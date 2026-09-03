// Firebase Cloud Messaging Background Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Config will be populated when Firebase is configured
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.notification?.title || data.data?.title || 'Nexus Notification';
    const options = {
      body: data.notification?.body || data.data?.body || 'You have an incoming notification on Nexus.',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      vibrate: [300, 150, 300, 150, 500],
      tag: data.data?.tag || 'nexus-alert',
      renotify: true,
      data: {
        url: data.data?.url || '/',
        callType: data.data?.callType,
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling background push notification:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
