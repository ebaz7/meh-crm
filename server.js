
import 'dotenv/config'; // Load environment variables
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

// *** CRASH PREVENTION HANDLERS ***
process.on('uncaughtException', (err) => {
    console.error('>>> CRITICAL ERROR (Uncaught Exception):', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('>>> CRITICAL ERROR (Unhandled Rejection):', reason instanceof Error ? reason.message : reason);
});

// --- IMPORT DEDICATED MODULES ---
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

// Ensure directories exist
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
            subscriptions: [] // Store Push Subscriptions
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.securityLogs) data.securityLogs = [];
    if (!data.personnelDelays) data.personnelDelays = [];
    if (!data.securityIncidents) data.securityIncidents = [];
    if (!data.subscriptions) data.subscriptions = [];
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
    console.log(">>> Web Push Initialized.");
};
initWebPush();

// --- PUSH NOTIFICATION HELPER ---
const broadcastPush = (title, body, url = '/') => {
    const db = getDb();
    const payload = JSON.stringify({ title, body, url });
    
    // Send to all subscriptions
    const subs = db.subscriptions || [];
    if (subs.length === 0) return;

    console.log(`>>> Broadcasting Push: "${title}" to ${subs.length} clients.`);

    subs.forEach((sub, index) => {
        webpush.sendNotification(sub, payload).catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription expired or invalid, remove it
                console.log(`>>> Removing expired subscription: ${index}`);
                db.subscriptions = db.subscriptions.filter(s => s.endpoint !== sub.endpoint);
                saveDb(db);
            } else {
                console.error(">>> Push Error:", err);
            }
        });
    });
};

// --- INITIALIZE BOTS ---
const db = getDb();
if (db.settings?.telegramBotToken) {
    try { initTelegram(db.settings.telegramBotToken); } catch (e) { console.error("Failed to init Telegram:", e.message); }
}
setTimeout(() => { try { initWhatsApp(WAUTH_DIR); } catch(e) { console.error("WA Startup Error:", e); } }, 3000);

// --- ROUTES ---

// NEW: Push Notification Routes
app.get('/api/vapid-key', (req, res) => {
    res.json({ publicKey: getDb().settings.vapidKeys.publicKey });
});

app.post('/api/subscribe', (req, res) => {
    const subscription = req.body;
    const db = getDb();
    
    // Check if exists
    const exists = db.subscriptions.find(s => s.endpoint === subscription.endpoint);
    if (!exists) {
        db.subscriptions.push(subscription);
        saveDb(db);
        console.log(">>> New Push Client Subscribed.");
    }
    res.json({ success: true });
});

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

app.post('/api/render-pdf', async (req, res) => {
    // ... (PDF logic same as before, omitted for brevity) ...
    // Note: Re-implement full PDF logic here if needed, or assume it persists from previous context.
    // For safety, I will implement a minimal version or keep existing if not requested to change.
    // To respect "minimal changes", I will rely on the existing PDF logic in the user's file unless I need to fix something.
    // Actually, I am overwriting server.js, so I MUST include the PDF logic again.
    try {
        const { html, landscape, format, width, height } = req.body;
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
        await page.emulateMediaType('print');
        
        const pdfOptions = { printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } };
        if (width && height) { pdfOptions.width = width; pdfOptions.height = height; pdfOptions.preferCSSPageSize = false; } 
        else if (format) { pdfOptions.format = format; pdfOptions.landscape = landscape || false; pdfOptions.preferCSSPageSize = false; } 
        else { pdfOptions.preferCSSPageSize = true; }

        const pdfBuffer = await page.pdf(pdfOptions);
        await browser.close();
        res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdfBuffer.length });
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ error: 'PDF Generation Failed' });
    }
});

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
    
    // Broadcast Push
    broadcastPush('دستور پرداخت جدید', `شماره: ${item.trackingNumber} | مبلغ: ${item.totalAmount.toLocaleString()} | ذینفع: ${item.payee}`);
    
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
        if (oldStatus !== newStatus) {
            broadcastPush('تغییر وضعیت پرداخت', `شماره: ${db.orders[idx].trackingNumber} | وضعیت جدید: ${newStatus}`);
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
    
    // Broadcast Push
    broadcastPush('درخواست خروج جدید', `شماره مجوز: ${item.permitNumber} | گیرنده: ${item.recipientName}`);

    res.json(db.exitPermits);
});
app.put('/api/exit-permits/:id', async (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(x => x.id === req.params.id);
    if(idx !== -1) {
        const oldStatus = db.exitPermits[idx].status;
        db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body, updatedAt: Date.now() };
        saveDb(db);
        
        const newStatus = db.exitPermits[idx].status;
        if (oldStatus !== newStatus) {
            broadcastPush('تغییر وضعیت خروج', `مجوز: ${db.exitPermits[idx].permitNumber} | وضعیت: ${newStatus}`);
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
        
        broadcastPush('صدور بیجک جدید', `بیجک شماره ${tx.number} برای ${tx.company} صادر شد.`);
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
    
    // Broadcast Chat Message
    broadcastPush(`پیام جدید از ${m.sender}`, m.message ? (m.message.length > 30 ? m.message.substring(0,30)+'...' : m.message) : 'فایل/صدا');
    
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
