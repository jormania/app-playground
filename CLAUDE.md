# app-playground — repo rules

A personal playground for standalone web apps. A few are React + Vite (under
`src/`); the rest are self-contained static HTML files at the repo root. Deploys
to Vercel on every push to `main`.

For the human-readable build playbook — how to start a new app, extend the
design system, and the full process/caveats — see the Notion page **Dev —
Building an App**. This file is its enforced, in-repo companion.

## Before declaring any task done

Run **`npm test`**, **`npm run typecheck`**, and **`npx eslint <changed paths>`**
and make sure all three pass. Don't call a change complete on green-looking
code alone.

Running `vitest` directly (rather than through `npm test`) drops **two** things
the `test` script sets, and both produce failures that read like real
regressions:

- without `NODE_OPTIONS=--no-experimental-webstorage`, Node's native
  `localStorage` shadows jsdom's and every storage-touching test fails with
  `Cannot read properties of undefined (reading 'clear')`;
- without `TZ=Europe/Bucharest`, tests with fixed datetime fixtures fail by the
  offset — Radar-B's `detail` and `wanderlist` suites go red with a clean
  three-hour shift, which looks exactly like a date bug someone just introduced.

Either run `npm test` (pass a path after `--` to narrow it), or set both
yourself.

## Daily refactor workflow

An autonomous agent improves this repo one item per weekday morning, opens a PR,
and for two of the four classes merges that PR itself. **Full documentation:
[`DAILY_REFACTOR.md`](DAILY_REFACTOR.md)** — read it before changing the workflow,
the skill, or the backlog's shape. The essentials:

- Driven by [`.github/workflows/daily-refactor.yml`](.github/workflows/daily-refactor.yml)
  on two crons — 22:41 UTC the evening before (the earliest hour that is already
  tomorrow in Bucharest in both seasons) and 00:41 UTC as a backstop, since
  GitHub's scheduled queue both drops and delays runs. **The runner's UTC date is
  therefore a day behind**: the workflow computes the Bucharest date and hands it
  to the agent, and nothing in a run may use bare `date +%F`. Needs the
  `CLAUDE_CODE_OAUTH_TOKEN` secret; add `REFACTOR_PAT` too, or the PRs it opens
  get no CI at all.
- It takes **one** item off [`REFACTOR_BACKLOG.md`](REFACTOR_BACKLOG.md), works it
  on a fresh branch off `main`, proves it green, and opens its own PR. Review
  happens after the fact. Reorder the backlog to reprioritise — the order is the
  steering wheel. The procedure is
  [`.claude/skills/daily-refactor/SKILL.md`](.claude/skills/daily-refactor/SKILL.md).
- **Classes set the autonomy.** `refactor` and `modernise` are
  behaviour-preserving: the agent may queue them for itself, and their PRs
  **merge themselves** once the workflow re-runs all three gates against a clean
  clone of the pushed branch. `qol` and `visual` change what you see, so the agent
  may only **propose** them under `## Proposed`, and they are never auto-merged
  however green. They also need before/after screenshots (both themes, phone and
  desktop) on the never-merged `claude/shots` branch, since preview deploys are
  off for `claude/*`.
- **Fridays are discovery runs** — nothing ships; the session reads the codebase
  against current standards and adds to the backlog instead.
- It stops on its own at six open refactor PRs, so an unreviewed pile can't grow
  without bound.
- **Silence is the failure mode it is built against.** Any run that doesn't finish
  cleanly fails on purpose, because a failed workflow is the one GitHub emails
  about by default; every PR body opens with an `@jormania` mention for the same
  reason. Don't "tidy away" either as noise — they are the reporting channel.

## Design-system boundary (one-way, enforced)

- **New apps** build on the shared design system in [`src/ds/`](src/ds/).
- **Legacy apps** — `src/touch-grass/`, `src/journal/`, `src/kettlebell/` — are
  design-locked and own their own styling. They **never import from `src/ds/`**.
- The rule flows one way: DS → new apps only. Enforced by
  [`src/ds/boundary.test.js`](src/ds/boundary.test.js) in `npm test` — a legacy
  import fails the suite. Full scope: [`LEGACY.md`](LEGACY.md).

## Per-app map

Each app's own doc (linked below) has the full feature/schema detail — read it
before working in that app. Don't hold app internals here; this table is a router.

