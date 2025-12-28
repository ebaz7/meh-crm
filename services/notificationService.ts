
const PREF_KEY = 'app_notification_pref';

export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
      alert("مرورگر پشتیبانی نمی‌کند.");
      return false;
  }
  try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
  } catch (e) {
      console.error(e);
      return false;
  }
};

export const sendNotification = async (title: string, body: string) => {
  // 1. بررسی تنظیمات داخلی برنامه
  if (!isNotificationEnabledInApp()) return;

  // 2. بررسی مجوز مرورگر
  if (Notification.permission !== "granted") return;

  const options: any = {
      body: body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
      tag: 'app-notif-' + Date.now(), // تگ یکتا برای جلوگیری از حذف پیام قبلی
      renotify: true,
      requireInteraction: false // روی موبایل چند ثانیه بعد می‌رود
  };

  try {
      // تلاش اول: استفاده از Service Worker (برای موبایل و اندروید ضروری است)
      if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration) {
              await registration.showNotification(title, options);
              return; 
          }
      }
  } catch (e) {
      console.warn("SW notification failed, trying standard...", e);
  }

  // تلاش دوم: استفاده از روش استاندارد (Fallback برای دسکتاپ)
  try {
      new Notification(title, options);
  } catch (e) {
      console.error("Notification API failed:", e);
  }
};
