// KeyPath service worker: stale-while-revalidate for same-origin GETs, scoped to
// the KeyPath page. Enables PWA installability and offline use after first visit.
// Same shape as Law of the Day's. Songs, takes and progress live in IndexedDB,
// never in this cache, so clearing it loses nothing but speed.
// The daily reminder's wake and click handlers (public/keypath-notify.js), on the shared
// notifications foundation (NOTIFICATIONS.md).
importScripts('/shared-notify-idb.js', '/keypath-notify.js');

const CACHE = 'keypath-cache-v1';
// Cache Storage is origin-wide and every app here shares one origin: activate only
// ever deletes this worker's own older caches, never another app's.
const CACHE_PREFIX = 'keypath-cache-';
// Every release brings files with new names and the cache's own name never changes, so
// without a bound it grows by each release's files for good (and a phone that agreed to
// keep KeyPath's storage never clears it). A file in use is put back on every visit online,
// which moves it to the end, so trimming from the front lets go of old releases' files first.
// A release is a few dozen files; this keeps several.
const MAX_ENTRIES = 200;
function trim(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - MAX_ENTRIES;
    return extra > 0 ? Promise.all(keys.slice(0, extra).map(function (k) { return cache.delete(k); })) : undefined;
  });
}

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigations are network-first so a fresh deploy shows immediately; falls back
  // to cache when offline.
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

  // Hashed assets (immutable by filename) are cache-first with background refresh.
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).then(function () { return trim(cache); }).catch(function () {});
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      });
    })
  );
});
