
const PREF_KEY = 'app_notification_pref';

export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!window.isSecureContext) return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
  } catch (e) {
      console.warn("Notification request failed", e);
      return false;
  }
};

export const sendNotification = async (title: string, body: string) => {
  if (!isNotificationEnabledInApp()) return;
  if (!window.isSecureContext) return;

  if (Notification.permission === "granted") {
    // Attempt to use Service Worker for better mobile/background support
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration) {
                registration.showNotification(title, {
                    body,
                    dir: 'rtl',
                    lang: 'fa',
                    icon: '/pwa-192x192.png', // Ensure this icon exists or use a default
                    badge: '/pwa-192x192.png',
                    vibrate: [200, 100, 200],
                    tag: 'payment-sys-notif', // Tags prevent stacking too many notifs
                    renotify: true,
                    data: { url: window.location.href } // Data to handle click
                } as any);
                return;
            }
        } catch (e) {
            console.warn("SW Notification failed, falling back to standard API", e);
        }
    }

    // Fallback for desktop or if SW not ready
    new Notification(title, { body, dir: 'rtl', lang: 'fa' });
  }
};
