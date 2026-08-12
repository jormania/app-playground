# Lexi5

**[coneofcold.vercel.app/lexi5-react.html](https://coneofcold.vercel.app/lexi5-react.html)**

A daily 5-letter word challenge built with React and Vite, featuring multiple curated dictionaries, comprehensive statistics, and a clean interface using the shared design system.

## Data & Curation
The game ships four dictionaries, ordered easiest to hardest, switchable in Settings:
- **Lite**: 344 hand-picked, everyday words — appropriate for a younger/less-practiced reader.
- **Standard**: The official original 2,309 word answers.
- **Expanded**: The 5,757 words from the Stanford GraphBase frequency list.
- **Expert**: The official list of 13,106 allowed guesses (including obscure words).

Standard/Expanded/Expert are generated via `scripts/curate-lexi5-dictionary.mjs`. Lite is
hand-curated directly in `src/lexi5/data/words.json` (not script-generated — word difficulty
isn't something the source lists encode, so it needed a human pass) and validated against the
guess list by the same script's invariants (5 letters, lowercase, real dictionary entries).

A fifth option, **Custom (AI Curated)**, is user-generated: paste an Anthropic API key into
Settings → "AI Curation" and configure your preferred Claude model (Haiku or Sonnet), the desired word count (up to 1,000 words), and an optional freeform theme (e.g., "Space", "Hard vocabulary"). The AI then curates a tailored list on the
fly. The key is never sent to or stored on our server — the request goes through a Vercel edge
rewrite (`/api/anthropic-proxy` → `api.anthropic.com`, see `vercel.json`) straight to Anthropic.
The **Custom** option is disabled in the dropdown until a list has actually been curated, so you
can't accidentally select a dictionary that silently falls back to Standard. You can easily reset a themed list back to a normal list using the "Curate Vanilla" button, or completely clear the list at any time from the Settings menu.

Switching dictionaries (built-in or Custom) always deals a fresh word immediately and shows a
toast confirming the switch — it never silently keeps playing the old word under a new label, and
it never counts as a loss.

### Non-repeating word cycles
Each dictionary's answer words are served from a deterministic shuffled order (seeded from the
list's own contents, so re-curating Custom reshuffles automatically) rather than a raw hash
lookup. This guarantees no word repeats until every word in that list has been used exactly once;
once a list's cycle completes it reshuffles and starts over, with a toast letting you know. This
also means Custom re-curation is the only way to avoid ever seeing a repeat past that list's size
— which was a real gap in the original implementation (words could collide well before the list
was exhausted). This position/cycle math (`getWordProgress` in `lib/gameState.js`) is a function
of `(dictionary, date, iteration)` — it doesn't matter how much you switch between dictionaries
and back; a given built-in dictionary's position on a given day is always the same, so nothing
needs "refreshing" just from navigating away and back.

Endless mode (`iteration > 0`) reports its own lap count through the list for progress/staleness
purposes, separate from Crown's calendar-anchored one — so a handful of Endless plays doesn't look
like the whole list got exhausted. `getWordProgress`'s `cycleNumber` used to fold a large offset
(`total * 100`) straight in for this, which meant it was always ≥100 for *any* Endless game — the
Custom "you've used every word" banner could fire after only two Endless plays on a 27-word list.
`getWordProgress` now reports Endless's real lap count (`floor((iteration - 1) / total)`) instead,
so the banner/toasts that key off it reflect how many words have actually been played.

That fix intentionally stops at *reporting*. `getWord` — which actually picks the word — does
**not** reuse `getWordProgress`'s numbers for Endless; it keeps computing its own cycleNumber/
position from that same `total * 100 + iteration` offset, unchanged, in a path of its own. Neither
Crown's nor Endless's word is persisted (both are re-derived from `(date/dictionary, iteration)` on
every load — see `App.jsx`), and a shared seed link (`handleShareBoard`) encodes `iteration` for
Endless games too, so changing *which* word an iteration maps to would silently corrupt an
in-progress Endless game's tile colors on its next load or resolve a previously-shared Endless link
to a different word — the same class of bug avoided for Crown, just less obvious since it needed
tracing through what `total * 100` was actually protecting. That offset was never the source of the
staleness bug in the first place: it already keeps Endless's shuffle order from colliding with
Crown's (Crown doesn't reach cycleNumber 100 for centuries on any real list size), so it didn't need
to change at all — only the number surfaced to the UI did.

For the built-in dictionaries, "cycle" is anchored to the Unix epoch — fine, since those lists
never change. **Custom is the one exception**: it's anchored to whenever it was last curated
(`markCustomDictionaryCurated`, storing `lexi5_custom_dict_epoch`), not the epoch. Without that
anchor, "cycle number" would be days-since-1970 divided by list length — since that's already
~20,000 days, a freshly curated list would look already-cycled on the day it's created. (This
shipped as a real bug once: refreshing the Custom list didn't clear the "used every word" banner,
because the banner was reading the un-anchored epoch-relative cycle number.) A list saved before
this anchor existed self-heals by anchoring to the first day it's read, rather than claiming
instant staleness.

