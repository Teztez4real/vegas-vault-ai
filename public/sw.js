// Vegas Vault AI — Service Worker for Push Notifications
const CACHE = 'vv-sw-v2';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Background push — fires even when app is closed
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const title = data.title || 'Vegas Vault AI';
  const options = {
    body: data.body || 'New update from Vegas Vault.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'vv-notification',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Tap notification to open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
