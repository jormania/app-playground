// Wanderlist service worker — a minimal offline shell so the installed PWA boots without
// a network (the app's data cache lives in localStorage via offlineClient.js; this only
// caches the app shell + assets). Scoped to /wanderlist-react.html (see main.jsx), so it
// never touches the other apps' workers. No notifications here — reminders are email,
// sent server-side by the daily cron.
var CACHE = 'wanderlist-shell-v1';
var SHELL = ['/wanderlist-react.html', '/wanderlist.webmanifest', '/wanderlist-icon.svg'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {}));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (e.g. Vercel insights) pass through

  // Navigations: network-first, falling back to the cached app shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('/wanderlist-react.html', copy); }).catch(function () {});
        return res;
      }).catch(function () {
        return caches.match('/wanderlist-react.html').then(function (m) { return m || caches.match(req); });
      })
    );
    return;
  }

  // Same-origin assets (hashed JS/CSS, fonts, icon): cache-first, filling the cache on
  // first fetch so a later offline load still has them.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
