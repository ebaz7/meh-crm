
// Helper to save DB
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', '..', 'database.json');

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error("DB Write Error", e); }
};

const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const formatCurrency = (amount) => new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
const formatDate = () => new Date().toLocaleDateString('fa-IR');

// --- ACTIONS ---

export const handleCreatePayment = (db, args) => {
    const trackingNum = (db.settings.currentTrackingNumber || 1000) + 1;
    db.settings.currentTrackingNumber = trackingNum;
    
    const amount = typeof args.amount === 'string' ? parseInt(args.amount.replace(/[^0-9]/g, '')) : args.amount;
    
    // Create detailed payment structure exactly like UI
    const newOrder = { 
        id: generateUUID(), 
        trackingNumber: trackingNum, 
        date: new Date().toISOString().split('T')[0], 
        payee: args.payee, 
        totalAmount: amount, 
        description: args.description || 'ثبت از طریق واتساپ', 
        status: 'در انتظار بررسی مالی', 
        requester: 'WhatsApp', 
        payingCompany: db.settings.defaultCompany, 
        paymentDetails: [
            {
                id: generateUUID(), 
                method: 'حواله بانکی', // Default to Transfer
                amount: amount, 
                bankName: args.bank || 'نامشخص',
                description: args.description || 'ثبت خودکار'
            }
        ], 
        createdAt: Date.now() 
    };
    
    db.orders.unshift(newOrder);
    saveDb(db);
    return `✅ *دستور پرداخت ثبت شد*\n🔹 شماره: ${trackingNum}\n💰 مبلغ: ${formatCurrency(amount)}\n👤 ذینفع: ${args.payee}\n🏦 بانک: ${args.bank || '-'}`;
};

export const handleCreateBijak = (db, args) => {
    const company = db.settings.defaultCompany || 'نامشخص';
    const nextSeq = (db.settings.warehouseSequences?.[company] || 1000) + 1;
    if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
    db.settings.warehouseSequences = { ...db.settings.warehouseSequences, [company]: nextSeq };
    
    const newTx = { 
        id: generateUUID(), 
        type: 'OUT', 
        date: new Date().toISOString(), 
        company: company, 
        number: nextSeq, 
        recipientName: args.recipient,
        driverName: args.driver || '',   // Capture Driver
        plateNumber: args.plate || '',   // Capture Plate
        destination: args.destination || '', // Capture Destination if provided
        items: [
            {
                itemId: generateUUID(), 
                itemName: args.itemName, 
                quantity: Number(args.count), 
                weight: 0,
                unitPrice: 0
            }
        ], 
        createdAt: Date.now(), 
        createdBy: 'WhatsApp' 
    };
    
    db.warehouseTransactions.unshift(newTx);
    saveDb(db);
    
    let msg = `📦 *حواله خروج (بیجک) صادر شد*\n🔹 شماره: ${nextSeq}\n📦 کالا: ${args.count} عدد ${args.itemName}\n👤 گیرنده: ${args.recipient}`;
    if (args.driver) msg += `\n🚛 راننده: ${args.driver}`;
    if (args.plate) msg += `\n🔢 پلاک: ${args.plate}`;
    return msg;
};

// NEW: Create Exit Permit (Sales Order)
export const handleCreateExitPermit = (db, args) => {
    const nextPermitNum = (db.settings.currentExitPermitNumber || 1000) + 1;
    db.settings.currentExitPermitNumber = nextPermitNum;

    const newPermit = {
        id: generateUUID(),
        permitNumber: nextPermitNum,
        date: new Date().toISOString().split('T')[0],
        requester: 'Telegram Bot',
        items: [{
            id: generateUUID(),
            goodsName: args.itemName,
            cartonCount: Number(args.count) || 0,
            weight: 0
        }],
        destinations: [{
            id: generateUUID(),
            recipientName: args.recipient,
            address: 'ثبت شده توسط ربات',
            phone: ''
        }],
        goodsName: args.itemName, // Legacy field support
        recipientName: args.recipient, // Legacy field support
        cartonCount: Number(args.count) || 0,
        status: 'در انتظار تایید مدیرعامل',
        createdAt: Date.now()
    };

    db.exitPermits.push(newPermit);
    saveDb(db);

    return `🚛 *درخواست خروج (حواله فروش) ثبت شد*\n🔹 شماره مجوز: ${nextPermitNum}\n📦 کالا: ${args.itemName} (${args.count})\n👤 گیرنده: ${args.recipient}\n⏳ وضعیت: در انتظار تایید`;
};

