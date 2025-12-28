
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
import puppeteer from 'puppeteer'; // Ensure puppeteer is imported

// *** CRASH PREVENTION HANDLERS (MUST BE AT THE VERY TOP) ***
process.on('uncaughtException', (err) => {
    console.error('>>> CRITICAL ERROR (Uncaught Exception):', err.message);
    // Prevent process exit
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('>>> CRITICAL ERROR (Unhandled Rejection):', reason instanceof Error ? reason.message : reason);
    // Prevent process exit
});

// --- IMPORT DEDICATED MODULES ---
import { initTelegram, sendDocument as sendTelegramDoc, sendMessage as sendTelegramMsg, notifyNewBijak } from './backend/telegram.js';
import { initWhatsApp, sendMessage as sendWhatsAppMessage, getStatus as getWhatsAppStatus, logout as logoutWhatsApp, getGroups as getWhatsAppGroups } from './backend/whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Priority: Argument passed -> .env file -> Default 3000
const PORT = process.env.PORT || 3000;

// SERVER BUILD ID (For Client Updates)
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
// Increased limit for PDF HTML content
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
                companyNames: [], companies: [], bankNames: [], rolePermissions: {}, savedContacts: [], warehouseSequences: {}
            }, 
            orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [],
            // Initialize security arrays
            securityLogs: [], personnelDelays: [], securityIncidents: [],
            users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', canManageTrade: true }], 
            messages: [], groups: [], tasks: [], tradeRecords: [] 
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // Migration: ensure security arrays exist
    if (!data.securityLogs) data.securityLogs = [];
    if (!data.personnelDelays) data.personnelDelays = [];
    if (!data.securityIncidents) data.securityIncidents = [];
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

// --- INITIALIZE BOTS ---
const db = getDb();

// 1. Telegram
if (db.settings?.telegramBotToken) {
    try {
        initTelegram(db.settings.telegramBotToken);
    } catch (e) {
        console.error("Failed to init Telegram:", e.message);
    }
}

// 2. WhatsApp
setTimeout(() => {
    try {
        initWhatsApp(WAUTH_DIR);
    } catch(e) {
        console.error("WA Startup Error:", e);
    }
}, 3000);


// --- SMART NOTIFICATION LOGIC ---

// Find a user phone by role
const findUserPhoneByRole = (db, role) => {
    const user = db.users.find(u => u.role === role && u.phoneNumber);
    return user ? user.phoneNumber : null;
};

// Find user phone by name
const findUserPhoneByName = (db, fullName) => {
    const user = db.users.find(u => u.fullName === fullName && u.phoneNumber);
    return user ? user.phoneNumber : null;
};

const sendSmartNotification = async (targetNumber, message) => {
    if (!targetNumber) {
        console.log(">>> Notification Skipped: No target number provided.");
        return;
    }
    try {
        console.log(`>>> Sending Smart Notification to ${targetNumber}`);
        await sendWhatsAppMessage(targetNumber, message);
    } catch (e) {
        console.error(">>> Notification Failed:", e.message);
    }
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
};

// --- CHROME PATH FINDER (ROBUST FIX) ---
const findChromePath = () => {
    // Helper to recursively find chrome.exe
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

    const pathsToCheck = [];

    // 1. Environment Variable (Injected by Service)
    if (process.env.PUPPETEER_CACHE_DIR) {
        pathsToCheck.push(process.env.PUPPETEER_CACHE_DIR);
    }

    // 2. Local Project Cache (Explicit)
    pathsToCheck.push(path.join(__dirname, '.cache', 'puppeteer'));
    
    // 3. Current Working Directory Cache
    pathsToCheck.push(path.join(process.cwd(), '.cache', 'puppeteer'));

    console.log(">>> Searching for Chrome in locations:", pathsToCheck);

    for (const cachePath of pathsToCheck) {
        const exe = findExe(cachePath);
        if (exe) {
            console.log(">>> Found Local Chrome at:", exe);
            return exe;
        }
    }

    // 4. System Paths (Fallback)
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    
    const systemPaths = [
        path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe')
    ];

    for (const sysPath of systemPaths) {
        if (fs.existsSync(sysPath)) {
            console.log(">>> Using System Browser:", sysPath);
            return sysPath;
        }
    }

    console.warn(">>> CRITICAL WARNING: Could not find any Chrome/Edge executable. PDF Generation will likely fail.");
    return undefined;
};

// --- ROUTES ---

// NEW: Version Check
app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

