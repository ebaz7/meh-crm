
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

// --- NUMBERING LOGIC (Matches Server Logic) ---
const findNextAvailableNumber = (arr, key, base) => {
    const startNum = base + 1;
    // Extract numbers, filter invalid ones, and sort
    const existing = arr
        .map(o => Number(o[key]))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
    
    let next = startNum;
    // Find the first gap or the end of the sequence
    for (const num of existing) {
        if (num === next) next++;
        else if (num > next) return next;
    }
    return next;
};

// --- PDF GENERATORS ---
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

const createBijakHtml = (tx, hidePrice = false) => {
    const totalQty = tx.items.reduce((a, b) => a + b.quantity, 0);
    const rows = tx.items.map((item, idx) => `<tr><td>${idx + 1}</td><td style="font-weight: bold;">${item.itemName}</td><td>${item.quantity}</td><td>${item.weight}</td>${!hidePrice ? `<td style="font-family: monospace;">${item.unitPrice ? fmt(item.unitPrice) : '-'}</td>` : ''}</tr>`).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl;width:148mm;margin:0 auto;}.header{display:flex;justify-content:space-between;border-bottom:2px solid black;padding-bottom:10px;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:11px;border:1px solid black}th{background:#e5e7eb;border:1px solid black}td{border:1px solid black;text-align:center;padding:5px}.footer{margin-top:30px;display:flex;justify-content:space-between;text-align:center;font-size:10px}</style></head><body><div class="header"><div><div style="font-size:18px;font-weight:900">${tx.company}</div><div style="font-size:12px">حواله خروج کالا (بیجک)</div></div><div style="border:2px solid black;padding:5px;border-radius:5px;font-weight:bold">NO: ${tx.number}</div></div><div style="margin-bottom:10px;font-size:11px;background:#f9f9f9;padding:8px;border:1px solid #ccc"><div>گیرنده: <b>${tx.recipientName}</b> | راننده: <b>${tx.driverName||'-'}</b> | پلاک: <b>${tx.plateNumber||'-'}</b></div></div><table><thead><tr><th>#</th><th>شرح</th><th>تعداد</th><th>وزن</th>${!hidePrice ? '<th>فی (ریال)</th>' : ''}</tr></thead><tbody>${rows}<tr style="background:#f3f4f6;font-weight:bold"><td colspan="2">جمع کل</td><td>${totalQty}</td><td>-</td>${!hidePrice ? '<td></td>' : ''}</tr></tbody></table><div class="footer"><div>ثبت کننده<br>${tx.createdBy}</div><div>تایید مدیریت<br>${tx.approvedBy || '_________'}</div><div>تحویل گیرنده<br>_________</div></div></body></html>`;
};

const createVoucherHtml = (order) => `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"/><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl;width:209mm;margin:0 auto;}.header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:10px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}th,td{border:1px solid #ccc;padding:5px;text-align:center}.box{background:#f9f9f9;padding:10px;border:1px solid #ddd;margin-bottom:10px}</style></head><body><div class="header"><h1>${order.payingCompany}</h1><div><h2>دستور پرداخت</h2><p>شماره: ${order.trackingNumber}</p><p>تاریخ: ${formatDate(order.date)}</p></div></div><div class="box"><div><b>ذینفع:</b> ${order.payee}</div><div><b>مبلغ:</b> ${fmt(order.totalAmount)} ریال</div><div><b>بابت:</b> ${order.description}</div></div><table><thead><tr><th>روش</th><th>مبلغ</th><th>بانک/چک</th></tr></thead><tbody>${order.paymentDetails.map(d=>`<tr><td>${d.method}</td><td>${fmt(d.amount)}</td><td>${d.bankName||d.chequeNumber||'-'}</td></tr>`).join('')}</tbody></table><div style="margin-top:40px;text-align:center;display:flex;justify-content:space-around"><div>درخواست کننده<br>${order.requester}</div><div>مدیر مالی<br>${order.approverFinancial||'-'}</div><div>مدیر عامل<br>${order.approverCeo||'-'}</div></div></body></html>`;

const createAllocationReportHtml = (records) => { return createHtmlReport("گزارش تخصیص ارز", ["پرونده", "کالا", "مبلغ", "وضعیت"], records.map(r => [r.fileNumber, r.goodsName, fmt(r.items.reduce((a,b)=>a+b.totalPrice,0)), r.status])); }; 

// --- NEW REPORT HTML GENERATORS ---

