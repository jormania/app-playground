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

// solar event time, ported from SunCalc (no dependencies): the "set" time when
// the sun descends through hDeg degrees (−0.833 = sunset, 6 = evening golden hour)
var TG_RAD = Math.PI / 180, TG_DAY = 86400000, TG_J1970 = 2440588, TG_J2000 = 2451545, TG_J0 = 0.0009, TG_E = TG_RAD * 23.4397;
function tgFromJulian(j) { return new Date((j + 0.5 - TG_J1970) * TG_DAY); }
function tgEventTime(date, lat, lng, hDeg) {
  var lw = TG_RAD * -lng, phi = TG_RAD * lat;
  var d = date.valueOf() / TG_DAY - 0.5 + TG_J1970 - TG_J2000;
  var n = Math.round(d - TG_J0 - lw / (2 * Math.PI));
  var ds = TG_J0 + (0 + lw) / (2 * Math.PI) + n;
  var M = TG_RAD * (357.5291 + 0.98560028 * ds);
  var L = M + TG_RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + TG_RAD * 102.9372 + Math.PI;
  var dec = Math.asin(Math.sin(TG_E) * Math.sin(L));
  var h0 = hDeg * TG_RAD;
  var w = Math.acos((Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  var a = TG_J0 + (w + lw) / (2 * Math.PI) + n;
  var Jset = TG_J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return tgFromJulian(Jset);
}
function tgFinite(date) { return date && isFinite(date.getTime()) ? date.getTime() : null; }
function tgTodayKey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function tgPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function tgDaily(beforeSunset) {
  return beforeSunset
    ? 'A couple of hours of light left — somewhere out there a small strange thing is waiting.'
    : 'Evening is settling in. A short walk before the dark? Something is always waiting.';
}
function tgGolden() {
  return tgPick([
    'The light is about to turn to honey — step out and stand in it.',
    'Golden hour is gathering. Go let it find you outside.',
    'The long warm light is nearly here. The screen will keep; the gold will not.'
  ]);
}

self.addEventListener('periodicsync', function (e) {
  if (e.tag !== 'tg-daily-call') return;
  e.waitUntil(tgMaybeCalls());
});

// In the background we can't hit an exact time, so each notification has a window
// and we deliver on whatever wake lands inside it (once per day, guards shared
// with the app). Golden hour and the almanac fire regardless of a walk; the
// generic daily fires only when there's no golden hour to offer and you haven't
// been out.
function tgMaybeCalls() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return Promise.resolve();
  var now = new Date(), today = tgTodayKey(now), nowMs = now.getTime();
  return Promise.all([
    tgGet('callEnabled'), tgGet('coords'), tgGet('lastWalkDay'),
    tgGet('lastCallDay'), tgGet('lastGoldenDay'), tgGet('lastAlmanacDay'), tgGet('almanacBody')
  ]).then(function (v) {
    var enabled = v[0], coords = v[1], walkDay = v[2], callDay = v[3], goldenDay = v[4], almanacDay = v[5], almanacBody = v[6];
    if (!enabled) return;
    var hasCoords = coords && typeof coords.lat === 'number';
    var sunset = hasCoords ? tgFinite(tgEventTime(now, coords.lat, coords.lon, -0.833)) : null;
    var golden = hasCoords ? tgFinite(tgEventTime(now, coords.lat, coords.lon, 6)) : null;
    var dailyTime = sunset != null ? sunset - 2 * 3600000 : (function () { var f = new Date(now); f.setHours(16, 30, 0, 0); return f.getTime(); })();
    var goldenNotify = golden != null ? golden - 30 * 60000 : null;
    var midnight = (function () { var m = new Date(now); m.setHours(24, 0, 0, 0); return m.getTime(); })();
    var jobs = [];
    var show = function (body, tag, dayKey) {
      jobs.push(self.registration.showNotification('Touch Grass', { body: body, tag: tag, badge: '/icon-192.png' })
        .then(function () { return tgSet(dayKey, today); }));
    };
    // golden hour — always, around its time
    if (goldenNotify != null && goldenDay !== today && nowMs >= goldenNotify && nowMs <= goldenNotify + 80 * 60000) {
      show(tgGolden(), 'tg-golden', 'lastGoldenDay');
    }
    // almanac — always on a moment day, any evening wake
    if (almanacBody && almanacDay !== today && nowMs >= dailyTime && nowMs < midnight) {
      show(almanacBody, 'tg-almanac', 'lastAlmanacDay');
    }
    // generic daily — only if there's no golden hour on offer, and not walked
    if (goldenNotify == null && callDay !== today && walkDay !== today && nowMs >= dailyTime && nowMs < midnight) {
      show(tgDaily(nowMs < dailyTime + 2 * 3600000), 'tg-daily-call', 'lastCallDay');
    }
    return Promise.all(jobs);
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
