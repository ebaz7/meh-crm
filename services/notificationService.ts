
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
      
      // Additional check for iOS PWA
      // iOS requires the app to be installed (Added to Home Screen) for notifications to work
      if (permission === 'granted') {
          return true;
      } else if (permission === 'denied') {
          console.warn("Permission denied by user.");
          return false;
      } else {
          // Default/Prompt state
          return false;
      }
  } catch (e) {
      console.error("Permission request error:", e);
      return false;
  }
};

export const sendNotification = async (title: string, body: string) => {
  // 1. User Preference Check
  if (!isNotificationEnabledInApp()) {
      return;
  }

  // 2. Browser Permission Check
  if (Notification.permission !== "granted") {
      console.log("System notification permission not granted.");
      return;
  }

  try {
      // 3. Service Worker Strategy (The Robust Way)
      // We try to find the active service worker registration and use it to show the notification.
      // This is required for Android/iOS PWA to show "native" style notifications.
      if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          
          if (registration && registration.active) {
              // Send a message to SW to trigger the notification
              // We do this instead of direct showNotification here to ensure it runs in the SW context
              // which is more reliable for background/minimized states.
              registration.active.postMessage({
                  type: 'SEND_NOTIFICATION',
                  title: title,
                  body: body
              });
              return;
          }
      }

      // 4. Fallback Strategy (Desktop Legacy)
      // If SW is not ready or fails, try the main thread notification
      const notification = new Notification(title, {
          body: body,
          icon: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'fa'
      });
      
      notification.onclick = () => {
          window.focus();
          notification.close();
      };

  } catch (e) {
      console.error("Notification failed:", e);
  }
};
