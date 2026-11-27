// Retired: Stillflow is now Mat Days, at /mat-days-react.html (MAT_DAYS.md, "Renamed").
//
// A phone that installed the old app still has a worker registered for
// /stillflow-react.html, serving its cached copy of the page cache-first, so the
// redirect in vercel.json would never be reached. The browser checks this file for
// changes when the old app opens; this version replaces that worker, clears its
// caches, unregisters, and sends any open window to the new address. Your practice
// data is untouched: it lives on this origin under keys Mat Days still reads.
var CACHE = 'stillflow-retired';
var CACHE_PREFIX = 'stillflow-';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (windows) {
        windows.forEach(function (w) {
          if (w.url.indexOf('/stillflow-react.html') !== -1) w.navigate(w.url.replace('/stillflow-react.html', '/mat-days-react.html'));
        });
      })
  );
});
