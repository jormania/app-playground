# The Cabinet — the app-of-apps

**[coneofcold.vercel.app/cabinet-app.html](https://coneofcold.vercel.app/cabinet-app.html)**

A dashboard listing every app in this repo. The six Vite+React apps
(`kind: "react-vite"`) always show and try to hand off to each one's
*installed* PWA rather than just opening another browser tab. The
hand-authored legacy static-HTML apps (`kind: "static"` — the old Touch Grass
variants and Codex Alchymicus) always show too, with the same tile treatment,
but always read "Open" (never "Install"/"Launch") and just navigate to the
plain page — no manifest, no install detection, nothing to check. No toggle
hides either group. Reuses each app's name, icon, and blurb from
[`src/apps-registry.js`](src/apps-registry.js) — the same data `index.html`'s
card grid reads from, so there's exactly one place to update per app.

The sort bar also offers Manual (drag-reorderable, persisted), Recent
(by last-opened), Popular (by open count), and A–Z ordering — see
[`src/cabinet/App.jsx`](src/cabinet/App.jsx).

Each tile also shows "opened Xm ago" once tapped, or "opened N× · Xm ago"
after more than one tap — the count and timestamp Recent/Popular sort by.
This only counts taps on the Cabinet's own tiles (`recordOpened` in
[`src/cabinet/lib/storage.js`](src/cabinet/lib/storage.js)); launching an
installed PWA from its home-screen icon bypasses the Cabinet and isn't
counted. Local to this browser/device only — there's no sync.

Source: [`src/cabinet/`](src/cabinet/). Entry shell: `cabinet-app.html`
(**not** `cabinet.html` — see "Why the URL is `cabinet-app.html`").
Built on `src/ds/`, like any new app — see the [design-system rule](CLAUDE.md).
Its palette is lifted from `index.html`'s own warm dark/gold identity rather
than invented separately — see the comment atop
[`src/cabinet/App.module.css`](src/cabinet/App.module.css).

## How install-detection works (and why there's no "not installed" error)

