
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import * as Actions from './whatsapp/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;
// Store user state: { chatId: { context: 'PAYMENT_WIZARD'|'TRADE_REPORT'..., step: '...', data: {} } }
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

const getPersianDate = () => {
    const now = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('fa-IR', options).formatToParts(now);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return { 
        full: `${y}/${m}/${d}`, // 1403/05/21
        month: `${y}/${m}`      // 1403/05
    };
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fa-IR');
};

// --- DATA CALCULATION FOR WAREHOUSE (Existing Logic) ---
const calculateStockData = (db, companyFilter = null) => {
    let companies = db.settings.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
    if (companyFilter) companies = companies.filter(c => c === companyFilter);
    const items = db.warehouseItems || [];
    const transactions = db.warehouseTransactions || [];
    return companies.map(company => {
        const companyItems = items.map(catalogItem => {
            let quantity = 0;
            let weight = 0;
            const companyTxs = transactions.filter(tx => tx.company === company);
            companyTxs.forEach(tx => {
                tx.items.forEach(txItem => {
                    if (txItem.itemId === catalogItem.id) {
                        if (tx.type === 'IN') { quantity += txItem.quantity; weight += txItem.weight; } 
                        else { quantity -= txItem.quantity; weight -= txItem.weight; }
                    }
                });
            });
            const containerCapacity = catalogItem.containerCapacity || 0;
            const containerCount = (containerCapacity > 0 && quantity > 0) ? (quantity / containerCapacity) : 0;
            return { id: catalogItem.id, name: catalogItem.name, quantity, weight, containerCount };
        });
        return { company, items: companyItems };
    });
};

// --- PDF GENERATORS (Keeping existing visual logic) ---
const createHtmlReport = (title, headers, rows) => {
    const trs = rows.map(row => `<tr>${row.map(cell => `<td>${cell || '-'}</td>`).join('')}</tr>`).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl}h1{text-align:center;border-bottom:2px solid #333}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:10px}th,td{border:1px solid #ddd;padding:6px;text-align:center}th{background:#f2f2f2}tr:nth-child(even){background:#f9f9f9}</style></head><body><h1>${title}</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
};

const createStockReportHtml = (data) => {
    const gridColumns = data.map((group, index) => {
        const headerColor = index === 0 ? 'background-color: #d8b4fe;' : index === 1 ? 'background-color: #fdba74;' : 'background-color: #93c5fd;';
        const rows = group.items.map(item => `
            <div style="display: flex; border-bottom: 1px solid #9ca3af; font-size: 10px;">
                <div style="flex: 1.5; padding: 2px; border-left: 1px solid black; font-weight: bold; text-align: right;">${item.name}</div>
                <div style="flex: 1; padding: 2px; border-left: 1px solid black;">${item.quantity}</div>
                <div style="flex: 1; padding: 2px; border-left: 1px solid black;">${item.weight > 0 ? item.weight : 0}</div>
                <div style="flex: 1; padding: 2px; color: #6b7280;">${item.containerCount > 0 ? item.containerCount.toFixed(2) : '-'}</div>
            </div>
        `).join('');
        return `<div style="border-left: 1px solid black;"><div style="${headerColor} padding: 4px; text-align: center; border-bottom: 1px solid black; font-weight: bold;">${group.company}</div><div style="display: flex; background: #f3f4f6; font-weight: bold; border-bottom: 1px solid black; font-size: 10px; text-align: center;"><div style="flex: 1.5;">نخ</div><div style="flex: 1;">کارتن</div><div style="flex: 1;">وزن</div><div style="flex: 1;">کانتینر</div></div>${rows}</div>`;
    }).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl;width:296mm;margin:0 auto;}.header-main{text-align:center;background:#fde047;border:1px solid black;padding:4px;font-weight:900;font-size:18px}.grid-container{display:grid;grid-template-columns:repeat(${data.length},1fr);border:1px solid black;border-left:none}</style></head><body><div class="header-main">موجودی کلی انبارها</div><div class="grid-container">${gridColumns}</div></body></html>`;
};

