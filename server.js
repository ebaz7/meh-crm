
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import cron from 'node-cron';
import puppeteer from 'puppeteer'; 
import webpush from 'web-push'; // Import Web Push

process.on('uncaughtException', (err) => {
    console.error('>>> CRITICAL ERROR (Uncaught Exception):', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('>>> CRITICAL ERROR (Unhandled Rejection):', reason instanceof Error ? reason.message : reason);
});

import { initTelegram, sendDocument as sendTelegramDoc, sendMessage as sendTelegramMsg, notifyNewBijak } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, getGroups as getWhatsAppGroups } from './backend/whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_BUILD_ID = Date.now().toString();

const DB_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const AI_UPLOADS_DIR = path.join(__dirname, 'uploads', 'ai');
const BACKUPS_DIR = path.join(__dirname, 'backups');
const WAUTH_DIR = path.join(__dirname, 'wauth');

[UPLOADS_DIR, AI_UPLOADS_DIR, BACKUPS_DIR, WAUTH_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- DATABASE HELPER ---
const getDb = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initial = { 
            settings: { 
                currentTrackingNumber: 1000, 
                currentExitPermitNumber: 1000,
                companyNames: [], companies: [], bankNames: [], rolePermissions: {}, savedContacts: [], warehouseSequences: {},
                vapidKeys: null // Placeholder for VAPID
            }, 
            orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [],
            securityLogs: [], personnelDelays: [], securityIncidents: [],
            users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', canManageTrade: true }], 
            messages: [], groups: [], tasks: [], tradeRecords: [],
            subscriptions: [] // Store Push Subscriptions with User IDs
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.securityLogs) data.securityLogs = [];
    if (!data.personnelDelays) data.personnelDelays = [];
    if (!data.securityIncidents) data.securityIncidents = [];
    if (!data.subscriptions) data.subscriptions = []; // Ensure subscriptions array exists
    return data;
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const findNextAvailableNumber = (arr, key, base) => {
    const startNum = base + 1;
    const existing = arr.map(o => o[key]).sort((a, b) => a - b);
    let next = startNum;
    for (const num of existing) { if (num === next) next++; else if (num > next) return next; }
    return next;
};

// --- INITIALIZE WEB PUSH ---
const initWebPush = () => {
    const db = getDb();
    
    // Generate VAPID keys if they don't exist
    if (!db.settings.vapidKeys) {
        console.log(">>> Generating VAPID Keys for Web Push...");
        const keys = webpush.generateVAPIDKeys();
        db.settings.vapidKeys = keys;
        saveDb(db);
    }
    
    webpush.setVapidDetails(
        'mailto:admin@payment-system.local',
        db.settings.vapidKeys.publicKey,
        db.settings.vapidKeys.privateKey
    );
    console.log(">>> Web Push Initialized with Public Key.");
};
initWebPush();

// --- SMART PUSH NOTIFICATION HELPER ---
const sendPushToRole = (targetRole, title, body, url = '/') => {
    const db = getDb();
    // Find users with this role (or admin who sees everything)
    const targetUserIds = db.users
        .filter(u => u.role === targetRole || u.role === 'admin')
        .map(u => u.id);
    
    if (targetUserIds.length === 0) return;

    // Find subscriptions for these users
    const subs = db.subscriptions.filter(s => targetUserIds.includes(s.userId));
    
    if (subs.length === 0) return;
    
    const payload = JSON.stringify({ title, body, url });
    
    subs.forEach(sub => {
        webpush.sendNotification(sub.subscription, payload).catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                // Remove expired
                db.subscriptions = db.subscriptions.filter(s => s.endpoint !== sub.endpoint);
                saveDb(db);
            }
        });
    });
};

const sendPushToUser = (username, title, body, url = '/') => {
    const db = getDb();
    const user = db.users.find(u => u.username === username || u.fullName === username);
    if (!user) return;

    const subs = db.subscriptions.filter(s => s.userId === user.id);
    const payload = JSON.stringify({ title, body, url });

    subs.forEach(sub => {
        webpush.sendNotification(sub.subscription, payload).catch(err => {});
    });
};

// --- CHROME PATH FINDER ---
const findChromePath = () => {
    const findExe = (dir) => {
        if (!fs.existsSync(dir)) return null;
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    const found = findExe(fullPath);
                    if (found) return found;
                } else if (file === 'chrome.exe' || file === 'chrome') {
                    return fullPath;
                }
            }
        } catch (e) { return null; }
        return null;
    };
    // ... (Keep existing path logic or simplify)
    return undefined; // Simplified for this snippet
};

