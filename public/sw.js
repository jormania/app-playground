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

// ---- Daily call in the background (Periodic Background Sync) ----
// The browser may wake this worker periodically (installed PWA, Chromium). We
// read the shared IndexedDB the app keeps, work out today's sunset−2h ourselves,
// and show the reminder if we're in the evening window and haven't sent today.
function tgOpenDB() {
  return new Promise(function (resolve, reject) {
    var r = indexedDB.open('tg-call', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
    r.onsuccess = function () { resolve(r.result); };
    r.onerror = function () { reject(r.error); };
  });
}
function tgGet(key) {
  return tgOpenDB().then(function (db) {
    return new Promise(function (resolve) {
      var t = db.transaction('kv', 'readonly').objectStore('kv').get(key);
      t.onsuccess = function () { resolve(t.result); };
      t.onerror = function () { resolve(undefined); };
    });
  }).catch(function () { return undefined; });
}
function tgSet(key, val) {
  return tgOpenDB().then(function (db) {
    return new Promise(function (resolve) {
      var tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { resolve(); };
    });
  }).catch(function () {});
}

// sunset, ported from SunCalc (no dependencies)
var TG_RAD = Math.PI / 180, TG_DAY = 86400000, TG_J1970 = 2440588, TG_J2000 = 2451545, TG_J0 = 0.0009, TG_E = TG_RAD * 23.4397;
function tgFromJulian(j) { return new Date((j + 0.5 - TG_J1970) * TG_DAY); }
function tgSunset(date, lat, lng) {
  var lw = TG_RAD * -lng, phi = TG_RAD * lat;
  var d = date.valueOf() / TG_DAY - 0.5 + TG_J1970 - TG_J2000;
  var n = Math.round(d - TG_J0 - lw / (2 * Math.PI));
  var ds = TG_J0 + (0 + lw) / (2 * Math.PI) + n;
  var M = TG_RAD * (357.5291 + 0.98560028 * ds);
  var L = M + TG_RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + TG_RAD * 102.9372 + Math.PI;
  var dec = Math.asin(Math.sin(TG_E) * Math.sin(L));
  var h0 = -0.833 * TG_RAD;
  var w = Math.acos((Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  var a = TG_J0 + (w + lw) / (2 * Math.PI) + n;
  var Jset = TG_J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return tgFromJulian(Jset);
}
function tgTodayKey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function tgBody(walked, name, beforeSunset) {
  if (walked) return name ? ('You have been out today — ' + name + ' is yours. Rest, or go once more before dark.') : 'You walked today; the world noticed. Rest easy.';
  if (beforeSunset) return 'A couple of hours of light left — somewhere out there a small strange thing is waiting.';
  return 'Evening is settling in. A short walk before the dark? Something is always waiting.';
}

self.addEventListener('periodicsync', function (e) {
  if (e.tag !== 'tg-daily-call') return;
  e.waitUntil(tgMaybeDailyCall());
});

function tgMaybeDailyCall() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return Promise.resolve();
  var now = new Date();
  var today = tgTodayKey(now);
  return Promise.all([tgGet('callEnabled'), tgGet('lastCallDay'), tgGet('coords'), tgGet('lastWalkDay'), tgGet('lastWalkName')]).then(function (v) {
    var enabled = v[0], last = v[1], coords = v[2], walkDay = v[3], walkName = v[4];
    if (!enabled || last === today) return; // off, or already delivered today (by app or SW)
    var callTime = null;
    if (coords && typeof coords.lat === 'number') {
      var sunset = tgSunset(now, coords.lat, coords.lon);
      if (sunset && isFinite(sunset.getTime())) callTime = sunset.getTime() - 2 * 3600000;
    }
    if (callTime == null) { var f = new Date(now); f.setHours(16, 30, 0, 0); callTime = f.getTime(); }
    var midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    // deliver on any background wake from sunset−2h until midnight (the timing is
    // the browser's to choose, so we take the chance whenever it comes)
    if (now.getTime() < callTime || now.getTime() >= midnight.getTime()) return;
    var body = tgBody(walkDay === today, walkName, now.getTime() < callTime + 2 * 3600000);
    return self.registration.showNotification('Touch Grass', {
      body: body, tag: 'tg-daily-call', icon: '/icon-192.png', badge: '/icon-192.png'
    }).then(function () { return tgSet('lastCallDay', today); });
  }).catch(function () {});
}

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
