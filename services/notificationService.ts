
const PREF_KEY = 'app_notification_pref';

export const isNotificationEnabledInApp = (): boolean => {
    // پیش‌فرض را true می‌گذاریم مگر اینکه کاربر صراحتاً خاموش کرده باشد
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
      alert("مرورگر شما از نوتیفیکیشن پشتیبانی نمی‌کند.");
      return false;
  }

  // درخواست مجوز
  try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
  } catch (e) {
      console.error("Permission request error:", e);
      return false;
  }
};

export const sendNotification = async (title: string, body: string) => {
  // 1. بررسی تنظیمات داخلی
  if (!isNotificationEnabledInApp()) return;

  // 2. بررسی مجوز مرورگر
  if (Notification.permission !== "granted") {
      // اگر مجوز نداریم، تلاشی نمی‌کنیم تا خطا ندهد
      return;
  }

  const options: any = {
      body: body,
      icon: '/pwa-192x192.png', 
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
      tag: 'payment-sys-' + Date.now(), // تگ یکتا برای اینکه پیام‌های جدید روی قبلی نیفتند
      renotify: true,
      requireInteraction: false, // روی موبایل زود برود که مزاحم نشود
      vibrate: [200, 100, 200]
  };

  try {
      // **حیاتی برای موبایل**: استفاده از Service Worker اگر موجود باشد
      if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration) {
              await registration.showNotification(title, options);
              return; 
          }
      }
  } catch (e) {
      console.warn("SW Notification failed, falling back to standard API...", e);
  }

  // روش استاندارد (برای دسکتاپ اگر SW کار نکرد)
  try {
      new Notification(title, options);
  } catch (e) {
      console.error("Notification API failed:", e);
  }
};
