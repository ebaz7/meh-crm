
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer'; // Re-use puppeteer installed for WhatsApp
import * as Actions from './whatsapp/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;

// Helper to read DB
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

// Helper to find user by Telegram ID
const getUserByTelegramId = (db, chatId) => {
    return db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
};

// Helper: Generate HTML for PDF
const createHtmlReport = (title, headers, rows) => {
    const trs = rows.map(row => `
        <tr>
            ${row.map(cell => `<td>${cell || '-'}</td>`).join('')}
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
        <style>
            body { font-family: 'Vazirmatn', sans-serif; padding: 20px; background: #fff; }
            h1 { text-align: center; color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .date { text-align: left; font-size: 12px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #888; }
        </style>
    </head>
    <body>
        <h1>${title}</h1>
        <div class="date">تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}</div>
        <table>
            <thead>
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>${trs}</tbody>
        </table>
        <div class="footer">تولید شده توسط سیستم مدیریت یکپارچه</div>
    </body>
    </html>`;
};

// Helper: Generate PDF using Puppeteer
const generatePdf = async (htmlContent) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });
    await browser.close();
    return pdfBuffer;
};

// Helper: Format Currency
const fmt = (num) => new Intl.NumberFormat('fa-IR').format(num);

export const initTelegram = (token) => {
    if (!token) {
        console.log(">>> Telegram: No token provided in settings.");
        return;
    }
    
    if (bot) { try { bot.stopPolling(); } catch(e) {} }

    try {
        bot = new TelegramBot(token, { polling: true });
        console.log(">>> Telegram Bot Module Loaded & Polling ✅");

        bot.on('polling_error', (error) => {
            if (error.code !== 'EFATAL' && error.code !== 'ETIMEDOUT') console.log(`Telegram Polling Error: ${error.code}`);
        });

        // --- MENU GENERATOR ---
        const getMainMenu = (user) => {
            const role = user ? user.role : 'unknown';
            const keyboard = [];

            // Row 1: General Items
            keyboard.push([{ text: '📊 کارتابل جاری (تایید/رد)' }]);

            // Row 2: Archives (Permission Based)
            const archiveRow = [];
            // Payment Archive: Admin, CEO, Financial, Manager
            if (['admin', 'ceo', 'financial', 'manager'].includes(role)) {
                archiveRow.push({ text: '💰 بایگانی دستور پرداخت' });
            }
            // Exit Archive: Admin, CEO, Sales, Factory
            if (['admin', 'ceo', 'sales_manager', 'factory_manager'].includes(role)) {
                archiveRow.push({ text: '🚛 بایگانی حواله خروج' });
            }
            if (archiveRow.length > 0) keyboard.push(archiveRow);

            // Row 3: Sales/Warehouse & Trade
            const opRow = [];
            // Sales/Bijak Archive: Admin, CEO, Sales, Warehouse
            if (['admin', 'ceo', 'sales_manager', 'warehouse_keeper'].includes(role)) {
                opRow.push({ text: '📦 بایگانی بیجک/فروش' });
            }
            // Trade Reports: Admin, CEO, Manager or Custom Permission
            if (['admin', 'ceo', 'manager'].includes(role) || user.canManageTrade) {
                opRow.push({ text: '🌍 گزارشات بازرگانی' });
            }
            if (opRow.length > 0) keyboard.push(opRow);

            return {
                keyboard: keyboard,
                resize_keyboard: true,
                one_time_keyboard: false
            };
        };

        // --- MESSAGE HANDLER ---
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text ? msg.text.trim() : '';
            if (!text) return;

            const db = getDb();
            if (!db) return;

            const user = getUserByTelegramId(db, chatId);

            // 1. START / MENU
            if (text === '/start' || text === 'منو' || text === 'گزارش') {
                if (!user) {
                    bot.sendMessage(chatId, "⛔ شما به سیستم دسترسی ندارید. لطفا آیدی عددی تلگرام خود را در تنظیمات کاربری وارد کنید.\nID: " + chatId);
                    return;
                }
                bot.sendMessage(chatId, `سلام ${user.fullName} عزیز 👋\nلطفا گزینه مورد نظر را انتخاب کنید:`, {
                    reply_markup: getMainMenu(user)
                });
                return;
            }

            // --- REPORT HANDLERS ---

            // 2. PAYMENT ARCHIVE (PDF)
            if (text === '💰 بایگانی دستور پرداخت') {
                if (!user || !['admin', 'ceo', 'financial', 'manager'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                
                bot.sendMessage(chatId, "⏳ در حال تولید فایل PDF...");
                const orders = db.orders.filter(o => o.status === 'تایید نهایی').slice(0, 50); // Last 50
                const headers = ['شماره', 'تاریخ', 'ذینفع', 'مبلغ (ریال)', 'شرح', 'درخواست کننده'];
                const rows = orders.map(o => [
                    o.trackingNumber, 
                    new Date(o.date).toLocaleDateString('fa-IR'), 
                    o.payee, 
                    fmt(o.totalAmount), 
                    o.description, 
                    o.requester
                ]);
                
                try {
                    const pdf = await generatePdf(createHtmlReport('گزارش بایگانی دستور پرداخت‌ها', headers, rows));
                    bot.sendDocument(chatId, pdf, {}, { filename: 'Payments_Archive.pdf', contentType: 'application/pdf' });
                } catch (e) { console.error(e); bot.sendMessage(chatId, "خطا در تولید گزارش"); }
                return;
            }

            // 3. EXIT PERMIT ARCHIVE (PDF)
            if (text === '🚛 بایگانی حواله خروج') {
                if (!user || !['admin', 'ceo', 'sales_manager', 'factory_manager'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");

                bot.sendMessage(chatId, "⏳ در حال تولید فایل PDF...");
                const permits = db.exitPermits.filter(p => p.status === 'خارج شده (بایگانی)').slice(0, 50);
                const headers = ['شماره', 'تاریخ', 'کالا', 'مقصد/گیرنده', 'راننده', 'پلاک'];
                const rows = permits.map(p => [
                    p.permitNumber,
                    new Date(p.date).toLocaleDateString('fa-IR'),
                    p.items?.map(i => i.goodsName).join('، ') || p.goodsName,
                    p.recipientName,
                    p.driverName || '-',
                    p.plateNumber || '-'
                ]);

                try {
                    const pdf = await generatePdf(createHtmlReport('گزارش بایگانی مجوزهای خروج', headers, rows));
                    bot.sendDocument(chatId, pdf, {}, { filename: 'Exit_Permits_Archive.pdf', contentType: 'application/pdf' });
                } catch (e) { console.error(e); bot.sendMessage(chatId, "خطا در تولید گزارش"); }
                return;
            }

            // 4. BIJAK/SALES ARCHIVE (PDF)
            if (text === '📦 بایگانی بیجک/فروش') {
                if (!user || !['admin', 'ceo', 'sales_manager', 'warehouse_keeper'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");

                bot.sendMessage(chatId, "⏳ در حال تولید فایل PDF...");
                const txs = db.warehouseTransactions.filter(t => t.type === 'OUT').slice(0, 50);
                const headers = ['شماره', 'تاریخ', 'شرکت', 'گیرنده', 'اقلام'];
                const rows = txs.map(t => [
                    t.number,
                    new Date(t.date).toLocaleDateString('fa-IR'),
                    t.company,
                    t.recipientName,
                    t.items.map(i => `${i.quantity} ${i.itemName}`).join('، ')
                ]);

                try {
                    const pdf = await generatePdf(createHtmlReport('گزارش بایگانی بیجک‌های خروجی', headers, rows));
                    bot.sendDocument(chatId, pdf, {}, { filename: 'Bijak_Archive.pdf', contentType: 'application/pdf' });
                } catch (e) { console.error(e); bot.sendMessage(chatId, "خطا در تولید گزارش"); }
                return;
            }

            // 5. TRADE REPORTS (PDF)
            if (text === '🌍 گزارشات بازرگانی') {
                if (!user || (!['admin', 'ceo', 'manager'].includes(user.role) && !user.canManageTrade)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");

                bot.sendMessage(chatId, "⏳ در حال تولید فایل PDF...");
                const records = db.tradeRecords.filter(r => r.status !== 'Completed');
                const headers = ['پرونده', 'کالا', 'فروشنده', 'شرکت', 'مرحله جاری', 'ارز پایه'];
                const rows = records.map(r => {
                    const stages = ['مجوزها و پروفرما', 'بیمه', 'در صف تخصیص ارز', 'تخصیص یافته', 'خرید ارز', 'اسناد حمل', 'گواهی بازرسی', 'ترخیصیه و قبض انبار', 'برگ سبز', 'حمل داخلی', 'هزینه‌های ترخیص', 'قیمت تمام شده'];
                    const currentStage = stages.slice().reverse().find(s => r.stages && r.stages[s] && r.stages[s].isCompleted) || 'شروع نشده';
                    return [r.fileNumber, r.goodsName, r.sellerName, r.company, currentStage, r.mainCurrency];
                });

                try {
                    const pdf = await generatePdf(createHtmlReport('گزارش پرونده‌های بازرگانی فعال', headers, rows));
                    bot.sendDocument(chatId, pdf, {}, { filename: 'Trade_Report.pdf', contentType: 'application/pdf' });
                } catch (e) { console.error(e); bot.sendMessage(chatId, "خطا در تولید گزارش"); }
                return;
            }

            // 6. INTERACTIVE CARTABLE (Existing Logic)
            if (text === '📊 کارتابل جاری (تایید/رد)' || text === 'کارتابل') {
                await sendInteractiveReport(chatId, db);
                return;
            }

            // ... (Keep existing Create Payment/Bijak Logic via regex if user types manually) ...
            
            // 7. HELP
            if (text.includes('راهنما') || text === '/help') {
                bot.sendMessage(chatId, `برای استفاده از سیستم، از دکمه‌های منو استفاده کنید.`);
            }
        });

        // --- CALLBACK QUERY HANDLER (Keep existing) ---
        bot.on('callback_query', async (callbackQuery) => {
            const chatId = callbackQuery.message.chat.id;
            const data = callbackQuery.data;
            const db = getDb();
            if (!db) return;

            const [type, action, id] = data.split('_'); 
            let resultText = '';

            try {
                if (type === 'pay') {
                    if (action === 'approve') resultText = Actions.handleApprovePayment(db, id);
                    else if (action === 'reject') resultText = Actions.handleRejectPayment(db, id);
                } else if (type === 'exit') {
                    if (action === 'approve') resultText = Actions.handleApproveExit(db, id);
                    else if (action === 'reject') resultText = Actions.handleRejectExit(db, id);
                }

                if (resultText.includes('تایید شد') || resultText.includes('رد شد')) {
                    const statusEmoji = action === 'approve' ? '✅' : '❌';
                    const statusText = action === 'approve' ? 'تایید شد' : 'رد شد';
                    await bot.editMessageText(`${callbackQuery.message.text}\n\n${statusEmoji} *${statusText}*`, {
                        chat_id: chatId, message_id: callbackQuery.message.message_id, parse_mode: 'Markdown'
                    });
                    bot.answerCallbackQuery(callbackQuery.id, { text: resultText });
                } else {
                    bot.answerCallbackQuery(callbackQuery.id, { text: resultText, show_alert: true });
                }
            } catch (e) { console.error("Callback Error", e); }
        });

    } catch (e) { console.error(">>> Telegram Init Error:", e.message); }
};

// --- INTERACTIVE REPORT (Cartable) ---
const sendInteractiveReport = async (chatId, db) => {
    const pendingOrders = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
    const pendingExits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');

    if (pendingOrders.length === 0 && pendingExits.length === 0) {
        bot.sendMessage(chatId, "✅ هیچ کارتابل بازی وجود ندارد.");
        return;
    }

    bot.sendMessage(chatId, "📊 *لیست موارد در انتظار بررسی*", { parse_mode: 'Markdown' });

    for (const order of pendingOrders) {
        const msg = `💰 *دستور پرداخت #${order.trackingNumber}*\n👤 ذینفع: ${order.payee}\n💵 مبلغ: ${fmt(order.totalAmount)} ریال\n📝 شرح: ${order.description || '-'}\n⏳ وضعیت: ${order.status}`;
        const keyboard = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `pay_approve_${order.trackingNumber}` }, { text: '❌ رد', callback_data: `pay_reject_${order.trackingNumber}` }]] };
        await bot.sendMessage(chatId, msg, { reply_markup: keyboard });
    }

    for (const permit of pendingExits) {
        const goods = permit.items?.map(i => i.goodsName).join('، ') || permit.goodsName;
        const msg = `🚛 *مجوز خروج #${permit.permitNumber}*\n📦 کالا: ${goods}\n👤 گیرنده: ${permit.recipientName}\n⏳ وضعیت: ${permit.status}`;
        const keyboard = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `exit_approve_${permit.permitNumber}` }, { text: '❌ رد', callback_data: `exit_reject_${permit.permitNumber}` }]] };
        await bot.sendMessage(chatId, msg, { reply_markup: keyboard });
    }
};

export const sendMessage = async (chatId, text) => { if (bot && chatId) try { await bot.sendMessage(chatId, text); } catch (e) { console.error("Send Msg Error:", e.message); } };
export const sendDocument = async (chatId, filePath, caption) => { if (bot && chatId && fs.existsSync(filePath)) try { await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption }); } catch (e) { console.error("Send Doc Error:", e.message); } };
export const getBot = () => bot;