const calculateCurrencyReportData = (records) => {
    // Basic aggregation similar to frontend, using default rates
    const rates = { eurToUsd: 1.08, aedToUsd: 0.272, cnyToUsd: 0.14, tryToUsd: 0.03 };
    const selectedYear = 1404; // Default to current or relevant year
    
    const rows = [];
    let idx = 1;
    let totals = { usd: 0, original: 0, rial: 0 };

    records.forEach(r => {
        if (r.status === 'Completed' || r.isArchived) return; // Active only for now
        const tranches = r.currencyPurchaseData?.tranches || [];
        
        tranches.forEach(t => {
            if (!t.date || !t.date.startsWith(selectedYear.toString())) return;
            
            let usdRate = 1;
            if (t.currencyType === 'EUR') usdRate = rates.eurToUsd;
            else if (t.currencyType === 'AED') usdRate = rates.aedToUsd;
            else if (t.currencyType === 'CNY') usdRate = rates.cnyToUsd;
            else if (t.currencyType === 'TRY') usdRate = rates.tryToUsd;

            const usdAmount = t.amount * usdRate;
            
            totals.usd += usdAmount;
            totals.original += t.amount;
            totals.rial += (t.amount * (t.rate || 0));

            rows.push([
                idx++,
                r.goodsName,
                r.fileNumber,
                r.company,
                formatCurrency(Math.round(usdAmount)),
                formatCurrency(t.amount) + ' ' + t.currencyType,
                t.purchaseDate,
                formatCurrency(t.amount * (t.rate || 0)),
                t.exchangeName,
                t.isDelivered ? '✅' : '⏳'
            ]);
        });
    });
    return { rows, totals, year: selectedYear };
};

const createCurrencyReportHtml = (data) => {
    const trs = data.rows.map(row => `<tr>${row.map(c => `<td>${c || '-'}</td>`).join('')}</tr>`).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl}h1{text-align:center;border-bottom:2px solid #333}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ddd;padding:6px;text-align:center}th{background:#e5e7eb;font-weight:bold}.totals{font-weight:bold;background:#f3f4f6}</style></head><body><h1>گزارش خرید ارز (${data.year})</h1><table><thead><tr><th>ردیف</th><th>کالا</th><th>پرونده</th><th>شرکت</th><th>دلار معادل</th><th>مقدار ارز</th><th>تاریخ</th><th>ریالی</th><th>صرافی</th><th>وضعیت</th></tr></thead><tbody>${trs}<tr class="totals"><td colspan="4">جمع کل</td><td>${formatCurrency(Math.round(data.totals.usd))}</td><td>-</td><td>-</td><td>${formatCurrency(data.totals.rial)}</td><td>-</td><td>-</td></tr></tbody></table></body></html>`;
};

const calculatePerformanceData = (records) => {
    const rates = { eurToUsd: 1.08, aedToUsd: 0.272, cnyToUsd: 0.14, tryToUsd: 0.03 };
    const selectedYear = 1404;
    const summary = {};
    let totalAll = 0;

    records.forEach(r => {
        const tranches = r.currencyPurchaseData?.tranches || [];
        tranches.forEach(t => {
            if (!t.date || !t.date.startsWith(selectedYear.toString())) return;
            let usdRate = 1;
            if (t.currencyType === 'EUR') usdRate = rates.eurToUsd;
            else if (t.currencyType === 'AED') usdRate = rates.aedToUsd;
            else if (t.currencyType === 'CNY') usdRate = rates.cnyToUsd;
            else if (t.currencyType === 'TRY') usdRate = rates.tryToUsd;

            const usdAmount = t.amount * usdRate;
            const comp = r.company || 'نامشخص';
            summary[comp] = (summary[comp] || 0) + usdAmount;
            totalAll += usdAmount;
        });
    });

    const details = Object.entries(summary).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total);
    return { details, totalAll, year: selectedYear };
};

const createPerformanceReportHtml = (data) => {
    const trs = data.details.map(item => `<tr><td>${item.name}</td><td style="font-family:monospace;font-weight:bold">${formatCurrency(Math.round(item.total))}</td></tr>`).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"/><style>body{font-family:'Vazirmatn';padding:20px;direction:rtl}h1{text-align:center;border-bottom:2px solid #333}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #000;padding:10px;text-align:center}th{background:#bfdbfe}</style></head><body><h1>عملکرد شرکت‌ها (${data.year})</h1><table><thead><tr><th>نام شرکت</th><th>جمع خرید (دلار)</th></tr></thead><tbody>${trs}<tr style="background:#1f2937;color:white;font-weight:bold"><td>جمع کل</td><td style="font-family:monospace">${formatCurrency(Math.round(data.totalAll))}</td></tr></tbody></table></body></html>`;
};

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

