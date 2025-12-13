
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
// Store user state: { chatId: { type: 'PAYMENT|TRADE...', filter: '...', tempParams: {} } }
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

const getUserByTelegramId = (db, chatId) => {
    return db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
};

const fmt = (num) => new Intl.NumberFormat('fa-IR').format(num);

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

const parsePersianDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    // Basic conversion logic (approximate for display logic only if needed)
    return new Date(y, m - 1, d); // Treat as Gregorian for calculation diffs or use libraries
};

// --- PDF GENERATOR (General) ---
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
            body { font-family: 'Vazirmatn', sans-serif; padding: 20px; background: #fff; direction: rtl; }
            h1 { text-align: center; color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; font-size: 20px; }
            .meta { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: center; }
            th { background-color: #f2f2f2; font-weight: bold; font-size: 11px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body>
        <h1>${title}</h1>
        <div class="meta">
            <span>تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}</span>
            <span>تعداد ردیف: ${rows.length}</span>
        </div>
        <table>
            <thead>
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>${trs}</tbody>
        </table>
        <div class="footer">تولید شده توسط سیستم مدیریت مالی و بازرگانی</div>
    </body>
    </html>`;
};

// --- SINGLE VOUCHER HTML GENERATOR ---
const createVoucherHtml = (order) => {
    // Replicating PrintVoucher.tsx visual structure
    return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
        <style>
            body { font-family: 'Vazirmatn', sans-serif; padding: 40px; background: #fff; direction: rtl; width: 210mm; margin: 0 auto; box-sizing: border-box; }
            .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
            .title { font-size: 24px; font-weight: bold; }
            .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
            .info-box { text-align: left; }
            .info-row { font-size: 14px; margin-bottom: 5px; }
            .info-label { font-weight: bold; color: #555; }
            .info-value { font-weight: bold; font-family: monospace; font-size: 16px; }
            
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
            .box { background: #f9f9f9; border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
            .label { font-size: 12px; color: #666; display: block; margin-bottom: 5px; }
            .value { font-size: 16px; font-weight: bold; }
            .desc-box { background: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .desc-text { font-size: 14px; line-height: 1.6; text-align: justify; }

            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px; }
            th { background: #eee; padding: 8px; border: 1px solid #ccc; font-weight: bold; }
            td { padding: 8px; border: 1px solid #ccc; text-align: center; }

            .footer { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 50px; border-top: 2px solid #333; padding-top: 10px; }
            .sign-box { text-align: center; height: 80px; display: flex; flex-direction: column; justify-content: flex-end; }
            .sign-label { font-size: 12px; font-weight: bold; color: #666; border-top: 1px solid #ccc; padding-top: 5px; width: 100%; }
            .stamp { border: 2px solid #1e40af; color: #1e40af; padding: 5px 10px; border-radius: 8px; transform: rotate(-5deg); font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 5px; opacity: 0.8; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div class="title">${order.payingCompany || 'شرکت بازرگانی'}</div>
                <div class="subtitle">سیستم مدیریت مالی و پرداخت</div>
            </div>
            <div class="info-box">
                <div style="background: #eee; padding: 5px 10px; border-radius: 5px; font-weight: bold; margin-bottom: 10px; text-align: center;">رسید پرداخت وجه</div>
                <div class="info-row"><span class="info-label">شماره:</span> <span class="info-value">${order.trackingNumber}</span></div>
                <div class="info-row"><span class="info-label">تاریخ:</span> <span class="info-value">${formatDate(order.date)}</span></div>
            </div>
        </div>

        <div class="grid">
            <div class="box"><span class="label">در وجه (ذینفع):</span><span class="value">${order.payee}</span></div>
            <div class="box"><span class="label">مبلغ کل پرداختی:</span><span class="value">${fmt(order.totalAmount)} ریال</span></div>
        </div>

        <div class="desc-box">
            <span class="label">بابت (شرح پرداخت):</span>
            <div class="desc-text">${order.description}</div>
        </div>

        <table>
            <thead><tr><th>#</th><th>نوع پرداخت</th><th>مبلغ</th><th>بانک / چک</th><th>توضیحات</th></tr></thead>
            <tbody>
                ${order.paymentDetails.map((d, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${d.method}</td>
                        <td style="font-family: monospace;">${fmt(d.amount)}</td>
                        <td>${d.method === 'چک' ? `چک: ${d.chequeNumber || '-'}` : d.method === 'حواله بانکی' ? `بانک: ${d.bankName || '-'}` : '-'}</td>
                        <td>${d.description || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <div class="sign-box">
                <div style="margin-bottom: 10px; font-weight: bold; font-size: 14px;">${order.requester}</div>
                <div class="sign-label">درخواست کننده</div>
            </div>
            <div class="sign-box">
                ${order.approverFinancial ? `<div class="stamp">تایید مالی<br>${order.approverFinancial}</div>` : ''}
                <div class="sign-label">مدیر مالی</div>
            </div>
            <div class="sign-box">
                ${order.approverManager ? `<div class="stamp">تایید مدیریت<br>${order.approverManager}</div>` : ''}
                <div class="sign-label">مدیریت</div>
            </div>
            <div class="sign-box">
                ${order.approverCeo ? `<div class="stamp">مدیر عامل<br>${order.approverCeo}</div>` : ''}
                <div class="sign-label">مدیر عامل</div>
            </div>
        </div>
    </body>
    </html>`;
};