// --- NEW: PDF GENERATION ENDPOINT ---
app.post('/api/render-pdf', async (req, res) => {
    try {
        const { html, landscape, format, width, height } = req.body;
        
        // RESOLVE EXECUTABLE PATH
        const executablePath = findChromePath();

        // Launch Puppeteer with explicit path
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath, // <--- CRITICAL FIX
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process'
            ]
        });
        
        const page = await browser.newPage();
        
        await page.setContent(html, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });

        // Optional: Wait for fonts
        try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}

        // Hard wait to ensure styles apply
        await new Promise(r => setTimeout(r, 1000));
        
        await page.emulateMediaType('print');
        
        const pdfOptions = {
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
            preferCSSPageSize: true // This is crucial for Smart Detection
        };

        if (width && height) {
            // Explicit dimensions provided (e.g. Bank Forms)
            pdfOptions.width = width;
            pdfOptions.height = height;
        } else if (format) {
            // Explicit format provided (e.g. A4)
            pdfOptions.format = format;
            pdfOptions.landscape = landscape || false;
        } 
        // If neither, preferCSSPageSize handles it based on @page CSS rules

        const pdfBuffer = await page.pdf(pdfOptions);

        await browser.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length
        });
        
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        const errorDetails = error.message.includes('Could not find Chrome') 
            ? 'مرورگر کروم پیدا نشد. لطفا دستور npm run fix-browser را اجرا کنید تا مرورگر در پوشه پروژه دانلود شود.'
            : error.message;
            
        res.status(500).json({ error: 'Failed to generate PDF on server', details: errorDetails });
    }
});

// 1. Order Routes
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = item.id || Date.now().toString();
    item.updatedAt = Date.now();
    
    // Auto Numbering
    const nextNum = findNextAvailableNumber(db.orders, 'trackingNumber', db.settings.currentTrackingNumber || 1000);
    item.trackingNumber = nextNum;
    
    db.orders.unshift(item);
    saveDb(db);

    // Notify Financial Manager (New Request)
    const finPhone = findUserPhoneByRole(db, 'financial');
    if (finPhone) {
        const msg = `📢 *درخواست پرداخت جدید*\nشماره: ${item.trackingNumber}\nمبلغ: ${formatCurrency(item.totalAmount)}\nدرخواست کننده: ${item.requester}\n\nلطفا جهت بررسی به سیستم مراجعه کنید.`;
        sendSmartNotification(finPhone, msg);
    }

    res.json(db.orders);
});

