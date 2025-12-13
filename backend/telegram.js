
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
    // Replicating PrintVoucher.tsx visual structure exactly
    // Using inline styles to simulate Tailwind classes for Puppeteer
    
    // Format currency
    const formatMoney = (amount) => new Intl.NumberFormat('fa-IR').format(amount);

    return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
        <style>
            body { font-family: 'Vazirmatn', sans-serif; margin: 0; padding: 8mm; box-sizing: border-box; width: 209mm; height: 147mm; direction: rtl; background: white; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f2937; padding-bottom: 12px; margin-bottom: 12px; }
            .title-box { display: flex; gap: 12px; align-items: center; width: 66%; }
            .company-name { font-size: 20px; font-weight: 900; color: #111827; letter-spacing: 0px; }
            .subtitle { font-size: 9px; font-weight: bold; color: #6b7280; margin-top: 2px; }
            .info-box { text-align: left; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; width: 33%; }
            .doc-title { font-size: 16px; font-weight: 900; background-color: #f3f4f6; border: 1px solid #e5e7eb; color: #1f2937; padding: 4px 12px; border-radius: 8px; margin-bottom: 4px; white-space: nowrap; }
            .info-row { display: flex; align-items: center; gap: 8px; font-size: 10px; }
            .label { font-weight: bold; color: #6b7280; }
            .value { font-weight: bold; color: #1f2937; font-size: 16px; font-family: monospace; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
            .box { background-color: rgba(249, 250, 251, 0.5); border: 1px solid #d1d5db; padding: 8px; border-radius: 4px; }
            .box-label { display: block; color: #6b7280; font-size: 9px; margin-bottom: 2px; }
            .box-value { font-weight: bold; color: #111827; font-size: 16px; }
            .desc-box { background-color: rgba(249, 250, 251, 0.5); border: 1px solid #d1d5db; padding: 8px; border-radius: 4px; min-height: 45px; margin-bottom: 12px; }
            .desc-text { color: #1f2937; text-align: justify; font-weight: 500; line-height: 1.25; font-size: 12px; }
            
            table { width: 100%; text-align: right; font-size: 10px; border-collapse: collapse; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden; }
            thead { background-color: #f3f4f6; border-bottom: 1px solid #d1d5db; }
            th { padding: 6px; font-weight: bold; color: #4b5563; }
            td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
            tr:last-child td { border-bottom: none; }
            .footer { margin-top: auto; padding-top: 8px; border-top: 2px solid #1f2937; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; position: relative; }
            .sign-col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-height: 60px; }
            .sign-name { margin-bottom: 4px; display: flex; align-items: center; justify-content: center; height: 100%; }
            .sign-role { width: 100%; border-top: 1px solid #9ca3af; padding-top: 2px; font-size: 8px; font-weight: bold; color: #4b5563; }
            .stamp { border: 2px solid #1e40af; color: #1e40af; border-radius: 8px; py: 4px; px: 12px; transform: rotate(-5deg); opacity: 0.9; background-color: rgba(255,255,255,0.8); display: inline-block; padding: 4px 12px; }
            .stamp-title { font-size: 9px; font-weight: bold; border-bottom: 1px solid #1e40af; margin-bottom: 2px; text-align: center; padding-bottom: 2px; }
            .stamp-name { font-size: 10px; text-align: center; font-weight: bold; white-space: nowrap; }
            .not-signed { color: #d1d5db; font-size: 8px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title-box">
                <!-- If logo exists, it would be an img tag here -->
                <div>
                    <h1 class="company-name">${order.payingCompany || 'شرکت بازرگانی'}</h1>
                    <p class="subtitle">سیستم مدیریت مالی و پرداخت</p>
                </div>
            </div>
            <div class="info-box">
                <div class="doc-title">رسید پرداخت وجه</div>
                <div class="info-row"><span class="label">شماره:</span><span class="value">${order.trackingNumber}</span></div>
                <div class="info-row"><span class="label">تاریخ:</span><span style="font-weight: bold; color: #1f2937;">${formatDate(order.date)}</span></div>
            </div>
        </div>

        <div class="grid-2">
            <div class="box">
                <span class="box-label">در وجه (ذینفع):</span>
                <span class="box-value">${order.payee}</span>
            </div>
            <div class="box">
                <span class="box-label">مبلغ کل پرداختی:</span>
                <span class="box-value">${formatMoney(order.totalAmount)} ریال</span>
            </div>
        </div>

        <div class="desc-box">
            <span class="box-label">بابت (شرح پرداخت):</span>
            <p class="desc-text">${order.description}</p>
        </div>

        <div style="border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden;">
            <table>
                <thead>
                    <tr>
                        <th style="width: 24px;">#</th>
                        <th>نوع پرداخت</th>
                        <th>مبلغ</th>
                        <th>بانک / چک</th>
                        <th>توضیحات</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.paymentDetails.slice(0, 4).map((detail, idx) => `
                        <tr>
                            <td style="text-align: center;">${idx + 1}</td>
                            <td style="font-weight: bold;">${detail.method}</td>
                            <td style="font-family: monospace;">${formatMoney(detail.amount)} ریال</td>
                            <td>${detail.method === 'چک' ? `چک: ${detail.chequeNumber || ''}${detail.chequeDate ? ` (${detail.chequeDate})` : ''}` : detail.method === 'حواله بانکی' ? `بانک: ${detail.bankName || ''}` : '-'}</td>
                            <td style="color: #4b5563;">${detail.description || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <div class="sign-col">
                <div class="sign-name">
                    <span style="font-weight: bold; color: #111827; font-size: 10px;">${order.requester}</span>
                </div>
                <div class="sign-role">درخواست کننده</div>
            </div>
            <div class="sign-col">
                <div class="sign-name">
                    ${order.approverFinancial ? `
                        <div class="stamp">
                            <div class="stamp-title">تایید مالی</div>
                            <div class="stamp-name">${order.approverFinancial}</div>
                        </div>
                    ` : '<span class="not-signed">امضا نشده</span>'}
                </div>
                <div class="sign-role">مدیر مالی</div>
            </div>
            <div class="sign-col">
                <div class="sign-name">
                    ${order.approverManager ? `
                        <div class="stamp">
                            <div class="stamp-title">تایید مدیریت</div>
                            <div class="stamp-name">${order.approverManager}</div>
                        </div>
                    ` : '<span class="not-signed">امضا نشده</span>'}
                </div>
                <div class="sign-role">مدیریت</div>
            </div>
            <div class="sign-col">
                <div class="sign-name">
                    ${order.approverCeo ? `
                        <div class="stamp">
                            <div class="stamp-title">مدیر عامل</div>
                            <div class="stamp-name">${order.approverCeo}</div>
                        </div>
                    ` : '<span class="not-signed">امضا نشده</span>'}
                </div>
                <div class="sign-role">مدیر عامل</div>
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
        
        // Remaining Days logic
        let remainingDays = '-';
        let remainingClass = '';
        if (isAllocated && stageA?.allocationDate) {
             // simplified date diff logic for nodejs
             remainingDays = 'Web Calc';
        }

        return {
            idx: idx + 1,
            file: r.fileNumber,
            goods: r.goodsName,
            reg: r.registrationNumber || '-',
            company: r.company || '-',
            currencyAmt: `${fmt(amount)} ${r.mainCurrency}`,
            usdAmt: `$ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(amountInUSD)}`,
            rialAmt: fmt(Math.round(rialEquiv)),
            qDate: stageQ?.queueDate || '-',
            aDate: stageA?.allocationDate || '-',
            rem: remainingDays,
            status: isAllocated ? 'تخصیص یافته' : 'در صف',
            statusColor: isAllocated ? '#dcfce7' : '#fef9c3', // Green-100 vs Yellow-100
            statusTextColor: isAllocated ? '#166534' : '#854d0e',
            bank: r.operatingBank || '-',
            prio: r.isPriority ? '✅' : '-',
            rank: r.allocationCurrencyRank === 'Type1' ? 'نوع 1' : r.allocationCurrencyRank === 'Type2' ? 'نوع 2' : '-'
        };
    });

    // Replicate PrintAllocationReport.tsx Table Style
    const trs = processed.map(r => `
        <tr style="border-bottom: 1px solid #d1d5db; background-color: white;">
            <td style="border-left: 1px solid #d1d5db; padding: 4px;">${r.idx}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; text-align: right;">
                <div style="font-weight: bold;">${r.file}</div>
                <div style="font-size: 8px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">${r.goods}</div>
            </td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; font-family: monospace;">${r.reg}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px;">${r.company}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; direction: ltr; font-family: monospace;">${r.currencyAmt}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; direction: ltr; font-family: monospace; font-weight: bold;">${r.usdAmt}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; direction: ltr; font-family: monospace; color: #2563eb;">${r.rialAmt}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; direction: ltr;">${r.qDate}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; direction: ltr;">${r.aDate}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px;">${r.rem}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; font-weight: bold; background-color: ${r.statusColor}; color: ${r.statusTextColor};">${r.status}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; font-size: 9px;">${r.bank}</td>
            <td style="border-left: 1px solid #d1d5db; padding: 4px; font-size: 10px;">${r.prio}</td>
            <td style="padding: 4px; font-size: 10px;">${r.rank}</td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
        <style>
            body { font-family: 'Vazirmatn', sans-serif; padding: 20px; background: #fff; direction: rtl; width: 296mm; margin: 0 auto; box-sizing: border-box; }
            h2 { text-align: center; font-weight: 900; font-size: 20px; margin-bottom: 16px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; text-align: center; border: 1px solid #9ca3af; margin-bottom: 24px; }
            thead { background-color: #1e3a8a; color: white; }
            th { padding: 4px; border: 1px solid #9ca3af; font-weight: normal; }
            tbody tr:hover { background-color: #f9fafb; }
        </style>
    </head>
    <body>
        <h2>گزارش صف تخصیص ارز</h2>
        <table>
            <thead>
                <tr>
                    <th>ردیف</th><th>پرونده / کالا</th><th>ثبت سفارش</th><th>شرکت</th><th>مبلغ ارزی</th><th>معادل دلار ($)</th><th>معادل ریالی</th>
                    <th>زمان در صف</th><th>زمان تخصیص</th><th>مانده (روز)</th><th>وضعیت</th><th>بانک عامل</th><th>اولویت</th><th>نوع ارز</th>
                </tr>
            </thead>
            <tbody>${trs}</tbody>
        </table>
        <div style="font-size: 10px; color: #6b7280; text-align: center;">تولید شده توسط سیستم مدیریت بازرگانی</div>
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
        margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' } 
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

                // Get only finalized orders for archive
                const archiveOrders = db.orders.filter(o => o.status === 'تایید نهایی').sort((a,b) => b.createdAt - a.createdAt);

                if (type === 'today') {
                    const todayStr = new Date().toISOString().split('T')[0];
                    filtered = archiveOrders.filter(o => o.date === todayStr); 
                    label = 'امروز';
                } else if (type === 'month') {
                    filtered = archiveOrders.slice(0, 50); // Simplified for this example
                    label = 'این ماه';
                } else {
                    filtered = archiveOrders.slice(0, 20);
                    label = 'آخرین‌ها';
                }

                if (filtered.length === 0) {
                    return bot.sendMessage(chatId, "هیچ موردی یافت نشد.");
                }

                await bot.sendMessage(chatId, `📂 *نتایج فیلتر (${label})*\nتعداد: ${filtered.length} مورد\nدر حال ارسال لیست...`, { parse_mode: 'Markdown' });

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
                    await new Promise(r => setTimeout(r, 150)); 
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
                    // A5 Landscape matches PrintVoucher.tsx
                    const pdf = await generatePdf(html, true); 
                    await bot.sendDocument(chatId, pdf, {}, { filename: `Voucher_${order.trackingNumber}.pdf`, contentType: 'application/pdf' });
                } catch(e) { console.error(e); bot.sendMessage(chatId, 'خطا در تولید فایل.'); }
                return bot.answerCallbackQuery(query.id);
            }

            // --- TRADE REPORT GENERATION ---
            if (data === 'dl_trade_pdf') {
                const session = userSessions.get(chatId);
                if (!session) return bot.answerCallbackQuery(query.id, { text: 'نشست نامعتبر' });

                bot.sendMessage(chatId, "⏳ در حال تولید گزارش...");
                
                const records = db.tradeRecords.filter(r => session.data.includes(r.id));

                try {
                    let pdf;
                    if (session.reportType === 'queue') {
                        // Use Special Complex Report for Queue (Landscape A4) matching web app
                        const html = createAllocationReportHtml(records);
                        pdf = await generatePdf(html, true); 
                        await bot.sendDocument(chatId, pdf, {}, { filename: `Allocation_Report_${Date.now()}.pdf`, contentType: 'application/pdf' });
                    } else {
                        // Standard logic for others (simplified)
                        const rows = records.map(r => [r.fileNumber, r.goodsName, r.company, r.mainCurrency]);
                        const html = createHtmlReport("گزارش بازرگانی", ["پرونده", "کالا", "شرکت", "ارز"], rows);
                        pdf = await generatePdf(html, false);
                        await bot.sendDocument(chatId, pdf, {}, { filename: `Report_${Date.now()}.pdf`, contentType: 'application/pdf' });
                    }
                } catch(e) { console.error(e); bot.sendMessage(chatId, 'خطا در تولید.'); }
                return bot.answerCallbackQuery(query.id);
            }
            
            // Handle other trade types logic...
            if (data.startsWith('trade_type_')) {
                const rType = data.replace('trade_type_', '');
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
                 // Store IDs for PDF generation
                 userSessions.set(chatId, { ...sess, data: filtered.map(r => r.id) });
                 
                 const txt = `آماده دریافت گزارش (${filtered.length} رکورد).`;
                 const opts = { reply_markup: { inline_keyboard: [[{ text: '📥 دانلود PDF کامل', callback_data: 'dl_trade_pdf' }]] } };
                 await bot.answerCallbackQuery(query.id);
                 return bot.sendMessage(chatId, txt, { parse_mode: 'Markdown', ...opts });
            }
            
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

// Helper to generate Main Menu
const getMainMenu = (user) => {
    const keys = [];
    if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) {
        keys.push(['📊 کارتابل جاری (تایید/رد)']);
        keys.push(['💰 بایگانی دستور پرداخت']);
    }
    if (user.canManageTrade || ['admin', 'ceo', 'manager'].includes(user.role)) {
        keys.push(['🌍 گزارشات بازرگانی']);
    }
    return { keyboard: keys, resize_keyboard: true };
};

export const sendMessage = async (chatId, text) => { if (bot && chatId) try { await bot.sendMessage(chatId, text); } catch (e) {} };
export const sendDocument = async (chatId, filePath, caption) => { if (bot && chatId) try { await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption }); } catch (e) {} };