The Cabinet asks the browser which of the react-vite sub-apps are already installed via
[`navigator.getInstalledRelatedApps()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getInstalledRelatedApps),
which matches against the `related_applications` list declared in
[`public/cabinet.webmanifest`](public/cabinet.webmanifest) — a list that
**deliberately no longer exists**; see "Why `related_applications` is gone"
below. The primary install signal is now the per-app flag each sub-app writes
itself (`src/shared/installFlag.ts` → `checkInstalledFlags()`).

**Only a `true` result is trusted.** The original design also showed a hard
"Not installed" error on a `false` result, on the assumption that Chromium's
answer would be reliable either way. Real-device testing on Android Chrome
disproved that: a confirmed genuine install (verified in Android's own
Settings → Apps, not just a home-screen shortcut) still came back as an empty
result from `getInstalledRelatedApps()`. Most likely cause: Chrome throttles
this API to stop it being used to fingerprint a device's installed-app list,
so it doesn't reliably hand back real data even when asked correctly. Because
a *false* "not installed" is actively misleading — worse than not claiming
anything — every non-`true` result (including an explicit `false`, `null`,
and unsupported browsers) now renders identically: a plain "Open →" link,
never an error. See the comment atop
[`src/cabinet/components/AppTile.jsx`](src/cabinet/components/AppTile.jsx).

### Why `related_applications` is gone

`cabinet.webmanifest` was the only manifest in the repo declaring a
`related_applications` array (one entry per sub-app, absolute URLs on the
production domain, since the API matches nothing else). That field was what
stopped Android Chrome ever minting a **WebAPK for the Cabinet itself**:
Chromium's install-banner logic suppresses WebAPK promotion for a page whose
own manifest carries a non-empty `related_applications` list, regardless of
`prefer_related_applications`. `chrome://webapks` listed every sub-app but not
the Cabinet, while Chrome's install UI wrongly reported it "already installed"
off a stale local flag. Every sibling manifest lacks the field and minted
fine — so the field was removed. **Don't re-add it**, on this manifest or as a
step when adding a new app; `installState.test.js` pins its absence.

The accepted tradeoff: `getInstalledRelatedApps()` now has nothing to match, so
it always answers empty here, and `reconcileInstallFlags()` can never reach the
conclusive answer it needs to clear a stale "Launch" flag after a sub-app is
uninstalled. That secondary cleanup is inert (still correct, just never fires).
The primary signal — `checkInstalledFlags()` reading each app's own flag from
`src/shared/installFlag.ts` — is untouched. See
[`src/cabinet/lib/installState.js`](src/cabinet/lib/installState.js).

### Why the URL is `cabinet-app.html`

The Cabinet was the one app Android never minted a WebAPK for. Removing
`related_applications` (above) was necessary but not sufficient: Chrome kept
answering **"This app is already installed"** on `/cabinet.html` and refusing to
offer an install.

What it was holding was a **shortcut app** — a real, standalone-launching web app
registered only inside Chrome's own profile, never handed to Android as a
package. It appeared in neither `chrome://webapks` nor Android's Settings →
Apps, so there was nothing to uninstall; and Chrome's installed-web-app registry
is separate from per-site storage, so removing the home-screen icon, running
Site settings → Clear & reset, and clearing browsing data all left it intact.
Bumping the manifest `id` didn't shake it loose either — Chrome wasn't keying on
that.

Installing the identical manifest from a Vercel preview origin **did** mint a
real WebAPK. That isolated it: the manifest was never the problem, only the
record bound to that URL on the production origin. A genuinely new path is the
one identity change no stale record can span, so the entry shell was renamed and
`start_url` / `scope` / `id` / the service-worker scope all follow it.

`/cabinet.html` **308s to `/cabinet-app.html`** (`vercel.json`), so old links and
bookmarks keep working. Don't move it back, and don't point the manifest at the
old path — `installState.test.js` pins the new one.

## Launching into the installed app, not a browser tab (Android)

Every sub-app here shares one origin (`coneofcold.vercel.app`) with its own
exact-file manifest `scope` (e.g. `public/touch-grass.webmanifest`'s scope is
just `/touch-grass-react.html`). A plain same-origin `<a href>` tap from
inside the Cabinet's own page is ordinary in-page navigation — Android only
runs its "does an installed app own this URL?" check on an external
`ACTION_VIEW` intent (a tap from outside the browser: a notification,
another app, a home-screen icon), not on a same-tab link click. So even with
correct, non-overlapping scopes, tapping a Launch tile used to just open the
target inside the current Chrome tab/Custom Tab instead of the standalone
installed PWA — confirmed against
[Chrome's own "same-origin, multi-PWA" guidance](https://web.dev/articles/building-multiple-pwas-on-the-same-domain),
which calls this out as a known limitation and recommends separate origins
(subdomains) as the only fully reliable fix — too heavy a restructure for
this repo's one-Vercel-project, one-`main`-push-deploys setup.

The workaround: `pwaLaunchIntentUrl()` in
[`src/cabinet/lib/browserSupport.js`](src/cabinet/lib/browserSupport.js)
rewrites the target into a bare Android `intent://` URL (no `package=`,
`S.browser_fallback_url` set to the same https URL). Navigating to an
`intent://` URL always forces Android's package-manager resolution, which is
the same check an external tap gets — so it can find and launch the
installed WebAPK. `AppTile.jsx` uses this for every `react-vite` tile on
Android, **regardless of `installed` status**: if no WebAPK claims the URL,
the fallback just reopens the page in the browser, i.e. today's behavior, so
there's no downside to trying it even when install detection says false or
unknown (see the `installed` note below on why that signal can't be
trusted). `chromeIntentUrl()` (the Edge-for-Android → Chrome redirect) is
unrelated and still used only for that case.

**Confirmed working on a real device, 2026-07-03.** Android's "Open with"
chooser correctly lists the installed app now, where before it wasn't
offered at all — proof the hand-off itself works. If a specific app still
never shows up as a launch option (chooser or otherwise) even though it's
genuinely installed, the WebAPK's own Android-side verification may be
stuck — see the troubleshooting note right below.

### If a specific installed app won't launch: reinstall it

Two apps (Touch Grass, Journal of Delights — both older installs) initially
showed the browser chooser with no way to make it stick as a silent,
one-tap launch, while every other app opened straight through. Diagnostic:
on Android, Settings → Apps → *that app* → Set as default → "Supported web
addresses" shows a domain toggle **only** for an app whose Digital Asset
Link verification hasn't succeeded — a working, verified WebAPK doesn't
show this screen at all. On at least Samsung/OneUI, that toggle is
effectively read-only: switching it on doesn't persist, so there's no way
to force verification by hand. **The fix is a clean uninstall + reinstall**
of the affected app, which re-triggers verification from scratch against
the current manifest — this isn't a manifest or icon quality problem (Touch
Grass already had a full PNG icon set and still needed the reinstall).

## QR launch — "scan to open on phone"

Every app in the registry (both `kind: "react-vite"` and `kind: "static"`)
has a small QR button — next to `.btn-launch` on each `index.html` card, and
raised above the stretched link on each `AppTile`. Tapping it opens a dialog
with a client-side-generated QR code encoding
`https://coneofcold.vercel.app/<app.file>` — the same hardcoded production
domain already used by `related_applications` above and
`installState.js`'s `PROD_ORIGIN`, since a QR code is meant to be scanned by
a phone camera that has no notion of `localhost`.

The shared logic (`appQrUrl()` + a thin `QRCode.toCanvas` wrapper) lives in
[`src/shared/qrCode.ts`](src/shared/qrCode.ts) — a typed module in the
typechecked path, imported directly by both `index.html`'s inline module
script and `AppTile.jsx`. Both render lazily: the canvas is only drawn once
its dialog actually opens, not for every app up front.

Two things to keep in mind if you touch this:

- **The stretched-link z-index trap.** `AppTile` has a full-tile `<a>`
  behind everything so the whole card is tappable (see "Launching into the
  installed app" below and `.stretchedLink` in `AppTile.module.css`). The QR
  button (`.qrButton`) is deliberately raised above it (`position: relative;
  z-index: 1`, matching `.details`), and its `onClick` calls
  `preventDefault()`/`stopPropagation()` — without both, tapping it would
  also navigate the tile.
- **No `intent://` rewriting.** Unlike `pwaLaunchIntentUrl()` below, the QR
  code encodes the plain `https://` URL as-is. A code scanned by a phone's
  camera or QR-scanner app is already an external `ACTION_VIEW` intent — the
  exact case Android runs its "does an installed app own this URL?" check
  against — so the OS-level WebAPK hand-off happens on its own. The
  `intent://` rewrite exists only to force that same check for a same-tab
  link tap *inside* the Cabinet, which a QR scan was never going to be.

## Install detection, take two: each app reports its own install

`getInstalledRelatedApps()` (above) is Chrome's own answer and it's
unreliable in both directions — throttled false negatives, and per the
launch-intent section above, nothing stops a *stale* WebAPK reporting `true`
when it can no longer actually be launched. `checkInstalledFlags()` in
[`src/cabinet/lib/installState.js`](src/cabinet/lib/installState.js) reads a
second, much more direct signal: every `react-vite` app calls
`watchInstalled(file)` from
[`src/shared/installFlag.ts`](src/shared/installFlag.ts) in its own
`main.jsx`/`main.tsx`, which writes a `localStorage` flag the instant that
page is either running in standalone display mode (proof it's installed and
was opened as the app) or receives the `appinstalled` event. Same origin as
the Cabinet, so it's readable directly — no manifest matching, no async
call, no throttling. `App.jsx` seeds `installedByManifest` from this
synchronously at mount, then only ever *upgrades* an entry to `true` from
the slower `checkInstalledApps()` result — never downgrades one, per the
"only trust `true`" rule above. A new `react-vite` app needs one
`watchInstalled('<file>.html')` call added at the top of its entry point;
see any existing `main.jsx` for the pattern.

**Confirmed working on a real device, 2026-07-03**: tiles for apps already
installed (opened at least once in standalone mode since this shipped) now
correctly read "Launch" instead of "Install".

## Refreshing when you come back

A tile tap navigates away, but the Cabinet page itself often survives that —
the back button (Android and desktop alike) typically restores it from the
back/forward cache with whatever state it had before the tap, and an
installed Cabinet PWA just resumes rather than reloading. Without handling
this, the open-count/last-opened stats — and therefore the Recent/Popular
order — only ever caught up on a manual page refresh. `App.jsx` re-reads
`lastOpened`, `order`, and the install flags on `pageshow` (bfcache
restores specifically, via `event.persisted`), `visibilitychange` (tab/PWA
regaining visibility), and `focus`, so returning to the Cabinet updates
everything automatically.

## Search

The controls row includes a single narrow `<input type="search">` (no chips,
no suggestions) that filters the visible grid against `app.title` and
`app.tags` only — deliberately not the `description`/"More" text, so a
result only ever surfaces on a name or tag you'd actually recognize, not an
incidental word buried in the blurb. Logic lives in
[`src/cabinet/lib/search.js`](src/cabinet/lib/search.js)
(`matchesSearch`). It's hidden while reordering: `move()` and the
`disableUp`/`disableDown` bounds both walk the full manual order, so a
filtered view would desync a tap's target index from what's on screen.

## Adding a new app to the Cabinet

A new app only shows up in the Cabinet once it's **stable and ready** — don't
add it while still iterating. When it is:

1. In [`src/apps-registry.js`](src/apps-registry.js), add the app's entry (or
   edit its existing one) with:
   - `kind: "react-vite"` — this is what the Cabinet filters on
   - `manifest: "/your-app.webmanifest"` — must match the `<link rel="manifest">`
     the app's own HTML entry actually serves
2. Make sure that app has a real webmanifest + PWA icon set + scoped service
   worker. If it doesn't yet (see `LEGACY.md` for apps that predate this),
   copy the pattern in `public/law-of-the-day.webmanifest` +
   `public/law-of-the-day-sw.js` + `src/law-of-the-day/main.jsx`'s registration
   snippet, and a `scripts/generate-<app>-icons.mjs` icon script (copy
   `scripts/generate-law-of-the-day-icons.mjs`).
3. Nothing to add to [`public/cabinet.webmanifest`](public/cabinet.webmanifest) —
   its `related_applications` list was removed on purpose (see "Why
   `related_applications` is gone"); the next step is what wires up detection.
4. Call `watchInstalled('your-app-file.html')` from
   [`src/shared/installFlag.ts`](src/shared/installFlag.ts) at the top of the
   app's own `main.jsx`/`main.tsx` — see "Install detection, take two" below
   for why, and any existing `main.jsx` for the one-line pattern.
5. `npm test` — the registry test (`src/apps-registry.test.js`) checks every
   `react-vite` entry has a manifest path.

That's it — the Cabinet's grid and index.html's card grid both update
automatically from the one registry entry.

## Adding a legacy static app instead

Hand-authored HTML apps that predate the design system (see `LEGACY.md`) use
`kind: "static"` instead. Set that — no `manifest` field, since there's
nothing to install. It gets the same tile (icon, subtitle, "More"
description) as a react-vite app, but the action always reads "Open" and taps
just navigate to `/<app.file>` directly.
