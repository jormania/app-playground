# Coneofcold Trove — the app-of-apps

**[coneofcold.vercel.app/coneofcold-trove.html](https://coneofcold.vercel.app/coneofcold-trove.html)**

A dashboard that lists just the Vite+React apps in this repo (not the static
HTML ones) and tries to hand off to each one's *installed* PWA rather than
just opening another browser tab. Reuses each app's name, icon, and blurb from
[`src/apps-registry.js`](src/apps-registry.js) — the same data `index.html`'s
card grid reads from, so there's exactly one place to update per app.

Source: [`src/trove/`](src/trove/). Entry shell: `coneofcold-trove.html`. Built
on `src/ds/`, like any new app — see the [design-system rule](CLAUDE.md).

## How install-detection works (and where it doesn't)

Trove asks the browser which of the six sub-apps are already installed via
[`navigator.getInstalledRelatedApps()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getInstalledRelatedApps),
matched against the `related_applications` list declared in
[`public/coneofcold-trove.webmanifest`](public/coneofcold-trove.webmanifest).

- **Chromium (desktop Chrome/Edge, Android Chrome):** real detection. An
  uninstalled app shows a genuine "Not installed" state with an explanation;
  an installed one shows "Launch →".
- **Everywhere else (Safari, Firefox):** no such API exists. Trove shows a
  plain "Open →" link and a one-time disclaimer instead of guessing — it
  never claims an app is "not installed" without being able to verify it.

`related_applications` entries must be **absolute URLs**, so they're hardcoded
to the production domain (`https://coneofcold.vercel.app`). This means real
detection only works on the deployed site, not `localhost` — expected, not a
bug. See [`src/trove/lib/installState.js`](src/trove/lib/installState.js).

## Adding a new app to Trove

A new app only shows up in Trove once it's **stable and ready** — don't add it
while still iterating. When it is:

1. In [`src/apps-registry.js`](src/apps-registry.js), add the app's entry (or
   edit its existing one) with:
   - `kind: "react-vite"` — this is what Trove filters on
   - `manifest: "/your-app.webmanifest"` — must match the `<link rel="manifest">`
     the app's own HTML entry actually serves
2. Make sure that app has a real webmanifest + PWA icon set + scoped service
   worker. If it doesn't yet (see `LEGACY.md` for apps that predate this),
   copy the pattern in `public/law-of-the-day.webmanifest` +
   `public/law-of-the-day-sw.js` + `src/law-of-the-day/main.jsx`'s registration
   snippet, and a `scripts/generate-<app>-icons.mjs` icon script (copy
   `scripts/generate-law-of-the-day-icons.mjs`).
3. Add that manifest's absolute production URL to `related_applications` in
   [`public/coneofcold-trove.webmanifest`](public/coneofcold-trove.webmanifest).
4. `npm test` — the registry test (`src/apps-registry.test.js`) checks every
   `react-vite` entry has a manifest path.

That's it — Trove's grid and index.html's card grid both update automatically
from the one registry entry.
