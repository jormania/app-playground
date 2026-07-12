// Daily Stoic service worker: stale-while-revalidate for same-origin GETs, scoped to
// the Daily Stoic page. Enables PWA installability and offline use after first visit.
const CACHE = 'daily-stoic-cache-v2';

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
  return Promise.all([get('state'), get('lastMorningNudge'), get('lastEveningNudge')]).then(function (v) {
    var state = v[0], lastMorning = v[1], lastEvening = v[2];
    if (!state || !state.enabled) return;

    var mParts = (state.morningTime || '07:00').split(':');
    var mHour = parseInt(mParts[0], 10) || 7;
    var mMin = parseInt(mParts[1], 10) || 0;

    var eParts = (state.eveningTime || '20:00').split(':');
    var eHour = parseInt(eParts[0], 10) || 20;
    var eMin = parseInt(eParts[1], 10) || 0;

    var promise = Promise.resolve();

    if (nowMs >= atLocalTime(now, mHour, mMin) && lastMorning !== today) {
      promise = promise.then(function() {
        return self.registration.showNotification('Daily Stoic', {
          body: "Start your day with purpose. Set your morning intentions.",
          tag: 'daily-stoic-morning',
          icon: '/daily-stoic-logo.svg',
          badge: '/daily-stoic-logo.svg'
        }).then(function () { return set('lastMorningNudge', today); });
      });
    }

    if (nowMs >= atLocalTime(now, eHour, eMin) && !state.todayLogged && lastEvening !== today) {
      promise = promise.then(function() {
        return self.registration.showNotification('Daily Stoic', {
          body: "Take a moment to reflect on today's principle.",
          tag: 'daily-stoic-evening',
          icon: '/daily-stoic-logo.svg',
          badge: '/daily-stoic-logo.svg'
        }).then(function () { return set('lastEveningNudge', today); });
      });
    }

    return promise;
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
        if (c.url && c.url.indexOf('daily-stoic-react') !== -1) {
          if ('focus' in c) return c.focus();
          return c;
        }
      }
      return self.clients.openWindow(APP);
    })
  );
});

