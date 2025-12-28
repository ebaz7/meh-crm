
const PREF_KEY = 'app_notification_pref';

// بررسی اینکه آیا کاربر دکمه نوتیفیکیشن را در تنظیمات روشن کرده است یا خیر
export const isNotificationEnabledInApp = (): boolean => {
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
  // 1. اگر کاربر کلاً دکمه را خاموش کرده، هیچ کاری نکن (فقط برای نوتیفیکیشن سیستم)
  if (!isNotificationEnabledInApp()) {
      console.log("System notification is disabled by user preference.");
      return;
  }

  // 2. اگر مجوز مرورگر داده نشده، کاری نکن
  if (Notification.permission !== "granted") {
      console.log("System notification permission not granted.");
      return;
  }

  const options: any = {
      body: body,
      icon: '/pwa-192x192.png', // مطمئن شوید این فایل وجود دارد
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
      tag: 'payment-sys-' + Date.now(), // تگ یکتا برای جلوگیری از حذف پیام قبلی
      renotify: true,
      requireInteraction: true, // پیام بماند تا کاربر ببندد
      data: { url: window.location.href }
  };

  try {
      // روش اول: سرویس ورکر (برای موبایل و PWA عالی است)
      if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration) {
              await registration.showNotification(title, options);
              return;
          }
      }
  } catch (e) {
      console.warn("SW Notification failed, trying fallback...", e);
  }

  // روش دوم: روش سنتی (برای دسکتاپ اگر سرویس ورکر در دسترس نباشد)
  try {
      const notification = new Notification(title, options);
      notification.onclick = function() {
          window.focus();
          notification.close();
      };
  } catch (e) {
      console.error("Notification API failed:", e);
  }
};
