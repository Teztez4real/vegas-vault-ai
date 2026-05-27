// Vegas Vault AI — Service Worker for Push Notifications
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const title = data.title || 'Vegas Vault AI';
  const options = {
    body: data.body || 'A play has been finalized.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: data.tag || 'vv-notification',
    requireInteraction: false,
    data: { url: data.url || '/' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
