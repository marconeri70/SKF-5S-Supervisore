const BUILD = '2.5.0';
const STATIC_CACHE  = `skf5s-static-${BUILD}`;
const RUNTIME_CACHE = `skf5s-runtime-${BUILD}`;

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
      Promise.all(keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)))
    ).then(()=>self.clients.claim())
  );
});

// HTML/JS network-first; il resto cache-first
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

  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
