// Silva's service worker — asset caching only, no notifications.
//
// Follows Fit Check's strategy: navigations are NETWORK-FIRST with a cached
// fallback, everything else is stale-while-revalidate. Do not convert
// navigations to cache-first, and keep the PROD-only registration guard in
// main.tsx (see CLAUDE.md "Service workers & dev") — under `vite dev` a
// cache-first worker pins the first copy of every unhashed dev URL forever.

var CACHE = 'silva-cache-v1';
var CACHE_PREFIX = 'silva-';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      // Cache Storage is origin-wide and this repo hosts many apps on one
      // origin — only ever touch our own prefixed caches, never another app's.
      return Promise.all(
        keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      });
    })
  );
});
