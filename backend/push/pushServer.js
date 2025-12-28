
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', '..', 'database.json');

// Helper to read/write DB
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("Push DB Read Error", e); }
    return null;
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error("Push DB Write Error", e); }
};

// 1. Initialize VAPID Keys
export const initPushServer = () => {
    const db = getDb();
    if (!db) return;

    if (!db.settings.vapidKeys) {
        console.log(">>> [PUSH] Generating new VAPID Keys...");
        const keys = webpush.generateVAPIDKeys();
        db.settings.vapidKeys = keys;
        saveDb(db);
    }

    webpush.setVapidDetails(
        'mailto:admin@company.com', // Dummy email required by standard
        db.settings.vapidKeys.publicKey,
        db.settings.vapidKeys.privateKey
    );
    console.log(">>> [PUSH] Service Initialized.");
};

export const getPublicKey = () => {
    const db = getDb();
    return db?.settings?.vapidKeys?.publicKey;
};

// 2. Subscribe User
export const subscribeUser = (subscription, userId) => {
    const db = getDb();
    if (!db) return;

    if (!db.subscriptions) db.subscriptions = [];

    // Remove old subscription for this specific endpoint to avoid duplicates
    db.subscriptions = db.subscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);

    // Add new
    db.subscriptions.push({
        userId,
        subscription,
        timestamp: Date.now()
    });

    saveDb(db);
    console.log(`>>> [PUSH] User ${userId} subscribed.`);
};

// 3. Send Notification Logic
export const sendPushNotification = async (target, payload) => {
    const db = getDb();
    if (!db || !db.subscriptions) return;

    let targets = [];

    // Target Logic
    if (target.type === 'ROLE') {
        const usersInRole = db.users.filter(u => u.role === target.value || u.role === 'admin').map(u => u.id);
        targets = db.subscriptions.filter(s => usersInRole.includes(s.userId));
    } else if (target.type === 'USER_ID') {
        targets = db.subscriptions.filter(s => s.userId === target.value);
    } else if (target.type === 'USERNAME') {
        const user = db.users.find(u => u.username === target.value || u.fullName === target.value);
        if (user) {
            targets = db.subscriptions.filter(s => s.userId === user.id);
        }
    }

    if (targets.length === 0) return;

    const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/',
        icon: '/pwa-192x192.png'
    });

    console.log(`>>> [PUSH] Sending to ${targets.length} devices...`);

    const promises = targets.map(sub => {
        return webpush.sendNotification(sub.subscription, notificationPayload)
            .catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired, remove it
                    console.log(`>>> [PUSH] Removing expired subscription for user ${sub.userId}`);
                    db.subscriptions = db.subscriptions.filter(s => s.subscription.endpoint !== sub.subscription.endpoint);
                    saveDb(db);
                } else {
                    console.error(">>> [PUSH] Send Error:", err.message);
                }
            });
    });

    await Promise.all(promises);
};
