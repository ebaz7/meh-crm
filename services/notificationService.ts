
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

  // اگر پروتکل امن نیست و لوکال هاست هم نیست، هشدار بده
  if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      alert("⚠️ توجه: مرورگرها اجازه نمایش نوتیفیکیشن روی آدرس‌های غیرامن (HTTP) را نمی‌دهند. لطفاً از HTTPS یا localhost استفاده کنید.");
      return false;
  }

  try {
      // درخواست مجوز
      const permission = await Notification.requestPermission();
      console.log("Notification permission result:", permission);
      return permission === "granted";
  } catch (e) {
      console.error("Permission request error:", e);
      // تلاش دوم برای مرورگرهای قدیمی
      return new Promise((resolve) => {
          Notification.requestPermission((perm) => {
              resolve(perm === "granted");
          });
      });
  }
};

export const sendNotification = async (title: string, body: string) => {
  // 1. اگر کاربر کلاً دکمه را خاموش کرده
  if (!isNotificationEnabledInApp()) {
      console.log("Notif disabled by user pref.");
      return;
  }

  // 2. اگر مجوز نداریم
  if (Notification.permission !== "granted") {
      console.warn("Notif permission not granted:", Notification.permission);
      return;
  }

  const options: any = {
      body: body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
      tag: 'payment-sys-' + Date.now(), // تگ یکتا برای جلوگیری از حذف پیام قبلی
      renotify: true,
      requireInteraction: false, // بستن خودکار بعد از چند ثانیه
      silent: false
  };

  try {
      // تلاش اول: روش استاندارد (سریعترین روش برای دسکتاپ و تست)
      const notification = new Notification(title, options);
      
      // پخش صدا به صورت دستی اگر مرورگر اجازه داد
      try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {}); // خطا را نادیده بگیر (نیاز به تعامل کاربر)
      } catch (e) {}

      notification.onclick = function() {
          window.focus();
          notification.close();
      };
      
      console.log("Notification sent via Standard API.");
  } catch (e) {
      console.warn("Standard Notification failed, trying Service Worker...", e);
      
      // تلاش دوم: سرویس ورکر (برای موبایل و PWA)
      if ('serviceWorker' in navigator) {
          try {
              const registration = await navigator.serviceWorker.ready;
              if (registration) {
                  await registration.showNotification(title, options);
                  console.log("Notification sent via Service Worker.");
              }
          } catch (swError) {
              console.error("SW Notification failed:", swError);
          }
      }
  }
};
