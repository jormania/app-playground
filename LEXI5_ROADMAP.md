# Lexi5 — Roadmap

Deferred/optional follow-ups identified during the 2026-08-08 full-app audit. Everything
judged a real bug, corner case, or clarity gap was fixed directly (see `LEXI5.md` and git
history around that date). This file is the "nice to have, not urgent" leftovers.

## Architecture & State Management
- **Persistent Toasts / Queue**: Implement a true toast queue system instead of a single string overlay, allowing multiple messages to stack visually without overwriting each other.
- **Advanced Curation Parameters**: Allow users to specify a *theme* (e.g., "Space-related words", "Hard vocabulary") in Settings instead of purely relying on Claude's random sampling.
- **Keyboard Key Status Memoization**: Beyond `React.memo`, memoizing the `keyStatuses` dictionary at the root level (instead of recalculating inside the Keyboard component) could save cycles, though it is currently fast enough.

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
- No non-English dictionary option.
