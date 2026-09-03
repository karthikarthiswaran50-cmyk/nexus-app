// Nexus PWA Service Worker v3 (Auto-purging corrupt cache & Safe Pass-through)
const CACHE_NAME = 'nexus-cache-v3';

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

// Pass-through fetch event (ensures PWA install criteria without breaking network loads)
self.addEventListener('fetch', () => {
  return;
});
