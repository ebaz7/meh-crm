
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import * as Actions from './whatsapp/actions.js';
import { sendMessage as sendWhatsAppMessage } from './whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;
// Store user state for wizards
const userSessions = new Map();

// --- HELPERS ---
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error("DB Write Error", e); }
};

const getUserByTelegramId = (db, chatId) => {
    return db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
};

const fmt = (num) => new Intl.NumberFormat('fa-IR').format(num);
const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const normalizeNum = (str) => str ? str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^0-9]/g, '') : '';

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fa-IR');
};

const formatCurrency = (val) => new Intl.NumberFormat('en-US').format(val);

// Safe Callback Answer to prevent crash on timeout
const safeAnswerCallback = async (queryId, options = {}) => {
    if (!bot) return;
    try {
        await bot.answerCallbackQuery(queryId, options);
    } catch (e) {
        if (!e.message.includes('query is too old')) {
             console.error("Callback Answer Error (Handled):", e.message);
        }
    }
};

// ... (PDF Generators and other helpers remain unchanged) ...
// --- PDF GENERATORS ---
const createHtmlReport = (title, headers, rows) => {
    const trs = rows.map(row => `<tr>${row.map(cell => `<td>${cell || '-'}</td>`).join('')}</tr>`).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl}h1{text-align:center;border-bottom:2px solid #333}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:10px}th,td{border:1px solid #ddd;padding:6px;text-align:center}th{background:#f2f2f2}tr:nth-child(even){background:#f9f9f9}</style></head><body><h1>${title}</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
};

// ... (Other HTML generators omitted for brevity but presumed present) ...

const generatePdf = async (htmlContent, options = {}) => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: options.format || 'A4', landscape: options.landscape !== undefined ? options.landscape : true, printBackground: true });
    await browser.close();
    return pdfBuffer;
};

// --- DATA CALCULATION ---
const calculateStockData = (db, companyFilter = null) => {
    // ...
    return [];
};

// --- MENU BUILDER ---
const getMainMenu = (user) => {
    const keys = [];
    const actionRow = [];
    if (['admin', 'ceo', 'financial', 'manager', 'sales_manager'].includes(user.role)) actionRow.push('➕ ثبت دستور پرداخت جدید');
    if (['admin', 'ceo', 'manager', 'sales_manager'].includes(user.role)) actionRow.push('🚛 ثبت مجوز خروج');
    if (['admin', 'warehouse_keeper', 'manager'].includes(user.role)) actionRow.push('📦 صدور بیجک انبار');
    if (actionRow.length > 0) keys.push(actionRow);
    
    // Separate Approval Buttons
    const approvalRow = [];
    if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) approvalRow.push('💰 کارتابل پرداخت');
    if (['admin', 'ceo', 'factory_manager', 'warehouse_keeper'].includes(user.role)) approvalRow.push('🚛 کارتابل خروج'); // Added warehouse_keeper
    if (['admin', 'ceo'].includes(user.role)) approvalRow.push('📦 کارتابل بیجک');
    
    if (approvalRow.length > 0) keys.push(approvalRow);

    const reportRow = [];
    if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) reportRow.push('💰 بایگانی دستور پرداخت');
    if (user.canManageTrade || ['admin', 'ceo', 'manager'].includes(user.role)) reportRow.push('🌍 گزارشات بازرگانی');
    if (['admin', 'ceo', 'manager', 'warehouse_keeper', 'sales_manager', 'factory_manager'].includes(user.role)) reportRow.push('📦 گزارشات انبار');
    if (reportRow.length > 0) keys.push(reportRow);
    
    return { keyboard: keys, resize_keyboard: true };
};

// ... (Wizard Handlers) ...

