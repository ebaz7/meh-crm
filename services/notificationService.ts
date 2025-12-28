
const PREF_KEY = 'app_notification_pref';

export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!window.isSecureContext) {
      console.error("Notifications require HTTPS (Secure Context).");
      return false;
  }
  
  if (!("Notification" in window)) {
      console.error("This browser does not support desktop notification");
      return false;
  }

  // Check if permission is already granted
  if (Notification.permission === "granted") return true;

  // If denied, we can't ask again via code, user must reset in settings
  if (Notification.permission === "denied") {
      console.warn("Notification permission was denied previously.");
      return false;
  }

  try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
  } catch (e) {
      console.warn("Notification request failed", e);
      return false;
  }
};

export const sendNotification = async (title: string, body: string) => {
  console.log(`Attempting to send notification: ${title}`);

  if (!isNotificationEnabledInApp()) {
      console.log("Notifications disabled in app settings.");
      return;
  }
  
  if (!window.isSecureContext) return;

  if (Notification.permission === "granted") {
    // Attempt to use Service Worker for better mobile/background support
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration) {
                // iOS Safari implies strict options. Removed 'vibrate' and 'badge' to prevent potential crashes on strict parsers.
                // We use minimal options for maximum compatibility.
                const options: any = {
                    body: body,
                    dir: 'rtl',
                    lang: 'fa',
                    icon: '/pwa-192x192.png',
                    tag: 'payment-sys-notif',
                    renotify: true,
                    data: { url: window.location.href }
                };

                await registration.showNotification(title, options);
                console.log("Notification sent via Service Worker");
                return;
            }
        } catch (e) {
            console.warn("SW Notification failed, falling back to standard API", e);
        }
    }

    // Fallback for desktop or if SW not ready
    try {
        new Notification(title, { body, dir: 'rtl', lang: 'fa', icon: '/pwa-192x192.png' });
        console.log("Notification sent via Standard API");
    } catch (e) {
        console.error("Standard Notification API failed", e);
    }
  } else {
      console.log("Notification permission not granted:", Notification.permission);
  }
};
