# Local notifications — shared foundation, app-specific decisions

Three apps (Touch Grass, Sol Odyssey, Journal of Delights) each show local, best-effort
notifications on a schedule the app decides for itself — no server, no push service. This
file documents the shared foundation they're built on, so the next app doesn't grow a fourth
from-scratch copy.

## What's actually shared

`src/shared/notify/` (TypeScript, typechecked via `tsconfig.json`'s `include` — plain-JS
apps import it too; Vite/esbuild transpiles it for them without adding them to the TS
project):

- `dayKey.ts` — local-time `dayKey()`/`minutesOfDay()`/`weekKey()`/`nextMidnight()`. Always
  local, never `toISOString()` (UTC shifts the calendar day for anyone west of Greenwich).
- `schedule.ts` — the two generic "should this fire now?" shapes: `shouldFireOncePerDay`
  (past a local time, not done yet, not already sent today), `shouldFireOncePerWeek`, and
  `shouldFireOncePerId` (event-based, once per stable id — a draft id, an odyssey id, …).
- `idbKv.ts` — `createIdbKv(dbName, storeName)`, a minimal IndexedDB key-value store. Needed
  because a service worker can't read `localStorage`; the page mirrors whatever state the
  worker needs into IndexedDB instead.
- `permission.ts` — `notificationPermission()`, `requestPermission()`, `capabilities()`.
- `periodicSync.ts` — `registerPeriodicSync(tag, minIntervalMs)` /
  `unregisterPeriodicSync(tag)` / `getPeriodicSyncTags()`, wrapping Periodic Background Sync.
- `diagnostics.ts` — `gatherDiagnostics({dbName, storeName, keys})`, a generic "why did this
  go quiet?" data-gatherer (permission, registered periodicSync tags, arbitrary IDB values).
  Renders nothing itself — each app renders the result with its **own** markup/styling.
- `useDiagnosticsReveal.ts` — the "N quick taps within a window reveals the diagnostics
  panel" gesture as a hook, generalized from Touch Grass's seven-tap easter egg on its
  API-key hint (itself modeled on Android's build-number trick).

A service worker can't `import` an ES module — it's a classic script. The one place true
duplication would otherwise creep back in is the raw IndexedDB open/get/put boilerplate
inside each app's worker, so that lives in exactly one place:

- `public/shared-notify-idb.js` — a classic script exposing
  `self.sharedNotifyIdb.get(dbName, storeName, key)` / `.set(...)`, loaded via
  `importScripts('/shared-notify-idb.js')` by every app's own service worker.

## What every app still writes itself

The shared layer is deliberately thin. Each app owns:

1. **Its own fire predicates.** "Should the daily nudge fire" is domain logic (sunset math
   for Touch Grass, Odyssey cycle state for Sol Odyssey, "is today's entry written yet" for
   Journal) built on top of `schedule.ts`'s generic shapes — never forced into the shared
   layer itself.
2. **A state-mirroring effect.** Whenever the data the predicates depend on changes, write a
   small serializable snapshot to the app's own `createIdbKv(...)` store (its own db name, so
   apps never cross-contaminate). See `sol-odyssey/lib/useReminderSync.ts` or
   `journal/reminders.js`'s `writeReminderState`.
3. **Its own service worker file**, registered scoped to its own page (never the root `/`,
   so apps' workers never collide) — importing `/shared-notify-idb.js`, reading its own IDB
   snapshot, re-implementing its own fire predicates inline (vanilla JS, no build step), and
   handling its own `periodicsync` + `notificationclick` (the latter should focus/open the
   app, optionally routing to a specific in-app screen via `postMessage`).
4. **Permission + settings UI**, using `capabilities()`/`enableReminders()`-style helpers —
   request permission on enable, fall back to a clear "blocked" or "unsupported" message when
   denied or unavailable, and never assume background delivery actually happened.
5. **A diagnostics reveal**, using `useDiagnosticsReveal` + `gatherDiagnostics`, rendered with
   the app's own styling. Worth adding for any app whose reminders depend on the periodic-sync
   + IndexedDB mechanism — it's the only way to see *why* a background notification went
   quiet without a laptop and devtools attached to the device.

## Known limitations (true of all three apps, not a bug to "fix")

- Background delivery only works in an **installed PWA on Chromium** (desktop or Android).
  iOS Safari and non-installed tabs degrade to in-app-only surfaces.
- Periodic Background Sync timing is **best-effort** — the browser decides when (and
  whether) to wake the worker based on usage/engagement heuristics. A notification's "should
  fire after 9pm" window is a lower bound, not a promise of exact delivery.
- No push service means **no delivery while the browser/OS considers the app not worth
  waking** — there's no fallback path once that happens; the in-app surface catches up next
  time the app is opened.
- No cross-device sync — state lives in that browser's IndexedDB only.

## Checklist for wiring a new app in

1. Decide the fire predicate(s) — what data, what "once per day/week/id" guard shape from
   `schedule.ts` fits.
2. `createIdbKv('<app>-reminders', 'kv')` for the state snapshot; write it from an effect that
   fires whenever the relevant data changes.
3. Write a minimal service worker (`public/<app>-sw.js`), `importScripts('/shared-notify-idb.js')`,
   reimplement the predicate(s) inline, register `periodicsync` + `notificationclick`.
4. Register the worker from the app's entry point, scoped to the app's own page — resume
   `registerPeriodicSync()` on load if the user had previously opted in.
5. Settings UI: an enable toggle (permission request + blocked/unsupported messaging) and,
   if there's more than one nudge type, per-type opt-outs.
6. A diagnostics reveal (`useDiagnosticsReveal` + `gatherDiagnostics`) in the same settings
   panel, styled like the rest of the app.
7. A `?<query>=<value>` preview hook that fires one notification immediately, for manual
   testing without waiting for the real window (see Touch Grass's `?call=` or Journal's
   `?notify=`).