// --- ROUTES ---

// NEW: VAPID Key Route
app.get('/api/vapid-key', (req, res) => {
    res.json({ publicKey: getDb().settings.vapidKeys.publicKey });
});

// NEW: Subscribe Route
app.post('/api/subscribe', (req, res) => {
    const { subscription, userId } = req.body;
    if (!subscription || !userId) return res.status(400).json({ error: 'Missing data' });

    const db = getDb();
    
    // Remove existing subscription for this endpoint if it exists (update user mapping)
    db.subscriptions = db.subscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
    
    // Add new
    db.subscriptions.push({ userId, subscription, timestamp: Date.now() });
    saveDb(db);
    
    console.log(`>>> User ${userId} subscribed to Push Notifications.`);
    res.json({ success: true });
});

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

// ... (PDF Route kept as is) ...

// Orders
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = item.id || Date.now().toString();
    item.updatedAt = Date.now();
    const nextNum = findNextAvailableNumber(db.orders, 'trackingNumber', db.settings.currentTrackingNumber || 1000);
    item.trackingNumber = nextNum;
    db.orders.unshift(item);
    saveDb(db);
    
    // PUSH NOTIFICATION: To Financial Manager
    sendPushToRole('financial', 'دستور پرداخت جدید', `شماره: ${item.trackingNumber} | مبلغ: ${item.totalAmount.toLocaleString()} | درخواست: ${item.requester}`, '/#manage');
    
    res.json(db.orders);
});

app.put('/api/orders/:id', async (req, res) => {
    const db = getDb();
    const idx = db.orders.findIndex(x => x.id === req.params.id);
    if(idx !== -1) {
        const oldStatus = db.orders[idx].status;
        db.orders[idx] = { ...db.orders[idx], ...req.body, updatedAt: Date.now() };
        saveDb(db);
        
        const newStatus = db.orders[idx].status;
        const tracking = db.orders[idx].trackingNumber;
        const requester = db.orders[idx].requester;

        // PUSH NOTIFICATION LOGIC
        if (oldStatus !== newStatus) {
            if (newStatus === 'تایید مالی / در انتظار مدیریت') {
                sendPushToRole('manager', 'تایید مالی شد', `دستور پرداخت ${tracking} منتظر تایید شماست.`, '/#manage');
            } else if (newStatus === 'تایید مدیریت / در انتظار مدیرعامل') {
                sendPushToRole('ceo', 'تایید مدیریت شد', `دستور پرداخت ${tracking} منتظر تایید نهایی شماست.`, '/#dashboard');
            } else if (newStatus === 'تایید نهایی') {
                sendPushToRole('financial', 'مجوز پرداخت صادر شد', `دستور ${tracking} تایید نهایی شد. لطفا پرداخت کنید.`, '/#manage');
                sendPushToUser(requester, 'درخواست تایید شد', `دستور پرداخت ${tracking} شما تایید نهایی شد.`, '/#dashboard');
            } else if (newStatus === 'رد شده') {
                sendPushToUser(requester, 'درخواست رد شد', `دستور پرداخت ${tracking} رد شد.`, '/#dashboard');
            }
        }

        res.json(db.orders);
    } else res.sendStatus(404);
});
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.orders); });
app.get('/api/next-tracking-number', (req, res) => res.json({ nextTrackingNumber: findNextAvailableNumber(getDb().orders, 'trackingNumber', getDb().settings.currentTrackingNumber || 1000) }));

