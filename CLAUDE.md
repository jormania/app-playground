# app-playground — repo rules

A personal playground for standalone web apps. A few are React + Vite (under
`src/`); the rest are self-contained static HTML files at the repo root. Deploys
to Vercel on every push to `main`.

For the human-readable build playbook — how to start a new app, extend the
design system, and the full process/caveats — see the Notion page **Dev —
Building an App**. This file is its enforced, in-repo companion.

## Before declaring any task done

Run **`npm test`** and **`npm run typecheck`** and make sure both pass. Don't
call a change complete on green-looking code alone.

## Design-system boundary (one-way, enforced)

- **New apps** build on the shared design system in [`src/ds/`](src/ds/).
- **Legacy apps** — `src/touch-grass/`, `src/journal/`, `src/kettlebell/` — are
  design-locked and own their own styling. They **never import from `src/ds/`**.
- The rule flows one way: DS → new apps only. It's enforced by
  [`src/ds/boundary.test.js`](src/ds/boundary.test.js) in `npm test` — a legacy
  import fails the suite. See [`LEGACY.md`](LEGACY.md) for the full scope.

## Per-app map

| App | Location | Type |
|-----|----------|------|
| Sol Odyssey | `src/sol-odyssey/` | **strict TypeScript** — has its own [`CLAUDE.md`](src/sol-odyssey/CLAUDE.md) + `DESIGN.md`; **defer to those** inside that dir |
| Tempo | `src/tempo/` | plain JSX, builds on `src/ds/` |
| Law of the Day | `src/law-of-the-day/` | plain JSX, builds on `src/ds/` |
| Yoru | `src/yoru/` | plain JSX, builds on `src/ds/`; night-only wind-down, one fixed Tokyo Night palette (no theme toggle) — see [`YORU.md`](YORU.md) |
| The Cabinet | `src/cabinet/` | plain JSX, builds on `src/ds/`; dashboard listing every `react-vite` and legacy `static` app, always, with no toggle to hide either — see [`CABINET.md`](CABINET.md) |
| Wanderlist | `src/wanderlist/` | plain JSX + Notion; a triaged backlog of city things-to-do. **Self-styled like Journal of Delights — does NOT build on `src/ds/`** (deliberate, per brief); "atlas" identity reusing JoD's **six-palette** theme system (header cycle + a Settings → Appearance picker). Server-side email reminder (Vercel Cron + Resend + KV), Google Places autocomplete, an Add-to-Calendar link, a keyless Google Maps embed view, and an optional Cost (lei) field — see [`WANDERLIST.md`](WANDERLIST.md) |
| Journal of Delights | `src/journal/` | plain JSX, no type checking; six-palette theme system (header cycle + a Settings → Appearance picker) |
| Kettlebell Training | `src/kettlebell/` | plain JSX, no type checking |
| Touch Grass | `src/touch-grass/` | plain JSX, no type checking |
| Static HTML apps | `public/*.html` (served at the site root) | design-locked, hand-authored — edit in place |

Every app's card/tile data (name, icon, blurb, tags) lives in one place —
[`src/apps-registry.js`](src/apps-registry.js) — read by both `index.html`'s
card grid and The Cabinet. See [`CABINET.md`](CABINET.md) for the checklist
when shipping a new app.

`tsconfig.json` covers the TypeScript code — **`src/sol-odyssey`, `src/ds`, and
`src/shared`**; `npm run typecheck` type-checks all three. The other React apps
are plain JS/JSX by design and intentionally left out (they still import from
`src/shared`, just without typechecking at those call sites).

## Cross-app shared logic (`src/shared/`) — distinct from `src/ds/`

`src/shared/` holds logic every app (new or legacy) may import — it is **not**
part of the design-system boundary above, which is about styling only. Any app
can use it, including the legacy ones. Today it holds `src/shared/notify/`, the
local-notifications foundation (Periodic Background Sync + IndexedDB state
mirroring + a diagnostics reveal) used by Touch Grass, Sol Odyssey, and Journal
of Delights — see [`NOTIFICATIONS.md`](NOTIFICATIONS.md) before building
notifications into another app. It also holds
[`src/shared/installFlag.ts`](src/shared/installFlag.ts) — every `react-vite`
app calls `watchInstalled('<file>.html')` once at startup so The Cabinet can
tell it's installed reliably; see CABINET.md's "Install detection, take two"
and add this call for any new PWA app.

## Service workers & dev

Every `react-vite` app registers its own scoped service worker from its
`main.{jsx,tsx}`. Those workers cache assets **cache-first**, which is correct in
production (hashed filenames guarantee a cache miss on each new build) but
**poison the Vite dev server**: dev module URLs are stable and unhashed, so the
worker serves the *first-cached* copy of your code back on every reload and your
edits never show up (this is why `localhost:5173/<app>.html` can look like "a
very old version"). **Registration is therefore gated on `import.meta.env.PROD`**
in every entry — a service worker must never install under `vite dev`. Keep that
guard when adding a new app or touching an entry's SW registration. If a stale
worker is already installed on localhost, unregister it and clear caches
(DevTools → Application) once; the guard prevents it recurring.

## Deploy guardrail

Pushing to `main` **auto-deploys via Vercel** — an unreviewed edit can reach
production. Never push with failing tests or type errors. **Stop and confirm with
me before any push to `main`.**

Once pushed, **don't poll GitHub Actions to check the CI run** — the owner
gets emailed on failure and will follow up if something's wrong. Only check
a run's status when explicitly asked to.
