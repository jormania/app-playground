# Lexi5 — Roadmap

Deferred/optional follow-ups identified during the 2026-08-08 full-app audit. Everything
judged a real bug, corner case, or clarity gap was fixed directly (see `LEXI5.md` and git
history around that date). This file is the "nice to have, not urgent" leftovers.

## Resolved since this file was written
All items originally listed here have since been addressed — kept as a record of what
"deferred" turned into, not as an open list to re-implement:
- **Toast queue**: `App.jsx`'s `showToast` now queues distinct messages (each gets its own
  turn) instead of one overwriting another mid-display, while deduping immediate repeats of
  the *same* message so mashing an invalid guess doesn't queue a pile of identical toasts.
- **Keyboard key-status memoization**: investigated and found to be a non-issue rather than
  something to fix — `Keyboard` is already wrapped in `React.memo`, and its props
  (`guesses`, `word`, the `useCallback`-memoized handlers, `smartKeyboard`) are already
  referentially stable across unrelated App re-renders (e.g. a toast changing), so the
  status computation already only re-runs when it actually needs to. An internal `useMemo`
  would add complexity without changing when the work happens.
- **Colorblind-friendly palette**: shipped as "High Contrast Mode" in Settings (a blue/orange
  palette swap) — this file just never got updated to reflect it.
- **Toasts wired to an ARIA live region**: the toast now renders with
  `role="status" aria-live="polite" aria-atomic="true"`.
- **Smart Keyboard positional dots**: each key now carries an `aria-label` stating its actual
  Wordle status (`"Q, correct"` / `"Q, present elsewhere"` / `"Q, absent"`) — the meaningful
  information a screen reader needs. The decorative dots themselves (which slots a letter's
  been tried in) are marked `aria-hidden` rather than transcribed, since translating that to
  text for every key was judged not worth the noise.
- **`daysSinceEpoch` DST safety**: already fixed in a prior pass (re-anchors to UTC noon of
  the local calendar date, so a fractional-day DST shift can't nudge the day count) — this
  file just never got updated to reflect it either. Added a regression test
  (`gameState.test.js`) that pins `process.env.TZ` to a DST-observing zone and checks
  sequential calendar days produce sequential positions across both the 2026 US
  spring-forward and fall-back transitions, since this sandbox/CI's own timezone (UTC) never
  exercises the bug.
- **Word Count field snapping to 0 instead of going blank**: `Number('')` is `0` (finite),
  not `NaN`, so the old `Number.isFinite` guard never actually let the field clear. Fixed by
  checking the raw input string first.

## Still open
- **No non-English dictionary option**: a real feature, not a bug fix — needs a source
  dictionary and curation pass for whichever language(s), same as `lite`/`standard`/
  `expanded`/`expert` each did. Left for a deliberate decision on which language(s) to add
  and where the word list comes from, rather than guessing.
