
import React, { useEffect } from 'react';
import { apiCall } from '../services/apiService';

// This component handles the registration of Service Worker and Push Subscription
// It is invisible and should be mounted once in the App layout.

const NotificationController: React.FC = () => {
  useEffect(() => {
    const registerSwAndSubscribe = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push messaging is not supported');
        return;
      }

      try {
        // 1. Register Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker Registered');

        // 2. Check if we are already subscribed
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          console.log('User is already subscribed to push');
          // Optionally send to backend to ensure it's synced
          await sendSubscriptionToBackend(existingSub);
          return;
        }

        // 3. Get VAPID Public Key from Backend
        const { publicKey } = await apiCall<{ publicKey: string }>('/vapid-key');
        
        // 4. Subscribe (This prompts the user if not granted)
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        // 5. Send Subscription to Backend
        await sendSubscriptionToBackend(subscription);
        console.log('User Subscribed successfully!');

      } catch (error) {
        console.error('Service Worker / Push Error:', error);
      }
    };

    // Helper to format key
    function urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    const sendSubscriptionToBackend = async (subscription: PushSubscription) => {
      await apiCall('/subscribe', 'POST', subscription);
    };

    // Trigger logic if user enabled notifications in previous session or setting
    if (localStorage.getItem('app_notification_pref') === 'true') {
        registerSwAndSubscribe();
    }

  }, []);

  return null; // Invisible component
};

export default NotificationController;
