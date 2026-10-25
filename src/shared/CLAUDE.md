# `src/shared/` — cross-app logic

Moved here from the root `CLAUDE.md` on 2026-10-25, so it loads when work touches
this directory instead of in every session. The root keeps the two rules that
apply from anywhere: extend what is here rather than copying it, and Claude model
ids live only in `models.js`.

`src/shared/` holds logic any app (new or legacy) may import — it is not part of
the `src/ds/` styling boundary. `notify/` is the local-notifications foundation
(Periodic Background Sync + IndexedDB state mirroring + a diagnostics reveal) used
by Touch Grass, Sol Odyssey and Journal of Delights — read
[`NOTIFICATIONS.md`](../../NOTIFICATIONS.md) before adding notifications to another
app. [`installFlag.ts`](installFlag.ts): every `react-vite` app calls
`watchInstalled('<file>.html')` once at startup so The Cabinet can detect install
reliably (CABINET.md, "Install detection, take two").

Promoted here once a second app needed them — **extend these rather than copying
an app's local copy**: [`weather.ts`](weather.ts) (Open-Meteo fetch + WMO mapping;
Touch Grass wraps it to add its own prose),
[`photo.ts`](photo.ts) (canvas downscale before upload; Wanderlist and Journal both
re-export `isImageFile`/`resizePhoto` — but **not** `photoFilename`, which Journal
keeps its own of because it names files from a date key rather than slugifying,
see `src/journal/photo.test.js`),
[`storage.ts`](storage.ts) (localStorage/sessionStorage helpers that can't throw;
WhereItWent re-exports it),
[`notionId.ts`](notionId.ts) (parses a Notion id out of a pasted URL, dashed UUID or
bare id — Loom, Wanderlist and Journal all re-export it. **WhereItWent deliberately
does not**: its own `extractNotionId` keeps dashes and case, and returns unmatched
input unchanged rather than `''`, which App.jsx's `hasNotionConfig` gate reads as
still-configured. An unreconciled overlap, not a missed promotion —
`Settings.notionId.test.jsx` pins the three differences), and
[`useWakeLock.ts`](useWakeLock.ts) (screen-awake hook wrapping the Wake Lock API,
degrading silently where unsupported; Tempo and Yoru re-export it, Lexi5 imports it
directly),
[`theme.ts`](theme.ts) (the theme **mechanism** only — the `matchMedia` probe
`systemPrefersDark`, re-exported by all seven apps that had written it out, and
`useThemeSync(key, {load, save, apply})`, the persist-and-cross-tab-sync effect
pair, used by **five of the six** theme providers — Cabinet, Loom, Law of the Day,
Sol Odyssey and Daily Stoic. Tempo is the exception and cannot use it: it applies
one value and saves another (`applyTheme(resolved)`, `saveThemePref(pref)`), so it
still hand-writes its own `storage` listener. Plus
`useSystemThemeFollow(active, onChange)`, the `matchMedia` listener for following
the OS while a preference is `system` — **all three apps that follow the OS use
it**: Law of the Day, Tempo and Daily Stoic (R-026). **What to do when the OS flips
stays with the caller**, because the three want different things: Tempo repaints,
Daily Stoic re-syncs only the browser-chrome tint since its palette swaps in CSS,
Law of the Day does both. Each app's own `theme.{js,ts}` keeps its vocabulary —
light/dark vs three-way-with-system vs palette presets — and **those must not be
flattened into one API**; see R-015),
[`findings.js`](findings.js) (**the Findings/Wanderlist Notion schema** — property
names, rich-text chunking, the Category/Tags lowercase rule, the Planned-Date
offset, `toFindingsProps`; promoted when Radar-B became a second writer to that
database, Wanderlist re-exports it all — **change the schema here, in WANDERLIST.md,
and in the `wanderlist` skill, or in none of them**), and [`share.js`](share.js) (OS
share sheet with a clipboard fallback; Wanderlist re-exports it). Each promotion
left the original path working as a thin re-export, so the old app's tests prove
the move was behaviour-preserving.

