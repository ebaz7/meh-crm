
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

// *** IMPORT NEW PUSH MODULE ***
import { initPushServer, getPublicKey, subscribeUser, sendPushNotification } from './backend/push/pushServer.js';

process.on('uncaughtException', (err) => { console.error('>>> CRITICAL ERROR (Uncaught Exception):', err.message); });
process.on('unhandledRejection', (reason, promise) => { console.error('>>> CRITICAL ERROR (Unhandled Rejection):', reason instanceof Error ? reason.message : reason); });

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

[UPLOADS_DIR, AI_UPLOADS_DIR, BACKUPS_DIR, WAUTH_DIR].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

const getDb = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initial = { 
            settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], bankNames: [], rolePermissions: {}, savedContacts: [], warehouseSequences: {}, vapidKeys: null }, 
            orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [], securityLogs: [], personnelDelays: [], securityIncidents: [],
            users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', canManageTrade: true }], 
            messages: [], groups: [], tasks: [], tradeRecords: [],
            subscriptions: [] // Ensure subscriptions exist
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.subscriptions) data.subscriptions = [];
    return data;
};
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
const findNextAvailableNumber = (arr, key, base) => { const startNum = base + 1; const existing = arr.map(o => o[key]).sort((a, b) => a - b); let next = startNum; for (const num of existing) { if (num === next) next++; else if (num > next) return next; } return next; };

// --- INITIALIZE SERVICES ---
const db = getDb();
if (db.settings?.telegramBotToken) try { initTelegram(db.settings.telegramBotToken); } catch (e) { console.error("Failed to init Telegram:", e.message); }
setTimeout(() => { try { initWhatsApp(WAUTH_DIR); } catch(e) { console.error("WA Startup Error:", e); } }, 3000);

// Initialize Push Server
initPushServer();

// --- PUSH NOTIFICATION ROUTES ---
app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: getPublicKey() });
});

app.post('/api/push/subscribe', (req, res) => {
    const { subscription, userId } = req.body;
    subscribeUser(subscription, userId);
    res.json({ success: true });
});

// --- HELPER TO FIND CHROME ---
const findChromePath = () => {
    const findExe = (dir) => { if (!fs.existsSync(dir)) return null; try { const files = fs.readdirSync(dir); for (const file of files) { const fullPath = path.join(dir, file); const stat = fs.statSync(fullPath); if (stat.isDirectory()) { const found = findExe(fullPath); if (found) return found; } else if (file === 'chrome.exe' || file === 'chrome') { return fullPath; } } } catch (e) { return null; } return null; };
    if (process.env.PUPPETEER_CACHE_DIR) { const exe = findExe(process.env.PUPPETEER_CACHE_DIR); if (exe) return exe; }
    return undefined;
};

// --- ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

app.post('/api/render-pdf', async (req, res) => {
    try {
        const { html, landscape, format, width, height } = req.body;
        const executablePath = findChromePath();
        const browser = await puppeteer.launch({ headless: true, executablePath: executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
        await page.emulateMediaType('print');
        const pdfOptions = { printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } };
        if (width && height) { pdfOptions.width = width; pdfOptions.height = height; pdfOptions.preferCSSPageSize = false; } else if (format) { pdfOptions.format = format; pdfOptions.landscape = landscape || false; pdfOptions.preferCSSPageSize = false; } else { pdfOptions.preferCSSPageSize = true; }
        const pdfBuffer = await page.pdf(pdfOptions);
        await browser.close();
        res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdfBuffer.length });
        res.send(pdfBuffer);
    } catch (error) { res.status(500).json({ error: 'Failed to generate PDF' }); }
});

app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = item.id || Date.now().toString();
    item.updatedAt = Date.now();
    item.trackingNumber = findNextAvailableNumber(db.orders, 'trackingNumber', db.settings.currentTrackingNumber || 1000);
    db.orders.unshift(item);
    saveDb(db);
    
    // PUSH: Notify Financial
    sendPushNotification({ type: 'ROLE', value: 'financial' }, { 
        title: 'دستور پرداخت جدید', 
        body: `شماره: ${item.trackingNumber} | مبلغ: ${item.totalAmount.toLocaleString()} | درخواست: ${item.requester}`,
        url: '/#manage'
    });

    res.json(db.orders);
});

