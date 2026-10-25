# app-playground — repo rules

A personal playground for standalone web apps: React + Vite apps under `src/`,
self-contained static HTML under `public/`. Every push to `main` deploys to Vercel.
The human playbook is the Notion page **Dev — Building an App**; this file is its
enforced, in-repo companion.

This file is read at the start of every session, so it keeps to rules that apply
anywhere. Detail lives where it is used: `src/shared/`, `src/sol-odyssey/`,
`src/long-listen/` and `src/keypath/` have their own `CLAUDE.md`, loaded when you
work there; deploy and build-size detail is in [`DEPLOY.md`](DEPLOY.md); each app's
doc is linked in the table below.

## Before declaring any task done

Run **`npm test`**, **`npm run typecheck`** and **`npx eslint <changed paths>`**; all
three must pass. Run tests through `npm test` (narrow with `-- <path>`), not bare
`vitest`: the script sets `NODE_OPTIONS=--no-experimental-webstorage` and
`TZ=Europe/Bucharest`. Without the first, every storage test fails on
`reading 'clear'`; without the second, Radar-B's date fixtures shift three hours.
Both look exactly like real regressions.

## Deploy guardrail

- Pushing to `main` **auto-deploys via Vercel**. Never push with failing tests or
  type errors. **Stop and confirm with me before any push to `main`.**
- Once pushed, **don't poll GitHub Actions** — I'm emailed on failure and will follow
  up. Check a run's status only when explicitly asked.
- **At most 12 serverless functions**: every top-level `api/*.js` is one (not
  `api/_*`), and so is a `.test.js` placed directly in `api/` — handler tests go in
  `api/_tests/`. Count with `ls api/*.js | grep -v '^api/_'` before adding one, and
  prefer folding into an existing endpoint. `scripts/build-meta.test.js` enforces it.
- **Never import a `@fontsource` family by its bare name or a weight entry point**,
  and watch for a dependency's `new URL(…, import.meta.url)` emitting dead assets.
  Read [`DEPLOY.md`](DEPLOY.md) before adding or changing a font import — the right
  fix depends on how many subsets the app needs, and the wrong one is a regression.

## Daily refactor workflow

An agent takes **one** item off [`REFACTOR_BACKLOG.md`](REFACTOR_BACKLOG.md) on
Monday, Wednesday and Friday mornings (every other Friday from 2026-10-09 is a
discovery run instead), opens a PR, and auto-merges the `refactor` and `modernise`
ones. `qol` and `visual` items it may only propose, and they are never auto-merged.
Backlog order is the priority. Read [`DAILY_REFACTOR.md`](DAILY_REFACTOR.md) before
changing the workflow, the skill (`.claude/skills/daily-refactor/SKILL.md`) or the
backlog's shape. Two things that look like noise and are not:

- Runs use the **Bucharest date** the workflow hands over — the runner's UTC date is
  a day behind, so nothing in a run may use bare `date +%F`.
- **A run that doesn't finish cleanly fails on purpose**, and every PR body opens with
  an `@jormania` mention. They are the reporting channel; don't tidy them away.

## Design-system boundary (one-way, enforced)

New apps build on [`src/ds/`](src/ds/). Legacy apps — `src/touch-grass/`,
`src/journal/`, `src/kettlebell/` — own their styling and **never import from
`src/ds/`**. Enforced by `src/ds/boundary.test.js`; full scope in
[`LEGACY.md`](LEGACY.md).

## Shared logic (`src/shared/`)

Any app, new or legacy, may import from `src/shared/`; it is separate from the
`src/ds/` boundary. **Before writing a helper, look there, and extend what exists
rather than copying an app's local copy.** Today it has: `notify/`, `installFlag`,
`weather`, `photo`, `storage`, `notionId`, `notionClient`, `useWakeLock`, `theme`,
`findings`, `share`, `anthropic`, `models`, `axisLockSlider`, `fullscreen`,
`haptics`, `mediaSession`, `qrCode`, `useSwipeAction`. Several apps deliberately
keep their own version of one of these, so read
[`src/shared/CLAUDE.md`](src/shared/CLAUDE.md) before promoting, re-exporting or
reconciling anything. Rules that apply from any app:

- **Claude model ids are written only in `src/shared/models.js`**; `models.test.js`
  fails on one anywhere else. Upgrading a model: [`AI_MODELS.md`](AI_MODELS.md).
- **The Findings/Wanderlist Notion schema** lives in `src/shared/findings.js`. Change
  it there, in WANDERLIST.md and in the `wanderlist` skill, or in none of them.