// --- WIZARD HANDLERS ---

const handlePaymentWizard = async (chatId, text, session, db, user) => {
    if (!text && session.step !== 'WAIT_BANK') return; 
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
        case 'WAIT_DESC': 
            session.data.description = text;
            sendConfirmation(chatId, 'payment', session.data);
            break;
    }
};

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
    // Determine next number using smart logic (checking DB records)
    const nextNum = findNextAvailableNumber(db.orders, 'trackingNumber', db.settings.currentTrackingNumber || 1000);
    db.settings.currentTrackingNumber = nextNum; // Update settings to stay strictly sequential for simple next increment
    
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
    // Smart Numbering
    const nextNum = findNextAvailableNumber(db.exitPermits, 'permitNumber', db.settings.currentExitPermitNumber || 1000);
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
    const company = data.company;
    // Smart Numbering for Bijak based on company
    const currentBase = db.settings.warehouseSequences?.[company] || 1000;
    const companyTxs = db.warehouseTransactions.filter(t => t.company === company && t.type === 'OUT');
    const nextSeq = findNextAvailableNumber(companyTxs, 'number', currentBase);

    if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
    db.settings.warehouseSequences[company] = nextSeq;

    const tx = {
        id: generateUUID(), type: 'OUT', date: new Date().toISOString(), company: data.company, number: nextSeq,
        recipientName: data.recipient, driverName: data.driver, plateNumber: data.plate,
        items: [{ itemId: generateUUID(), itemName: data.goods, quantity: data.count, weight: 0, unitPrice: 0 }],
        createdAt: Date.now(), createdBy: user.fullName, status: 'PENDING'
    };
    db.warehouseTransactions.unshift(tx);
    saveDb(db);
    notifyNewBijak(tx); // Trigger approval workflow
    return nextSeq;
};

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
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ تایید و ارسال', callback_data: `bijak_approve_${tx.id}` },
                    { text: '❌ رد', callback_data: `bijak_reject_${tx.id}` }
                ]
            ]
        };
        try { await bot.sendMessage(user.telegramChatId, msg, { parse_mode: 'Markdown', reply_markup: keyboard }); } catch (e) { }
    }
};

