
const PREF_KEY = 'app_notification_pref';

export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  // 1. Check if browser supports notifications
  if (!("Notification" in window)) {
      alert("مرورگر شما از نوتیفیکیشن پشتیبانی نمی‌کند.");
      return false;
  }

  // 2. Check if context is secure (HTTPS or localhost)
  if (!window.isSecureContext) {
      console.warn("Notifications require a secure context (HTTPS).");
      // Note: We don't return false here immediately to allow local testing if browser permits
  }

  // 3. Request permission
  try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
  } catch (e) {
      console.error("Permission request error:", e);
      return false;
  }
};

export const sendNotification = async (title: string, body: string) => {
  // 1. Basic checks
  if (!isNotificationEnabledInApp()) return;
  if (Notification.permission !== "granted") {
      console.log("Permission not granted");
      return;
  }

  // 2. Prepare Options (using 'any' to bypass TypeScript strictness on 'vibrate' for iOS)
  const options: any = {
      body: body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
      tag: 'general-notification', // Overwrites older notifications with same tag
      renotify: true,
      vibrate: [200, 100, 200], // Vibration pattern
      data: {
          dateOfArrival: Date.now(),
          url: window.location.href
      }
  };

  try {
      // 3. Try Service Worker Method (Best for Mobile/PWA)
      if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration) {
              await registration.showNotification(title, options);
              return;
          }
      }
  } catch (e) {
      console.warn("Service Worker notification failed, falling back...", e);
  }

  // 4. Fallback to Standard Web Notification (Desktop/Old Browsers)
  try {
      new Notification(title, options);
  } catch (e) {
      console.error("Standard notification failed:", e);
  }
};