// NEW: Trade Report
export const handleTradeReport = (db) => {
    const records = db.tradeRecords || [];
    const activeRecords = records.filter(r => r.status !== 'Completed');

    if (activeRecords.length === 0) return "✅ هیچ پرونده بازرگانی فعالی وجود ندارد.";

    let report = `🌍 *گزارش پرونده‌های بازرگانی فعال*\n---------------------------\n`;
    
    activeRecords.forEach(r => {
        // Determine current stage
        const stages = ['مجوزها و پروفرما', 'بیمه', 'در صف تخصیص ارز', 'تخصیص یافته', 'خرید ارز', 'اسناد حمل', 'گواهی بازرسی', 'ترخیصیه و قبض انبار', 'برگ سبز', 'حمل داخلی', 'هزینه‌های ترخیص', 'قیمت تمام شده'];
        const completedStages = stages.filter(s => r.stages && r.stages[s] && r.stages[s].isCompleted);
        const currentStage = completedStages.length > 0 ? completedStages[completedStages.length - 1] : 'شروع نشده';

        report += `📁 *پرونده: ${r.fileNumber}*\n`;
        report += `📦 کالا: ${r.goodsName}\n`;
        report += `🏢 شرکت: ${r.company || '-'}\n`;
        report += `🔄 مرحله: ${currentStage}\n`;
        report += `💰 ارز پایه: ${r.mainCurrency}\n`;
        report += `---------------------------\n`;
    });

    return report;
};

export const handleApprovePayment = (db, number) => {
    const order = db.orders.find(o => o.trackingNumber == number);
    if (!order) return "❌ دستور پرداخت یافت نشد.";
    
    let oldStatus = order.status;
    if (order.status === 'در انتظار بررسی مالی') order.status = 'تایید مالی / در انتظار مدیریت';
    else if (order.status === 'تایید مالی / در انتظار مدیریت') order.status = 'تایید مدیریت / در انتظار مدیرعامل';
    else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') order.status = 'تایید نهایی';
    else if (order.status === 'تایید نهایی') return "ℹ️ این سند قبلاً تایید نهایی شده است.";
    
    saveDb(db);
    return `✅ *تایید شد*\nدستور پرداخت: ${number}\nوضعیت قبلی: ${oldStatus}\nوضعیت جدید: ${order.status}`;
};

export const handleRejectPayment = (db, number) => {
    const order = db.orders.find(o => o.trackingNumber == number);
    if (!order) return "❌ دستور پرداخت یافت نشد.";
    
    order.status = 'رد شده';
    saveDb(db);
    return `🚫 دستور پرداخت ${number} رد شد.`;
};