| App | Location | Notes |
|-----|----------|-------|
| Radar-B | `src/radar-b/` | JSX, DS — Bucharest event radar; reads the Notion **📡 Radar** DB written by the `/recommend in Bucharest` skill, saves into Wanderlist's Findings. Read [`RADAR_B.md`](RADAR_B.md) — especially "the app does not scrape" and the two-pass dedupe — before touching it |
| Sol Odyssey | `src/sol-odyssey/` | strict TS — has its own [`CLAUDE.md`](src/sol-odyssey/CLAUDE.md) + `DESIGN.md`; **defer to those** in that dir |
| Daily Stoic | `src/daily-stoic/` | strict TS, DS — [`DAILY_STOIC.md`](DAILY_STOIC.md) |
| Tempo | `src/tempo/` | JSX, DS |
| Law of the Day | `src/law-of-the-day/` | JSX, DS |
| Yoru | `src/yoru/` | JSX, DS — [`YORU.md`](YORU.md) |
| The Cabinet | `src/cabinet/` | JSX, DS — [`CABINET.md`](CABINET.md) |
| Loom | `src/loom/` | JSX, DS — [`LOOM.md`](LOOM.md) |
| Marquee | `src/marquee/` | JSX, DS — venue watcher; reads venue programme pages through `api/marquee-scan.js` (the ONE endpoint, adapters under `api/_lib/marquee/`), saves into Wanderlist's Findings. Read [`MARQUEE.md`](MARQUEE.md) — especially the health gate, "throttled ≠ broken", the detail cache (§9.75, why an adapter's `extractDetail` exists), and §9.89's time budget (the scheduled check may stop early **and must say so**; don't add per-venue cost without re-reading it) — before touching an adapter |
| Click Deck | `src/click-deck/` | JSX, **not DS** (self-styled) — [`CLICK_DECK.md`](CLICK_DECK.md) |
| Wanderlist | `src/wanderlist/` | JSX, **not DS** (self-styled) — [`WANDERLIST.md`](WANDERLIST.md) |
| WhereItWent | `src/where-it-went/` | JSX, DS — schema is load-bearing, read [`WHERE_IT_WENT.md`](WHERE_IT_WENT.md) before touching it; also [`WHERE_IT_WENT_ROADMAP.md`](WHERE_IT_WENT_ROADMAP.md) |
| Lexi5 | `src/lexi5/` | JSX, DS — [`LEXI5.md`](LEXI5.md); also [`LEXI5_ROADMAP.md`](LEXI5_ROADMAP.md) |
| Fit Check | `src/fit-check/` | **strict TS**, DS — Notion select options are a **closed vocabulary** and its tags are AI-assigned; read [`FIT_CHECK.md`](FIT_CHECK.md) before touching `lib/vocabulary.ts`. Also [`FIT_CHECK_ROADMAP.md`](FIT_CHECK_ROADMAP.md), [`FIT_CHECK_DISCOVERY.md`](FIT_CHECK_DISCOVERY.md) |
| Silva | `src/silva/` | **strict TS**, DS — commonplace book: today's walk, reading history, photo/share intake, neighbourhoods. Read [`SILVA.md`](SILVA.md) |
| Journal of Delights | `src/journal/` | JSX, legacy, no typecheck |
| Kettlebell Training | `src/kettlebell/` | JSX, legacy, no typecheck |
| Touch Grass | `src/touch-grass/` | JSX, legacy, no typecheck |
| Static HTML apps | `public/*.html` | design-locked, hand-authored — edit in place |
| Front page | `index.html` | card grid + the footer's status line — see [`DAILY_REFACTOR.md`](DAILY_REFACTOR.md) |

Card/tile data (name, icon, blurb, tags) for every app lives in one place —
[`src/apps-registry.js`](src/apps-registry.js) — read by `index.html`'s card
grid and The Cabinet. See [`CABINET.md`](CABINET.md) for the new-app checklist.

`tsconfig.json` covers **seven** paths — `src/sol-odyssey`, `src/daily-stoic`,
`src/ds`, `src/shared`, `src/fit-check`, `src/silva` and `src/lexi5/lib`; `npm run
typecheck` checks all seven. Other React apps are plain JS/JSX by design and left
out of typecheck (they can still import from `src/shared`).

`src/lexi5/lib` is the deliberate half-measure: Lexi5's components stay JSX while
its pure logic — the stats schema, the config shape, the tile scorer, Hard Mode,
undo — is typed, because a closed `Config` type is what stops a setting being read
before it exists in `DEFAULT_CONFIG`. Only `.ts` files are picked up, so the JS
modules beside them are unaffected.

## Cross-app shared logic (`src/shared/`) — distinct from `src/ds/`

