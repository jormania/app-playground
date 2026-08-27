// Marquee service worker: stale-while-revalidate for same-origin GETs, scoped to the
// Marquee page (enables PWA installability and offline reading of the last fetch) —
// AND, below, opt-in periodic checking for tickets that just opened. Same file for
// both, same shape public/where-it-went-sw.js uses when an app needs caching and
// notifications together (see NOTIFICATIONS.md).
//
// The notification half is genuinely different from the other three apps wired
// into src/shared/notify/: their workers only ever READ a snapshot the page
// already computed. This one does the actual work "Check venues" does — POSTs to
// /api/marquee-scan itself — because "did tickets just open" can only be
// answered by re-reading the venue pages, and a worker woken while the app is
// closed has no other way to find out. See src/marquee/notify.js for the page
// half and the reasoning behind the extra, independent snapshot this keeps.
importScripts('/shared-notify-idb.js');

const CACHE = 'marquee-cache-v1';
const REMINDERS_DB = 'marquee-reminders', REMINDERS_STORE = 'kv';
const VENUES_KEY = 'venues', PREFS_KEY = 'prefs', SNAPSHOT_KEY = 'snapshot';
const SCAN_URL = '/api/marquee-scan';
const APP_URL = '/marquee-react.html';

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

  // Hashed assets (immutable by filename) are cache-first with background refresh.
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

// ── Notifications: opt-in checking for tickets that just opened ───────────

function get(key) { return self.sharedNotifyIdb.get(REMINDERS_DB, REMINDERS_STORE, key); }
function set(key, val) { return self.sharedNotifyIdb.set(REMINDERS_DB, REMINDERS_STORE, key, val); }

// Mirrors src/marquee/notify.js's own copy of the same three functions — see
// that file's header for why a service worker carries a second copy at all
// (it can't `import` an ES module), and notify.sw.test.js for what pins the
// two together so a rule drifting between them fails a test rather than
// silently disagreeing about what counts as a change.
function kindFor(before, after) {
  if (!before) return 'new-event';
  if (before.ticketState !== 'open' && after.ticketState === 'open') return 'tickets-opened';
  if (before.ticketState !== 'sold-out' && after.ticketState === 'sold-out') return 'sold-out';
  return null;
}

function notifiableChanges(beforeMap, events, kinds) {
  var allow = {};
  kinds.forEach(function (k) { allow[k] = true; });
  var out = [];
  events.forEach(function (e) {
    var kind = kindFor(beforeMap ? beforeMap[e.key] : undefined, e);
    if (kind && allow[kind]) out.push({ kind: kind, key: e.key, title: e.title, venue: e.venue });
  });
  return out;
}

var LABEL = { 'tickets-opened': 'tickets on sale', 'sold-out': 'sold out', 'new-event': 'new' };

function notifyTitle(changes) {
  if (changes.length === 1) return 'Marquee: "' + changes[0].title + '" — ' + LABEL[changes[0].kind];
  var opened = changes.filter(function (c) { return c.kind === 'tickets-opened'; }).length;
  return opened > 0
    ? ('Marquee: ' + opened + ' tickets just opened')
    : ('Marquee: ' + changes.length + ' changes at your venues');
}

function notifyBody(changes) {
  var lines = changes.slice(0, 3).map(function (c) { return c.title + ' — ' + LABEL[c.kind] + ' (' + c.venue + ')'; });
  if (changes.length > 3) lines.push('+' + (changes.length - 3) + ' more');
  return lines.join('\n');
}

function toSnapshotMap(events) {
  var map = {};
  events.forEach(function (e) { map[e.key] = { ticketState: e.ticketState, venue: e.venue }; });
  return map;
}

function answeredVenues(venues) {
  var out = {};
  (venues || []).forEach(function (v) {
    if (v && (v.status === 'ok' || v.status === 'empty')) out[v.venue] = true;
  });
  return out;
}

