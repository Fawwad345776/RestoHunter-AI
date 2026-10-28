// Self-destructing service worker to clear caches across all client browsers
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      return self.registration.unregister();
    })
  );
});
