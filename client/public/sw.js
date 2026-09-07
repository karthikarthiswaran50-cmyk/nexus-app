// Nexus Royal PWA & Notification Service Worker v6
const CACHE_NAME = 'nexus-cache-v6';

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

// Pass-through fetch (ensures PWA installability, do not cache API calls)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only cache same-origin non-API static assets
  if (url.origin === self.location.origin && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/socket.io/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});

// ============================================================
// 🔔 BACKGROUND PUSH NOTIFICATION HANDLER
// Fires when server sends Web Push (receiver phone is locked / app is in background)
// ============================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { notification: { title: '👑 Nexus Royal', body: event.data.text() } };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || '👑 Nexus Royal';
  const body = notification.body || data.body || 'You have a new notification on Nexus Royal.';
  const tag = data.tag || notification.tag || 'nexus-notification';
  const isCall = tag === 'nexus-incoming-call' || data.type === 'call';

  const options = {
    body,
    icon: notification.icon || data.callerAvatar || '/icon-192.svg',
    badge: '/icon-192.svg',
    vibrate: isCall ? [800, 300, 800, 300, 800, 300, 800, 300, 800] : [250, 100, 250],
    tag: isCall ? 'nexus-incoming-call' : tag,
    renotify: true,
    requireInteraction: isCall, // WhatsApp style: call stays pinned on lockscreen until answered
    silent: false,
    actions: isCall
      ? [
          { action: 'answer', title: '📞 Answer' },
          { action: 'decline', title: '❌ Decline' },
        ]
      : undefined,
    data: {
      url: data.url || '/',
      type: data.type,
      callType: data.callType,
      conversationId: data.conversationId,
      callerId: data.callerId,
      callerName: data.callerName,
      timestamp: Date.now(),
    },
  };

  // Keep service worker alive until notification is shown
  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Also wake up any open clients so they can reconnect socket
      return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        windowClients.forEach((client) => {
          client.postMessage({ type: 'PUSH_RECEIVED', payload });
        });
      });
    })
  );
});

// ============================================================
// 👆 NOTIFICATION CLICK / TAP HANDLER
// ============================================================
self.addEventListener('notificationclick', (event) => {
  const notifData = event.notification.data || {};
  const action = event.action; // 'answer' | 'decline' | '' (body click)

  event.notification.close();

  if (action === 'decline') {
    // Close notification and notify open clients to decline
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        windowClients.forEach((client) => {
          client.postMessage({ type: 'CALL_ACTION', action: 'decline', data: notifData });
        });
      })
    );
    return;
  }

  const targetUrl = notifData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing open tab first
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICKED', data: notifData, action });
          return;
        }
      }
      // Open new tab if no existing tab found
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ============================================================
// 💬 MESSAGES FROM CLIENT (close call notification, etc.)
// ============================================================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.action === 'closeCallNotification') {
    self.registration.getNotifications({ tag: 'nexus-incoming-call' }).then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }

  if (event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
