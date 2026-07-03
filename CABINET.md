# The Cabinet — the app-of-apps

**[coneofcold.vercel.app/cabinet.html](https://coneofcold.vercel.app/cabinet.html)**

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

Source: [`src/cabinet/`](src/cabinet/). Entry shell: `cabinet.html`.
Built on `src/ds/`, like any new app — see the [design-system rule](CLAUDE.md).
Its palette is lifted from `index.html`'s own warm dark/gold identity rather
than invented separately — see the comment atop
[`src/cabinet/App.module.css`](src/cabinet/App.module.css).

## How install-detection works (and why there's no "not installed" error)

The Cabinet asks the browser which of the six react-vite sub-apps are already installed via
[`navigator.getInstalledRelatedApps()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getInstalledRelatedApps),
matched against the `related_applications` list declared in
[`public/cabinet.webmanifest`](public/cabinet.webmanifest).

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

`related_applications` entries must be **absolute URLs**, so they're hardcoded
to the production domain (`https://coneofcold.vercel.app`). This means even a
`true` result only ever shows up on the deployed site, not `localhost` — see
[`src/cabinet/lib/installState.js`](src/cabinet/lib/installState.js).

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
3. Add that manifest's absolute production URL to `related_applications` in
   [`public/cabinet.webmanifest`](public/cabinet.webmanifest).
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