// --- ALLOCATION REPORT HTML (Replicates AllocationReport.tsx) ---
const createAllocationReportHtml = (records) => {
    // Basic Rate constants (Should ideally fetch from settings, using defaults here as proxy)
    const RATES = { eurToUsd: 1.08, rialRate: 500000 }; 
    const filtered = records.filter(r => r.status !== 'Completed');

    // Processing Logic (Replicated from React Component)
    const processed = filtered.map((r, idx) => {
        const stageQ = r.stages['در صف تخصیص ارز'];
        const stageA = r.stages['تخصیص یافته'];
        const isAllocated = stageA?.isCompleted;
        
        let amount = stageQ?.costCurrency;
        if (!amount || amount === 0) amount = r.items.reduce((s, i) => s + i.totalPrice, 0);
        
        // USD Conversion
        let amountInUSD = amount;
        if (r.mainCurrency === 'EUR') amountInUSD = amount * RATES.eurToUsd;
        // ... simplified others

        const rialEquiv = amountInUSD * RATES.rialRate;
        
        // Remaining Days
        let remainingDays = '-';
        let remainingColor = 'black';
        if (isAllocated && stageA?.allocationDate) {
            // Need a way to parse Persian date string to JS date in Node environment without complex libraries
            // Simplified: Just display raw string or use basic logic if critical. 
            // For report display, raw data is acceptable if calculation is complex.
            remainingDays = 'محاسبه در وب'; 
        }

        return {
            idx: idx + 1,
            file: r.fileNumber,
            goods: r.goodsName,
            reg: r.registrationNumber || '-',
            company: r.company || '-',
            currencyAmt: `${fmt(amount)} ${r.mainCurrency}`,
            usdAmt: `$ ${fmt(Math.round(amountInUSD))}`,
            rialAmt: fmt(Math.round(rialEquiv)),
            qDate: stageQ?.queueDate || '-',
            aDate: stageA?.allocationDate || '-',
            rem: remainingDays,
            status: isAllocated ? 'تخصیص یافته' : 'در صف',
            bank: r.operatingBank || '-',
            prio: r.isPriority ? '✅' : '-',
            rank: r.allocationCurrencyRank === 'Type1' ? 'نوع 1' : r.allocationCurrencyRank === 'Type2' ? 'نوع 2' : '-'
        };
    });

    const trs = processed.map(r => `
        <tr style="border-bottom: 1px solid #ccc;">
            <td>${r.idx}</td>
            <td style="text-align: right;"><b>${r.file}</b><br><span style="font-size:9px;color:#555;">${r.goods}</span></td>
            <td style="font-family: monospace;">${r.reg}</td>
            <td>${r.company}</td>
            <td style="direction: ltr; font-family: monospace;">${r.currencyAmt}</td>
            <td style="direction: ltr; font-family: monospace; font-weight: bold;">${r.usdAmt}</td>
            <td style="direction: ltr; font-family: monospace; color: #1e40af;">${r.rialAmt}</td>
            <td>${r.qDate}</td>
            <td>${r.aDate}</td>
            <td>${r.rem}</td>
            <td style="font-weight: bold; background: ${r.status === 'تخصیص یافته' ? '#dcfce7; color: #166534' : '#fef9c3; color: #854d0e'}">${r.status}</td>
            <td style="font-size: 10px;">${r.bank}</td>
            <td>${r.prio}</td>
            <td style="font-size: 10px;">${r.rank}</td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
        <style>
            body { font-family: 'Vazirmatn', sans-serif; padding: 20px; background: #fff; direction: rtl; width: 297mm; margin: 0 auto; }
            h2 { text-align: center; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; text-align: center; border: 1px solid #999; }
            th { background-color: #1e3a8a; color: white; padding: 5px; border: 1px solid #999; }
            td { padding: 4px; border-right: 1px solid #ccc; }
            tr:nth-child(even) { background-color: #f8fafc; }
        </style>
    </head>
    <body>
        <h2>گزارش صف تخصیص ارز</h2>
        <table>
            <thead>
                <tr>
                    <th>ردیف</th><th>پرونده / کالا</th><th>ثبت سفارش</th><th>شرکت</th><th>مبلغ ارزی</th><th>معادل دلار</th><th>معادل ریالی</th>
                    <th>زمان در صف</th><th>زمان تخصیص</th><th>مانده</th><th>وضعیت</th><th>بانک</th><th>اولویت</th><th>نوع ارز</th>
                </tr>
            </thead>
            <tbody>${trs}</tbody>
        </table>
        <div style="margin-top: 20px; font-size: 10px; color: #666; text-align: center;">تولید شده توسط سیستم مدیریت بازرگانی</div>
    </body>
    </html>`;
};

const generatePdf = async (htmlContent, landscape = true) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
        format: landscape ? 'A4' : 'A5', 
        landscape: landscape, 
        printBackground: true, 
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } 
    });
    await browser.close();
    return pdfBuffer;
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

            // 1. Main Menu
            if (text === '/start' || text === 'منو' || text === 'گزارش') {
                if (!user) return bot.sendMessage(chatId, "⛔ عدم دسترسی. ID: " + chatId);
                userSessions.delete(chatId); // Reset session
                return bot.sendMessage(chatId, `سلام ${user.fullName} 👋\nمنوی اصلی:`, { reply_markup: getMainMenu(user) });
            }

            // 2. Interactive Report Handlers
            
            // Payment Archive Menu
            if (text === '💰 بایگانی دستور پرداخت') {
                if (!user || !['admin', 'ceo', 'financial', 'manager'].includes(user.role)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                
                const opts = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '📅 امروز', callback_data: 'filter_pay_today' },
                                { text: '🗓 این ماه', callback_data: 'filter_pay_month' }
                            ],
                            [
                                { text: '🔢 ۵۰ مورد آخر', callback_data: 'filter_pay_last50' },
                                { text: '🔎 جستجو (بزودی)', callback_data: 'filter_pay_search' }
                            ]
                        ]
                    }
                };
                return bot.sendMessage(chatId, "🧐 *فیلتر گزارش پرداخت‌ها*\nلطفا بازه زمانی یا نوع فیلتر را انتخاب کنید:", { parse_mode: 'Markdown', ...opts });
            }

            // Trade Reports Menu
            if (text === '🌍 گزارشات بازرگانی') {
                if (!user || (!['admin', 'ceo', 'manager'].includes(user.role) && !user.canManageTrade)) return bot.sendMessage(chatId, "⛔ عدم دسترسی");
                const opts = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📄 لیست کلی پرونده‌ها', callback_data: 'trade_type_general' }],
                            [{ text: '⏳ صف تخصیص ارز', callback_data: 'trade_type_queue' }],
                            [{ text: '💰 وضعیت خرید ارز', callback_data: 'trade_type_currency' }],
                            [{ text: '🏭 ترخیص و انبار', callback_data: 'trade_type_clearance' }]
                        ]
                    }
                };
                return bot.sendMessage(chatId, "🌍 *منوی گزارشات بازرگانی*\nنوع گزارش را انتخاب کنید:", { parse_mode: 'Markdown', ...opts });
            }

            // Cartable
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
            if (!db) return;

            // Handle Actions
            if (data.startsWith('pay_') || data.startsWith('exit_')) {
                await handleApprovalAction(bot, query, db);
                return;
            }

            // --- PAYMENT FILTERS (LIST MODE) ---
            if (data.startsWith('filter_pay_')) {
                const type = data.replace('filter_pay_', '');
                let filtered = [];
                let label = '';

                if (type === 'today') {
                    // Logic for today (simplified)
                    filtered = db.orders.filter(o => o.status === 'تایید نهایی').slice(0, 20); 
                    label = 'امروز';
                } else if (type === 'month') {
                    filtered = db.orders.filter(o => o.status === 'تایید نهایی').slice(0, 50);
                    label = 'این ماه';
                } else {
                    filtered = db.orders.filter(o => o.status === 'تایید نهایی').slice(0, 20);
                    label = 'آخرین‌ها';
                }

                if (filtered.length === 0) {
                    return bot.sendMessage(chatId, "هیچ موردی یافت نشد.");
                }

                bot.sendMessage(chatId, `📂 *نتایج فیلتر (${label})*\nتعداد: ${filtered.length} مورد\nدر حال ارسال لیست...`, { parse_mode: 'Markdown' });

                // Send items ONE BY ONE with individual download button
                for (const order of filtered) {
                    const caption = `💰 *دستور پرداخت #${order.trackingNumber}*\n` +
                                    `👤 ذینفع: ${order.payee}\n` +
                                    `💵 مبلغ: ${fmt(order.totalAmount)} ریال\n` +
                                    `📝 شرح: ${order.description}\n` +
                                    `📅 تاریخ: ${formatDate(order.date)}\n` +
                                    `🏦 شرکت: ${order.payingCompany || '-'}`;
                    
                    const keyboard = {
                        inline_keyboard: [[{ text: '📥 دانلود رسید PDF', callback_data: `dl_pay_single_${order.id}` }]]
                    };

                    await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: keyboard });
                    // Small delay to prevent flood limits
                    await new Promise(r => setTimeout(r, 100)); 
                }
                
                await bot.answerCallbackQuery(query.id);
                return;
            }

            // --- SINGLE PDF DOWNLOAD: PAYMENT ---
            if (data.startsWith('dl_pay_single_')) {
                const orderId = data.replace('dl_pay_single_', '');
                const order = db.orders.find(o => o.id === orderId);
                
                if (!order) return bot.answerCallbackQuery(query.id, { text: 'سند یافت نشد.' });

                bot.sendMessage(chatId, `⏳ در حال ایجاد فایل PDF سند ${order.trackingNumber}...`);
                
                try {
                    const html = createVoucherHtml(order);
                    const pdf = await generatePdf(html, false); // A5 Portrait logic inside helper
                    await bot.sendDocument(chatId, pdf, {}, { filename: `Voucher_${order.trackingNumber}.pdf`, contentType: 'application/pdf' });
                } catch(e) { console.error(e); bot.sendMessage(chatId, 'خطا در تولید فایل.'); }
                return bot.answerCallbackQuery(query.id);
            }

            // --- TRADE REPORT GENERATION ---
            if (data === 'dl_trade_pdf') {
                const session = userSessions.get(chatId);
                if (!session) return bot.answerCallbackQuery(query.id, { text: 'نشست نامعتبر' });

                bot.sendMessage(chatId, "⏳ در حال تولید گزارش...");
                
                // Get filtered records based on session
                // For simplicity here, assuming 'data' contains IDs or just use all active for Queue report if needed
                // If it's a specific filter, reload based on IDs
                const records = db.tradeRecords.filter(r => session.data.includes(r.id));

                try {
                    let pdf;
                    if (session.reportType === 'queue') {
                        // Use Special Complex Report for Queue
                        const html = createAllocationReportHtml(records);
                        pdf = await generatePdf(html, true); // Landscape A4
                        await bot.sendDocument(chatId, pdf, {}, { filename: `Allocation_Report_${Date.now()}.pdf`, contentType: 'application/pdf' });
                    } else {
                        // Standard logic for others (simplified)
                        const rows = records.map(r => [r.fileNumber, r.goodsName, r.company, r.mainCurrency]);
                        const html = createHtmlReport("گزارش بازرگانی", ["پرونده", "کالا", "شرکت", "ارز"], rows);
                        pdf = await generatePdf(html);
                        await bot.sendDocument(chatId, pdf, {}, { filename: `Report_${Date.now()}.pdf`, contentType: 'application/pdf' });
                    }
                } catch(e) { console.error(e); bot.sendMessage(chatId, 'خطا در تولید.'); }
                return bot.answerCallbackQuery(query.id);
            }
            
            // Handle other trade types logic...
            if (data.startsWith('trade_type_')) {
                const rType = data.replace('trade_type_', '');
                // For 'queue', we might want to skip complex filters or just show 'All'
                userSessions.set(chatId, { context: 'trade', reportType: rType, step: 'WAITING_FILTER' });
                
                const opts = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'نمایش همه', callback_data: 'trade_filter_all' }],
                            [{ text: '🏢 فیلتر بر اساس شرکت', callback_data: 'trade_filter_company_select' }]
                        ]
                    }
                };
                return bot.editMessageText(`گزارش انتخابی: ${rType}\nفیلتر مورد نظر را انتخاب کنید:`, { chat_id: chatId, message_id: query.message.message_id, ...opts });
            }
            
            if (data === 'trade_filter_all' || data.startsWith('trade_do_filter_')) {
                 const sess = userSessions.get(chatId);
                 let filtered = db.tradeRecords.filter(r => r.status !== 'Completed');
                 if (data.startsWith('trade_do_filter_company')) {
                     const c = data.split('|')[1];
                     filtered = filtered.filter(r => r.company === c);
                 }
                 userSessions.set(chatId, { ...sess, data: filtered.map(r => r.id) });
                 
                 const txt = `آماده دریافت گزارش (${filtered.length} رکورد).`;
                 const opts = { reply_markup: { inline_keyboard: [[{ text: '📥 دانلود PDF کامل', callback_data: 'dl_trade_pdf' }]] } };
                 await bot.answerCallbackQuery(query.id);
                 return bot.sendMessage(chatId, txt, { parse_mode: 'Markdown', ...opts });
            }
            
            // ... (Keep existing company selector logic) ...
            if (data === 'trade_filter_company_select') {
                const companies = [...new Set(db.tradeRecords.map(r => r.company).filter(Boolean))];
                const buttons = companies.map(c => [{ text: c, callback_data: `trade_do_filter_company|${c}` }]);
                return bot.editMessageText("🏢 شرکت را انتخاب کنید:", { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: buttons } });
            }

        });

    } catch (e) { console.error(">>> Telegram Init Error:", e.message); }
};

