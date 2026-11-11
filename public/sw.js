// TimeWarp service worker: makes the app installable and shows a friendly page when offline.
// It caches only static files (css, js, icons, 3D library). Pages, API calls, logins and chat are never cached.
const VERSION = 'timewarp-v12';
const PRECACHE = ['/offline.html', '/css/style.css', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];
const STATIC = /^\/(css|js|icons|vendor|data)\/|^\/media\/world-/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {                       // pages: always the live server; offline page only if it is unreachable
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  if (STATIC.test(url.pathname) || url.pathname === '/manifest.webmanifest') {   // static files: instant from cache, refreshed in the background
    e.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    }));
  }
});
