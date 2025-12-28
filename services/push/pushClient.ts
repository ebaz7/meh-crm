
import { apiCall } from '../apiService';
import { getCurrentUser } from '../authService';

// Helper to convert VAPID key from Base64String to Uint8Array
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

export const registerPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported in this browser.');
        return;
    }

    // 1. Check/Request Permission
    if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
    }

    try {
        const user = getCurrentUser();
        if (!user) return;

        // 2. Get Service Worker Registration
        const registration = await navigator.serviceWorker.ready;
        if (!registration) return;

        // 3. Get Server Public Key
        const keyResponse = await apiCall<{publicKey: string}>('/push/vapid-key');
        if (!keyResponse || !keyResponse.publicKey) {
            console.error('[PUSH] Failed to get public key');
            return;
        }

        const convertedVapidKey = urlBase64ToUint8Array(keyResponse.publicKey);

        // 4. Subscribe (Browser talks to FCM/Mozilla Push Service)
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        // 5. Send Subscription to Our Backend
        await apiCall('/push/subscribe', 'POST', {
            subscription,
            userId: user.id
        });

        console.log('>>> [PUSH] Registered successfully for:', user.fullName);

    } catch (e) {
        console.error('>>> [PUSH] Registration failed:', e);
    }
};