app.put('/api/orders/:id', async (req, res) => {
    const db = getDb();
    const idx = db.orders.findIndex(x => x.id === req.params.id);
    if(idx !== -1) {
        const oldStatus = db.orders[idx].status;
        db.orders[idx] = { ...db.orders[idx], ...req.body, updatedAt: Date.now() };
        saveDb(db);
        
        // PUSH LOGIC
        const newStatus = db.orders[idx].status;
        const tracking = db.orders[idx].trackingNumber;
        const reqUser = db.orders[idx].requester;

        if (oldStatus !== newStatus) {
            if (newStatus.includes('مالی')) sendPushNotification({ type: 'ROLE', value: 'manager' }, { title: 'تایید مالی', body: `دستور ${tracking} منتظر تایید مدیریت`, url: '/#manage' });
            else if (newStatus.includes('مدیریت')) sendPushNotification({ type: 'ROLE', value: 'ceo' }, { title: 'تایید مدیریت', body: `دستور ${tracking} منتظر تایید نهایی`, url: '/#manage' });
            else if (newStatus.includes('نهایی')) {
                sendPushNotification({ type: 'ROLE', value: 'financial' }, { title: 'تایید نهایی', body: `دستور ${tracking} تایید شد. پرداخت کنید.`, url: '/#manage' });
                sendPushNotification({ type: 'USERNAME', value: reqUser }, { title: 'درخواست تایید شد', body: `دستور ${tracking} شما تایید نهایی شد.`, url: '/#manage' });
            }
            else if (newStatus === 'رد شده') {
                sendPushNotification({ type: 'USERNAME', value: reqUser }, { title: 'درخواست رد شد', body: `دستور ${tracking} رد شد.`, url: '/#manage' });
            }
        }
        res.json(db.orders);
    } else res.sendStatus(404);
});
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.orders); });
app.get('/api/next-tracking-number', (req, res) => res.json({ nextTrackingNumber: findNextAvailableNumber(getDb().orders, 'trackingNumber', getDb().settings.currentTrackingNumber || 1000) }));