const createBijakHtml = (tx) => {
    const totalQty = tx.items.reduce((a, b) => a + b.quantity, 0);
    const rows = tx.items.map((item, idx) => `<tr><td>${idx + 1}</td><td style="font-weight: bold;">${item.itemName}</td><td>${item.quantity}</td><td>${item.weight}</td></tr>`).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl;width:148mm;margin:0 auto;}.header{display:flex;justify-content:space-between;border-bottom:2px solid black;padding-bottom:10px;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:11px;border:1px solid black}th{background:#e5e7eb;border:1px solid black}td{border:1px solid black;text-align:center;padding:5px}.footer{margin-top:30px;display:flex;justify-content:space-between;text-align:center;font-size:10px}</style></head><body><div class="header"><div><div style="font-size:18px;font-weight:900">${tx.company}</div><div style="font-size:12px">حواله خروج کالا (بیجک)</div></div><div style="border:2px solid black;padding:5px;border-radius:5px;font-weight:bold">NO: ${tx.number}</div></div><div style="margin-bottom:10px;font-size:11px;background:#f9f9f9;padding:8px;border:1px solid #ccc"><div>گیرنده: <b>${tx.recipientName}</b> | راننده: <b>${tx.driverName||'-'}</b> | پلاک: <b>${tx.plateNumber||'-'}</b></div></div><table><thead><tr><th>#</th><th>شرح</th><th>تعداد</th><th>وزن</th></tr></thead><tbody>${rows}<tr style="background:#f3f4f6;font-weight:bold"><td colspan="2">جمع کل</td><td>${totalQty}</td><td>-</td></tr></tbody></table><div class="footer"><div>ثبت کننده<br>${tx.createdBy}</div><div>تایید مدیریت<br>_________</div><div>تحویل گیرنده<br>_________</div></div></body></html>`;
};

const createVoucherHtml = (order) => `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"/><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl;width:209mm;margin:0 auto;}.header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:10px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}th,td{border:1px solid #ccc;padding:5px;text-align:center}.box{background:#f9f9f9;padding:10px;border:1px solid #ddd;margin-bottom:10px}</style></head><body><div class="header"><h1>${order.payingCompany}</h1><div><h2>دستور پرداخت</h2><p>شماره: ${order.trackingNumber}</p><p>تاریخ: ${formatDate(order.date)}</p></div></div><div class="box"><div><b>ذینفع:</b> ${order.payee}</div><div><b>مبلغ:</b> ${fmt(order.totalAmount)} ریال</div><div><b>بابت:</b> ${order.description}</div></div><table><thead><tr><th>روش</th><th>مبلغ</th><th>بانک/چک</th></tr></thead><tbody>${order.paymentDetails.map(d=>`<tr><td>${d.method}</td><td>${fmt(d.amount)}</td><td>${d.bankName||d.chequeNumber||'-'}</td></tr>`).join('')}</tbody></table><div style="margin-top:40px;text-align:center;display:flex;justify-content:space-around"><div>درخواست کننده<br>${order.requester}</div><div>مدیر مالی<br>${order.approverFinancial||'-'}</div><div>مدیر عامل<br>${order.approverCeo||'-'}</div></div></body></html>`;

const createAllocationReportHtml = (records) => { return createHtmlReport("گزارش تخصیص ارز", ["پرونده", "کالا", "مبلغ", "وضعیت"], records.map(r => [r.fileNumber, r.goodsName, fmt(r.items.reduce((a,b)=>a+b.totalPrice,0)), r.status])); }; // Simplified for brevity

// --- PDF GENERATOR ---
const generatePdf = async (htmlContent, options = {}) => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: options.format || 'A4', landscape: options.landscape !== undefined ? options.landscape : true, printBackground: true });
    await browser.close();
    return pdfBuffer;
};

// --- WIZARD LOGIC (NEW) ---

// 1. Payment Wizard
const handlePaymentWizard = async (chatId, text, session, db, user) => {
    if (!text && session.step !== 'WAIT_BANK') return; // Valid text required unless waiting for button

    switch (session.step) {
        case 'WAIT_PAYEE':
            session.data.payee = text;
            session.step = 'WAIT_AMOUNT';
            bot.sendMessage(chatId, "💰 *مبلغ* را به ریال وارد کنید (فقط عدد):", { parse_mode: 'Markdown' });
            break;
        case 'WAIT_AMOUNT':
            const amount = parseInt(normalizeNum(text));
            if (!amount || isNaN(amount)) return bot.sendMessage(chatId, "❌ لطفاً فقط عدد وارد کنید.");
            session.data.amount = amount;
            session.step = 'WAIT_BANK';
            const banks = db.settings.bankNames || ['ملی', 'ملت', 'صادرات'];
            const bankButtons = banks.map(b => [{ text: b, callback_data: `wiz_sel_bank_${b}` }]);
            bot.sendMessage(chatId, "🏦 *بانک مبدا* را انتخاب کنید:", { reply_markup: { inline_keyboard: bankButtons } });
            break;
        case 'WAIT_DESC': // Coming from Bank Selection callback
            session.data.description = text;
            sendConfirmation(chatId, 'payment', session.data);
            break;
    }
};

