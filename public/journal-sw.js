// Journal of Delights — a dedicated, minimal service worker: notifications only. No asset
// caching here — the app already keeps its own offline data cache in localStorage (see
// offlineClient.js), so this worker's only job is Periodic Background Sync. Scoped to
// /journal-of-delights-react.html (see main.jsx), so it never touches Touch Grass's
// root-scope /sw.js. Built on the same shared foundation as the other two apps' service
// workers (see NOTIFICATIONS.md).
importScripts('/shared-notify-idb.js');

var DB = 'jod-reminders', STORE = 'kv', APP = '/journal-of-delights-react.html';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

function get(key) { return self.sharedNotifyIdb.get(DB, STORE, key); }
function set(key, val) { return self.sharedNotifyIdb.set(DB, STORE, key, val); }

function todayKey(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function atLocalTime(now, hour) {
  var d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}
function onThisDayBody(matches) {
  if (matches.length === 1) return 'On this day: ' + matches[0].title + ' (' + matches[0].date.slice(0, 4) + ').';
  return 'On this day, ' + matches.length + ' delights from years past are worth a look.';
}
function show(body, tag) {
  return self.registration.showNotification('Journal of Delights', {
    body: body, tag: tag, icon: '/journal-icon.svg', badge: '/journal-icon.svg',
  });
}

// Two independent evening checks, each once a day: a 9pm nudge to write today's delight
// (skipped if it's already written), and a 7pm "on this day" note (skipped entirely — no
// notification at all — when no past year shares today's calendar day).
function maybeNotify() {
  var now = new Date(), today = todayKey(now), nowMs = now.getTime();
  return Promise.all([get('state'), get('lastNudgeSent'), get('lastOnThisDaySent')]).then(function (v) {
    var state = v[0], lastNudge = v[1], lastOnThisDay = v[2], jobs = [];
    if (!state || !state.enabled) return;

    if (state.wantNudge !== false && nowMs >= atLocalTime(now, 21) && !state.todayLogged && lastNudge !== today) {
      jobs.push(show('Anything catch your eye today? There’s still time to write it down.', 'jod-nudge')
        .then(function () { return set('lastNudgeSent', today); }));
    }

    var matches = state.onThisDay || [];
    if (state.wantOnThisDay !== false && nowMs >= atLocalTime(now, 19) && matches.length && lastOnThisDay !== today) {
      jobs.push(show(onThisDayBody(matches), 'jod-on-this-day')
        .then(function () { return set('lastOnThisDaySent', today); }));
    }

    return Promise.all(jobs);
  }).catch(function () {});
}

self.addEventListener('periodicsync', function (e) {
  if (e.tag !== 'jod-reminders') return;
  e.waitUntil(maybeNotify());
});

// Tapping a reminder focuses the app (or opens it).
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.indexOf('journal-of-delights-react') !== -1) return c.focus();
      }
      return self.clients.openWindow(APP);
    })
  );
});