app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits));
app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = item.id || Date.now().toString();
    item.updatedAt = Date.now();
    item.permitNumber = findNextAvailableNumber(db.exitPermits, 'permitNumber', db.settings.currentExitPermitNumber || 1000);
    db.exitPermits.push(item);
    saveDb(db);
    
    // PUSH: Notify CEO
    sendPushNotification({ type: 'ROLE', value: 'ceo' }, { title: 'درخواست خروج جدید', body: `مجوز شماره ${item.permitNumber} | گیرنده: ${item.recipientName}`, url: '/#manage-exit' });

    res.json(db.exitPermits);
});
app.put('/api/exit-permits/:id', async (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(x => x.id === req.params.id);
    if(idx !== -1) {
        const oldStatus = db.exitPermits[idx].status;
        db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body, updatedAt: Date.now() };
        saveDb(db);
        
        // PUSH logic for Exit Permits
        const newStatus = db.exitPermits[idx].status;
        const num = db.exitPermits[idx].permitNumber;
        if (oldStatus !== newStatus) {
             if (newStatus.includes('کارخانه')) sendPushNotification({ type: 'ROLE', value: 'factory_manager' }, { title: 'مجوز خروج تایید شد', body: `شماره ${num} منتظر تایید کارخانه`, url: '/#manage-exit' });
             else if (newStatus.includes('انبار')) sendPushNotification({ type: 'ROLE', value: 'warehouse_keeper' }, { title: 'مجوز خروج تایید شد', body: `شماره ${num} منتظر تایید انبار`, url: '/#manage-exit' });
             else if (newStatus.includes('انتظامات')) sendPushNotification({ type: 'ROLE', value: 'security_head' }, { title: 'مجوز خروج (نهایی)', body: `شماره ${num} آماده خروج`, url: '/#security' });
        }

        res.json(db.exitPermits);
    } else res.sendStatus(404);
});
app.delete('/api/exit-permits/:id', (req, res) => { const db = getDb(); db.exitPermits = db.exitPermits.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.exitPermits); });
app.get('/api/next-exit-permit-number', (req, res) => res.json({ nextNumber: findNextAvailableNumber(getDb().exitPermits, 'permitNumber', getDb().settings.currentExitPermitNumber || 1000) }));

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
        
        // PUSH: Notify CEO
        sendPushNotification({ type: 'ROLE', value: 'ceo' }, { title: 'صدور بیجک جدید', body: `شماره ${tx.number} برای ${tx.company} | گیرنده: ${tx.recipientName}`, url: '/#warehouse' });
    }
    db.warehouseTransactions.unshift(tx);
    saveDb(db);
    res.json(db.warehouseTransactions);
});
app.put('/api/warehouse/transactions/:id', async (req, res) => { const db = getDb(); const idx = db.warehouseTransactions.findIndex(x => x.id === req.params.id); if(idx !== -1) { db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body, updatedAt: Date.now() }; saveDb(db); res.json(db.warehouseTransactions); } else res.sendStatus(404); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { 
    const db = getDb(); 
    const m = req.body; 
    m.id = m.id || Date.now().toString(); 
    db.messages.push(m); 
    saveDb(db); 
    
    // PUSH: Notify Recipient
    if (m.recipient) {
        sendPushNotification({ type: 'USERNAME', value: m.recipient }, { 
            title: `پیام جدید از ${m.sender}`, 
            body: m.message ? (m.message.substring(0, 40) + '...') : 'فایل/صدا',
            url: '/#chat'
        });
    } else if (m.groupId) {
         const group = db.groups.find(g => g.id === m.groupId);
         if (group) {
             group.members.forEach(member => {
                 if (member !== m.senderUsername) {
                     sendPushNotification({ type: 'USERNAME', value: member }, { title: `پیام گروه ${group.name}`, body: `${m.sender}: ${m.message || '...'}` });
                 }
             });
         }
    }
    res.json(db.messages); 
});
app.put('/api/chat/:id', (req, res) => { const db = getDb(); const idx = db.messages.findIndex(m => m.id === req.params.id); if(idx!==-1) { db.messages[idx] = {...db.messages[idx], ...req.body}; saveDb(db); res.json(db.messages); } else res.sendStatus(404); });
app.delete('/api/chat/:id', (req, res) => { const db = getDb(); db.messages = db.messages.filter(m => m.id !== req.params.id); saveDb(db); res.json(db.messages); });

app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs));
app.post('/api/security/logs', (req, res) => { const db = getDb(); const item = req.body; item.id = item.id || Date.now().toString(); db.securityLogs.unshift(item); saveDb(db); res.json(db.securityLogs); });
app.put('/api/security/logs/:id', (req, res) => { const db = getDb(); const idx = db.securityLogs.findIndex(x => x.id === req.params.id); if (idx !== -1) { db.securityLogs[idx] = { ...db.securityLogs[idx], ...req.body }; saveDb(db); res.json(db.securityLogs); } else res.sendStatus(404); });
app.delete('/api/security/logs/:id', (req, res) => { const db = getDb(); db.securityLogs = db.securityLogs.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.securityLogs); });

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
['groups', 'tasks'].forEach(key => { app.get(`/api/${key}`, (req, res) => res.json(getDb()[key])); app.post(`/api/${key}`, (req, res) => { const db = getDb(); const i = req.body; i.id = i.id || Date.now().toString(); db[key].push(i); saveDb(db); res.json(db[key]); }); app.put(`/api/${key}/:id`, (req, res) => { const db = getDb(); const idx = db[key].findIndex(x => x.id === req.params.id); if(idx!==-1){ db[key][idx]={...db[key][idx],...req.body}; saveDb(db); res.json(db[key]); } else res.sendStatus(404); }); app.delete(`/api/${key}/:id`, (req, res) => { const db = getDb(); db[key] = db[key].filter(x => x.id !== req.params.id); saveDb(db); res.json(db[key]); }); });

app.get('/api/manifest', (req, res) => res.json({ "name": "PaySys", "short_name": "PaySys", "start_url": "/", "display": "standalone", "icons": [] }));
app.get('*', (req, res) => { const p = path.join(__dirname, 'dist', 'index.html'); if(fs.existsSync(p)) res.sendFile(p); else res.send('Build first'); });

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