app.put('/api/orders/:id', async (req, res) => {
    const db = getDb();
    const idx = db.orders.findIndex(x => x.id === req.params.id);
    if(idx !== -1) {
        const oldStatus = db.orders[idx].status;
        db.orders[idx] = { ...db.orders[idx], ...req.body, updatedAt: Date.now() };
        saveDb(db);
        
        const newOrder = db.orders[idx];
        const newStatus = newOrder.status;

        // --- SMART NOTIFICATION LOGIC FOR ORDERS ---
        if (oldStatus !== newStatus) {
            try {
                let targetPhone = null;
                let msg = '';

                // --- NORMAL WORKFLOW ---
                if (newStatus === 'تایید مالی / در انتظار مدیریت') {
                    targetPhone = findUserPhoneByRole(db, 'manager'); 
                    msg = `✅ *تایید مالی انجام شد*\nدستور پرداخت: ${newOrder.trackingNumber}\nمبلغ: ${formatCurrency(newOrder.totalAmount)}\n\nمنتظر تایید مدیریت.`;
                }
                else if (newStatus === 'تایید مدیریت / در انتظار مدیرعامل') {
                    targetPhone = findUserPhoneByRole(db, 'ceo') || db.settings?.defaultSalesManager; 
                    msg = `✅ *تایید مدیریت انجام شد*\nدستور پرداخت: ${newOrder.trackingNumber}\nمبلغ: ${formatCurrency(newOrder.totalAmount)}\nذی‌نفع: ${newOrder.payee}\n\nمنتظر تایید نهایی مدیرعامل.`;
                }
                else if (newStatus === 'تایید نهایی') {
                    // Notify Requester
                    const reqPhone = findUserPhoneByName(db, newOrder.requester);
                    if (reqPhone) {
                        sendSmartNotification(reqPhone, `🎉 *درخواست شما تایید نهایی شد*\nشماره: ${newOrder.trackingNumber}\nمبلغ: ${formatCurrency(newOrder.totalAmount)}`);
                    }
                    // Notify Finance to pay
                    targetPhone = findUserPhoneByRole(db, 'financial');
                    msg = `💰 *دستور پرداخت تایید نهایی شد*\nشماره: ${newOrder.trackingNumber}\nمبلغ: ${formatCurrency(newOrder.totalAmount)}\n\nلطفا نسبت به پرداخت اقدام نمایید.`;
                }
                else if (newStatus === 'رد شده') {
                    targetPhone = findUserPhoneByName(db, newOrder.requester);
                    msg = `⛔ *درخواست پرداخت رد شد*\nشماره: ${newOrder.trackingNumber}\nدلیل: ${newOrder.rejectionReason || 'نامشخص'}`;
                }
                
                // --- REVOCATION WORKFLOW ---
                else if (newStatus === 'درخواست ابطال / منتظر تایید مالی') {
                     targetPhone = findUserPhoneByRole(db, 'financial');
                     msg = `⚠️ *درخواست ابطال دستور پرداخت*\nشماره: ${newOrder.trackingNumber}\nمبلغ: ${formatCurrency(newOrder.totalAmount)}\n\nاین دستور جهت ابطال به کارتابل شما ارسال شد. لطفا بررسی نمایید.`;
                }
                else if (newStatus === 'تایید ابطال مالی / منتظر مدیریت') {
                     targetPhone = findUserPhoneByRole(db, 'manager');
                     msg = `⚠️ *تایید اولیه ابطال (مالی)*\nشماره: ${newOrder.trackingNumber}\n\nمدیر مالی درخواست ابطال را تایید کرد. منتظر تایید مدیریت.`;
                }
                else if (newStatus === 'تایید ابطال مدیریت / منتظر مدیرعامل') {
                     targetPhone = findUserPhoneByRole(db, 'ceo');
                     msg = `⚠️ *تایید ثانویه ابطال (مدیریت)*\nشماره: ${newOrder.trackingNumber}\n\nمدیریت درخواست ابطال را تایید کرد. منتظر تایید نهایی مدیرعامل جهت بایگانی باطل شده.`;
                }
                else if (newStatus === 'باطل شده (نهایی)') {
                     // Notify Finance & Requester
                     const reqPhone = findUserPhoneByName(db, newOrder.requester);
                     if (reqPhone) sendSmartNotification(reqPhone, `❌ *دستور پرداخت باطل شد*\nشماره: ${newOrder.trackingNumber}\nوضعیت: بایگانی باطل شده`);
                     
                     targetPhone = findUserPhoneByRole(db, 'financial');
                     msg = `❌ *دستور پرداخت باطل شد (نهایی)*\nشماره: ${newOrder.trackingNumber}\n\nتوسط مدیرعامل تایید و بایگانی شد.`;
                }

                if (targetPhone) {
                    await sendSmartNotification(targetPhone, msg);
                }
            } catch (e) {
                console.error("Auto Notification Error:", e);
            }
        }

        res.json(db.orders);
    } else {
        res.sendStatus(404);
    }
});
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.orders); });
app.get('/api/next-tracking-number', (req, res) => res.json({ nextTrackingNumber: findNextAvailableNumber(getDb().orders, 'trackingNumber', getDb().settings.currentTrackingNumber || 1000) }));


// 2. Exit Permit Routes
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

    // Notify CEO (New Exit Request)
    const ceoPhone = findUserPhoneByRole(db, 'ceo');
    if (ceoPhone) {
        const msg = `🚛 *درخواست خروج بار جدید*\nشماره: ${item.permitNumber}\nمقصد: ${item.recipientName || 'چند مقصد'}\n\nمنتظر تایید شما.`;
        sendSmartNotification(ceoPhone, msg);
    }

    res.json(db.exitPermits);
});

