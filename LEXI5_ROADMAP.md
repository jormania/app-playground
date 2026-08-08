# Lexi5 — Roadmap

Deferred/optional follow-ups identified during the 2026-08-08 full-app audit. Everything
judged a real bug, corner case, or clarity gap was fixed directly (see `LEXI5.md` and git
history around that date). This file is the "nice to have, not urgent" leftovers.

## Custom (AI Curated) dictionary
- **No quality check on curated words.** Claude's output is only validated by shape
  (5 lowercase letters) — nothing confirms the words are real/appropriate. Could
  cross-check against the existing `guesses` list or a dictionary API and drop anything
  unrecognized.
- **No "Clear Custom List" action.** The only way to change or remove a curated list is
  to overwrite it via re-curation; there's no button to just delete it and fall back to
  a built-in dictionary.
- **Re-curating can reproduce words from the previous list.** Nothing tells Claude to
  avoid the existing list, so a refresh could hand back a list with heavy overlap.
- No way to choose the word count or model for curation — both are hardcoded (500 words,
  `claude-haiku-4-5-20251001`).

## Accessibility
- No colorblind-friendly palette alternative (real Wordle offers an orange/blue swap for
  the green/yellow tiles).
- Toasts aren't wired to an ARIA live region, so screen readers won't announce them.
- The Smart Keyboard's positional dots have no `aria-label` describing what they mean.

## Polish / nice-to-haves
- `daysSinceEpoch` parses dates via the browser's local `Date` constructor — around DST
  transitions this could theoretically shift a word by a day for some users. Vanishingly
  rare in practice; not worth the complexity of a UTC-normalized date scheme unless it's
  actually reported.
- No daily-word archive/calendar view (e.g. "what was yesterday's Standard word").
- No non-English dictionary option.