Unlike the built-in lists (which just reshuffle silently once their cycle completes), Custom
requires the player to take an action to get fresh words — re-curate. So once Custom's cycle has
wrapped at least once *since it was curated*, a persistent banner stays up on the main screen (not
just the one-off toast, which is easy to miss) until you tap **Refresh Now**, which jumps straight
into Settings with the curation panel already open.

## Code layout
Game logic lives in focused modules under `src/lexi5/lib/`, with `gameState.js` kept as a
thin re-export barrel so every existing import path (and the whole test suite) works
unchanged — the same promotion pattern used for `useWakeLock`:
- `score.js` — **the** tile scorer (`scoreGuess`, `keyStatuses`). Board, the keyboard and
  the share card all call it. There used to be three separate implementations; the share
  card's skipped the letter-consumption step and painted yellows the board never showed.
- `hardMode.js` — `validateHardMode`, extracted from a 55-line block inlined in `App.jsx`.
- `words.js` — PRNG, shuffle cache, `getWord`/`getWordProgress`, `parseSeed`.
- `dictionaries.js` — built-in lists and the whole Custom-list lifecycle.
- `stats.js` — statistics schema, migrations, Crown-win history.
- `useGameState.js` — the React hook.
- `useToastQueue.js` — the queued toast (see Toast notifications below).

**All storage goes through [`src/shared/storage.ts`](src/shared/storage.ts)**, whose helpers
can't throw. An unguarded `setItem` inside an effect is an uncaught render error — in Safari
private mode or at quota it unmounted the app to a blank page. `lib/storageBoundary.test.js`
fails the suite if a direct `localStorage` write reappears, the same way
`src/ds/boundary.test.js` guards the design-system boundary. `components/ErrorBoundary.jsx`
catches whatever still gets through and offers to clear Lexi5's keys.

## Game State
State is entirely local to the device and tracked via `localStorage` keys:
- `lexi5_stats`: Lifetime statistics (played, won, streaks, guess distribution), one bucket per
  dictionary (`lite`, `standard`, `expanded`, `expert`, `custom`).
- `lexi5_game`: The current active game state, keyed to the current date and dictionary.
- `lexi5_config`: User preferences (theme, difficulty, dictionary).
- `lexi5_custom_dict`: The AI-curated word list, if one has been generated.

