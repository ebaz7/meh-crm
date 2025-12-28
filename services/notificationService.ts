
import { apiCall } from "./apiService";

const PREF_KEY = 'app_notification_pref';

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return false;
  }

  try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
          // Trigger Push Subscription automatically if granted
          subscribeUserToPush();
          return true;
      }
      return false;
  } catch (e) {
      console.error("Permission request error:", e);
      return false;
  }
};

export const subscribeUserToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        if (!registration) return;

        // 1. Get Public Key from Server
        const response = await apiCall<{publicKey: string}>('/vapid-key');
        if (!response || !response.publicKey) return;

        const convertedVapidKey = urlBase64ToUint8Array(response.publicKey);

        // 2. Subscribe using PushManager
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        // 3. Send Subscription to Server
        await apiCall('/subscribe', 'POST', subscription);
        console.log(">>> Push Subscription Registered Successfully!");

    } catch (e) {
        console.error("Push Subscription Failed:", e);
    }
};

export const sendNotification = async (title: string, body: string) => {
  // Local notification check
  if (!isNotificationEnabledInApp()) return;
  if (Notification.permission !== "granted") return;

  try {
      // Local immediate notification via Service Worker
      if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration && registration.active) {
              registration.active.postMessage({
                  type: 'SEND_NOTIFICATION',
                  title: title,
                  body: body
              });
              return;
          }
      }
      // Fallback
      new Notification(title, { body, icon: '/pwa-192x192.png', dir: 'rtl', lang: 'fa' });
  } catch (e) {
      console.error("Notification failed:", e);
  }
};
