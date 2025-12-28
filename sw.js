
const CACHE_NAME = 'payment-sys-v2-robust';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); 
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
  return self.clients.claim(); 
});

// 1. Handle Messages from Client (React App) - Local Notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SEND_NOTIFICATION') {
    const title = event.data.title || 'پیام سیستم';
    const options = {
      body: event.data.body,
      icon: '/pwa-192x192.png', 
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
      vibrate: [200, 100, 200], 
      tag: 'payment-sys-tag',
      renotify: true,
      requireInteraction: false,
      data: {
        url: self.registration.scope 
      }
    };
    self.registration.showNotification(title, options);
  }
});

// 2. Handle Server Push Events (Web Push) - Works even when app is closed!
self.addEventListener('push', (event) => {
  let data = { title: 'اعلان جدید', body: 'پیام جدیدی دریافت شد', url: '/' };
  
  if (event.data) {
    try {
        const json = event.data.json();
        data = { ...data, ...json };
    } catch (e) {
        data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'fa',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 3. Handle Notification Click (Focus or Open App)
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); 

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(function(clientList) {
      // Try to find existing window
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
      return; 
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