The daily word itself needs no server round-trip — it's derived deterministically from the local
date and the (statically bundled, so identical for every install) dictionary contents. The
optional Custom dictionary curation feature does call out through the Vercel edge rewrite
described above, so the app isn't *entirely* server-free, but nothing about normal gameplay
requires network access once loaded (it's a fully offline-capable PWA).

## Toast notifications
The app surfaces state changes/errors via a lightweight in-app toast (not blocking native
`alert()`s) at these points:
- Invalid guess (wrong length / not in word list), Hard Mode rule violations.
- Switching dictionaries — confirms the new dictionary and that a fresh word was dealt.
- A custom dictionary running low on words (warns when 3 or fewer words remain).
- A dictionary's word cycle completing and reshuffling.
- Falling back off an unavailable Custom dictionary (storage cleared, or a shared seed link
  referencing a Custom list you don't have).
- Curating/refreshing the Custom dictionary (success, or a readable error inline in Settings).
- Copying/sharing the board (link copy, image share, and their failure paths).
- Resetting statistics.

Implemented by `lib/useToastQueue.js`. Toasts queue rather than overwrite: if one fires while another's still showing, it waits its
turn instead of silently clobbering the first (immediate repeats of the *same* message are
deduped against what's showing/queued, so e.g. mashing Enter on an invalid guess doesn't pile
up a run of identical toasts). The toast itself renders with `role="status" aria-live="polite"
aria-atomic="true"` so screen readers announce it.

## Theming gotcha: this app maps DS tokens onto its own palette
`App.module.css`'s `:root` block re-maps several `--color-*` custom properties
(`--color-surface`, `--color-ink`, `--color-border`, `--color-surface-2`, `--color-muted`) so
that `src/ds/` components (Modal, SegmentedControl, Field, etc.) render in Lexi5's own
black/white palette instead of the design system's default Solarized/Tokyo Night theme.

Two things to watch if you touch this:
1. **Every mapping must be re-declared in the `:root[data-theme="dark"]` block too**, not just
   the base `:root`. DS's own dark-theme rule for these same properties is an attribute-qualified
   selector (`:root[data-theme="dark"]`), which is *more specific* than a bare `:root` — a mapping
   left only in the light block gets silently overridden by DS's own dark value. This exact bug
   shipped once already (Modal titles and stat numbers briefly rendered in DS's lavender ink
   instead of white).
2. **`--color-surface-2` is intentionally its own value, not an alias for `--surface-float`.** DS
   pairs `--color-surface-2` with `--color-muted` as a background/foreground combo
   (SegmentedControl's track+inactive-label, Modal's close-button hover, IconButton). Lexi5's own
   `--surface-float` and `--text-subtle` happen to be the *identical* hex value in dark mode
   (`#818384`, used for unrelated things — the Keyboard's untried-key background vs. general
   muted text) — aliasing `--color-surface-2` to `--surface-float` made muted text exactly the
   same color as its own background, i.e. invisible. `main.jsx` also imports `../ds/tokens.css`
   *before* `./App` for the same reason — so Lexi5's own CSS loads later and wins same-specificity
   cascade ties (this matters for the light theme, where the DS/Lexi5 rules for these tokens are
   equally specific).

## Features & Polish
- **Crown Mode vs Infinite**: The first game played each day is the "Crown" word, which tracks its own special streak separate from infinite practice mode. The UI now intelligently displays the global session streak by default, enabling players of endless custom games to track their active win streaks continuously.
- **Smart Keyboard**: An optional setting that adds positional memory (small dots) to yellow keys, reminding you which positions you've already tried a letter in. The dots are decorative/`aria-hidden`; every key's actual Wordle status (correct/present/absent) is exposed to assistive tech via `aria-label` regardless of this setting, since color alone doesn't reach a screen reader.
- **High Contrast Mode**: An optional blue/orange palette swap for the green/yellow tiles, for players with color vision deficiencies that make the default red/green-adjacent palette hard to distinguish.
- **High-Fidelity Social Sharing**: Instead of simple text emojis, the "Share" button utilizes `html2canvas` and the Web Share API to generate and share a clean, beautiful image of your game board. Sharing replaces the target word with a spoiler-free definition hint, and dynamically brands AI-curated custom games.
- **Animations & Haptics**: Full NYT-style animations including tile pops, invalid word shake, and a staggered victory dance. Includes mobile `navigator.vibrate` haptics and a confetti celebration upon beating the Crown word. The layout features `overscroll-behavior-y: none` to prevent native browser pull-to-refresh from squishing viewport elements.
- **Hard Mode**: Revealed hints must be used in subsequent guesses (and green letters must remain in their exact positions).
- **Accessibility**: keyboard keys expose their Wordle status via `aria-label` (colour is
  otherwise the only signal); the toast is a `role="status"` live region; every animation
  and the confetti burst are skipped under `prefers-reduced-motion`; tile fills are paired
  with explicit `--tile-*-ink` tokens so text contrast follows the palette — High Contrast
  Mode previously kept white ink on its light fills and measured *worse* (1.93:1) than the
  default palette it replaces.
- **Screen Wake Lock**: The screen stays awake only while an active game is actually on screen
  (`gameState.status === 'playing'` and no Settings/Stats/Archive/forfeit modal is open) — moving
  to any menu, winning, or forfeiting drops back to default OS sleep behavior. Uses
  `src/shared/useWakeLock.ts`, promoted there once Lexi5 became a third app needing it (Tempo and
  Yoru re-export it from their old paths).
- **Statistics Management**: In-progress games are automatically forfeited if left unfinished past midnight (recorded as a loss against the dictionary that game was playing), and users have the option to securely reset their statistics via a destructive confirmation modal. Guess distributions intelligently omit the "0" text for empty bars for a cleaner look.
- **Daily Archive**: A modal accessible via the calendar icon allowing players to look up the past 14 days of Crown words for any dictionary.
- **Reveal link stays lowercase in the DOM**: The post-game "The word was: WORD" Wiktionary link
  displays uppercase via CSS (`text-transform: uppercase` on `.wordRevealWord`) but its actual text
  content — and the link's `href` — stay lowercase. English Wiktionary treats a capitalized title as
  a *different, case-sensitive page* (often a surname/proper-noun entry, e.g. "Gully" vs "gully"). If
  the on-screen text itself were the literal uppercase string, a phone's "search selected text" /
  circle-to-search on that word would search the all-caps string directly — bypassing our correct
  lowercase `href` entirely — and could land on the wrong, unrelated entry.
- **PWA**: Fully installable as an offline-first app, registered in The Cabinet.

See [`LEXI5_ROADMAP.md`](LEXI5_ROADMAP.md) for deferred/optional follow-ups from the 2026-08-08 audit.
