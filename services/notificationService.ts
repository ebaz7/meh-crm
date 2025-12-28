
const PREF_KEY = 'app_notification_pref';

// Check if user enabled notifications in the app settings
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

  try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
          // Trigger the controller logic indirectly by page reload or state change if needed, 
          // but usually this function is called from Settings which will trigger the controller hook on next mount.
          window.location.reload(); 
          return true;
      } else {
          return false;
      }
  } catch (e) {
      console.error("Permission request error:", e);
      return false;
  }
};

// Deprecated in favor of Backend Push, but kept for Fallback
export const sendNotification = async (title: string, body: string) => {
  // Legacy local notification (only works if tab is open)
  if (isNotificationEnabledInApp() && Notification.permission === "granted") {
      new Notification(title, { body, icon: '/pwa-192x192.png', dir: 'rtl', lang: 'fa' });
  }
};
