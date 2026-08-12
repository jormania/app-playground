// Lexi5's service worker.
// Navigations are NETWORK-FIRST with a cached fallback, everything else is
// stale-while-revalidate. On install we also PRECACHE the shell, so a player who installs
// the app and opens it offline before any successful online visit still gets a game —
// previously the cache was populated purely at runtime, so that first run showed nothing.

var CACHE = 'lexi5-cache-v2';
var CACHE_PREFIX = 'lexi5-';

// The entry document plus the icons the manifest references. Hashed JS/CSS can't be named
// here (their filenames change every build) but the document pulls them in on the first
// online load, and stale-while-revalidate keeps them from then on.
var PRECACHE_URLS = [
  '/lexi5-react.html',
  '/lexi5.webmanifest',
  '/lexi5-icon-192.png',
  '/lexi5-icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // addAll is all-or-nothing; one 404 would fail the whole install and leave the
      // worker unregistered, so each URL is allowed to fail on its own.
      return Promise.all(PRECACHE_URLS.map(function (url) {
        return cache.add(url).catch(function () { /* offline or missing — runtime cache covers it */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
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
      }).catch(function () {
        // Offline: serve this navigation from cache, falling back to the precached shell
        // so a deep link (e.g. a ?seed= share URL) still opens the app.
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/lexi5-react.html');
        });
      })
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
