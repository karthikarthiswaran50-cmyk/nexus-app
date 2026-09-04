// Nexus Royal PWA & Notification Service Worker v4
const CACHE_NAME = 'nexus-cache-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// Pass-through fetch event (ensures PWA installability without blocking network loads)
self.addEventListener('fetch', () => {
  return;
});

// 🔔 High-Priority Background Push Notification Handler (FCM & Web Push)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    let payload = {};
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { notification: { title: 'Nexus Notification', body: event.data.text() } };
    }

    const title = payload.notification?.title || payload.data?.title || '👑 Nexus Royal';
    const body = payload.notification?.body || payload.data?.body || 'You have a new update on Nexus.';
    const callType = payload.data?.callType || payload.data?.type;
    const isCall = callType === 'audio' || callType === 'video' || payload.data?.tag === 'nexus-incoming-call';

    const options = {
      body,
      icon: payload.notification?.icon || payload.data?.callerAvatar || '/icon-192.svg',
      badge: '/icon-192.svg',
      // Dynamic vibration: longer pulses for calls, short double pulse for messages
      vibrate: isCall ? [500, 250, 500, 250, 500] : [150, 80, 150],
      tag: payload.data?.tag || (isCall ? 'nexus-incoming-call' : 'nexus-chat-message'),
      renotify: true,
      requireInteraction: isCall,
      data: {
        url: payload.data?.url || '/',
        callType: payload.data?.callType,
        conversationId: payload.data?.conversationId,
        timestamp: Date.now(),
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Service Worker Push Error:', err);
  }
});

// 👆 Notification Click / Tap Handler (Focus existing tab or open new window)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If an existing window is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('postMessage' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: event.notification.data,
            });
          }
          return;
        }
      }

      // 2. Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Listen for messages from client windows (e.g. to close notifications)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'closeCallNotification') {
    self.registration.getNotifications({ tag: 'nexus-incoming-call' }).then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});
