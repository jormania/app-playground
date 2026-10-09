// The Long Listen's service worker — asset caching only.
//
// Same strategy as Silva's: navigations are NETWORK-FIRST with a cached
// fallback, so the programme you already have opens offline; everything else
// is stale-while-revalidate. Registration is PROD-only (main.tsx) — see
// CLAUDE.md "Service workers & dev". The curator endpoint and Spotify are
// never cached: they are POSTs or cross-origin, which this worker leaves alone.

var CACHE = 'long-listen-cache-v1';
var CACHE_PREFIX = 'long-listen-';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      // Cache Storage is origin-wide and this repo hosts many apps on one
      // origin — only ever touch our own prefixed caches.
      return Promise.all(
        keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// A concert programme shared to the app from the phone's share sheet arrives
// as a POST of the picture (manifest share_target). It's put in this worker's
// cache under one fixed key, and the app opens on the concert form, which
// reads it, sends it to the curator to read, and deletes it.
var SHARED_IMAGE = '/long-listen-shared-image';

function receiveShare(req) {
  return req.formData().then(function (form) {
    var file = form.get('image');
    if (!file || typeof file === 'string') return null;
    return caches.open(CACHE).then(function (cache) {
      return cache.put(SHARED_IMAGE, new Response(file, { headers: { 'content-type': file.type || 'image/jpeg' } }));
    });
  }).catch(function () { return null; }).then(function () {
    return Response.redirect('/long-listen-react.html#/concerts/new', 303);
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname === '/long-listen-react.html' && url.searchParams.get('share-target') === 'concert') {
    e.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;

  if (req.mode === 'navigate') {
    // The Spotify callback arrives as a navigation with ?code=…&state=…; it
    // must reach the page untouched, and must never be stored.
    var hasQuery = url.search !== '';
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic' && !hasQuery) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req, { ignoreSearch: true }); })
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