[`notionClient.ts`](notionClient.ts) (the `/api/notion` relay call — `notionProxy` +
`PROXY_URL`. Loom, Journal, Wanderlist, Marquee and Radar-B all use it.
**WhereItWent, Fit Check and Sol Odyssey deliberately do not**: the first two are
retrying client classes with backoff and a `NotionError`, and Sol Odyssey's
`buildRelayInit` is a pure `RequestInit` builder whose caller does the fetch. They
share about ten lines with this and differ everywhere else — not outstanding
promotions. See R-003).

The rest of `src/shared/` — this list only does its job (stop an app hand-rolling
what already exists) if it is complete:

- [`anthropic.ts`](anthropic.ts) — the client-side Claude call every app makes the
  same way: BYO key straight from the browser, the endpoint and API version,
  `anthropicHeaders()`, `extractAnthropicText()` (reads replies by block type). Used
  by Silva, The Long Listen (`long-listen/curator/curator.js`) and KeyPath (coach's
  note, weekly note, Studio answers: `keypath/app/ai.ts`).
- [`models.js`](models.js) — **the only place a Claude model id may be written**
  (`MODEL_HAIKU`, `MODEL_SONNET`) and `noThinking(model)`, the per-model way to keep
  a model from thinking. Every app that calls Claude imports from it;
  `models.test.js` fails on an id anywhere else and on a caller missing from the
  live API check (`npm run test:live`, needs `ANTHROPIC_API_KEY`). **Upgrading a
  model: read [`AI_MODELS.md`](../../AI_MODELS.md).**
- [`axisLockSlider.js`](axisLockSlider.js) — a touch-safe drag handler for range
  sliders inside a vertically scrolling list, where `touch-action: pan-y` on a
  native `<input type="range">` isn't reliably honoured. Touch Grass's Chorus and
  Yoru's mixer.
- [`fullscreen.ts`](fullscreen.ts) — `fullscreenOnTap()`: on a touch device in a
  browser tab or Chrome shortcut, each tap that finds the page out of full screen
  puts it back, hiding Chrome's toolbar and Android's button bar the way an install
  would. A no-op when installed standalone, on desktop, or without the API. For apps
  Chrome won't install properly on the owner's phone (CABINET.md, "Update
  (2026-09-24)"): Radar-B. KeyPath tried it and dropped it: Chrome shows a "to exit
  full screen" toast on every entry, which no page can hide, and on KeyPath it sat
  over the keys; its landscape layout fits beside the toolbar instead.
- [`haptics.ts`](haptics.ts) — `triggerHaptic(type)` for a named intent (`light` /
  `heavy` / `success` / `transition`). Daily Stoic and Silva.
- [`mediaSession.js`](mediaSession.js) — `useMediaSession()`, which holds a silent
  looping WAV so a browser will surface lock-screen, headset and watch transport
  controls at all. Tempo and Yoru.
- [`qrCode.ts`](qrCode.ts) — `appQrUrl(file)` and `renderAppQr()`, against the same
  hardcoded production origin as Cabinet's `installState.js`. The Cabinet.
- [`useSwipeAction.ts`](useSwipeAction.ts) — the swipe-to-act gesture hook. Marquee.

One thing in here is **not** a tidy-up waiting to happen:

- **`haptics` is an unreconciled overlap, not a missed promotion.**
  `src/lexi5/lib/haptics.js`, `src/loom/lib/haptics.js`, `src/tempo/lib/haptics.js`
  and `src/wanderlist/haptics.js` each keep a local `tap(pattern)`. That is a raw
  vibrate pattern; the shared module takes a named intent. Genuinely different
  APIs — do not file this as a mechanical re-export like R-004 was.

There was a second: `audio.ts`, which had no importers and shadowed Tempo's richer
`playChime(volume, variant)`. It was deleted (R-025). Tempo's `lib/sound.js` was
briefly promoted here for The Long Listen's chime between works, and moved back
when that feature was removed (2026-10-09): Tempo is its only user again.