// --- BIJAK NOTIFICATION ---
export const notifyNewBijak = async (tx) => {
    if (!bot) return;
    const db = getDb();
    const ceoUsers = db.users.filter(u => (u.role === 'ceo' || u.role === 'admin') && u.telegramChatId);
    for (const user of ceoUsers) {
        const msg = `📦 *درخواست خروج کالا (بیجک جدید)*\n` +
                    `🏢 شرکت: ${tx.company}\n` +
                    `🔢 شماره: ${tx.number}\n` +
                    `👤 گیرنده: ${tx.recipientName}\n` +
                    `📦 اقلام: ${tx.items.length} مورد\n` +
                    `👤 ثبت کننده: ${tx.createdBy}\n\n` +
                    `آیا تایید می‌کنید؟`;
        const keyboard = { inline_keyboard: [[{ text: '✅ تایید و ارسال', callback_data: `bijak_approve_${tx.id}` }, { text: '❌ رد', callback_data: `bijak_reject_${tx.id}` }]] };
        try { await bot.sendMessage(user.telegramChatId, msg, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) { }
    }
};

async function handleApprovalAction(bot, query, db) {
    const [type, action, id] = query.data.split('_'); 
    let resultText = '';
    if (type === 'pay') { if (action === 'approve') resultText = Actions.handleApprovePayment(db, id); else if (action === 'reject') resultText = Actions.handleRejectPayment(db, id); }
    else if (type === 'exit') { if (action === 'approve') resultText = Actions.handleApproveExit(db, id); else if (action === 'reject') resultText = Actions.handleRejectExit(db, id); }
    if (resultText.includes('تایید شد') || resultText.includes('رد شد')) {
        const statusEmoji = action === 'approve' ? '✅' : '❌';
        const statusText = action === 'approve' ? 'تایید شد' : 'رد شد';
        await bot.editMessageText(`${query.message.text}\n\n${statusEmoji} *${statusText}*`, { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' });
    }
    safeAnswerCallback(query.id, { text: resultText, show_alert: !resultText.includes('تایید شد') });
}

async function sendPaymentCartable(chatId, db, user) {
    let pendingOrders = [];
    const role = user.role;
    if (role === 'admin') pendingOrders = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
    else if (role === 'financial') pendingOrders = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
    else if (role === 'manager') pendingOrders = db.orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
    else if (role === 'ceo') pendingOrders = db.orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
    if (pendingOrders.length === 0) return bot.sendMessage(chatId, "✅ هیچ دستور پرداخت منتظر تاییدی وجود ندارد.");
    bot.sendMessage(chatId, `💰 *کارتابل پرداخت (${pendingOrders.length} مورد)*`, { parse_mode: 'Markdown' });
    for (const order of pendingOrders) {
        const msg = `💰 *دستور پرداخت #${order.trackingNumber}*\n👤 ذینفع: ${order.payee}\n💵 مبلغ: ${fmt(order.totalAmount)} ریال\n📝 شرح: ${order.description || '-'}\n⏳ وضعیت: ${order.status}`;
        await bot.sendMessage(chatId, msg, { reply_markup: { inline_keyboard: [[{ text: '✅ تایید', callback_data: `pay_approve_${order.trackingNumber}` }, { text: '❌ رد', callback_data: `pay_reject_${order.trackingNumber}` }]] } });
        await new Promise(r => setTimeout(r, 100)); 
    }
}

// UPDATED: Support for Warehouse Supervisor in Telegram
async function sendExitCartable(chatId, db, user) {
    let pendingExits = [];
    const role = user.role;
    const STATUS = {
        CEO: 'در انتظار تایید مدیرعامل',
        FACTORY: 'تایید مدیرعامل / در انتظار مدیر کارخانه',
        WAREHOUSE: 'تایید کارخانه / در انتظار سرپرست انبار',
        SECURITY: 'تایید انبار / در انتظار تایید انتظامات',
    };

    if (role === 'admin') pendingExits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');
    else if (role === 'ceo') pendingExits = db.exitPermits.filter(p => p.status === STATUS.CEO);
    else if (role === 'factory_manager') pendingExits = db.exitPermits.filter(p => p.status === STATUS.FACTORY);
    else if (role === 'warehouse_keeper') pendingExits = db.exitPermits.filter(p => p.status === STATUS.WAREHOUSE);
    
    if (pendingExits.length === 0) return bot.sendMessage(chatId, "✅ هیچ مجوز خروج منتظر تاییدی وجود ندارد.");
    
    bot.sendMessage(chatId, `🚛 *کارتابل خروج (${pendingExits.length} مورد)*`, { parse_mode: 'Markdown' });
    for (const permit of pendingExits) {
        const itemsSummary = permit.items?.map(i => `${i.cartonCount} کارتن ${i.goodsName}`).join('، ') || permit.goodsName;
        const msg = `🚛 *مجوز خروج #${permit.permitNumber}*\n👤 گیرنده: ${permit.recipientName}\n📦 کالا: ${itemsSummary}\n⏳ وضعیت: ${permit.status}`;
        await bot.sendMessage(chatId, msg, { reply_markup: { inline_keyboard: [[{ text: '✅ تایید', callback_data: `exit_approve_${permit.permitNumber}` }, { text: '❌ رد', callback_data: `exit_reject_${permit.permitNumber}` }]] } });
        await new Promise(r => setTimeout(r, 100));
    }
}

// ... (Rest of the file remains similar) ...

export const initTelegram = (token) => {
    if (!token) return;
    if (bot) try { bot.stopPolling(); } catch(e) {}

    try {
        bot = new TelegramBot(token, { 
            polling: false,
            request: {
                agentOptions: { keepAlive: true, family: 4 },
                timeout: 30000 
            }
        });
        
        bot.startPolling({ interval: 3000, params: { timeout: 10 } });
        
        console.log(">>> Telegram Bot Module Loaded & Polling ✅");

        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text ? msg.text.trim() : '';
            if (!text) return;
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);
            
            if (text === '/start' || text === 'منو' || text === 'گزارش' || text === 'لغو') {
                userSessions.delete(chatId);
                if (!user) return bot.sendMessage(chatId, "⛔ عدم دسترسی. شناسه شما در سیستم ثبت نشده است. ID: " + chatId);
                return bot.sendMessage(chatId, `سلام ${user.fullName} 👋\nمنوی اصلی:`, { reply_markup: getMainMenu(user) });
            }
            
            if (text === '💰 کارتابل پرداخت') { await sendPaymentCartable(chatId, db, user); return; }
            if (text === '🚛 کارتابل خروج') { await sendExitCartable(chatId, db, user); return; }
            
            // ... (Other handlers) ...
        });

        bot.on('callback_query', async (query) => {
            const data = query.data;
            const chatId = query.message.chat.id;
            const db = getDb();
            if (data.startsWith('pay_') || data.startsWith('exit_')) { await handleApprovalAction(bot, query, db); return; }
        });

    } catch (e) { console.error(">>> Telegram Init Error:", e.message); }
};

export const sendMessage = async (chatId, text) => { if (bot && chatId) try { await bot.sendMessage(chatId, text); } catch (e) {} };
export const sendDocument = async (chatId, filePath, caption) => { if (bot && chatId) try { await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption }); } catch (e) {} };