// Exit Permits
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits));
app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = item.id || Date.now().toString();
    item.updatedAt = Date.now();
    const nextNum = findNextAvailableNumber(db.exitPermits, 'permitNumber', db.settings.currentExitPermitNumber || 1000);
    item.permitNumber = nextNum;
    db.exitPermits.push(item);
    saveDb(db);
    
    // PUSH: To CEO
    sendPushToRole('ceo', 'درخواست خروج بار', `شماره: ${item.permitNumber} | گیرنده: ${item.recipientName}`, '/#manage-exit');

    res.json(db.exitPermits);
});
app.put('/api/exit-permits/:id', async (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(x => x.id === req.params.id);
    if(idx !== -1) {
        const oldStatus = db.exitPermits[idx].status;
        db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body, updatedAt: Date.now() };
        saveDb(db);
        
        // PUSH LOGIC
        const newStatus = db.exitPermits[idx].status;
        const num = db.exitPermits[idx].permitNumber;
        
        if (oldStatus !== newStatus) {
            if (newStatus.includes('مدیر کارخانه')) {
                sendPushToRole('factory_manager', 'مجوز خروج تایید شد', `مجوز ${num} تایید مدیرعامل شد.`, '/#manage-exit');
            } else if (newStatus.includes('انبار')) {
                sendPushToRole('warehouse_keeper', 'مجوز خروج تایید شد', `مجوز ${num} به انبار رسید.`, '/#warehouse');
            } else if (newStatus.includes('انتظامات')) {
                sendPushToRole('security_head', 'مجوز خروج تایید شد', `مجوز ${num} آماده خروج است.`, '/#security');
            }
        }
        
        res.json(db.exitPermits);
    } else res.sendStatus(404);
});
app.delete('/api/exit-permits/:id', (req, res) => { const db = getDb(); db.exitPermits = db.exitPermits.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.exitPermits); });
app.get('/api/next-exit-permit-number', (req, res) => res.json({ nextNumber: findNextAvailableNumber(getDb().exitPermits, 'permitNumber', getDb().settings.currentExitPermitNumber || 1000) }));

// Warehouse
app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems));
app.post('/api/warehouse/items', (req, res) => { const db = getDb(); const item = req.body; item.id = item.id || Date.now().toString(); db.warehouseItems.push(item); saveDb(db); res.json(db.warehouseItems); });
app.put('/api/warehouse/items/:id', (req, res) => { const db = getDb(); const idx = db.warehouseItems.findIndex(x => x.id === req.params.id); if(idx !== -1) { db.warehouseItems[idx] = { ...db.warehouseItems[idx], ...req.body }; saveDb(db); res.json(db.warehouseItems); } else res.sendStatus(404); });
app.delete('/api/warehouse/items/:id', (req, res) => { const db = getDb(); db.warehouseItems = db.warehouseItems.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.warehouseItems); });

app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions));
app.post('/api/warehouse/transactions', async (req, res) => {
    const db = getDb();
    const tx = req.body;
    tx.updatedAt = Date.now();
    if (tx.type === 'OUT') {
        const companyName = tx.company;
        const currentBase = db.settings.warehouseSequences?.[companyName] || 1000;
        const companyTransactions = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.company === companyName);
        const nextSeq = findNextAvailableNumber(companyTransactions, 'number', currentBase);
        if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
        db.settings.warehouseSequences[companyName] = nextSeq;
        tx.number = nextSeq;
        tx.status = 'PENDING';
        
        // PUSH: Notify CEO of new Bijak
        sendPushToRole('ceo', 'صدور بیجک جدید', `بیجک ${tx.number} برای ${tx.company} صادر شد.`, '/#approvals');
    }
    db.warehouseTransactions.unshift(tx);
    saveDb(db);
    res.json(db.warehouseTransactions);
});
app.put('/api/warehouse/transactions/:id', async (req, res) => { const db = getDb(); const idx = db.warehouseTransactions.findIndex(x => x.id === req.params.id); if(idx !== -1) { db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body, updatedAt: Date.now() }; saveDb(db); res.json(db.warehouseTransactions); } else res.sendStatus(404); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

// Chat
app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { 
    const db = getDb(); 
    const m = req.body; 
    m.id = m.id || Date.now().toString(); 
    db.messages.push(m); 
    saveDb(db); 
    
    // PUSH: Chat Notifications
    const title = `پیام جدید از ${m.sender}`;
    const body = m.message ? (m.message.length > 40 ? m.message.substring(0,40)+'...' : m.message) : 'فایل/صدا';
    
    if (m.recipient) {
        // Private Message
        sendPushToUser(m.recipient, title, body, '/#chat');
    } else if (m.groupId) {
        // Group Message: Find members
        const group = db.groups.find(g => g.id === m.groupId);
        if (group && group.members) {
            group.members.forEach(member => {
                if (member !== m.senderUsername) {
                    sendPushToUser(member, `${title} (گروه ${group.name})`, body, '/#chat');
                }
            });
        }
    } else {
        // Public Message: Notify everyone except sender
        db.users.forEach(u => {
            if (u.username !== m.senderUsername) {
                sendPushToUser(u.username, `${title} (عمومی)`, body, '/#chat');
            }
        });
    }
    
    res.json(db.messages); 
});
app.put('/api/chat/:id', (req, res) => { const db = getDb(); const idx = db.messages.findIndex(m => m.id === req.params.id); if(idx!==-1) { db.messages[idx] = {...db.messages[idx], ...req.body}; saveDb(db); res.json(db.messages); } else res.sendStatus(404); });
app.delete('/api/chat/:id', (req, res) => { const db = getDb(); db.messages = db.messages.filter(m => m.id !== req.params.id); saveDb(db); res.json(db.messages); });