- Every `react-vite` app calls `watchInstalled('<file>.html')` from
  `src/shared/installFlag.ts` once at startup.

## Service workers

Every `react-vite` app registers its own scoped service worker from its
`main.{jsx,tsx}`, cache-first. **Registration is gated on `import.meta.env.PROD`** in
every entry: under `vite dev` a worker serves the first-cached copy of unhashed URLs
forever (if one already has, unregister it and clear caches once in DevTools →
Application). All apps share one origin, so **nothing may claim the root**: each manifest
declares an `id` and a `scope` narrower than `/`, each worker registers with an
explicit `scope` (only Touch Grass's legacy `/sw.js` is root-scoped), and each
worker's `activate` deletes only caches under its own `CACHE_PREFIX`.
`scripts/pwa-scope.test.js` enforces all three; CABINET.md, "Update (2026-09-24)",
has the incident behind it.

## Apps

Read an app's doc before working in it. Card data for every app (name, icon, blurb,
tags) lives in [`src/apps-registry.js`](src/apps-registry.js); the new-app checklist
is in [`CABINET.md`](CABINET.md). `npm run typecheck` covers the strict-TS apps plus
`src/ds`, `src/shared` and `src/lexi5/lib` — `tsconfig.json`'s `include` is the list,
and its comment says why Lexi5's `lib/` alone is typed. The other apps are plain JSX
by design.

| App | Location | Notes |
|-----|----------|-------|
| Radar-B | `src/radar-b/` | JSX, DS — [`RADAR_B.md`](RADAR_B.md): read "the app does not scrape" and the two-pass dedupe first |
| Sol Odyssey | `src/sol-odyssey/` | strict TS — its own `CLAUDE.md` and `DESIGN.md` govern that directory |
| Daily Stoic | `src/daily-stoic/` | strict TS, DS — [`DAILY_STOIC.md`](DAILY_STOIC.md) |
| Tempo | `src/tempo/` | JSX, DS |
| Law of the Day | `src/law-of-the-day/` | JSX, DS — today's scenario is written in the browser by Sonnet on a BYO key (`lib/generate.js`); no server function, no cron |
| Yoru | `src/yoru/` | JSX, DS — [`YORU.md`](YORU.md) |
| The Cabinet | `src/cabinet/` | JSX, DS — [`CABINET.md`](CABINET.md) |
| Loom | `src/loom/` | JSX, DS — [`LOOM.md`](LOOM.md) |
| Marquee | `src/marquee/` | JSX, DS — reads venues through `api/marquee-scan.js` (adapters in `api/_lib/marquee/`). Read [`MARQUEE.md`](MARQUEE.md)'s health gate, §9.75 and §9.89 before touching an adapter |
| Click Deck | `src/click-deck/` | JSX, self-styled (not DS) — [`CLICK_DECK.md`](CLICK_DECK.md) |
| Wanderlist | `src/wanderlist/` | JSX, self-styled (not DS) — [`WANDERLIST.md`](WANDERLIST.md) |
| WhereItWent | `src/where-it-went/` | JSX, DS — the schema is load-bearing: [`WHERE_IT_WENT.md`](WHERE_IT_WENT.md) first |
| Lexi5 | `src/lexi5/` | JSX, DS, typed `lib/` — [`LEXI5.md`](LEXI5.md) |
| Fit Check | `src/fit-check/` | strict TS, DS — Notion options are a closed vocabulary; read [`FIT_CHECK.md`](FIT_CHECK.md) before touching `lib/vocabulary.ts` |
| Silva | `src/silva/` | strict TS, DS — [`SILVA.md`](SILVA.md) |
| KeyPath | `src/keypath/` | strict TS, DS — piano tutor, in progress; its own `CLAUDE.md`, and [`KEYPATH.md`](KEYPATH.md) |
| The Long Listen | `src/long-listen/` | strict TS, DS — orchestral curator; its own `CLAUDE.md`, and [`LONG_LISTEN.md`](LONG_LISTEN.md) |
| Journal of Delights | `src/journal/` | JSX, legacy, no typecheck |
| Kettlebell Training | `src/kettlebell/` | JSX, legacy, no typecheck |
| Touch Grass | `src/touch-grass/` | JSX, legacy, no typecheck |
| Static HTML apps | `public/*.html` | design-locked, hand-authored — edit in place |
| Front page | `index.html` | card grid + the footer's status line — see [`DAILY_REFACTOR.md`](DAILY_REFACTOR.md) |