// Carries a venue that did NOT answer forward from the previous snapshot —
// see notify.js's own copy for the full reasoning. Short version: a throttled
// venue contributes no events, and letting it drop out means the next time it
// answers, a genuine `none -> open` reads as `new-event` and never notifies.
function nextSnapshot(previous, events, scannedVenues) {
  var after = toSnapshotMap(events);
  if (!previous) return after;
  var answered = answeredVenues(scannedVenues);
  Object.keys(previous).forEach(function (key) {
    if (after[key]) return;
    var entry = previous[key];
    if (entry && entry.venue && answered[entry.venue]) return;
    after[key] = entry;
  });
  return after;
}

// Mirrors notify.js's own copy — see notify.sw.test.js for what pins the two
// together. 11pm-8am on the DEVICE's own clock, not configurable: the point
// of a quiet-hours toggle is a fast decision, not a second pair of time
// pickers.
function isQuietHours(now) {
  var hour = now.getHours();
  return hour >= 23 || hour < 8;
}

function showChangeNotification(changes) {
  return self.registration.showNotification(notifyTitle(changes), {
    body: notifyBody(changes),
    tag: 'marquee-changes',
    icon: '/marquee-icon.svg',
    badge: '/marquee-icon.svg',
  });
}

// The one real risk worth naming: a busy venue list (TNB alone costs ~61
// extra per-production requests, MARQUEE.md's own Open section flags it as
// the single biggest per-check request count) can take longer than a
// periodic-sync wake's own execution budget, which the browser — not this
// code — enforces and can end early. A run cut short simply doesn't reach
// `set(SNAPSHOT_KEY, ...)`, so the NEXT wake compares against the same old
// snapshot rather than a half-updated one — a slow check costs a delay,
// never a wrong notification.
function runNotifyCheck() {
  return Promise.all([get(VENUES_KEY), get(PREFS_KEY), get(SNAPSHOT_KEY)]).then(function (v) {
    var venues = v[0], prefs = v[1], snapshot = v[2];
    if (!prefs || !prefs.enabled || !venues || !venues.length) return;

    // Quiet hours are decided BEFORE the fetch, not after. The outcome is
    // identical either way (the snapshot is deliberately held, so a ticket
    // that opens at 2am is still "new" to the first check after quiet hours
    // end — one morning digest rather than a 2am ping), but doing it here
    // saves a full multi-venue scrape whose result was only going to be
    // discarded. That scrape is ~80 requests against other people's servers
    // on a busy venue list; MARQUEE.md's own politeness rule (§6) is reason
    // enough not to make it for nothing.
    if (prefs.quietHours && isQuietHours(new Date())) return;

    return fetch(SCAN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ venues: venues }),
    }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      if (!data || !Array.isArray(data.events)) return;
      var after = nextSnapshot(snapshot, data.events, data.venues);

      // No snapshot yet: this check establishes the baseline, silently — the
      // same rule changes.js's own diff uses for the app's first-ever scan.
      // Everything would technically read "new"; a wake's first-ever push
      // notification reporting the whole programme would be noise, not news.
      if (!snapshot) return set(SNAPSHOT_KEY, after);

      var changes = notifiableChanges(snapshot, data.events, prefs.kinds || ['tickets-opened']);

      var written = set(SNAPSHOT_KEY, after);
      return changes.length > 0 ? written.then(function () { return showChangeNotification(changes); }) : written;
    });
    // Best-effort throughout: any failure here (offline, the endpoint down, a
    // throttled venue) just means this wake found nothing to say. The app
    // itself, and the server's own twice-daily email check, are still the
    // source of truth either way.
  }).catch(function () {});
}

self.addEventListener('periodicsync', function (e) {
  if (e.tag !== 'marquee-reminders') return;
  e.waitUntil(runNotifyCheck());
});

// Tapping a notification focuses the app (or opens it) rather than routing to
// a specific card — "what changed" is already the first thing the programme
// shows.
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url && list[i].url.indexOf('marquee-react') !== -1) return list[i].focus();
      }
      return self.clients.openWindow(APP_URL);
    })
  );
});
