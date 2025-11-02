// sw.js — v2.3.14-safe
const VERSION = 'v2.3.14';

// niente cache aggressiva: sempre rete; se offline, prova da cache.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req, { cache: 'no-store' }).catch(() => caches.match(req))
  );
});