// 2. Exit Permit Wizard
const handleExitWizard = async (chatId, text, session, db, user) => {
    switch (session.step) {
        case 'WAIT_RECIPIENT':
            session.data.recipient = text;
            session.step = 'WAIT_GOODS';
            bot.sendMessage(chatId, "📦 نام *کالا و اقلام* را وارد کنید:");
            break;
        case 'WAIT_GOODS':
            session.data.goods = text;
            session.step = 'WAIT_COUNT';
            bot.sendMessage(chatId, "🔢 *تعداد/کارتن* را وارد کنید (عدد):", { parse_mode: 'Markdown' });
            break;
        case 'WAIT_COUNT':
            session.data.count = parseInt(normalizeNum(text)) || 0;
            session.step = 'WAIT_ADDRESS';
            bot.sendMessage(chatId, "📍 *آدرس مقصد* را وارد کنید:");
            break;
        case 'WAIT_ADDRESS':
            session.data.address = text;
            sendConfirmation(chatId, 'exit', session.data);
            break;
    }
};

// 3. Bijak Wizard
const handleBijakWizard = async (chatId, text, session, db, user) => {
    switch (session.step) {
        case 'WAIT_RECIPIENT':
            session.data.recipient = text;
            session.step = 'WAIT_GOODS';
            bot.sendMessage(chatId, "📦 نام *کالا* را وارد کنید:");
            break;
        case 'WAIT_GOODS':
            session.data.goods = text;
            session.step = 'WAIT_COUNT';
            bot.sendMessage(chatId, "🔢 *تعداد* را وارد کنید (عدد):", { parse_mode: 'Markdown' });
            break;
        case 'WAIT_COUNT':
            session.data.count = parseInt(normalizeNum(text)) || 0;
            session.step = 'WAIT_DRIVER';
            bot.sendMessage(chatId, "🚛 نام *راننده* را وارد کنید:");
            break;
        case 'WAIT_DRIVER':
            session.data.driver = text;
            session.step = 'WAIT_PLATE';
            bot.sendMessage(chatId, "🔢 شماره *پلاک خودرو* را وارد کنید:");
            break;
        case 'WAIT_PLATE':
            session.data.plate = text;
            sendConfirmation(chatId, 'bijak', session.data);
            break;
    }
};

const sendConfirmation = (chatId, type, data) => {
    let msg = '';
    let confirmData = '';

    if (type === 'payment') {
        msg = `📝 *پیش‌نویس دستور پرداخت*\n\n👤 ذینفع: ${data.payee}\n💰 مبلغ: ${fmt(data.amount)} ریال\n🏦 بانک: ${data.bank}\n📝 شرح: ${data.description || '-'}\n\nآیا اطلاعات مورد تایید است؟`;
        confirmData = 'wiz_confirm_payment';
    } else if (type === 'exit') {
        msg = `📝 *پیش‌نویس مجوز خروج*\n\n👤 گیرنده: ${data.recipient}\n📦 کالا: ${data.goods}\n🔢 تعداد: ${data.count}\n📍 آدرس: ${data.address}\n\nآیا اطلاعات مورد تایید است؟`;
        confirmData = 'wiz_confirm_exit';
    } else if (type === 'bijak') {
        msg = `📝 *پیش‌نویس بیجک انبار*\n\n🏢 شرکت: ${data.company}\n👤 گیرنده: ${data.recipient}\n📦 کالا: ${data.goods}\n🔢 تعداد: ${data.count}\n🚛 راننده: ${data.driver}\n🔢 پلاک: ${data.plate}\n\nآیا اطلاعات مورد تایید است؟`;
        confirmData = 'wiz_confirm_bijak';
    }

    bot.sendMessage(chatId, msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '✅ تایید و صدور نهایی', callback_data: confirmData }], [{ text: '❌ لغو', callback_data: 'wiz_cancel' }]] } });
};

