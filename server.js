
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import cron from 'node-cron';

// ... سایر کدهای سرور (crash handlers, helpers, bots init) بدون تغییر

app.put('/api/exit-permits/:id', async (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(x => x.id === req.params.id);
    if(idx !== -1) {
        const oldStatus = db.exitPermits[idx].status;
        db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body, updatedAt: Date.now() };
        saveDb(db);

        const newPermit = db.exitPermits[idx];
        const newStatus = newPermit.status;

        if (oldStatus !== newStatus) {
            let targetPhones = [];
            let msg = '';

            // ۱. تایید مدیرعامل -> اطلاع به مدیر کارخانه
            if (newStatus === 'تایید مدیرعامل / در انتظار مدیر کارخانه') {
                const phone = findUserPhoneByRole(db, 'factory_manager');
                if (phone) targetPhones.push(phone);
                msg = `🚛 *مجوز خروج تایید شد (مدیرعامل)*\nشماره: ${newPermit.permitNumber}\nدر انتظار تایید مدیر کارخانه.`;
            }
            // ۲. تایید مدیر کارخانه -> اطلاع به انتظامات/گروه
            else if (newStatus === 'تایید کارخانه / در انتظار انتظامات (خروج)') {
                if (db.settings?.exitPermitNotificationGroup) targetPhones.push(db.settings.exitPermitNotificationGroup);
                msg = `🏭 *تایید مدیر کارخانه صادر شد*\nشماره مجوز: ${newPermit.permitNumber}\nانتظامات محترم، بار آماده خروج است. پس از خروج ساعت را ثبت و تایید نمایید.`;
            }
            // ۳. خروج نهایی (تایید انتظامات) -> اطلاع به مدیر فروش و گروه
            else if (newStatus === 'خارج شده (بایگانی)') {
                const salesPhone = findUserPhoneByName(db, newPermit.requester);
                if (salesPhone) targetPhones.push(salesPhone);
                if (db.settings?.exitPermitNotificationGroup) targetPhones.push(db.settings.exitPermitNotificationGroup);
                
                msg = `✅ *بار از کارخانه خارج شد*\n🔹 شماره: ${newPermit.permitNumber}\n👤 گیرنده: ${newPermit.recipientName}\n⏰ ساعت خروج: ${newPermit.exitTime || '-'}\n🏁 فرآیند تکمیل شد.`;
            }

            for (const phone of targetPhones) {
                sendSmartNotification(phone, msg);
            }
        }

        res.json(db.exitPermits);
    } else res.sendStatus(404);
});

// بقیه فایل سرور بدون تغییر
// ...
