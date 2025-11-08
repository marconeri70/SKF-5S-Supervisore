const BUILD = '2.4.6'; // bump ad ogni release
const STATIC_CACHE = `skf5s-static-${BUILD}`;
const RUNTIME_CACHE = `skf5s-runtime-${BUILD}`;

// file statici minimi
const PRECACHE = [
  './',
  'index.html',
  'checklist.html',
  'notes.html',
  'style.css?v='+BUILD,
  'app.js?v='+BUILD,
  'assets/skf-logo.png',
  'assets/5S.png',
  'assets/skf-192.png',
  'assets/skf-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Strategia:
// - HTML e JS: network-first (evita “file vecchi” dopo deploy)
// - Tutto il resto: cache-first con fallback rete
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const isHTML = req.headers.get('accept')?.includes('text/html');
  const isJS   = url.pathname.endsWith('.js');

  if (isHTML || isJS) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // cache-first per immagini/CSS
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
