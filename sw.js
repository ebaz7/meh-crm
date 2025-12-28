
const CACHE_NAME = 'payment-sys-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Network first, fall back to cache strategy
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Handle Notification Clicks - Brings app to front
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(function(clientList) {
      // If a window is already open, focus it
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        // If the client is open but not focused, focus it
        if ('focus' in client) {
            return client.focus();
        }
      }
      // If no window is open, open one
      if (clients.openWindow)
        return clients.openWindow('/');
    })
  );
});

// Placeholder for future Push Notifications (Background Sync)
self.addEventListener('push', function(event) {
  if (event.data) {
    let data;
    try {
        data = event.data.json();
    } catch(e) {
        data = { title: 'پیام جدید', body: event.data.text() };
    }
    
    const title = data.title || 'پیام سیستم';
    const options = {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      tag: 'push-notification-' + Date.now()
    };
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});
