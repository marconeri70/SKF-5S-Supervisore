// v2.3.8 — SW minimale: usa sempre i file più recenti
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