// UPDATED: Fixed status strings to match frontend Types exactly (5 Stages)
export const handleApproveExit = (db, number) => {
    const permit = db.exitPermits.find(p => p.permitNumber == number);
    if (!permit) return "❌ مجوز خروج یافت نشد.";
    
    // Status Enum Mappings from types.ts
    const STATUS = {
        PENDING_CEO: 'در انتظار تایید مدیرعامل',
        PENDING_FACTORY: 'تایید مدیرعامل / در انتظار مدیر کارخانه',
        PENDING_WAREHOUSE: 'تایید کارخانه / در انتظار سرپرست انبار',
        PENDING_SECURITY: 'تایید انبار / در انتظار تایید انتظامات',
        EXITED: 'خارج شده (بایگانی)'
    };

    let oldStatus = permit.status;
    
    // 1. CEO -> Factory
    if (permit.status === STATUS.PENDING_CEO) {
        permit.status = STATUS.PENDING_FACTORY;
        permit.approverCeo = 'تایید ربات';
    }
    // 2. Factory -> Warehouse
    else if (permit.status === STATUS.PENDING_FACTORY) {
        permit.status = STATUS.PENDING_WAREHOUSE;
        permit.approverFactory = 'تایید ربات';
    }
    // 3. Warehouse -> Security (NEW STEP)
    else if (permit.status === STATUS.PENDING_WAREHOUSE) {
        permit.status = STATUS.PENDING_SECURITY;
        permit.approverWarehouse = 'تایید ربات';
    }
    // 4. Security -> Exit
    else if (permit.status === STATUS.PENDING_SECURITY) {
        permit.status = STATUS.EXITED;
        permit.approverSecurity = 'تایید ربات';
        permit.exitTime = new Date().toLocaleTimeString('fa-IR');
    }
    else {
        return "ℹ️ وضعیت این مجوز قابل تغییر نیست یا قبلاً نهایی شده است.";
    }
    
    saveDb(db);
    return `✅ *تایید شد*\nمجوز خروج: ${number}\nوضعیت جدید: ${permit.status}`;
};

export const handleRejectExit = (db, number) => {
    const permit = db.exitPermits.find(p => p.permitNumber == number);
    if (!permit) return "❌ مجوز خروج یافت نشد.";
    
    permit.status = 'رد شده';
    saveDb(db);
    return `🚫 مجوز خروج ${number} رد شد.`;
};

export const handleReport = (db) => {
    const pendingOrders = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
    const pendingExits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');
    const recentBijaks = db.warehouseTransactions.filter(t => t.type === 'OUT').slice(0, 5);
    
    let report = `📊 گزارش کارتابل دستور پرداخت‌ها\n`;
    report += `وضعیت: ${formatDate()}\n`;
    report += `---------------------------\n`;
    
    // Payments Detail
    if (pendingOrders.length > 0) {
        pendingOrders.forEach(o => {
            report += `🔹 شماره: ${o.trackingNumber}\n`;
            report += `👤 ذینفع: ${o.payee}\n`;
            report += `💰 مبلغ: ${formatCurrency(o.totalAmount)}\n`;
            report += `📝 بابت: ${o.description || '-'}\n`;
            report += `👤 ثبت‌کننده: ${o.requester}\n`;
            report += `⏳ وضعیت: ${o.status}\n`;
            report += `---------------------------\n`;
        });
    } else {
        report += "هیچ دستور پرداخت بازی وجود ندارد.\n---------------------------\n";
    }
    
    report += `🚛 گزارش حواله و خروج کالا\n`;
    report += `---------------------------\n`;

    // Exits Detail (Permits)
    if (pendingExits.length > 0) {
        report += `🔴 مجوزهای خروج در انتظار:\n`;
        pendingExits.forEach(p => {
            const items = p.items?.map(i => i.goodsName).join('، ') || p.goodsName || 'کالا';
            report += `🔸 مجوز #${p.permitNumber} | گیرنده: ${p.recipientName}\n`;
            report += `   وضعیت: ${p.status}\n`;
        });
        report += `---------------------------\n`;
    }

    // Recent Bijaks
    if (recentBijaks.length > 0) {
        report += `📦 آخرین بیجک‌های صادر شده:\n`;
        recentBijaks.forEach(b => {
            const itemsSummary = b.items.map(i => `${i.quantity} ${i.itemName}`).join('، ');
            report += `🔹 بیجک #${b.number} | ${itemsSummary}\n`;
            report += `   گیرنده: ${b.recipientName}\n`;
        });
    }

    return report;
};
