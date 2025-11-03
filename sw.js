// sw.js — v244
const CACHE = 'skf5s-244';
const ASSETS = [
  './','./index.html','./checklist.html','./notes.html','./style.css','./app.js',
  './assets/skf-192.png','./assets/skf-512.png','./assets/skf-logo.png','./assets/5S.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin){
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