// --- DB ACTION FUNCTIONS ---
const performSavePayment = (db, data, user) => {
    const nextNum = (db.settings.currentTrackingNumber || 1000) + 1;
    db.settings.currentTrackingNumber = nextNum;
    const order = {
        id: generateUUID(), trackingNumber: nextNum, date: new Date().toISOString().split('T')[0],
        payee: data.payee, totalAmount: data.amount, description: data.description, status: 'در انتظار بررسی مالی',
        requester: user.fullName, payingCompany: db.settings.defaultCompany || 'نامشخص',
        paymentDetails: [{ id: generateUUID(), method: 'حواله بانکی', amount: data.amount, bankName: data.bank, description: data.description }],
        createdAt: Date.now()
    };
    db.orders.unshift(order);
    saveDb(db);
    return nextNum;
};

const performSaveExit = (db, data, user) => {
    const nextNum = (db.settings.currentExitPermitNumber || 1000) + 1;
    db.settings.currentExitPermitNumber = nextNum;
    const permit = {
        id: generateUUID(), permitNumber: nextNum, date: new Date().toISOString().split('T')[0], requester: user.fullName,
        items: [{ id: generateUUID(), goodsName: data.goods, cartonCount: data.count, weight: 0 }],
        destinations: [{ id: generateUUID(), recipientName: data.recipient, address: data.address, phone: '' }],
        goodsName: data.goods, recipientName: data.recipient, cartonCount: data.count, status: 'در انتظار تایید مدیرعامل', createdAt: Date.now()
    };
    db.exitPermits.push(permit);
    saveDb(db);
    return nextNum;
};

const performSaveBijak = (db, data, user) => {
    const nextSeq = (db.settings.warehouseSequences?.[data.company] || 1000) + 1;
    if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
    db.settings.warehouseSequences[data.company] = nextSeq;
    const tx = {
        id: generateUUID(), type: 'OUT', date: new Date().toISOString(), company: data.company, number: nextSeq,
        recipientName: data.recipient, driverName: data.driver, plateNumber: data.plate,
        items: [{ itemId: generateUUID(), itemName: data.goods, quantity: data.count, weight: 0, unitPrice: 0 }],
        createdAt: Date.now(), createdBy: user.fullName
    };
    db.warehouseTransactions.unshift(tx);
    saveDb(db);
    return nextSeq;
};

