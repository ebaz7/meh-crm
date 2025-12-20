
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import cron from 'node-cron';

// ... (Existing crash handlers and imports)

// ... (DB helper same)

// ... (Bots init same)

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

            // 1. CEO Approved -> Notify Factory Manager
            if (newStatus === 'تایید مدیرعامل / در انتظار مدیر کارخانه') {
                const phone = findUserPhoneByRole(db, 'factory_manager');
                if (phone) targetPhones.push(phone);
                msg = `🚛 *مجوز خروج تایید شد (مدیرعامل)*\nشماره: ${newPermit.permitNumber}\nدر انتظار تایید مدیر کارخانه.`;
            }
            // 2. Factory Approved -> Notify Security/Group
            else if (newStatus === 'تایید کارخانه / در انتظار انتظامات (خروج)') {
                if (db.settings?.exitPermitNotificationGroup) targetPhones.push(db.settings.exitPermitNotificationGroup);
                msg = `🏭 *تایید مدیر کارخانه صادر شد*\nشماره مجوز: ${newPermit.permitNumber}\nانتظامات محترم، لطفا پس از خروج بار ساعت را ثبت و تایید نهایی نمایید.`;
            }
            // 3. Security Approved -> EXITED -> Notify Sales Manager & Group
            else if (newStatus === 'خارج شده (بایگانی)') {
                // Notify Sales Manager (Requester)
                const salesPhone = findUserPhoneByName(db, newPermit.requester);
                if (salesPhone) targetPhones.push(salesPhone);
                
                // Notify Group
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

// ... (Rest of server.js same)