app.put('/api/exit-permits/:id', async (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(x => x.id === req.params.id);
    if(idx !== -1) {
        const oldStatus = db.exitPermits[idx].status;
        db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body, updatedAt: Date.now() };
        saveDb(db);

        const newPermit = db.exitPermits[idx];
        const newStatus = newPermit.status;

        // --- SMART NOTIFICATION FOR EXIT PERMITS ---
        if (oldStatus !== newStatus) {
            let targetPhone = null;
            let msg = '';

            // CEO Approved -> Notify Factory Manager
            if (newStatus === 'تایید مدیرعامل / در انتظار مدیر کارخانه') {
                targetPhone = findUserPhoneByRole(db, 'factory_manager');
                msg = `🏭 *مجوز خروج تایید شد*\nشماره: ${newPermit.permitNumber}\nراننده: ${newPermit.driverName || '-'}\nپلاک: ${newPermit.plateNumber || '-'}\n\nمجاز به بررسی توسط مدیر کارخانه.`;
            }
            // Exited -> Notify Sales Manager / Requester
            else if (newStatus === 'خارج شده (بایگانی)') {
                targetPhone = findUserPhoneByName(db, newPermit.requester);
                msg = `✅ *بار خارج شد*\nمجوز شماره: ${newPermit.permitNumber}\nوضعیت: خروج از کارخانه ثبت شد.`;
            }

            if (targetPhone) {
                sendSmartNotification(targetPhone, msg);
            }
        }

        res.json(db.exitPermits);
    } else res.sendStatus(404);
});
app.delete('/api/exit-permits/:id', (req, res) => { const db = getDb(); db.exitPermits = db.exitPermits.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.exitPermits); });
app.get('/api/next-exit-permit-number', (req, res) => res.json({ nextNumber: findNextAvailableNumber(getDb().exitPermits, 'permitNumber', getDb().settings.currentExitPermitNumber || 1000) }));


// 3. Warehouse Routes
app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems));
app.post('/api/warehouse/items', (req, res) => { const db = getDb(); const item = req.body; item.id = item.id || Date.now().toString(); db.warehouseItems.push(item); saveDb(db); res.json(db.warehouseItems); });
app.put('/api/warehouse/items/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.warehouseItems.findIndex(x => x.id === req.params.id); 
    if(idx !== -1) { 
        db.warehouseItems[idx] = { ...db.warehouseItems[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.warehouseItems); 
    } else res.sendStatus(404); 
});
app.delete('/api/warehouse/items/:id', (req, res) => { const db = getDb(); db.warehouseItems = db.warehouseItems.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.warehouseItems); });

app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions));
app.post('/api/warehouse/transactions', async (req, res) => {
    const db = getDb();
    const tx = req.body;
    tx.updatedAt = Date.now();
    
    // Bijak Numbering logic (Unique per Company)
    if (tx.type === 'OUT') {
        const companyName = tx.company;
        const currentBase = db.settings.warehouseSequences?.[companyName] || 1000;
        
        // Find existing transactions for this company to determine strictly next number
        // We use 'findNextAvailableNumber' but scoped to this company
        const companyTransactions = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.company === companyName);
        const nextSeq = findNextAvailableNumber(companyTransactions, 'number', currentBase);
        
        // Check for duplicates just in case (though findNext should avoid it)
        const exists = companyTransactions.find(t => t.number === nextSeq);
        if (exists) {
            // Should not happen with findNextAvailableNumber logic, but failsafe
            return res.status(409).json({ error: "خطا در تولید شماره بیجک. شماره تکراری است." });
        }

        // Update settings sequence
        if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
        db.settings.warehouseSequences[companyName] = nextSeq;
        
        tx.number = nextSeq;
        tx.status = 'PENDING';
        
        // Notify CEO via Telegram
        notifyNewBijak(tx);
    }
    
    db.warehouseTransactions.unshift(tx);
    saveDb(db);

    res.json(db.warehouseTransactions);
});

app.put('/api/warehouse/transactions/:id', async (req, res) => { 
    const db = getDb(); 
    const idx = db.warehouseTransactions.findIndex(x => x.id === req.params.id); 
    if(idx !== -1) {
        // Validation: If it's a Bijak and number is changed, ensure uniqueness per company
        if (req.body.type === 'OUT' && req.body.number && req.body.number !== db.warehouseTransactions[idx].number) {
            const newNumber = Number(req.body.number);
            const companyName = req.body.company || db.warehouseTransactions[idx].company;
            
            const duplicate = db.warehouseTransactions.find(t => 
                t.type === 'OUT' && 
                t.company === companyName && 
                t.number === newNumber && 
                t.id !== req.params.id
            );

            if (duplicate) {
                return res.status(409).json({ error: `شماره بیجک ${newNumber} برای شرکت ${companyName} تکراری است.` });
            }
        }

        db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body, updatedAt: Date.now() }; 
        saveDb(db); 
        res.json(db.warehouseTransactions); 
    } else {
        res.sendStatus(404); 
    }
});
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

// --- 4. SECURITY MODULE ROUTES ---

