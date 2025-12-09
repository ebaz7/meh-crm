
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Actions from './whatsapp/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;

// Helper to read DB locally for report generation
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

// Helper to sanitize text for Markdown
const escapeMd = (text) => {
    if (!text) return '';
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
};

export const initTelegram = (token) => {
    if (!token) {
        console.log(">>> Telegram: No token provided in settings.");
        return;
    }
    
    // Stop existing bot if any
    if (bot) {
        try { bot.stopPolling(); } catch(e) {}
    }

    try {
        // Enable Polling to fix "stuck in load"
        bot = new TelegramBot(token, { polling: true });
        console.log(">>> Telegram Bot Module Loaded & Polling ✅");

        // --- MESSAGE HANDLER ---
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text ? msg.text.trim() : '';
            
            if (!text) return;

            const db = getDb();
            if (!db) return bot.sendMessage(chatId, "❌ خطا در دسترسی به پایگاه داده.");

            // 1. REPORT / CARTABLE (With Buttons)
            if (text === '/start' || text.includes('گزارش') || text.includes('کارتابل')) {
                // If specific report requested
                if (text.includes('بازرگانی')) {
                    const report = Actions.handleTradeReport(db);
                    bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
                    return;
                }
                
                await sendInteractiveReport(chatId, db);
                return;
            }

            // 2. HELP
            if (text.includes('راهنما') || text === 'help' || text === '/help') {
                const helpText = `🤖 *راهنمای ربات تلگرام*\n\n` +
                    `📊 *مشاهده کارتابل:* ارسال کلمه "گزارش" یا "کارتابل"\n` +
                    `🌍 *گزارش بازرگانی:* ارسال کلمه "گزارش بازرگانی"\n\n` +
                    `💰 *ثبت پرداخت:* "دستور پرداخت [مبلغ] به [نام] بابت [شرح]"\n` +
                    `🚛 *ثبت حواله فروش:* "حواله فروش [تعداد] [کالا] برای [گیرنده]"\n` +
                    `📦 *صدور بیجک (انبار):* "بیجک [تعداد] [کالا] برای [گیرنده]"\n\n` +
                    `_برای تایید یا رد، از دکمه‌های شیشه‌ای زیر پیام‌های گزارش استفاده کنید._`;
                bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
                return;
            }

            // 3. CREATE PAYMENT (Regex)
            // Pattern: دستور پرداخت [amount] به [payee] بابت [desc] (بانک [bank])
            const payMatch = text.match(/(?:دستور پرداخت|ثبت پرداخت|واریز)\s+(\d+(?:[.,]\d+)?)\s*(?:ریال|تومان)?\s*(?:به|برای|در وجه)\s+(.+?)\s+(?:بابت|شرح)\s+(.+?)(?:\s+(?:از|بانک)\s+(.+))?$/);
            if (payMatch) {
                const args = {
                    amount: payMatch[1].replace(/[,.]/g, ''),
                    payee: payMatch[2].trim(),
                    description: payMatch[3].trim(),
                    bank: payMatch[4] ? payMatch[4].trim() : 'نامشخص'
                };
                const result = Actions.handleCreatePayment(db, args);
                bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
                return;
            }

            // 4. CREATE BIJAK (Regex)
            // Pattern: بیجک [count] [item] برای [recipient] ...
            const bijakMatch = text.match(/(?:بیجک|خروج انبار|صدور بیجک)\s+(\d+)\s*(?:کارتن|عدد|شاخه)?\s+(.+?)\s+(?:برای|به)\s+(.+?)(?:\s+(?:راننده)\s+(.+?))?(?:\s+(?:پلاک)\s+(.+))?$/);
            if (bijakMatch) {
                const args = {
                    count: bijakMatch[1],
                    itemName: bijakMatch[2].trim(),
                    recipient: bijakMatch[3].trim(),
                    driver: bijakMatch[4] ? bijakMatch[4].trim() : '',
                    plate: bijakMatch[5] ? bijakMatch[5].trim() : ''
                };
                const result = Actions.handleCreateBijak(db, args);
                bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
                return;
            }

            // 5. CREATE EXIT PERMIT (Sales Order Request) (Regex)
            // Pattern: حواله فروش [count] [item] برای [recipient]
            const exitMatch = text.match(/(?:حواله فروش|درخواست خروج|مجوز خروج)\s+(\d+)\s*(?:کارتن|عدد|شاخه)?\s+(.+?)\s+(?:برای|به)\s+(.+?)$/);
            if (exitMatch) {
                const args = {
                    count: exitMatch[1],
                    itemName: exitMatch[2].trim(),
                    recipient: exitMatch[3].trim()
                };
                const result = Actions.handleCreateExitPermit(db, args);
                bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
                return;
            }

            // 6. MANUAL APPROVAL (Legacy Text Command)
            if (text.startsWith('تایید') || text.startsWith('رد')) {
                // ... same logic as WhatsApp but minimal support since we have buttons
                bot.sendMessage(chatId, "💡 لطفاً برای مدیریت درخواست‌ها کلمه 'گزارش' را ارسال کنید و از دکمه‌های شیشه‌ای استفاده نمایید.");
            }

        });

        // --- CALLBACK QUERY HANDLER (BUTTON CLICKS) ---
        bot.on('callback_query', async (callbackQuery) => {
            const chatId = callbackQuery.message.chat.id;
            const data = callbackQuery.data; // e.g., "pay_approve_1001"
            const db = getDb();

            if (!db) return;

            const [type, action, id] = data.split('_'); 
            // type: 'pay' or 'exit'
            // action: 'approve' or 'reject'
            // id: number

            let resultText = '';

            try {
                if (type === 'pay') {
                    if (action === 'approve') resultText = Actions.handleApprovePayment(db, id);
                    else if (action === 'reject') resultText = Actions.handleRejectPayment(db, id);
                } else if (type === 'exit') {
                    if (action === 'approve') resultText = Actions.handleApproveExit(db, id);
                    else if (action === 'reject') resultText = Actions.handleRejectExit(db, id);
                }

                // Edit the original message to remove buttons and show status
                if (resultText.includes('تایید شد') || resultText.includes('رد شد')) {
                    const statusEmoji = action === 'approve' ? '✅' : '❌';
                    const statusText = action === 'approve' ? 'تایید شد' : 'رد شد';
                    
                    await bot.editMessageText(`${callbackQuery.message.text}\n\n${statusEmoji} *${statusText}*`, {
                        chat_id: chatId,
                        message_id: callbackQuery.message.message_id,
                        parse_mode: 'Markdown'
                    });
                    
                    bot.answerCallbackQuery(callbackQuery.id, { text: resultText });
                } else {
                    // Error or warning
                    bot.answerCallbackQuery(callbackQuery.id, { text: resultText, show_alert: true });
                }

            } catch (e) {
                console.error("Callback Error", e);
                bot.answerCallbackQuery(callbackQuery.id, { text: 'خطا در عملیات' });
            }
        });

    } catch (e) {
        console.error(">>> Telegram Init Error:", e.message);
    }
};

