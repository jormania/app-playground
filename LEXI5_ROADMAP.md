# Lexi5 — Roadmap

Everything from the 2026-08-08 audit was cleared previously. The 2026-08-12 production
audit found 32 further issues across `src/lexi5`, `src/ds` and `src/shared`; its Quick Wins
and Refactor Roadmap sections have now been implemented, closing 24 of them. This file is
what remains, plus what was deliberately not done and why.

## Still open

### UX (from audit section 6)
- **No undo for destructive actions.** Reset Statistics, Clear List and Refresh Word List
  each destroy unrecoverable local state behind a single confirm; Refresh silently discards
  the current list's cycle progress. Since everything lives in `localStorage`, stashing the
  previous blob under a `lexi5_undo_*` key and offering "Undo" in the toast that already
  fires would make all three recoverable. ~2 hours.
- **Curation has no progress feedback or cancel.** A 1,000-word Sonnet curation can run most
  of the 30-second timeout showing only a disabled "Curating…" button. The `AbortController`
  already exists — it just isn't reachable from the UI. ~1 hour.
- **The API key field explains storage but not cost.** It says the key is sent straight to
  Anthropic, which is true; it doesn't mention the Vercel edge rewrite it passes through or
  roughly what a curation costs. Trust is the blocker on this feature. ~30 minutes.
- **Statistics auto-open 1.5s after every game**, interrupting the win animation they're
  timed against and covering the board before the player has looked at it. A dismissible
  result bar with a "Stats" action would let the player choose when to leave the board.
  ~45 minutes.
- **Hard Mode's lock is explained only once it's too late** — the hint changes to "Can only
  be changed before your first guess" at the moment the toggle is already disabled. ~15 min.

### Accessibility (additive, from audit section 7)
- **The board communicates state through colour alone.** Each tile should carry an
  `aria-label` ("R, correct, position 1") and each completed row should be announced.
- **No live region for results** — a screen-reader user learns they won only when the Stats
  modal takes focus. ~2 hours for both.

### Lower priority
- **`lexi5_history` retention is now bounded (30 days), but the Archive can still misreport
  Custom.** Past days are recomputed against the *current* curated list, so re-curating makes
  the Archive show words that were never that day's answer. Either record the served word per
  day, or hide Custom from the Archive. ~1 hour honest / 10 minutes to hide.
- **Service worker has no precache**, so "fully offline-capable PWA" overstates it: a player
  who installs and opens offline before a successful online visit gets nothing. ~1 hour.
- **System theme changes are ignored while the app is open** — `matchMedia` is read but never
  subscribed to, so with theme set to "system" a scheduled dark-mode switch doesn't reach a
  running tab. ~20 minutes.
- **The Settings test's `SettingsToggle` mock contradicts the real component**, passing a
  boolean where the real one passes an event. The tests pass only because none of them
  toggles anything. ~20 minutes.
- **Word data is still bundled whole.** `html2canvas` and `canvas-confetti` are now
  dynamically imported, but `words.json` (277 KB raw / 97 KB gzipped) is still a static
  import, so all four dictionaries plus the 13,106-word guess list load before first paint.
  Splitting per dictionary and deferring the guess list is the remaining win. ~2 hours.
- **Lexi5 is excluded from `npm run typecheck`.** Plain JSX is the repo convention for most
  apps, but Lexi5's state is the most intricate of the JSX apps — a five-key stats object with
  nested histograms migrated across two schema versions — and typing it would have caught the
  `highContrast`/`DEFAULT_CONFIG` mismatch at compile time. ~4 hours.
- **No non-English dictionary option.** A real feature needing a source word list and a
  decision about which language(s), not a bug fix.

## Deliberately not done

- **Full `SelectField` adoption for the two native dropdowns.** The audit suggested replacing
  Lexi5's hand-rolled selects with the DS component. The accessibility defects behind that
  recommendation are fixed in place (real `htmlFor`/`id` pairs, `aria-describedby`, a visible
  `:focus-visible` ring), but swapping in `SelectField` would also swap in DS field styling
  and lose Lexi5's compact custom chevron — a visual change to a design-locked app that
  nobody asked for. Worth doing only alongside a deliberate restyle.
- **A separate `src/lexi5/theme.css`.** The audit recommended lifting the DS-token mapping out
  of `App.module.css`. All the mapping gaps are now closed (every `--color-*` token Lexi5
  touches is mapped in both theme blocks, and tile fills are paired with ink tokens), so the
  remaining benefit is organisational only; moving ~50 lines of load-bearing CSS across files
  carries more regression risk than it removes right now.
- **Keyboard key-status memoisation** (carried over from the previous roadmap). Investigated
  and confirmed a non-issue: `Keyboard` is wrapped in `React.memo` and its props are already
  referentially stable across unrelated App re-renders, so the computation only runs when it
  must. An internal `useMemo` would add indirection without changing when anything executes.
- **Tiles are no longer square on short viewports.** The board now sizes from its container
  instead of `100dvh` arithmetic, so landscape went from unusable 4–8px tiles to ~66×36. The
  grid stretches rather than staying 5:6 when height is the binding constraint. That's a
  deliberate trade — playable and non-square beats square and invisible — but a dedicated
  landscape layout would be better still.
