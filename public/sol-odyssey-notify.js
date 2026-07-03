// Sol Odyssey reminders — imported into the generated service worker (vite-plugin-pwa
// workbox.importScripts). Best-effort local notifications via Periodic Background Sync: the browser
// may wake this worker (installed PWA, Chromium); we read the snapshot the app keeps in IndexedDB
// and show the daily / weekly nudge inside its window, once per day / week, suppressed once done.
// No server, no push service — purely local. Built on the same shared foundation as Touch Grass's
// and Journal of Delights's service workers (see NOTIFICATIONS.md).
importScripts('/shared-notify-idb.js');

(function () {
  var DB = 'sol-reminders', STORE = 'kv', APP = '/sol-odysseys-react.html';

  function get(key) { return self.sharedNotifyIdb.get(DB, STORE, key); }
  function set(key, val) { return self.sharedNotifyIdb.set(DB, STORE, key, val); }

  function dateKey(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function minutesOfDay(d) { return d.getHours() * 60 + d.getMinutes(); }
  function weekKey(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + '-W' + ('0' + week).slice(-2);
  }

  // Per-type opt-in; absent => true (older snapshots).
  function wants(s, k) { return !s.want || s.want[k] !== false; }
  function shouldFireDaily(s, lastSent, now) {
    if (!s || !s.enabled || !wants(s, 'daily') || !s.cycleActive || s.dailyMinutes == null) return false;
    var today = dateKey(now);
    if (s.todayLogged === today) return false;
    if (lastSent === today) return false;
    return minutesOfDay(now) >= s.dailyMinutes;
  }
  function shouldFireWeekly(s, lastSent, now) {
    if (!s || !s.enabled || !wants(s, 'weekly') || !s.weekly || !s.weeklyDue) return false;
    if (now.getDay() !== s.weekly.dow) return false;
    if (lastSent === weekKey(now)) return false;
    return minutesOfDay(now) >= s.weekly.minutes;
  }
  function shouldFireStart(s, lastSent) {
    if (!s || !s.enabled || !wants(s, 'start') || !s.startReady || !s.startId) return false;
    return lastSent !== s.startId;
  }
  function shouldFireHarvest(s, lastSent) {
    if (!s || !s.enabled || !wants(s, 'harvest') || !s.harvestReady || !s.harvestId) return false;
    return lastSent !== s.harvestId;
  }

  function show(body, tag) {
    return self.registration.showNotification('Sol Odyssey', {
      body: body, tag: tag,
      icon: '/sol-odyssey-icon-192.png', badge: '/sol-odyssey-icon-192.png',
    });
  }

  function maybeNotify() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return Promise.resolve();
    var now = new Date();
    return Promise.all([
      get('state'), get('lastDailySent'), get('lastWeeklySent'), get('lastStartSent'), get('lastHarvestSent'),
    ]).then(function (v) {
      var state = v[0], lastDaily = v[1], lastWeekly = v[2], lastStart = v[3], lastHarvest = v[4], jobs = [];
      if (shouldFireDaily(state, lastDaily, now)) {
        jobs.push(show('Today’s tiny version is waiting — a minute is all it takes.', 'sol-daily')
          .then(function () { return set('lastDailySent', dateKey(now)); }));
      }
      if (shouldFireWeekly(state, lastWeekly, now)) {
        jobs.push(show('Your week is complete — time to reflect and adjust.', 'sol-weekly')
          .then(function () { return set('lastWeeklySent', weekKey(now)); }));
      }
      if (shouldFireStart(state, lastStart)) {
        jobs.push(show('Your planned Odyssey’s start date has arrived — ready to begin.', 'sol-start')
          .then(function () { return set('lastStartSent', state.startId); }));
      }
      if (shouldFireHarvest(state, lastHarvest)) {
        jobs.push(show('You reached the summit — time to harvest what installed.', 'sol-harvest')
          .then(function () { return set('lastHarvestSent', state.harvestId); }));
      }
      return Promise.all(jobs);
    }).catch(function () {});
  }

  self.addEventListener('periodicsync', function (e) {
    if (e.tag !== 'sol-reminders') return;
    e.waitUntil(maybeNotify());
  });

  // Tapping a reminder focuses the app (or opens it) at the right screen.
  self.addEventListener('notificationclick', function (e) {
    var tag = e.notification.tag;
    var hash = tag === 'sol-weekly' ? '#/weekly'
      : tag === 'sol-start' ? '#/overview'
      : tag === 'sol-harvest' ? '#/harvest'
      : '#/';
    e.notification.close();
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (c.url && c.url.indexOf('sol-odysseys-react') !== -1) {
            // Hand the target route to the open tab (its own router applies the hash — a service
            // worker can't set location.hash on a client directly) and bring it to the front.
            c.postMessage({ type: 'sol-odyssey:navigate', hash: hash });
            return c.focus();
          }
        }
        return self.clients.openWindow(APP + hash);
      })
    );
  });
})();
