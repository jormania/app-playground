// WhereItWent's service worker: asset caching *and* upcoming-bill reminders.
//
// The caching half predates the notification half and is unchanged — do not
// convert it to cache-first for navigations, and keep the PROD-only
// registration guard in main.jsx (see CLAUDE.md "Service workers & dev").
//
// The notification half follows NOTIFICATIONS.md: it reads the snapshot the
// page mirrors into IndexedDB and re-implements the fire predicate inline,
// because a classic worker script can't import the ES module the page uses.
// Keep this predicate in step with `billsToNotify` in lib/reminders.js.
importScripts('/shared-notify-idb.js');

var CACHE = 'whereitwent-cache-v1';
var CACHE_PREFIX = 'whereitwent-';
var DB = 'wiw-reminders', STORE = 'kv', APP = '/where-it-went-react.html';
var SYNC_TAG = 'wiw-bill-reminders';
var MAX_SENT_IDS = 200;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      // Cache Storage is origin-wide — this repo hosts many apps on one
      // origin, so only ever touch our own prefixed caches, never another
      // app's.
      return Promise.all(
        keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

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

// --- Upcoming-bill reminders ------------------------------------------------

function kvGet(key) { return self.sharedNotifyIdb.get(DB, STORE, key); }
function kvSet(key, val) { return self.sharedNotifyIdb.set(DB, STORE, key, val); }

// Whole local days from today to a YYYY-MM-DD. Built from parts, never
// Date.parse of the raw string, which would read it as UTC and land a day out
// west of Greenwich.
function daysUntilDue(dueDate, now) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dueDate || ''));
  if (!m) return null;
  var due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function formatBill(bill, now) {
  var days = daysUntilDue(bill.dueDate, now);
  var when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
  var amount = Number(bill.amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Signed — an occurrence is just as often income due (rent collected as a
  // landlord) as an expense about to post.
  var sign = bill.type === 'Income' ? '+' : '−';
  return bill.name + ' · ' + sign + amount + ' L due ' + when;
}

// Mirror of billsToNotify() in lib/reminders.js.
function billsToNotify(state, sentIds, now) {
  if (!state || !state.enabled) return [];
  var sent = sentIds || [];
  var lead = Number(state.leadDays) > 0 ? Number(state.leadDays) : 5;
  return (state.bills || []).filter(function (bill) {
    if (sent.indexOf(bill.id) !== -1) return false;
    var days = daysUntilDue(bill.dueDate, now);
    return days !== null && days >= 0 && days <= lead;
  });
}

function maybeNotify() {
  var now = new Date();
  return Promise.all([kvGet('state'), kvGet('sent')]).then(function (values) {
    var state = values[0];
    var sent = Array.isArray(values[1]) ? values[1] : [];
    var due = billsToNotify(state, sent, now);
    if (due.length === 0) return undefined;

    // One notification for one occurrence; a single summary for several, so a
    // quiet week and a busy one don't feel equally noisy.
    var body = due.length === 1
      ? formatBill(due[0], now)
      : due.length + ' due soon · ' + due.map(function (b) { return b.name; }).join(', ');

    return self.registration.showNotification('WhereItWent', {
      body: body,
      tag: 'wiw-upcoming-bills',
      icon: '/where-it-went-icon.svg',
      badge: '/where-it-went-icon.svg',
    }).then(function () {
      var next = sent.concat(due.map(function (b) { return b.id; }));
      if (next.length > MAX_SENT_IDS) next = next.slice(next.length - MAX_SENT_IDS);
      return kvSet('sent', next);
    });
  }).catch(function () {
    // A reminder that fails is a non-event; never let it break the worker.
  });
}

self.addEventListener('periodicsync', function (e) {
  if (e.tag !== SYNC_TAG) return;
  e.waitUntil(maybeNotify());
});

// Tapping a reminder focuses the app, or opens it if it isn't running.
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.indexOf('where-it-went-react') !== -1) return c.focus();
      }
      return self.clients.openWindow(APP);
    })
  );
});