// --- INIT ---
export const initTelegram = (token) => {
    if (!token) return;
    if (bot) try { bot.stopPolling(); } catch(e) {}

    try {
        // Robust polling configuration to handle ETIMEDOUT
        bot = new TelegramBot(token, { 
            polling: {
                interval: 3000, // Check every 3 seconds to avoid spamming bad connections
                autoStart: true,
                params: {
                    timeout: 10 // Long polling timeout in seconds
                }
            },
            request: {
                // Add agent options to stabilize connection
                agentOptions: {
                    keepAlive: true,
                    family: 4 // Force IPv4
                },
                timeout: 30000 // 30s request timeout
            }
        });
        
        console.log(">>> Telegram Bot Module Loaded & Polling ✅");

        // *** ERROR HANDLING TO PREVENT CRASHES AND LOG SPAM ***
        bot.on('polling_error', (error) => {
            // Filter out common network timeout errors from the console
            if (error.code === 'ETIMEDOUT' || error.code === 'EFATAL' || error.code === 'ECONNRESET') {
                // Do nothing or log sparingly
                // console.log(`[Telegram Network Error] ${error.code} - Retrying...`);
            } else {
                console.log(`[Telegram Polling Error] ${error.code}: ${error.message}`);
            }
        });
        
        bot.on('error', (error) => {
            if (error.code !== 'ETIMEDOUT') {
                console.log(`[Telegram General Error] ${error.message}`);
            }
        });

        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text ? msg.text.trim() : '';
            if (!text) return;

            const db = getDb();
            const user = getUserByTelegramId(db, chatId);

            // Handle Reset / Menu
            if (text === '/start' || text === 'منو' || text === 'گزارش' || text === 'لغو') {
                userSessions.delete(chatId);
                if (!user) return bot.sendMessage(chatId, "⛔ عدم دسترسی. ID: " + chatId);
                return bot.sendMessage(chatId, `سلام ${user.fullName} 👋\nمنوی اصلی:`, { reply_markup: getMainMenu(user) });
            }

            // Handle Active Wizards
            const session = userSessions.get(chatId);
            if (session) {
                if (session.context === 'PAYMENT_WIZARD') return handlePaymentWizard(chatId, text, session, db, user);
                if (session.context === 'EXIT_WIZARD') return handleExitWizard(chatId, text, session, db, user);
                if (session.context === 'BIJAK_WIZARD') return handleBijakWizard(chatId, text, session, db, user);
            }

            // Handle Main Menu Buttons
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

            // --- SEPARATE CARTABLES ---
            if (text === '💰 کارتابل پرداخت') {
                await sendPaymentCartable(chatId, db, user);
                return;
            }
            if (text === '🚛 کارتابل خروج') {
                await sendExitCartable(chatId, db, user);
                return;
            }
            if (text === '📦 کارتابل بیجک') {
                await sendBijakCartable(chatId, db, user);
                return;
            }

            if (text === '💰 بایگانی دستور پرداخت') {
                if (!user || !['admin', 'ceo', 'financial', 'manager'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                const opts = { reply_markup: { inline_keyboard: [[{ text: '📅 امروز', callback_data: 'filter_pay_today' }, { text: '🗓 این ماه', callback_data: 'filter_pay_month' }], [{ text: '🔢 ۵۰ مورد آخر', callback_data: 'filter_pay_last50' }]] } };
                return bot.sendMessage(chatId, "🧐 *فیلتر گزارش پرداخت‌ها*", { parse_mode: 'Markdown', ...opts });
            }
            if (text === '🌍 گزارشات بازرگانی') {
                if (!user || (!['admin', 'ceo', 'manager'].includes(user.role) && !user.canManageTrade)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                const opts = { reply_markup: { inline_keyboard: [[{ text: '📄 لیست کلی پرونده‌ها', callback_data: 'trade_type_general' }], [{ text: '⏳ صف تخصیص ارز', callback_data: 'trade_type_queue' }], [{ text: '💰 وضعیت خرید ارز', callback_data: 'trade_type_currency' }], [{ text: '📊 عملکرد شرکت‌ها', callback_data: 'trade_type_performance' }], [{ text: '🏭 ترخیص و انبار', callback_data: 'trade_type_clearance' }]] } };
                return bot.sendMessage(chatId, "🌍 *منوی گزارشات بازرگانی*", { parse_mode: 'Markdown', ...opts });
            }
            if (text === '📦 گزارشات انبار') {
                if (!user || !['admin', 'ceo', 'manager', 'warehouse_keeper', 'sales_manager', 'factory_manager'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                const opts = { reply_markup: { inline_keyboard: [[{ text: '📊 موجودی کلی (همه شرکت‌ها)', callback_data: 'wh_report_all' }], [{ text: '🏢 موجودی بر اساس شرکت', callback_data: 'wh_report_company' }], [{ text: '🚛 لیست بیجک‌ها', callback_data: 'wh_bijak_menu' }]] } }; 
                return bot.sendMessage(chatId, "📦 *منوی گزارشات انبار*", { parse_mode: 'Markdown', ...opts });
            }
        });

        // --- CALLBACK QUERY HANDLER ---
        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);
            if (!db || !user) return;

            const session = userSessions.get(chatId);

            if (data === 'wiz_cancel') {
                userSessions.delete(chatId);
                bot.editMessageText("❌ عملیات لغو شد.", { chat_id: chatId, message_id: query.message.message_id });
                return;
            }

            if (data.startsWith('wiz_sel_bank_') && session && session.context === 'PAYMENT_WIZARD') {
                const bank = data.replace('wiz_sel_bank_', '');
                session.data.bank = bank;
                session.step = 'WAIT_DESC';
                bot.editMessageText(`✅ بانک انتخاب شد: ${bank}\n📝 لطفاً *بابت/شرح پرداخت* را بنویسید:`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                return;
            }

            if (data.startsWith('wiz_sel_comp_') && session && session.context === 'BIJAK_WIZARD') {
                const comp = data.replace('wiz_sel_comp_', '');
                session.data.company = comp;
                session.step = 'WAIT_RECIPIENT';
                bot.editMessageText(`✅ شرکت انتخاب شد: ${comp}\n👤 نام *تحویل گیرنده* را وارد کنید:`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                return;
            }

            // Wizard Completions
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

            // --- BIJAK APPROVAL ---
            if (data.startsWith('bijak_approve_')) {
                const txId = data.replace('bijak_approve_', '');
                const txIndex = db.warehouseTransactions.findIndex(t => t.id === txId);
                if (txIndex === -1) return bot.answerCallbackQuery(query.id, { text: 'بیجک یافت نشد.' });
                const tx = db.warehouseTransactions[txIndex];
                if (tx.status === 'APPROVED') return bot.answerCallbackQuery(query.id, { text: 'قبلاً تایید شده است.' });

                tx.status = 'APPROVED';
                tx.approvedBy = user.fullName;
                saveDb(db);

                await bot.editMessageText(`${query.message.text}\n\n✅ *توسط ${user.fullName} تایید شد.*`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                
                // Auto-Send to WA logic
                try {
                    const companyConfig = db.settings.companyNotifications?.[tx.company];
                    if (companyConfig) {
                        if (companyConfig.salesManager) {
                            const html = createBijakHtml(tx, false);
                            const pdf = await generatePdf(html, { format: 'A5' });
                            const base64 = pdf.toString('base64');
                            const caption = `🏭 *شرکت: ${tx.company}*\n📑 *حواله خروج (تایید شده)*\n🔢 شماره: ${tx.number}\n👤 گیرنده: ${tx.recipientName}`;
                            await sendWhatsAppMessage(companyConfig.salesManager, caption, { data: base64, mimeType: 'application/pdf', filename: `Bijak_${tx.number}.pdf` });
                        }
                        if (companyConfig.warehouseGroup) {
                            const html = createBijakHtml(tx, true);
                            const pdf = await generatePdf(html, { format: 'A5' });
                            const base64 = pdf.toString('base64');
                            const caption = `🏭 *شرکت: ${tx.company}*\n📦 *حواله خروج (انبار)*\n🔢 شماره: ${tx.number}\n👤 گیرنده: ${tx.recipientName}`;
                            await sendWhatsAppMessage(companyConfig.warehouseGroup, caption, { data: base64, mimeType: 'application/pdf', filename: `Bijak_${tx.number}_WH.pdf` });
                        }
                        bot.sendMessage(chatId, "✅ به واتساپ ارسال شد.");
                    }
                } catch (e) {}
                return bot.answerCallbackQuery(query.id);
            }

            if (data.startsWith('bijak_reject_')) {
                const txId = data.replace('bijak_reject_', '');
                const txIndex = db.warehouseTransactions.findIndex(t => t.id === txId);
                if (txIndex !== -1) {
                    db.warehouseTransactions[txIndex].status = 'REJECTED';
                    saveDb(db);
                    await bot.editMessageText(`${query.message.text}\n\n❌ *توسط ${user.fullName} رد شد.*`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
                }
                return bot.answerCallbackQuery(query.id);
            }

            // Existing Logic (Approvals, Filters, Reports)
            if (data.startsWith('pay_') || data.startsWith('exit_')) { await handleApprovalAction(bot, query, db); return; }
            if (data.startsWith('filter_pay_')) {
                const type = data.replace('filter_pay_', '');
                let filtered = [];
                const archiveOrders = db.orders.filter(o => o.status === 'تایید نهایی').sort((a,b) => b.createdAt - a.createdAt);
                if (type === 'today') { const todayStr = new Date().toISOString().split('T')[0]; filtered = archiveOrders.filter(o => o.date === todayStr); } 
                else if (type === 'month') { filtered = archiveOrders.slice(0, 50); } 
                else { filtered = archiveOrders.slice(0, 20); }
                if (filtered.length === 0) return bot.sendMessage(chatId, "هیچ موردی یافت نشد.");
                await bot.sendMessage(chatId, `📂 *نتایج فیلتر*\nتعداد: ${filtered.length} مورد`, { parse_mode: 'Markdown' });
                for (const order of filtered) {
                    const caption = `💰 *دستور پرداخت #${order.trackingNumber}*\n👤 ذینفع: ${order.payee}\n💵 مبلغ: ${fmt(order.totalAmount)} ریال\n📝 شرح: ${order.description}`;
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

            if (data === 'wh_report_all') {
                bot.sendMessage(chatId, "⏳ در حال تولید گزارش موجودی کلی...");
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
                const opts = { reply_markup: { inline_keyboard: [[{ text: '📦 ۱۰ بیجک آخر', callback_data: 'wh_bijak_list_10' }]] } };
                return bot.editMessageText("🚛 *منوی بیجک*", { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown', ...opts });
            }
            if (data === 'wh_bijak_list_10') {
                const recentBijaks = db.warehouseTransactions.filter(t => t.type === 'OUT').sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);
                if (recentBijaks.length === 0) return bot.sendMessage(chatId, "هیچ بیجکی یافت نشد.");
                await bot.sendMessage(chatId, `📦 *آخرین بیجک‌ها*`, { parse_mode: 'Markdown' });
                for (const tx of recentBijaks) {
                    const caption = `🧾 *بیجک شماره ${tx.number}*\n📅 تاریخ: ${formatDate(tx.date)}\n🏢 شرکت: ${tx.company}\n👤 گیرنده: ${tx.recipientName || '-'}`;
                    await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📥 دانلود PDF', callback_data: `dl_bijak_${tx.id}` }]] } });
                    await new Promise(r => setTimeout(r, 150)); 
                }
                await bot.answerCallbackQuery(query.id); return;
            }
            if (data.startsWith('dl_bijak_')) {
                const txId = data.replace('dl_bijak_', ''); const tx = db.warehouseTransactions.find(t => t.id === txId);
                if (!tx) return bot.answerCallbackQuery(query.id, { text: 'بیجک یافت نشد.' });
                bot.sendMessage(chatId, `⏳ در حال تولید فایل...`);
                try { const html = createBijakHtml(tx); const pdf = await generatePdf(html, { format: 'A5', landscape: false }); await bot.sendDocument(chatId, pdf, {}, { filename: `Bijak_${tx.number}.pdf`, contentType: 'application/pdf' }); } catch(e) { bot.sendMessage(chatId, 'خطا در تولید فایل.'); }
                return bot.answerCallbackQuery(query.id);
            }
            
            // Trade Reports
            if (data.startsWith('trade_type_')) {
                const rType = data.replace('trade_type_', '');
                
                // Direct PDF generation for reports that don't need filtering
                if (rType === 'currency' || rType === 'performance') {
                    bot.sendMessage(chatId, `⏳ در حال تولید گزارش ${rType === 'currency' ? 'خرید ارز' : 'عملکرد شرکت‌ها'}...`);
                    try {
                        let pdf;
                        if (rType === 'currency') {
                            const calc = calculateCurrencyReportData(db.tradeRecords || []);
                            const html = createCurrencyReportHtml(calc);
                            pdf = await generatePdf(html, { format: 'A4', landscape: true });
                            await bot.sendDocument(chatId, pdf, {}, { filename: `Currency_Report_${calc.year}.pdf`, contentType: 'application/pdf' });
                        } else {
                            const calc = calculatePerformanceData(db.tradeRecords || []);
                            const html = createPerformanceReportHtml(calc);
                            pdf = await generatePdf(html, { format: 'A4', landscape: false });
                            await bot.sendDocument(chatId, pdf, {}, { filename: `Performance_Report_${calc.year}.pdf`, contentType: 'application/pdf' });
                        }
                    } catch(e) { console.error(e); bot.sendMessage(chatId, 'خطا در تولید گزارش.'); }
                    return bot.answerCallbackQuery(query.id);
                }

                // Filtering flow for other reports
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
        });

    } catch (e) { console.error(">>> Telegram Init Error:", e.message); }
};

// --- SPECIFIC CARTABLE HANDLERS ---

async function sendPaymentCartable(chatId, db, user) {
    let pendingOrders = [];
    const role = user.role;

    if (role === 'admin') {
        pendingOrders = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
    } else if (role === 'financial') {
        pendingOrders = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
    } else if (role === 'manager') {
        pendingOrders = db.orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
    } else if (role === 'ceo') {
        pendingOrders = db.orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
    }

    if (pendingOrders.length === 0) return bot.sendMessage(chatId, "✅ هیچ دستور پرداخت منتظر تاییدی وجود ندارد.");

    bot.sendMessage(chatId, `💰 *کارتابل پرداخت (${pendingOrders.length} مورد)*`, { parse_mode: 'Markdown' });
    for (const order of pendingOrders) {
        const msg = `💰 *دستور پرداخت #${order.trackingNumber}*\n👤 ذینفع: ${order.payee}\n💵 مبلغ: ${fmt(order.totalAmount)} ریال\n📝 شرح: ${order.description || '-'}\n⏳ وضعیت: ${order.status}`;
        await bot.sendMessage(chatId, msg, { reply_markup: { inline_keyboard: [[{ text: '✅ تایید', callback_data: `pay_approve_${order.trackingNumber}` }, { text: '❌ رد', callback_data: `pay_reject_${order.trackingNumber}` }]] } });
        await new Promise(r => setTimeout(r, 100)); // Slight delay
    }
}

async function sendExitCartable(chatId, db, user) {
    let pendingExits = [];
    const role = user.role;

    if (role === 'admin') {
        pendingExits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');
    } else if (role === 'ceo') {
        pendingExits = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل');
    } else if (role === 'factory_manager') {
        pendingExits = db.exitPermits.filter(p => p.status === 'تایید مدیرعامل / در انتظار خروج (کارخانه)');
    }

    if (pendingExits.length === 0) return bot.sendMessage(chatId, "✅ هیچ مجوز خروج منتظر تاییدی وجود ندارد.");

    bot.sendMessage(chatId, `🚛 *کارتابل خروج (${pendingExits.length} مورد)*`, { parse_mode: 'Markdown' });
    for (const permit of pendingExits) {
        const itemsSummary = permit.items?.map(i => `${i.cartonCount} کارتن ${i.goodsName}`).join('، ') || permit.goodsName;
        const msg = `🚛 *مجوز خروج #${permit.permitNumber}*\n👤 گیرنده: ${permit.recipientName}\n📦 کالا: ${itemsSummary}\n⏳ وضعیت: ${permit.status}`;
        await bot.sendMessage(chatId, msg, { reply_markup: { inline_keyboard: [[{ text: '✅ تایید', callback_data: `exit_approve_${permit.permitNumber}` }, { text: '❌ رد', callback_data: `exit_reject_${permit.permitNumber}` }]] } });
        await new Promise(r => setTimeout(r, 100));
    }
}

async function sendBijakCartable(chatId, db, user) {
    // Assuming Admins and CEOs approve Bijaks
    if (!['admin', 'ceo'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");

    const pendingBijaks = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING');

    if (pendingBijaks.length === 0) return bot.sendMessage(chatId, "✅ هیچ بیجک منتظر تاییدی وجود ندارد.");

    bot.sendMessage(chatId, `📦 *کارتابل بیجک (${pendingBijaks.length} مورد)*`, { parse_mode: 'Markdown' });
    for (const tx of pendingBijaks) {
        const msg = `📦 *درخواست خروج کالا (بیجک)*\n` +
                    `🏢 شرکت: ${tx.company}\n` +
                    `🔢 شماره: ${tx.number}\n` +
                    `👤 گیرنده: ${tx.recipientName}\n` +
                    `📦 اقلام: ${tx.items.length} مورد\n` +
                    `👤 ثبت کننده: ${tx.createdBy}`;
        
        await bot.sendMessage(chatId, msg, { reply_markup: { inline_keyboard: [[{ text: '✅ تایید و ارسال', callback_data: `bijak_approve_${tx.id}` }, { text: '❌ رد', callback_data: `bijak_reject_${tx.id}` }]] } });
        await new Promise(r => setTimeout(r, 100));
    }
}

// ... (Rest of existing functions: handleApprovalAction, getMainMenu, exports) ...

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
    if (['admin', 'ceo', 'factory_manager'].includes(user.role)) approvalRow.push('🚛 کارتابل خروج');
    if (['admin', 'ceo'].includes(user.role)) approvalRow.push('📦 کارتابل بیجک');
    
    if (approvalRow.length > 0) keys.push(approvalRow);

    const reportRow = [];
    if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) reportRow.push('💰 بایگانی دستور پرداخت');
    if (user.canManageTrade || ['admin', 'ceo', 'manager'].includes(user.role)) reportRow.push('🌍 گزارشات بازرگانی');
    if (['admin', 'ceo', 'manager', 'warehouse_keeper', 'sales_manager', 'factory_manager'].includes(user.role)) reportRow.push('📦 گزارشات انبار');
    if (reportRow.length > 0) keys.push(reportRow);
    
    return { keyboard: keys, resize_keyboard: true };
};

export const sendMessage = async (chatId, text) => { if (bot && chatId) try { await bot.sendMessage(chatId, text); } catch (e) {} };
export const sendDocument = async (chatId, filePath, caption) => { if (bot && chatId) try { await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption }); } catch (e) {} };
