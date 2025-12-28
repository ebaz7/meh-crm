
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Pointing to the main database.json in the root
const DB_PATH = path.join(__dirname, '..', '..', 'database.json');

// --- Helper: Read DB safely ---
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) {
        console.error("[PUSH] DB Read Error:", e);
    }
    return null;
};

// --- Helper: Write DB safely ---
const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("[PUSH] DB Write Error:", e);
    }
};

// 1. Initialize VAPID Keys (Run once on server start)
export const initPushServer = () => {
    const db = getDb();
    if (!db) return;

    // Generate keys if missing
    if (!db.settings.vapidKeys) {
        console.log(">>> [PUSH] Generating new VAPID Keys...");
        const keys = webpush.generateVAPIDKeys();
        db.settings.vapidKeys = keys;
        saveDb(db);
    }

    // Configure web-push
    webpush.setVapidDetails(
        'mailto:admin@payment-system.local',
        db.settings.vapidKeys.publicKey,
        db.settings.vapidKeys.privateKey
    );
    console.log(">>> [PUSH] Service Initialized. Public Key available.");
};

// 2. Get Public Key for Client
export const getPublicKey = () => {
    const db = getDb();
    return db?.settings?.vapidKeys?.publicKey;
};

// 3. Save Client Subscription
export const subscribeUser = (subscription, userId) => {
    const db = getDb();
    if (!db) return;

    if (!db.subscriptions) db.subscriptions = [];

    // Remove old subscription for this specific device endpoint to update/avoid dups
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

// 4. Send Notification Logic
export const sendPushNotification = async (target, payload) => {
    const db = getDb();
    if (!db || !db.subscriptions) return;

    let targets = [];

    // Determine who to send to
    if (target.type === 'ROLE') {
        // Find users with this role OR admin
        const usersInRole = db.users
            .filter(u => u.role === target.value || u.role === 'admin')
            .map(u => u.id);
        
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
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png'
    });

    console.log(`>>> [PUSH] Sending to ${targets.length} devices... (${payload.title})`);

    // Send to all matching subscriptions
    const promises = targets.map(sub => {
        return webpush.sendNotification(sub.subscription, notificationPayload)
            .catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired, remove it from DB
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
