
const CACHE_NAME = 'payment-sys-v2-robust';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of all clients immediately
});

// 1. Handle Messages from Client (React App)
// This allows the app to trigger a "System Notification" via the Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SEND_NOTIFICATION') {
    const title = event.data.title || 'پیام سیستم';
    const options = {
      body: event.data.body,
      icon: '/pwa-192x192.png', // Ensure this icon exists in public folder
      badge: '/pwa-192x192.png', // Small icon for status bar (Android)
      dir: 'rtl',
      lang: 'fa',
      vibrate: [200, 100, 200], // Vibration pattern
      tag: 'payment-sys-tag', // Groups notifications so they don't stack infinitely
      renotify: true, // Play sound/vibrate even if tag exists
      requireInteraction: false, // Let it close automatically or stay based on OS preference
      data: {
        url: self.registration.scope // Url to open on click
      }
    };

    // Show the notification via the Service Worker Registration
    // This is the "Native" way that works on Android/iOS PWA
    self.registration.showNotification(title, options);
  }
});

// 2. Handle Notification Click
// When user clicks the pop-up, open or focus the app
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Close the notification

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(function(clientList) {
      // If a window is already open, focus it
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Network first strategy for API calls, Cache first for assets
  if (event.request.url.includes('/api/')) {
      return; 
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