// --- INTERACTIVE REPORT ---
const sendInteractiveReport = async (chatId, db) => {
    const pendingOrders = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
    const pendingExits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');

    if (pendingOrders.length === 0 && pendingExits.length === 0) {
        bot.sendMessage(chatId, "✅ هیچ کارتابل بازی وجود ندارد.\nبرای مشاهده گزارشات بازرگانی، دستور 'گزارش بازرگانی' را ارسال کنید.");
        return;
    }

    bot.sendMessage(chatId, "📊 *لیست موارد در انتظار بررسی*\nلطفا با استفاده از دکمه‌ها اقدام کنید:", { parse_mode: 'Markdown' });

    // 1. Payment Orders
    for (const order of pendingOrders) {
        const msg = `💰 *دستور پرداخت #${order.trackingNumber}*\n` +
                    `👤 ذینفع: ${order.payee}\n` +
                    `💵 مبلغ: ${new Intl.NumberFormat('fa-IR').format(order.totalAmount)} ریال\n` +
                    `📝 شرح: ${order.description || '-'}\n` +
                    `⏳ وضعیت: ${order.status}`;
        
        const keyboard = {
            inline_keyboard: [[
                { text: '✅ تایید پرداخت', callback_data: `pay_approve_${order.trackingNumber}` },
                { text: '❌ رد پرداخت', callback_data: `pay_reject_${order.trackingNumber}` }
            ]]
        };

        await bot.sendMessage(chatId, msg, { reply_markup: keyboard });
    }

    // 2. Exit Permits
    for (const permit of pendingExits) {
        const goods = permit.items?.map(i => i.goodsName).join('، ') || permit.goodsName;
        const msg = `🚛 *مجوز خروج #${permit.permitNumber}*\n` +
                    `📦 کالا: ${goods}\n` +
                    `👤 گیرنده: ${permit.recipientName}\n` +
                    `⏳ وضعیت: ${permit.status}`;

        const keyboard = {
            inline_keyboard: [[
                { text: '✅ تایید خروج', callback_data: `exit_approve_${permit.permitNumber}` },
                { text: '❌ رد خروج', callback_data: `exit_reject_${permit.permitNumber}` }
            ]]
        };

        await bot.sendMessage(chatId, msg, { reply_markup: keyboard });
    }
};

export const sendMessage = async (chatId, text) => {
    if (!bot || !chatId) return;
    try {
        await bot.sendMessage(chatId, text);
    } catch (e) {
        console.error(">>> Telegram Send Msg Error:", e.message);
    }
};

export const sendDocument = async (chatId, filePath, caption) => {
    if (!bot || !chatId) return;
    try {
        if (fs.existsSync(filePath)) {
            await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption });
        }
    } catch (e) {
        console.error(">>> Telegram Send Doc Error:", e.message);
    }
};

export const getBot = () => bot;
