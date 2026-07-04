// Vegas Vault AI — Service Worker
// Handles Web Push delivery to all devices including closed apps on mobile.
const CACHE = 'vv-sw-v3';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Background push — fires on ALL devices even when app is fully closed/signed out.
// On Android: works in Chrome/Edge/Samsung browser automatically.
// On iOS: requires the app to be installed via "Add to Home Screen" (iOS 16.4+).
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const title = data.title || 'Vegas Vault AI';
  // "silent" is used for live-score ticker updates on watchlisted games —
  // the notification updates in place (same tag) WITHOUT re-vibrating or
  // re-alerting every time, so it behaves like a quietly-refreshing score
  // rather than a new alert every couple minutes.
  const isSilent = data.silent === true;
  const options = {
    body: data.body || 'New update from Vegas Vault AI.',
    icon: '/icon-192.png',   // proper sized icon for mobile home screen
    badge: '/icon-192.png',  // small badge icon shown in notification bar
    vibrate: isSilent ? [] : [200, 100, 200, 100, 200],
    tag: data.tag || 'vv-notification',
    renotify: !isSilent,     // silent updates replace in place, no re-alert
    silent: isSilent,
    requireInteraction: false,
    data: { url: data.url || '/dashboard' },
    actions: isSilent ? [] : [
      { action: 'open', title: 'View Pick' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Tap notification or action button → open/focus the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/dashboard';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing tab if open
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window/tab
      return clients.openWindow(url);
    })
  );
});