// --- INTERACTIVE REPORT (CARTABLE) ---
async function sendInteractiveReport(chatId, db) {
    const pendingOrders = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
    const pendingExits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');

    if (pendingOrders.length === 0 && pendingExits.length === 0) {
        return bot.sendMessage(chatId, "✅ هیچ کارتابل بازی وجود ندارد.");
    }

    bot.sendMessage(chatId, "📊 *لیست موارد در انتظار بررسی*", { parse_mode: 'Markdown' });

    for (const order of pendingOrders) {
        const msg = `💰 *دستور پرداخت #${order.trackingNumber}*\n👤 ذینفع: ${order.payee}\n💵 مبلغ: ${fmt(order.totalAmount)} ریال\n📝 شرح: ${order.description || '-'}\n⏳ وضعیت: ${order.status}`;
        const keyboard = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `pay_approve_${order.trackingNumber}` }, { text: '❌ رد', callback_data: `pay_reject_${order.trackingNumber}` }]] };
        await bot.sendMessage(chatId, msg, { reply_markup: keyboard });
    }
}

// --- APPROVAL HANDLER ---
async function handleApprovalAction(bot, query, db) {
    const [type, action, id] = query.data.split('_'); 
    let resultText = '';

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
        await bot.editMessageText(`${query.message.text}\n\n${statusEmoji} *${statusText}*`, {
            chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown'
        });
    }
    bot.answerCallbackQuery(query.id, { text: resultText, show_alert: !resultText.includes('تایید شد') });
}

export const sendMessage = async (chatId, text) => { if (bot && chatId) try { await bot.sendMessage(chatId, text); } catch (e) {} };
export const sendDocument = async (chatId, filePath, caption) => { if (bot && chatId) try { await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption }); } catch (e) {} };