// Logs
app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs));
app.post('/api/security/logs', (req, res) => { const db = getDb(); const item = req.body; item.id = item.id || Date.now().toString(); db.securityLogs.unshift(item); saveDb(db); res.json(db.securityLogs); });
app.put('/api/security/logs/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.securityLogs.findIndex(x => x.id === req.params.id); 
    if (idx !== -1) { db.securityLogs[idx] = { ...db.securityLogs[idx], ...req.body }; saveDb(db); res.json(db.securityLogs); } else res.sendStatus(404); 
});
app.delete('/api/security/logs/:id', (req, res) => { const db = getDb(); db.securityLogs = db.securityLogs.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.securityLogs); });

// Delays
app.get('/api/security/delays', (req, res) => res.json(getDb().personnelDelays));
app.post('/api/security/delays', (req, res) => { const db = getDb(); const item = req.body; item.id = item.id || Date.now().toString(); db.personnelDelays.unshift(item); saveDb(db); res.json(db.personnelDelays); });
app.put('/api/security/delays/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.personnelDelays.findIndex(x => x.id === req.params.id); 
    if (idx !== -1) { db.personnelDelays[idx] = { ...db.personnelDelays[idx], ...req.body }; saveDb(db); res.json(db.personnelDelays); } else res.sendStatus(404); 
});
app.delete('/api/security/delays/:id', (req, res) => { const db = getDb(); db.personnelDelays = db.personnelDelays.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.personnelDelays); });

// Incidents
app.get('/api/security/incidents', (req, res) => res.json(getDb().securityIncidents));
app.post('/api/security/incidents', (req, res) => { const db = getDb(); const item = req.body; item.id = item.id || Date.now().toString(); db.securityIncidents.unshift(item); saveDb(db); res.json(db.securityIncidents); });
app.put('/api/security/incidents/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.securityIncidents.findIndex(x => x.id === req.params.id); 
    if (idx !== -1) { db.securityIncidents[idx] = { ...db.securityIncidents[idx], ...req.body }; saveDb(db); res.json(db.securityIncidents); } else res.sendStatus(404); 
});
app.delete('/api/security/incidents/:id', (req, res) => { const db = getDb(); db.securityIncidents = db.securityIncidents.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.securityIncidents); });


// Other Standard Routes
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); const u = req.body; u.id = u.id || Date.now().toString(); db.users.push(u); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db = getDb(); const idx = db.users.findIndex(x => x.id === req.params.id); if(idx!==-1) { db.users[idx] = { ...db.users[idx], ...req.body }; saveDb(db); res.json(db.users); } else res.sendStatus(404); });
app.delete('/api/users/:id', (req, res) => { const db = getDb(); db.users = db.users.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.users); });
app.post('/api/login', (req, res) => { const u = getDb().users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = req.body; 
    saveDb(db); 
    if (req.body.telegramBotToken) initTelegram(req.body.telegramBotToken);
    res.json(db.settings); 
});

