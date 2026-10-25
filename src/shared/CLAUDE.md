# `src/shared/` — cross-app logic

Loads when work touches this directory. The root `CLAUDE.md` keeps the rules that
apply from anywhere: extend what is here rather than copying it, Claude model ids
live only in `models.js`, the Findings schema changes in three places or none.

Any app, new or legacy, may import from here; it is not part of the `src/ds/`
styling boundary. **This file does not list who imports what.** Those lists went
stale every time an app adopted a module (R-038), and a grep answers the question
exactly: `grep -rnE "shared/<module>" src api | grep -v '^src/shared/' | grep -v '\.test\.'`.
What it does record is what a grep cannot tell you: the apps that **deliberately**
keep their own version, and why. Don't "fix" those.

When a module is promoted here, the old path stays as a thin re-export, so the
first app's tests prove the move was behaviour-preserving.

## Modules

- [`notify/`](notify/) — local notifications: Periodic Background Sync, IndexedDB
  state mirroring, a diagnostics reveal. Read
  [`NOTIFICATIONS.md`](../../NOTIFICATIONS.md) before adding notifications to an app.
- [`installFlag.ts`](installFlag.ts) — every `react-vite` app calls
  `watchInstalled('<file>.html')` once at startup, so The Cabinet can detect install
  (CABINET.md, "Install detection, take two").
- [`weather.ts`](weather.ts) — Open-Meteo fetch and WMO mapping. Touch Grass wraps it
  to add its own prose.
- [`photo.ts`](photo.ts) — canvas downscale before upload (`isImageFile`,
  `resizePhoto`). **Journal keeps its own `photoFilename`**: it names files from a
  date key rather than slugifying (`src/journal/photo.test.js`).
- [`storage.ts`](storage.ts) — localStorage/sessionStorage helpers that can't throw.
- [`notionId.ts`](notionId.ts) — parses a Notion id out of a pasted URL, dashed UUID
  or bare id. **WhereItWent deliberately keeps its own `extractNotionId`**: it keeps
  dashes and case, and returns unmatched input unchanged rather than `''`, which
  App.jsx's `hasNotionConfig` gate reads as still-configured. An unreconciled
  overlap, not a missed promotion; `Settings.notionId.test.jsx` pins the three
  differences (R-019).
- [`notionClient.ts`](notionClient.ts) — the `/api/notion` relay call (`notionProxy`,
  `PROXY_URL`). **WhereItWent, Fit Check and Sol Odyssey deliberately don't use it**:
  the first two are retrying client classes with backoff and a `NotionError`, and
  Sol Odyssey's `buildRelayInit` is a pure `RequestInit` builder whose caller does
  the fetch. They share about ten lines with it and differ everywhere else (R-003).
- [`useWakeLock.ts`](useWakeLock.ts) — keeps the screen awake through the Wake Lock
  API, degrading silently where it is unsupported.
- [`theme.ts`](theme.ts) — the theme **mechanism** only: `systemPrefersDark`, the
  `matchMedia` probe; `useThemeSync(key, {load, save, apply})`, the persist and
  cross-tab-sync pair; and `useSystemThemeFollow(active, onChange)`, the listener for
  following the OS while a preference is `system`.
  - **Tempo cannot use `useThemeSync`**: it applies one value and saves another
    (`applyTheme(resolved)`, `saveThemePref(pref)`), so it hand-writes its own
    `storage` listener.
  - **What to do when the OS flips stays with the caller.** The apps want different
    things: Tempo repaints, Daily Stoic re-syncs only the browser-chrome tint because
    its palette swaps in CSS, Law of the Day does both.
  - **Each app's own `theme.{js,ts}` keeps its vocabulary** — light/dark,
    three-way-with-system, palette presets — and those must not be flattened into
    one API (R-015, R-026).
- [`findings.js`](findings.js) — **the Findings/Wanderlist Notion schema**: property
  names, rich-text chunking, the Category/Tags lowercase rule, the Planned-Date
  offset, `toFindingsProps`. Promoted when Radar-B became a second writer to that
  database. Change it here, in WANDERLIST.md and in the `wanderlist` skill, or in
  none of them.
- [`share.js`](share.js) — the OS share sheet with a clipboard fallback.
- [`anthropic.ts`](anthropic.ts) — the client-side Claude call: BYO key straight from
  the browser, the endpoint and API version, `anthropicHeaders()`, `requestAnthropic`,
  and `extractAnthropicText()`, which reads replies by block type. It re-exports the
  model ids, which is how most apps reach them.
- [`models.js`](models.js) — **the only place a Claude model id may be written**
  (`MODEL_HAIKU`, `MODEL_SONNET`), plus `noThinking(model)`, the per-model way to
  keep a model from thinking. `models.test.js` fails on an id written anywhere else,
  and on a file that calls Claude but is missing from the live API check
  (`npm run test:live`, needs `ANTHROPIC_API_KEY`). Upgrading a model:
  [`AI_MODELS.md`](../../AI_MODELS.md).
- [`axisLockSlider.js`](axisLockSlider.js) — a touch-safe drag handler for range
  sliders inside a vertically scrolling list, where `touch-action: pan-y` on a native
  `<input type="range">` isn't reliably honoured.
- [`fullscreen.ts`](fullscreen.ts) — `fullscreenOnTap()`: on a touch device in a
  browser tab or Chrome shortcut, each tap that finds the page out of full screen
  puts it back, hiding Chrome's toolbar and Android's button bar the way an install
  would. A no-op when installed standalone, on desktop, or without the API. For apps
  Chrome won't install properly on the owner's phone (CABINET.md, "Update
  (2026-09-24)"). **KeyPath tried it and dropped it**: Chrome shows a "to exit full
  screen" toast on every entry, which no page can hide, and on KeyPath it sat over
  the keys.
- [`haptics.ts`](haptics.ts) — `triggerHaptic(type)` for a named intent (`light`,
  `heavy`, `success`, `transition`).
- [`mediaSession.js`](mediaSession.js) — `useMediaSession()`, which holds a silent
  looping WAV so a browser will surface lock-screen, headset and watch transport
  controls at all.
- [`qrCode.ts`](qrCode.ts) — `appQrUrl(file)` and `renderAppQr()`, against the same
  hardcoded production origin as Cabinet's `installState.js`.
- [`useSwipeAction.ts`](useSwipeAction.ts) — the swipe-to-act gesture hook.

## Not tidy-ups waiting to happen

- **`haptics` is an unreconciled overlap, not a missed promotion.**
  `src/lexi5/lib/haptics.js`, `src/loom/lib/haptics.js`, `src/tempo/lib/haptics.js`
  and `src/wanderlist/haptics.js` each keep a local `tap(pattern)`, a raw vibrate
  pattern; the shared module takes a named intent. Genuinely different APIs — do not
  file this as a mechanical re-export like R-004.
- **There is no shared chime.** `audio.ts` had no importers and shadowed Tempo's
  richer `playChime(volume, variant)`, so it was deleted (R-025). Tempo's
  `lib/sound.js` was briefly promoted here for The Long Listen and moved back when
  that feature was removed (2026-10-09).
