// Shared root-scope service worker: stale-while-revalidate for same-origin GETs.
// Enables PWA installability and offline use after the first visit, for both
// the React rewrite (/touch-grass-react.html) and the older static apps.
const CACHE = 'tg-cache-v3';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Tapping a notification focuses the app (or opens it). The walk reminder
// (tag 'tg-walk') also asks the app to return from the walk → the result panel.
self.addEventListener('notificationclick', function (e) {
  var wantReturn = e.notification.tag === 'tg-walk';
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.indexOf('touch-grass-react') !== -1) {
          c.focus();
          if (wantReturn && c.postMessage) c.postMessage({ type: 'tg-return' });
          return;
        }
      }
      return self.clients.openWindow(wantReturn ? '/touch-grass-react.html?return=1' : '/touch-grass-react.html');
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
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