app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { const db = getDb(); const m = req.body; m.id = m.id || Date.now().toString(); db.messages.push(m); saveDb(db); res.json(db.messages); });
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords));
app.post('/api/trade', (req, res) => { const db = getDb(); const t = req.body; t.id = t.id || Date.now().toString(); db.tradeRecords.push(t); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(x => x.id === req.params.id); if(idx!==-1){ db.tradeRecords[idx] = {...db.tradeRecords[idx], ...req.body}; saveDb(db); res.json(db.tradeRecords); } else res.sendStatus(404); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(x => x.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

// Standard Group/Task routes
['groups', 'tasks'].forEach(key => {
    app.get(`/api/${key}`, (req, res) => res.json(getDb()[key]));
    app.post(`/api/${key}`, (req, res) => { const db = getDb(); const i = req.body; i.id = i.id || Date.now().toString(); db[key].push(i); saveDb(db); res.json(db[key]); });
    app.put(`/api/${key}/:id`, (req, res) => { const db = getDb(); const idx = db[key].findIndex(x => x.id === req.params.id); if(idx!==-1){ db[key][idx]={...db[key][idx],...req.body}; saveDb(db); res.json(db[key]); } else res.sendStatus(404); });
    app.delete(`/api/${key}/:id`, (req, res) => { const db = getDb(); db[key] = db[key].filter(x => x.id !== req.params.id); saveDb(db); res.json(db[key]); });
});

// WhatsApp & AI Routes
app.post('/api/send-whatsapp', async (req, res) => { 
    try {
        const { number, message, mediaData } = req.body;
        await sendWhatsAppMessage(number, message, mediaData);
        res.json({ success: true });
    } catch (e) {
        res.status(503).json({ success: false, message: e.message });
    }
});
app.get('/api/whatsapp/status', (req, res) => res.json(getWhatsAppStatus()));
app.post('/api/whatsapp/logout', async (req, res) => { await logoutWhatsApp(); res.json({success:true}); });
app.get('/api/whatsapp/groups', async (req, res) => { 
    try {
        const groups = await getWhatsAppGroups();
        res.json({ success: true, groups });
    } catch(e) {
        res.status(503).json({ success: false });
    }
});

// --- GEMINI AI ROUTE ---
app.post('/api/ai-request', async (req, res) => { 
    try { 
        const { message, audio, mimeType, username } = req.body;
        const db = getDb();
        const apiKey = db.settings?.geminiApiKey;

        if (!apiKey) return res.json({ reply: "کلید هوش مصنوعی تنظیم نشده است." });

        const ai = new GoogleGenAI({ apiKey });
        
        let parts = [];
        if (audio) {
            const buffer = Buffer.from(audio, 'base64');
            const ext = mimeType?.includes('mp4') ? 'm4a' : 'webm';
            const filename = `ai_voice_${Date.now()}_${username}.${ext}`;
            const filepath = path.join(AI_UPLOADS_DIR, filename);
            fs.writeFileSync(filepath, buffer);
            
            parts.push({ inlineData: { mimeType: mimeType || 'audio/webm', data: audio } });
            parts.push({ text: "این یک پیام صوتی فارسی است. اگر دستور پرداخت است، اطلاعات را استخراج کن. اگر سوال است پاسخ بده." });
        } else {
            parts.push({ text: message || "Hello" });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts }]
        });

        const responseText = response.text;
        res.json({ reply: responseText }); 

    } catch (e) { 
        console.error("AI Error:", e);
        res.status(500).json({ error: e.message }); 
    } 
});

// Backup Routes
const performFullBackup = async (isAuto = false, includeFiles = true) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const type = includeFiles ? 'full' : 'db-only';
    const backupFileName = `backup-${type}-${timestamp}.zip`;
    const backupPath = path.join(BACKUPS_DIR, backupFileName);
    
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
            console.log(`>>> Backup: ${backupFileName}`);
            if (isAuto) {
                const db = getDb();
                if (db.settings?.telegramAdminId) {
                    sendTelegramDoc(db.settings.telegramAdminId, backupPath, `#بک_آپ_خودکار\n📅 ${new Date().toLocaleDateString('fa-IR')}`);
                }
            }
            resolve(backupPath);
        });
        archive.on('error', reject);
        archive.pipe(output);
        if (fs.existsSync(DB_FILE)) archive.file(DB_FILE, { name: 'database.json' });
        if (includeFiles && fs.existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'uploads');
        archive.finalize();
    });
};

cron.schedule('30 23 * * *', async () => { try { await performFullBackup(true, true); } catch (e) { console.error("Backup Failed:", e); } });

app.get('/api/full-backup', async (req, res) => { try { const backupPath = await performFullBackup(false, req.query.includeFiles !== 'false'); res.download(backupPath); } catch (e) { res.status(500).send(e.message); } });
app.post('/api/full-restore', (req, res) => { try { const { fileData } = req.body; if (!fileData) return res.status(400).send('No data'); const buffer = Buffer.from(fileData.split(',')[1], 'base64'); const zip = new AdmZip(buffer); const dbEntry = zip.getEntry("database.json"); if (dbEntry) fs.writeFileSync(DB_FILE, dbEntry.getData()); const entries = zip.getEntries().filter(e => e.entryName.startsWith('uploads/') && !e.isDirectory); entries.forEach(e => fs.writeFileSync(path.join(UPLOADS_DIR, path.basename(e.entryName)), e.getData())); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } });

app.post('/api/upload', (req, res) => { 
    try { 
        const { fileName, fileData } = req.body; 
        const n = Date.now() + '_' + fileName; 
        fs.writeFileSync(path.join(UPLOADS_DIR, n), Buffer.from(fileData.split(',')[1], 'base64')); 
        res.json({ url: `/uploads/${n}`, fileName: n }); 
    } catch (e) { res.status(500).send('Err'); } 
});

app.get('/api/manifest', (req, res) => res.json({ "name": "PaySys", "short_name": "PaySys", "start_url": "/", "display": "standalone", "icons": [] }));
app.get('*', (req, res) => { const p = path.join(__dirname, 'dist', 'index.html'); if(fs.existsSync(p)) res.sendFile(p); else res.send('Build first'); });

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