`src/shared/` holds logic any app (new or legacy) may import — not part of the
styling boundary above. Today: `src/shared/notify/`, the local-notifications
foundation (Periodic Background Sync + IndexedDB state mirroring + a
diagnostics reveal) used by Touch Grass, Sol Odyssey, Journal of Delights —
read [`NOTIFICATIONS.md`](NOTIFICATIONS.md) before adding notifications to
another app. Also [`src/shared/installFlag.ts`](src/shared/installFlag.ts) —
every `react-vite` app calls `watchInstalled('<file>.html')` once at startup
so The Cabinet can detect install reliably; add this call for any new PWA app
(see CABINET.md's "Install detection, take two").

Promoted here once a second app needed them — **extend these rather than copying
an app's local copy**: [`weather.ts`](src/shared/weather.ts) (Open-Meteo fetch +
WMO mapping; Touch Grass wraps it to add its own prose),
[`photo.ts`](src/shared/photo.ts) (canvas downscale before upload; Wanderlist and
Journal both re-export `isImageFile`/`resizePhoto` — but **not** `photoFilename`,
which Journal keeps its own of because it names files from a date key rather than
slugifying, see `src/journal/photo.test.js`),
[`storage.ts`](src/shared/storage.ts) (localStorage/sessionStorage helpers that
can't throw; WhereItWent re-exports it),
[`notionId.ts`](src/shared/notionId.ts) (parses a Notion id out of a pasted URL,
dashed UUID or bare id — Loom, Wanderlist and Journal all re-export it.
**WhereItWent deliberately does not**: its own `extractNotionId` keeps dashes and
case, and returns unmatched input unchanged rather than `''`, which App.jsx's
`hasNotionConfig` gate reads as still-configured. An unreconciled overlap, not a
missed promotion — `Settings.notionId.test.jsx` pins the three differences), and [`useWakeLock.ts`](src/shared/useWakeLock.ts)
(screen-awake hook wrapping the Wake Lock API, degrading silently where
unsupported; Tempo and Yoru re-export it, Lexi5 imports it directly),
[`theme.ts`](src/shared/theme.ts) (the theme **mechanism** only — the
`matchMedia` probe `systemPrefersDark`, re-exported by all seven apps that had
written it out, and `useThemeSync(key, {load, save, apply})`, the
persist-and-cross-tab-sync effect pair, used by Cabinet, Law of the Day and
Loom. Each app's own `theme.{js,ts}` keeps its vocabulary — light/dark vs
three-way-with-system vs palette presets — and **those must not be flattened
into one API**; see R-015),
[`findings.js`](src/shared/findings.js) (**the Findings/Wanderlist Notion schema** —
property names, rich-text chunking, the Category/Tags lowercase rule, the Planned-Date
offset, `toFindingsProps`; promoted when Radar-B became a second writer to that database,
Wanderlist re-exports it all — **change the schema here, in WANDERLIST.md, and in the
`wanderlist` skill, or in none of them**), and [`share.js`](src/shared/share.js) (OS
share sheet with a clipboard fallback; Wanderlist re-exports it). Each
promotion left the original path working as a thin re-export, so the old
app's tests prove the move was behaviour-preserving.

[`notionClient.ts`](src/shared/notionClient.ts) (the `/api/notion` relay call —
`notionProxy` + `PROXY_URL`. Loom, Journal, Wanderlist, Marquee and Radar-B all
use it. **WhereItWent, Fit Check and Sol Odyssey deliberately do not**: the first
two are retrying client classes with backoff and a `NotionError`, and Sol
Odyssey's `buildRelayInit` is a pure `RequestInit` builder whose caller does the
fetch. They share about ten lines with this and differ everywhere else — not
outstanding promotions. See R-003).

The rest of `src/shared/`, which the list above used to leave out entirely —
this section only does its job (stop an app hand-rolling what already exists) if
it is complete:

- [`anthropic.ts`](src/shared/anthropic.ts) — the client-side Claude call every
  app makes the same way: BYO key straight from the browser, the endpoint and
  API version, `anthropicHeaders()`, and the model ids. Used by Silva.
- [`axisLockSlider.js`](src/shared/axisLockSlider.js) — a touch-safe drag handler
  for range sliders inside a vertically scrolling list, where `touch-action:
  pan-y` on a native `<input type="range">` isn't reliably honoured. Touch Grass's
  Chorus and Yoru's mixer.
- [`haptics.ts`](src/shared/haptics.ts) — `triggerHaptic(type)` for a named intent
  (`light` / `heavy` / `success` / `transition`). Daily Stoic and Silva.
- [`mediaSession.js`](src/shared/mediaSession.js) — `useMediaSession()`, which
  holds a silent looping WAV so a browser will surface lock-screen, headset and
  watch transport controls at all. Tempo and Yoru.
- [`qrCode.ts`](src/shared/qrCode.ts) — `appQrUrl(file)` and `renderAppQr()`,
  against the same hardcoded production origin as Cabinet's `installState.js`.
  The Cabinet.
- [`useSwipeAction.ts`](src/shared/useSwipeAction.ts) — the swipe-to-act gesture
  hook. Marquee.

Two things in here are **not** tidy-ups waiting to happen:

- **`haptics` is an unreconciled overlap, not a missed promotion.**
  `src/lexi5/lib/haptics.js`, `src/loom/lib/haptics.js`, `src/tempo/lib/haptics.js`
  and `src/wanderlist/haptics.js` each keep a local `tap(pattern)`. That is a raw
  vibrate pattern; the shared module takes a named intent. Genuinely different
  APIs — do not file this as a mechanical re-export like R-004 was.
- **[`audio.ts`](src/shared/audio.ts) has no importers at all.** Its `playChime()`
  is unrelated to Tempo's `playChime(volume, variant)` in `src/tempo/lib/sound.js`,
  which is richer and is the one actually used. Don't adopt the shared one over
  Tempo's; see R-025.

## Service workers & dev

Every `react-vite` app registers its own scoped service worker from its
`main.{jsx,tsx}`, caching assets **cache-first** — correct in production
(hashed filenames) but **poisons Vite dev** (unhashed dev URLs mean the worker
serves back the first-cached copy forever). **Registration is gated on
`import.meta.env.PROD`** in every entry — never let a service worker install
under `vite dev`. Keep that guard on any new app or SW registration change. If
a stale worker is already on localhost, unregister it and clear caches
(DevTools → Application) once — the guard prevents recurrence.

## Deploy guardrail

Pushing to `main` **auto-deploys via Vercel** — an unreviewed edit can reach
production. Never push with failing tests or type errors. **Stop and confirm
with me before any push to `main`.**

Once pushed, **don't poll GitHub Actions** — the owner gets emailed on failure
and will follow up. Only check a run's status when explicitly asked.

**Vercel Hobby caps a deployment at 12 serverless functions, counted across
the entire repo** — every top-level `api/*.js` file is one function, regardless
of app (files under `api/_*` don't count). Before adding a new `api/*.js`,
run `ls api/*.js | grep -v '^api/_'` and check the count. At 12 already, one
more **will fail the deploy** (happened before, see git history ~2026-07-23).
**A `.test.js` file placed directly in `api/` counts as a function too** — put tests for
top-level handlers in `api/_tests/` (caught once, 2026-08-26).
`scripts/build-meta.test.js` now fails the suite if the count exceeds 12, so CI catches
the thirteenth file before Vercel does; the front-page footer shows the count from 10 up.
Prefer folding a new proxy into an existing same-app endpoint (extra
query param/mode) over a new file when the count is tight.

**Deployment Storage is 10 GB on Hobby, charged per RETAINED deployment** — not
per push. `dist/` is ~10 MB; at that size the quota is a few hundred builds
deep, and it filled once already (2026-09-09). Three rules keep it there:

- **Never import a `@fontsource` family by its bare name or weight entry point**
  (`@fontsource/x`, `@fontsource/x/400.css`). Those emit every subset — greek,
  cyrillic, and for a CJK family ~120 Japanese chunks — in both `.woff2` and
  legacy `.woff`. Import the per-subset file instead (`latin-400.css`, or
  `/wght.css` for a variable family). Yoru did the former and shipped 17 MB of
  Japanese fonts to draw one kanji; see `src/yoru/fonts.css` for how a single
  needed glyph is declared without the family.
- **Watch for a dependency's `new URL(…, import.meta.url)`.** Rollup treats it
  as an asset reference and emits the target even when nothing fetches it —
  that's how a dead ONNX fallback put a 23 MB `.wasm` in every build. See
  `dropOrtWasmPlugin` in [`vite.config.js`](vite.config.js).
- **The front-page footer shows the built size of `dist/` from 20 MB up**, red at
  40 MB — hidden at the usual ~10 MB, since a number that is always fine is one
  nobody reads. Measured by `stampBuildSizePlugin` in `vite.config.js` (from
  `closeBundle`, not `transformIndexHtml` — the weight isn't knowable until the
  bundle is written), counted by `directorySizeBytes` in `scripts/build-meta.js`.
- Preview builds on `claude/*` branches are **off** (`git.deploymentEnabled` in
  [`vercel.json`](vercel.json)) — every change used to cost two deployments,
  one preview and one production. `main` is unaffected.

Old deployments are swept automatically: the project's **Deployment Retention
Policy** (Vercel → Settings → Build and Deployment) is set to 1 week for all four
classes. That cleared ~11 weeks of backlog on 2026-09-10 and holds the retained
set to about a week's worth. Nothing to run by hand — a retention window only
works because the per-deployment size above stays small, so the two are one
mechanism, not two.
