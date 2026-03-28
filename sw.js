// v3.5.0 — SW minimale: Sync Ritardi 7 Giorni
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