// --- INIT ---
export const initTelegram = (token) => {
    if (!token) return;
    if (bot) try { bot.stopPolling(); } catch(e) {}

    try {
        bot = new TelegramBot(token, { polling: true });
        console.log(">>> Telegram Bot Module Loaded & Polling ✅");

        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text ? msg.text.trim() : '';
            if (!text) return;

            const db = getDb();
            const user = getUserByTelegramId(db, chatId);

            // Cancel any active wizard if user types /start or Menu or Cancel
            if (text === '/start' || text === 'منو' || text === 'گزارش' || text === 'لغو') {
                userSessions.delete(chatId);
                if (!user) return bot.sendMessage(chatId, "⛔ عدم دسترسی. ID: " + chatId);
                return bot.sendMessage(chatId, `سلام ${user.fullName} 👋\nمنوی اصلی:`, { reply_markup: getMainMenu(user) });
            }

            // Check for active Wizard Session
            const session = userSessions.get(chatId);
            if (session) {
                if (session.context === 'PAYMENT_WIZARD') return handlePaymentWizard(chatId, text, session, db, user);
                if (session.context === 'EXIT_WIZARD') return handleExitWizard(chatId, text, session, db, user);
                if (session.context === 'BIJAK_WIZARD') return handleBijakWizard(chatId, text, session, db, user);
            }

            // --- MENU HANDLERS (NEW BUTTONS) ---
            if (text === '➕ ثبت دستور پرداخت جدید') {
                if (!user) return;
                userSessions.set(chatId, { context: 'PAYMENT_WIZARD', step: 'WAIT_PAYEE', data: {} });
                bot.sendMessage(chatId, "👤 نام *ذینفع* (دریافت کننده وجه) را وارد کنید:", { parse_mode: 'Markdown' });
                return;
            }

            if (text === '🚛 ثبت مجوز خروج') {
                if (!user) return;
                userSessions.set(chatId, { context: 'EXIT_WIZARD', step: 'WAIT_RECIPIENT', data: {} });
                bot.sendMessage(chatId, "👤 نام *گیرنده کالا* را وارد کنید:", { parse_mode: 'Markdown' });
                return;
            }

            if (text === '📦 صدور بیجک انبار') {
                if (!user || !['admin', 'warehouse_keeper', 'manager'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                const companies = db.settings.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
                const buttons = companies.map(c => [{ text: c, callback_data: `wiz_sel_comp_${c}` }]);
                userSessions.set(chatId, { context: 'BIJAK_WIZARD', step: 'WAIT_COMPANY', data: {} });
                bot.sendMessage(chatId, "🏢 *شرکت صادرکننده* را انتخاب کنید:", { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
                return;
            }

            // --- EXISTING HANDLERS ---
            if (text === '💰 بایگانی دستور پرداخت') {
                if (!user || !['admin', 'ceo', 'financial', 'manager'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                const opts = { reply_markup: { inline_keyboard: [[{ text: '📅 امروز', callback_data: 'filter_pay_today' }, { text: '🗓 این ماه', callback_data: 'filter_pay_month' }], [{ text: '🔢 ۵۰ مورد آخر', callback_data: 'filter_pay_last50' }, { text: '🔎 جستجو (بزودی)', callback_data: 'filter_pay_search' }]] } };
                return bot.sendMessage(chatId, "🧐 *فیلتر گزارش پرداخت‌ها*", { parse_mode: 'Markdown', ...opts });
            }
            if (text === '🌍 گزارشات بازرگانی') {
                if (!user || (!['admin', 'ceo', 'manager'].includes(user.role) && !user.canManageTrade)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                const opts = { reply_markup: { inline_keyboard: [[{ text: '📄 لیست کلی پرونده‌ها', callback_data: 'trade_type_general' }], [{ text: '⏳ صف تخصیص ارز', callback_data: 'trade_type_queue' }], [{ text: '💰 وضعیت خرید ارز', callback_data: 'trade_type_currency' }], [{ text: '🏭 ترخیص و انبار', callback_data: 'trade_type_clearance' }]] } };
                return bot.sendMessage(chatId, "🌍 *منوی گزارشات بازرگانی*", { parse_mode: 'Markdown', ...opts });
            }
            if (text === '📦 گزارشات انبار') {
                if (!user || !['admin', 'ceo', 'manager', 'warehouse_keeper', 'sales_manager', 'factory_manager'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                const opts = { reply_markup: { inline_keyboard: [[{ text: '📊 موجودی کلی (همه شرکت‌ها)', callback_data: 'wh_report_all' }], [{ text: '🏢 موجودی بر اساس شرکت', callback_data: 'wh_report_company' }], [{ text: '🚛 لیست بیجک‌ها', callback_data: 'wh_bijak_menu' }]] } }; // Renamed label slightly
                return bot.sendMessage(chatId, "📦 *منوی گزارشات انبار*", { parse_mode: 'Markdown', ...opts });
            }
            if (text === '📊 کارتابل جاری (تایید/رد)' || text === 'کارتابل') {
                await sendInteractiveReport(chatId, db);
                return;
            }
        });

        // --- CALLBACK QUERY HANDLER ---
        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);
            if (!db || !user) return;

            // Wizard Interceptors
            const session = userSessions.get(chatId);

            if (data === 'wiz_cancel') {
                userSessions.delete(chatId);
                bot.editMessageText("❌ عملیات لغو شد.", { chat_id: chatId, message_id: query.message.message_id });
                return;
            }

            // Payment Wizard: Bank Selection
            if (data.startsWith('wiz_sel_bank_') && session && session.context === 'PAYMENT_WIZARD') {
                const bank = data.replace('wiz_sel_bank_', '');
                session.data.bank = bank;
                session.step = 'WAIT_DESC';
                bot.editMessageText(`✅ بانک انتخاب شد: ${bank}\n📝 لطفاً *بابت/شرح پرداخت* را بنویسید:`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                return;
            }

            // Bijak Wizard: Company Selection
            if (data.startsWith('wiz_sel_comp_') && session && session.context === 'BIJAK_WIZARD') {
                const comp = data.replace('wiz_sel_comp_', '');
                session.data.company = comp;
                session.step = 'WAIT_RECIPIENT';
                bot.editMessageText(`✅ شرکت انتخاب شد: ${comp}\n👤 نام *تحویل گیرنده* را وارد کنید:`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                return;
            }

            // Final Confirmations
            if (data === 'wiz_confirm_payment' && session && session.context === 'PAYMENT_WIZARD') {
                const num = performSavePayment(db, session.data, user);
                userSessions.delete(chatId);
                bot.editMessageText(`✅ *دستور پرداخت با موفقیت ثبت شد.*\n#️⃣ شماره پیگیری: *${num}*`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                return;
            }

            if (data === 'wiz_confirm_exit' && session && session.context === 'EXIT_WIZARD') {
                const num = performSaveExit(db, session.data, user);
                userSessions.delete(chatId);
                bot.editMessageText(`✅ *درخواست خروج ثبت شد.*\n#️⃣ شماره مجوز: *${num}*\nجهت بررسی به مدیریت ارسال شد.`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                return;
            }

            if (data === 'wiz_confirm_bijak' && session && session.context === 'BIJAK_WIZARD') {
                const num = performSaveBijak(db, session.data, user);
                userSessions.delete(chatId);
                bot.editMessageText(`✅ *بیجک با موفقیت صادر شد.*\n#️⃣ شماره بیجک: *${num}*`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                return;
            }

            // --- EXISTING CALLBACK LOGIC (PRESERVED) ---
            if (data.startsWith('pay_') || data.startsWith('exit_')) { await handleApprovalAction(bot, query, db); return; }
            if (data.startsWith('filter_pay_')) { /* ... Payment filter logic ... */
                const type = data.replace('filter_pay_', '');
                let filtered = [];
                let label = '';
                const archiveOrders = db.orders.filter(o => o.status === 'تایید نهایی').sort((a,b) => b.createdAt - a.createdAt);
                if (type === 'today') { const todayStr = new Date().toISOString().split('T')[0]; filtered = archiveOrders.filter(o => o.date === todayStr); label = 'امروز'; } 
                else if (type === 'month') { filtered = archiveOrders.slice(0, 50); label = 'این ماه'; } 
                else { filtered = archiveOrders.slice(0, 20); label = 'آخرین‌ها'; }
                if (filtered.length === 0) return bot.sendMessage(chatId, "هیچ موردی یافت نشد.");
                await bot.sendMessage(chatId, `📂 *نتایج فیلتر (${label})*\nتعداد: ${filtered.length} مورد`, { parse_mode: 'Markdown' });
                for (const order of filtered) {
                    const caption = `💰 *دستور پرداخت #${order.trackingNumber}*\n👤 ذینفع: ${order.payee}\n💵 مبلغ: ${fmt(order.totalAmount)} ریال\n📝 شرح: ${order.description}\n📅 تاریخ: ${formatDate(order.date)}\n🏦 شرکت: ${order.payingCompany || '-'}`;
                    await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📥 دانلود رسید PDF', callback_data: `dl_pay_single_${order.id}` }]] } });
                    await new Promise(r => setTimeout(r, 150)); 
                }
                await bot.answerCallbackQuery(query.id); return;
            }
            if (data.startsWith('dl_pay_single_')) {
                const orderId = data.replace('dl_pay_single_', ''); const order = db.orders.find(o => o.id === orderId);
                if (!order) return bot.answerCallbackQuery(query.id, { text: 'سند یافت نشد.' });
                bot.sendMessage(chatId, `⏳ در حال ایجاد فایل PDF سند ${order.trackingNumber}...`);
                try { const html = createVoucherHtml(order); const pdf = await generatePdf(html, { format: 'A5', landscape: true }); await bot.sendDocument(chatId, pdf, {}, { filename: `Voucher_${order.trackingNumber}.pdf`, contentType: 'application/pdf' }); } catch(e) { bot.sendMessage(chatId, 'خطا در تولید فایل.'); }
                return bot.answerCallbackQuery(query.id);
            }
            if (data === 'dl_trade_pdf') {
                const session = userSessions.get(chatId); if (!session) return bot.answerCallbackQuery(query.id, { text: 'نشست نامعتبر' });
                bot.sendMessage(chatId, "⏳ در حال تولید گزارش...");
                const records = db.tradeRecords.filter(r => session.data.includes(r.id));
                try {
                    let pdf;
                    if (session.reportType === 'queue') { const html = createAllocationReportHtml(records); pdf = await generatePdf(html, { format: 'A4', landscape: true }); await bot.sendDocument(chatId, pdf, {}, { filename: `Allocation_Report_${Date.now()}.pdf`, contentType: 'application/pdf' }); } 
                    else { const rows = records.map(r => [r.fileNumber, r.goodsName, r.company, r.mainCurrency]); const html = createHtmlReport("گزارش بازرگانی", ["پرونده", "کالا", "شرکت", "ارز"], rows); pdf = await generatePdf(html, { format: 'A4', landscape: false }); await bot.sendDocument(chatId, pdf, {}, { filename: `Report_${Date.now()}.pdf`, contentType: 'application/pdf' }); }
                } catch(e) { bot.sendMessage(chatId, 'خطا در تولید.'); }
                return bot.answerCallbackQuery(query.id);
            }
            if (data.startsWith('trade_type_')) {
                const rType = data.replace('trade_type_', '');
                userSessions.set(chatId, { context: 'trade', reportType: rType, step: 'WAITING_FILTER' });
                const opts = { reply_markup: { inline_keyboard: [[{ text: 'نمایش همه', callback_data: 'trade_filter_all' }], [{ text: '🏢 فیلتر بر اساس شرکت', callback_data: 'trade_filter_company_select' }]] } };
                return bot.editMessageText(`گزارش انتخابی: ${rType}\nفیلتر مورد نظر را انتخاب کنید:`, { chat_id: chatId, message_id: query.message.message_id, ...opts });
            }
            if (data === 'trade_filter_all' || data.startsWith('trade_do_filter_')) {
                 const sess = userSessions.get(chatId);
                 let filtered = db.tradeRecords.filter(r => r.status !== 'Completed');
                 if (data.startsWith('trade_do_filter_company')) { const c = data.split('|')[1]; filtered = filtered.filter(r => r.company === c); }
                 userSessions.set(chatId, { ...sess, data: filtered.map(r => r.id) });
                 const txt = `آماده دریافت گزارش (${filtered.length} رکورد).`;
                 const opts = { reply_markup: { inline_keyboard: [[{ text: '📥 دانلود PDF کامل', callback_data: 'dl_trade_pdf' }]] } };
                 await bot.answerCallbackQuery(query.id); return bot.sendMessage(chatId, txt, { parse_mode: 'Markdown', ...opts });
            }
            if (data === 'trade_filter_company_select') {
                const companies = [...new Set(db.tradeRecords.map(r => r.company).filter(Boolean))];
                const buttons = companies.map(c => [{ text: c, callback_data: `trade_do_filter_company|${c}` }]);
                return bot.editMessageText("🏢 شرکت را انتخاب کنید:", { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: buttons } });
            }
            if (data === 'wh_report_all') {
                bot.sendMessage(chatId, "⏳ در حال محاسبه و تولید گزارش موجودی کلی...");
                try { const calculatedData = calculateStockData(db); const html = createStockReportHtml(calculatedData); const pdf = await generatePdf(html, { format: 'A4', landscape: true }); await bot.sendDocument(chatId, pdf, {}, { filename: `Stock_Report_All_${Date.now()}.pdf`, contentType: 'application/pdf' }); } catch(e) { bot.sendMessage(chatId, "خطا در تولید گزارش."); }
                return bot.answerCallbackQuery(query.id);
            }
            if (data === 'wh_report_company') {
                const companies = db.settings.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
                const buttons = companies.map(c => [{ text: c, callback_data: `wh_do_report_company|${c}` }]);
                return bot.editMessageText("🏢 شرکت مورد نظر را انتخاب کنید:", { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: buttons } });
            }
            if (data.startsWith('wh_do_report_company')) {
                const companyName = data.split('|')[1];
                bot.sendMessage(chatId, `⏳ در حال تولید گزارش موجودی ${companyName}...`);
                try { const calculatedData = calculateStockData(db, companyName); const html = createStockReportHtml(calculatedData); const pdf = await generatePdf(html, { format: 'A4', landscape: true }); await bot.sendDocument(chatId, pdf, {}, { filename: `Stock_Report_${companyName}.pdf`, contentType: 'application/pdf' }); } catch(e) { bot.sendMessage(chatId, "خطا در تولید گزارش."); }
                return bot.answerCallbackQuery(query.id);
            }
            if (data === 'wh_bijak_menu') {
                const opts = { reply_markup: { inline_keyboard: [[{ text: '📦 ۱۰ بیجک آخر', callback_data: 'wh_bijak_list_10' }], [{ text: '🔍 جستجو (بزودی)', callback_data: 'wh_bijak_search' }]] } };
                return bot.editMessageText("🚛 *منوی بیجک (خروج کالا)*\nلطفا انتخاب کنید:", { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown', ...opts });
            }
            if (data === 'wh_bijak_list_10') {
                const recentBijaks = db.warehouseTransactions.filter(t => t.type === 'OUT').sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);
                if (recentBijaks.length === 0) return bot.sendMessage(chatId, "هیچ بیجکی یافت نشد.");
                await bot.sendMessage(chatId, `📦 *آخرین بیجک‌های صادر شده*\nتعداد: ${recentBijaks.length} مورد`, { parse_mode: 'Markdown' });
                for (const tx of recentBijaks) {
                    const itemsSummary = tx.items.map(i => `${i.quantity} عدد ${i.itemName}`).join('، ');
                    const caption = `🧾 *بیجک شماره ${tx.number}*\n📅 تاریخ: ${formatDate(tx.date)}\n🏢 شرکت: ${tx.company}\n👤 گیرنده: ${tx.recipientName || '-'}\n📦 اقلام: ${itemsSummary}\n🚛 راننده: ${tx.driverName || '-'}`;
                    await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📥 دانلود PDF بیجک', callback_data: `dl_bijak_${tx.id}` }]] } });
                    await new Promise(r => setTimeout(r, 150)); 
                }
                await bot.answerCallbackQuery(query.id); return;
            }
            if (data.startsWith('dl_bijak_')) {
                const txId = data.replace('dl_bijak_', ''); const tx = db.warehouseTransactions.find(t => t.id === txId);
                if (!tx) return bot.answerCallbackQuery(query.id, { text: 'بیجک یافت نشد.' });
                bot.sendMessage(chatId, `⏳ در حال تولید فایل PDF بیجک شماره ${tx.number}...`);
                try { const html = createBijakHtml(tx); const pdf = await generatePdf(html, { format: 'A5', landscape: false }); await bot.sendDocument(chatId, pdf, {}, { filename: `Bijak_${tx.number}.pdf`, contentType: 'application/pdf' }); } catch(e) { bot.sendMessage(chatId, 'خطا در تولید فایل.'); }
                return bot.answerCallbackQuery(query.id);
            }
        });

    } catch (e) { console.error(">>> Telegram Init Error:", e.message); }
};

// --- INTERACTIVE REPORT (CARTABLE) ---
async function sendInteractiveReport(chatId, db) {
    const pendingOrders = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
    const pendingExits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');
    if (pendingOrders.length === 0 && pendingExits.length === 0) return bot.sendMessage(chatId, "✅ هیچ کارتابل بازی وجود ندارد.");
    bot.sendMessage(chatId, "📊 *لیست موارد در انتظار بررسی*", { parse_mode: 'Markdown' });
    for (const order of pendingOrders) {
        const msg = `💰 *دستور پرداخت #${order.trackingNumber}*\n👤 ذینفع: ${order.payee}\n💵 مبلغ: ${fmt(order.totalAmount)} ریال\n📝 شرح: ${order.description || '-'}\n⏳ وضعیت: ${order.status}`;
        await bot.sendMessage(chatId, msg, { reply_markup: { inline_keyboard: [[{ text: '✅ تایید', callback_data: `pay_approve_${order.trackingNumber}` }, { text: '❌ رد', callback_data: `pay_reject_${order.trackingNumber}` }]] } });
    }
}

// --- APPROVAL HANDLER ---
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
    bot.answerCallbackQuery(query.id, { text: resultText, show_alert: !resultText.includes('تایید شد') });
}

// Helper to generate Main Menu with NEW Options
const getMainMenu = (user) => {
    const keys = [];
    
    // NEW: Action Row (Step-by-Step Creation)
    const actionRow = [];
    if (['admin', 'ceo', 'financial', 'manager', 'sales_manager'].includes(user.role)) actionRow.push('➕ ثبت دستور پرداخت جدید');
    if (['admin', 'ceo', 'manager', 'sales_manager'].includes(user.role)) actionRow.push('🚛 ثبت مجوز خروج');
    if (['admin', 'warehouse_keeper', 'manager'].includes(user.role)) actionRow.push('📦 صدور بیجک انبار');
    if (actionRow.length > 0) keys.push(actionRow);

    // Existing: Cartable & Archives
    if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) {
        keys.push(['📊 کارتابل جاری (تایید/رد)', '💰 بایگانی دستور پرداخت']);
    }
    
    // Existing: Reports
    const reportRow = [];
    if (user.canManageTrade || ['admin', 'ceo', 'manager'].includes(user.role)) reportRow.push('🌍 گزارشات بازرگانی');
    if (['admin', 'ceo', 'manager', 'warehouse_keeper', 'sales_manager', 'factory_manager'].includes(user.role)) reportRow.push('📦 گزارشات انبار');
    if (reportRow.length > 0) keys.push(reportRow);

    return { keyboard: keys, resize_keyboard: true };
};

export const sendMessage = async (chatId, text) => { if (bot && chatId) try { await bot.sendMessage(chatId, text); } catch (e) {} };
export const sendDocument = async (chatId, filePath, caption) => { if (bot && chatId) try { await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption }); } catch (e) {} };
