// Daily Stoic service worker: stale-while-revalidate for same-origin GETs, scoped to
// the Daily Stoic page. Enables PWA installability and offline use after first visit.
const CACHE = 'daily-stoic-cache-v1';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
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

  // Hashed assets are cache-first with background refresh.
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

// local push notifications (PWA)
importScripts('/shared-notify-idb.js');

var DB = 'daily-stoic-reminders', STORE = 'kv', APP = '/daily-stoic-react.html';

function get(key) { return self.sharedNotifyIdb.get(DB, STORE, key); }
function set(key, val) { return self.sharedNotifyIdb.set(DB, STORE, key, val); }

function todayKey(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function atLocalTime(now, hour, minute) {
  var d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function maybeNotify() {
  var now = new Date(), today = todayKey(now), nowMs = now.getTime();
  return Promise.all([get('state'), get('lastNudgeSent')]).then(function (v) {
    var state = v[0], lastNudge = v[1];
    if (!state || !state.enabled) return;

    var parts = (state.time || '08:00').split(':');
    var hour = parseInt(parts[0], 10) || 8;
    var minute = parseInt(parts[1], 10) || 0;

    if (nowMs >= atLocalTime(now, hour, minute) && !state.todayLogged && lastNudge !== today) {
      return self.registration.showNotification('Daily Stoic', {
        body: "Take a moment to reflect on today's principle.",
        tag: 'daily-stoic-nudge',
        icon: '/daily-stoic-logo.svg',
        badge: '/daily-stoic-logo.svg'
      }).then(function () {
        return set('lastNudgeSent', today);
      });
    }
  }).catch(function () {});
}

self.addEventListener('periodicsync', function (e) {
  if (e.tag !== 'daily-stoic-reminders') return;
  e.waitUntil(maybeNotify());
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.indexOf('daily-stoic-react') !== -1) return c.focus();
      }
      return self.clients.openWindow(APP);
    })
  );
});

