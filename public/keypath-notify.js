// KeyPath's daily reminder, imported into keypath-sw.js. Best-effort local notification on a
// Periodic Background Sync wake (an installed PWA on Chromium): read the snapshot the page keeps
// in IndexedDB (src/keypath/app/reminder.ts) and, after the chosen time, if nobody has practised
// today and it hasn't been sent today, show it. No server, no push service. The decision below is
// the same as `shouldFire` in reminder.ts (shared/notify/schedule.ts's once-per-day shape); a test
// runs both on the same cases. See NOTIFICATIONS.md. keypath-sw.js imports shared-notify-idb.js first.
(function () {
  var DB = 'keypath-reminders', STORE = 'kv', APP = '/keypath-react.html';
  var TEXT = {
    en: 'Time for your five minutes of piano.',
    ro: 'E ora celor cinci minute de pian.',
  };

  function dayKey(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function minutesOfDay(d) { return d.getHours() * 60 + d.getMinutes(); }

  // Quiet from 22:00 (QUIET_FROM in reminder.ts): a late wake waits for tomorrow.
  var QUIET_FROM = 22 * 60;

  function shouldFire(state, lastSent, now) {
    if (!state || !state.enabled || state.minutes == null) return false;
    if (minutesOfDay(now) >= QUIET_FROM) return false;
    var today = dayKey(now);
    if (state.practisedDay === today) return false;
    if (lastSent === today) return false;
    return minutesOfDay(now) >= state.minutes;
  }
  // For the page's parity test: the same function, as text.
  self.keypathShouldFire = shouldFire;

  function maybeNotify() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return Promise.resolve();
    var now = new Date();
    return Promise.all([
      self.sharedNotifyIdb.get(DB, STORE, 'state'),
      self.sharedNotifyIdb.get(DB, STORE, 'lastSent'),
    ]).then(function (v) {
      var state = v[0];
      if (!shouldFire(state, v[1], now)) return;
      var body = TEXT[state && state.language] || TEXT.en;
      return self.registration
        .showNotification('KeyPath', { body: body, tag: 'keypath-daily', icon: '/keypath-icon-192.png', badge: '/keypath-icon-192.png' })
        .then(function () { return self.sharedNotifyIdb.set(DB, STORE, 'lastSent', dayKey(now)); });
    }).catch(function () {});
  }

  self.addEventListener('periodicsync', function (e) {
    if (e.tag !== 'keypath-reminder') return;
    e.waitUntil(maybeNotify());
  });

  // Tapping the reminder brings KeyPath forward, or opens it.
  self.addEventListener('notificationclick', function (e) {
    e.notification.close();
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].url && list[i].url.indexOf('keypath-react') !== -1) return list[i].focus();
        }
        return self.clients.openWindow(APP);
      })
    );
  });
})();