// Security
app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs));
app.post('/api/security/logs', (req, res) => { const db = getDb(); const item = req.body; item.id = item.id || Date.now().toString(); db.securityLogs.unshift(item); saveDb(db); res.json(db.securityLogs); });
app.put('/api/security/logs/:id', (req, res) => { const db = getDb(); const idx = db.securityLogs.findIndex(x => x.id === req.params.id); if (idx !== -1) { db.securityLogs[idx] = { ...db.securityLogs[idx], ...req.body }; saveDb(db); res.json(db.securityLogs); } else res.sendStatus(404); });
app.delete('/api/security/logs/:id', (req, res) => { const db = getDb(); db.securityLogs = db.securityLogs.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.securityLogs); });

// Misc
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); const u = req.body; u.id = u.id || Date.now().toString(); db.users.push(u); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db = getDb(); const idx = db.users.findIndex(x => x.id === req.params.id); if(idx!==-1) { db.users[idx] = { ...db.users[idx], ...req.body }; saveDb(db); res.json(db.users); } else res.sendStatus(404); });
app.delete('/api/users/:id', (req, res) => { const db = getDb(); db.users = db.users.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.users); });
app.post('/api/login', (req, res) => { const u = getDb().users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = req.body; saveDb(db); if (req.body.telegramBotToken) initTelegram(req.body.telegramBotToken); res.json(db.settings); });
app.post('/api/upload', (req, res) => { try { const { fileName, fileData } = req.body; const n = Date.now() + '_' + fileName; fs.writeFileSync(path.join(UPLOADS_DIR, n), Buffer.from(fileData.split(',')[1], 'base64')); res.json({ url: `/uploads/${n}`, fileName: n }); } catch (e) { res.status(500).send('Err'); } });
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords));
app.post('/api/trade', (req, res) => { const db = getDb(); const t = req.body; t.id = t.id || Date.now().toString(); db.tradeRecords.push(t); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(x => x.id === req.params.id); if(idx!==-1){ db.tradeRecords[idx] = {...db.tradeRecords[idx], ...req.body}; saveDb(db); res.json(db.tradeRecords); } else res.sendStatus(404); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });
app.get('/api/groups', (req, res) => res.json(getDb().groups));
app.post('/api/groups', (req, res) => { const db = getDb(); const i = req.body; i.id = i.id || Date.now().toString(); db.groups.push(i); saveDb(db); res.json(db.groups); });
app.put('/api/groups/:id', (req, res) => { const db = getDb(); const idx = db.groups.findIndex(x => x.id === req.params.id); if(idx!==-1){ db.groups[idx]={...db.groups[idx],...req.body}; saveDb(db); res.json(db.groups); } else res.sendStatus(404); });
app.delete('/api/groups/:id', (req, res) => { const db = getDb(); db.groups = db.groups.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.groups); });
app.get('/api/tasks', (req, res) => res.json(getDb().tasks));
app.post('/api/tasks', (req, res) => { const db = getDb(); const i = req.body; i.id = i.id || Date.now().toString(); db.tasks.push(i); saveDb(db); res.json(db.tasks); });
app.put('/api/tasks/:id', (req, res) => { const db = getDb(); const idx = db.tasks.findIndex(x => x.id === req.params.id); if(idx!==-1){ db.tasks[idx]={...db.tasks[idx],...req.body}; saveDb(db); res.json(db.tasks); } else res.sendStatus(404); });
app.delete('/api/tasks/:id', (req, res) => { const db = getDb(); db.tasks = db.tasks.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.tasks); });

app.get('/api/manifest', (req, res) => res.json({ "name": "PaySys", "short_name": "PaySys", "start_url": "/", "display": "standalone", "icons": [] }));
app.get('*', (req, res) => { const p = path.join(__dirname, 'dist', 'index.html'); if(fs.existsSync(p)) res.sendFile(p); else res.send('Build first'); });

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
