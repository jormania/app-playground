# Backlog — refactors, modernisation, and enhancements

The queue the **Daily refactor** Routine burns through — one item per weekday
morning, each landing as its own PR off fresh `main`. Fridays are discovery runs:
nothing ships, the agent reads the codebase and adds to this file instead.
Process lives in [`.claude/skills/daily-refactor/SKILL.md`](.claude/skills/daily-refactor/SKILL.md).

Edit by hand freely. Reorder to change priority — the agent always takes the
topmost eligible item, so the order of this file is the steering wheel.

**States:** `open` · `claimed` (an open PR names it) · `done` · `blocked` · `dropped`.
An `open` item may also carry **not agent-executable** in its header — work only a
human can do, which the agent passes over and names in its PR. Progress notes may
follow the state (`` `open` — step 1 done ``); the state token itself stays third.

**One item = one `## ` header.** A big item that splits into slices gets one
header per slice, in the order they should be taken — nesting them as bullets
hides them from the footer's backlog count and makes "the topmost eligible item"
ambiguous.

**The order is absolute.** The agent takes the topmost eligible item — never a
lower one because it seems a better fit for the morning, and never by reasoning
about the classes around it. It names every item it passes over in its PR, and
the only valid reasons are the four in the skill's pick rule.

**Interleaving is advice for whoever arranges the queue, not a rule the agent
applies.** `refactor` and `modernise` items merge themselves once the workflow's
independent run is green; `qol` and `visual` never do — they wait for a human. So
a run of review-needed items at the top means that many mornings in a row of PRs
waiting on you. When adding or reordering, it is usually worth putting a `qol`
or `visual` item between self-merging neighbours. But if you *want* three visual
items first, put them first: the agent will take them in that order. (It once
didn't — on 2026-09-23 it passed over three `visual` items to take a
self-merging one, on the strength of an older wording of this paragraph. That
wording is gone.)

**Classes** decide the burden of proof and who may queue an item:

| Class | What it is | Agent may queue it itself? |
|-------|-----------|---------------------------|
| `refactor` | Behaviour-preserving restructuring | yes |
| `modernise` | Dep currency, deprecated APIs, coverage, doc drift | yes |
| `qol` | Small user-visible improvement | no — proposes only |
| `visual` | SVG, icons, spacing, motion, empty states | no — proposes only |

Anything under **`## Proposed`** is the agent's own idea and will not be worked
until a human moves it up into the main list. That move is the whole approval
ritual: cut the block, paste it above, change `proposed` to `open`.

## R-013 — The suite goes red for a week whenever the clock walks past a fixture date · `modernise` · `done 2026-09-18`

**Impact:** none visible in any app. But **`main`'s suite is red right now**, and
while it is, the daily pass's independent verify step fails and *nothing
auto-merges* — so this sits at the top of the list ahead of everything else.

Found on the Friday read, 2026-09-18, by the gates failing on a Markdown-only
change. It reproduces on a clean `origin/main` checkout, so it is not this run's
doing:

```
src/marquee/Programme.test.jsx > a swipe starting on a real control … fires neither
  Unable to find an accessible element with the role "button" and name /Sep/
```

**Why, exactly.** The test's fixture hard-codes `date: '2026-09-23'`
(`src/marquee/Programme.test.jsx:9-21`) and then matches the date button by
`/Sep/`. The label comes from `formatDay` in `src/marquee/format.js:29`, whose
`now` **defaults to the real system clock**: at 2 to 6 days out it returns a bare
weekday (`'Wednesday'`), and only outside that window does it return the
`"Wed 23 Sept"` form the matcher needs. So the test passed the day it was
written, quietly became a time bomb, started failing on 2026-09-17, and will go
green again on its own around 2026-09-25 — a week of red that looks exactly like
a real Marquee regression and is not one.

**The fix is small and behaviour-preserving** — `formatDay` already takes an
explicit `now`, so nothing in the app changes:

1. Freeze the clock for this file (`vi.setSystemTime` in a `beforeEach`, restored
   after), **or** match on the label the component actually renders rather than
   on a month abbreviation. Freezing is the better answer: it fixes every
   assertion in the file at once and documents what date the fixtures assume.
2. **Then sweep for the same shape.** Any test with a hard-coded `2026-…` fixture
   date and no frozen clock is the same bomb with a different fuse. Marquee,
   Radar-B, Loom and WhereItWent all reason about "today". List what you find on
   the PR even if you only fix Marquee.

Read [`MARQUEE.md`](MARQUEE.md) first. Do **not** reach for the forbidden fix:
skipping, quarantining or loosening the assertion is not on the table — the test
is correct about the behaviour, it is only wrong about what day it is.

### What happened — fixed in #75, 2026-09-18

Step 1 done: the clock is frozen at `2026-09-01` in a `beforeEach`, restored
after. `main` is green again, 4488 passing. It also defused the `/27 Sept/`
assertion later in the same file, which was four days from the identical fate.

Two corrections to the diagnosis above, both checked against
`Math.round((startOfDay(date) - startOfDay(now)) / DAY)`:

- It **started failing on the 18th, not the 17th.** On the 17th the `09-24`
  fixture was exactly seven days out, which falls past the `days < 7` branch and
  still rendered `"Thu 24 Sept"`, so one match survived. The 2026-09-17 run
  verified green, which settles it.
- It would have **self-healed on the 24th, not the 25th** — once a fixture is one
  day past, `days = -1` falls through to the month form and matches again.

Step 2, the sweep, is **not** done and is now R-018. What was established:
every direct `formatDay` call in the suite already pins `now`, so the unit tests
were written correctly and the defect only existed where `formatDay` is reached
through a rendered component. `Changes`, `WeekStrip` and `App` were run against a
clock six months ahead and pass.

## R-001 — Root triage, slice 1: the inert data dumps · `refactor` · `done 2026-09-14`

**Impact:** a repo root someone can read. Nothing user-facing.

Deleted `diff.txt` (a UTF-16 `git diff` capture), `lexi5_dump.txt` and
`memento_dump.html` (regenerable output of `dump.cjs` and `debug_memento.cjs`),
`lint-output.txt` (a captured `eslint .` run), `notes.json` (a one-shot Click
Deck payload, no reader) and the empty `results.json`. Each was committed once,
incidentally, alongside unrelated work; none is read by any code. All remain
recoverable from git history.

Left alone on purpose: `mcp-payloads.json`, which was not in this item's scope.

## P-002 — A bundle-size gauge in the footer, beside the function one · `qol` · `done 2026-09-16`

**Impact:** the second Vercel ceiling this repo has hit becomes visible before
it is hit, the way the function count now is.

Deployment Storage is 10 GB on Hobby, charged per retained deployment, and it
filled once already (2026-09-09). The retention policy sweeps old builds, but
that only holds because `dist/` stays around 10 MB — the two are one mechanism.
Nothing on any surface says what `dist/` currently weighs, so the drift that
matters (a `@fontsource` family imported by bare name, a dependency's
`new URL(…, import.meta.url)` dragging in a `.wasm`) is invisible until the
quota complains.

The footer's build line already carries the function gauge, hidden until it has
something to say. Same treatment: show the built size from some threshold up —
20 MB is a reasonable first guess, given ~10 MB is normal and the known
incidents were 17 MB and 23 MB of a single accidental asset.

**The catch, and the reason this is not a five-minute job.** The existing gauges
ride on `buildMetaPlugin`'s `transformIndexHtml`, which runs *before* the bundle
exists — the size is not knowable at that point. This one needs a `closeBundle`
hook that measures `dist/` and rewrites the emitted HTML afterwards, which is a
different and uglier mechanism than a `<meta>` tag stamped on the way through.
Whoever takes it should decide whether one gauge is worth that second mechanism,
and say so on the PR either way; "measured it, not worth the hook" is a fine
outcome. Counting logic belongs in `scripts/build-meta.js` with the others, and
tested — the point of a guardrail gauge is that it cannot quietly under-report.

Being `qol`, it changes what you see: not auto-merged however green, and needs
before/after screenshots (both themes, phone and desktop).

Proposed 2026-09-15, alongside the footer work that added the function gauge.
**Promoted by Gabriel on 2026-09-16** and placed at the head of the list, so
it is the next item taken. Being `qol` it is still never auto-merged: it waits
for his eye on the screenshots however green it comes back.

**Built 2026-09-16.** The second mechanism was worth it, but only because it was
not actually second: `stripStraySolOdysseyManifestPlugin` already rewrites emitted
HTML from `closeBundle`, so `stampBuildSizePlugin` is a second tenant of a hook
this config already runs rather than a new idea. `directorySizeBytes` and
`withBuildSizeMeta` live in `scripts/build-meta.js` with the other counts, tested.

One thing the item did not anticipate, and the reason a naive version would have
under-reported: vite-plugin-pwa generates its service workers from a **post**-ordered
`closeBundle`, so a plain hook — at any position in the plugin array — measures
`dist/` before `sol-odyssey-sw.js`, `click-deck-sw.js` and their two workbox
runtimes exist, and reads ~42 kB light. Measured that, then ordered the hook `post`
too. What remains is the tag stamping itself: 20 pages × ~45 bytes ≈ 0.9 kB it
cannot include, against a threshold in megabytes.

Thresholds: visible from 20 MB, rose from 40 MB, against today's 9.4 MB — so it
shows nothing right now, which is the point. The front page is dark-only (no
`prefers-color-scheme` anywhere in `index.html`), so "both themes" did not apply;
the PR carries both widths, plus both fired states rendered from a patched tag.

## P-001 — 38 hand-rolled inline `<svg>` blocks while lucide-react sits in the deps · `visual` · `slice 1 (audit) done 2026-09-16`

**Impact:** icons that finally look like one family instead of twelve people's
handwriting; a smaller bundle where a hand-rolled path duplicates a lucide one.

Promoted by Gabriel on 2026-09-14. Being `visual`, no slice of this is ever
auto-merged however green it comes back — each waits for his eye on the
screenshots.

### What the audit found

Inline `<svg>` is in **44 `.jsx`/`.tsx` files across eighteen app directories**
(the "38 / twelve apps" figure was measured 2026-09-13 and has drifted up). They
are not one population but two, and only one of them is worth touching:

**Group 1 — pasted Feather/lucide markup, in apps that already bundle
lucide-react.** The tell is markup no human types: `<line x1= y1= x2= y2=>`,
`<polyline points=>`, `rx="2" ry="2"`, and Feather's 700-character `settings`
gear path. `src/where-it-went/components/CategorySelect.jsx` and its two
siblings inline `m6 9 6 6 6-6`, which is lucide `ChevronDown` character for
character. Worse, the duplication is *within* one app: WhereItWent imports
lucide in seven files (`CategoryIcon.jsx` alone pulls 23 glyphs) while pasting
Feather markup into nine others, so one screen can show both drawing
conventions. And it crosses apps — the sun and moon in
`src/where-it-went/components/Settings.jsx` are byte-identical to two of the
three in `src/lexi5/components/Settings.jsx`. Replacing
these is near-free — lucide is already in those bundles — and it is the only
part of this item that delivers the stated "one family" win.

**Group 2 — deliberate, documented, app-specific glyph families, in apps with no
lucide dependency at all.** Cabinet, Loom, Law of the Day, Radar-B, Tempo and
Wanderlist each hand-draw a coherent set at a 1.6–1.7 stroke, and several carry
comments explaining why they are *not* the standard glyph: Tempo's header says
"deliberately organic/quiet rather than mechanical (no gears, no wrench)";
Radar-B's `SettingsIcon` documents that a gear reads as a sun at 20px;
Cabinet's sort marks document why Manual is deliberately not arrows. lucide
0.460's drawings are also a visibly looser family — `Star` is a
rounded-corner path with 2.12 radii where Cabinet's `IconPopular` is a sharp
five-point star, `Search` is r=8 where Radar-B's is r=7. So converting Group 2
would **not** unify anything; it would swap six coherent sets for a seventh
look, contradict written design decisions, and *add* lucide's runtime
(`createLucideIcon` + `Icon` + `defaultAttributes`, ~2.3 kB unminified before
the icons) to six bundles that currently carry none of it.

**The "smaller bundle" half of the Impact line above is therefore only true for
Group 1, and is backwards for Group 2.**

### The slices

Each is its own top-level item below — **P-001a**, **P-001b**, **P-001c** — in that
order, though no longer consecutive: they are spaced out among the `refactor`
items so that no two mornings in a row produce a PR waiting on a human. They live
out there rather than as bullets in here because the queue is read by header: a
sub-item is invisible to the footer's backlog count, and "the topmost eligible
item" stops meaning anything when one sits nested inside a finished parent.

### Explicitly not doing, so nobody re-audits this

Cabinet, Loom, Law of the Day, Radar-B, Tempo, Wanderlist — Group 2 above.
Touch Grass, Journal of Delights, Kettlebell — legacy and design-locked
(`LEGACY.md`); their glyphs are part of a look nobody may restyle.
Silva's four, Sol Odyssey's `Logo`/`Sparkline`, Yoru's `MoonGlyph`, Tempo's
`CountdownRing`, Click Deck's watchlist mark, `src/ds/components/GuideNote.tsx`,
`src/ds/showcase/Showcase.tsx`, Fit Check's guide mark — genuine one-off
drawings (graphs, rings, avatars, logos) that no icon library contains.

## R-010 — Root triage, slice 2: the `patch-*.cjs` family · `refactor` · `done 2026-09-17`

**Impact:** a repo root someone can read. Nothing user-facing.

`patch-accounts.cjs`, `patch-bulk.cjs`, `patch-categories.cjs`,
`patch-currency.cjs`, `patch-forms.cjs`, `patch-modal.cjs`,
`patch-remaining.cjs` — seven files, none referenced by `package.json`. Delete
the one-shot migrations, move anything still earning its keep under `scripts/`.
Check `git log` on a file before deleting — a script someone reruns yearly is
not junk.

**Done 2026-09-17.** All seven deleted; nothing moved to `scripts/`, because none
of them earned it. `git log` puts every one in a single commit — 3930c68,
2026-07-31, *"feat(mobile): replace account emojis with lucide icons and add
currency flags"* — the same commit that carries their output. They are the
codemods that performed that one migration, written to be run once against
WhereItWent and committed by accident alongside the result. The migration is
fully landed: `AccountSelect.jsx`, `CategorySelect.jsx`, `CurrencySelect.jsx`,
`CategoryIcon.jsx` and `AccountIcon.jsx` all exist and are imported by the
components these scripts were rewriting.

Worth recording that they are not merely dead but **actively unsafe to run
now**: each is a set of regex/string replacements over `src/where-it-went/`
source that assumes the pre-migration text. `patch-modal.cjs` prepends a
`lucide-react` import and re-injects the `CATEGORY_ICONS` map that
`patch-categories.cjs` deleted; `patch-categories.cjs` blanks
`notionClient.js`'s emoji mapping. Anyone who found one at the root and ran it
to see what it did would corrupt the app. Deleting them removes a trap, not just
clutter. All recoverable from history at 3930c68.

No search outside `REFACTOR_BACKLOG.md` finds these names — no `package.json`
script, no workflow, no doc.

## P-001a — WhereItWent: retire the pasted Feather markup · `visual` · `done 2026-09-21`

**Impact:** one drawing convention per screen instead of two. Part of P-001,
Group 1 — see that item's audit for why this group and not the other.

Nine files, ~17 glyph sites, in an app already importing lucide in seven others.
`components/Navigation.jsx` is the bulk (7 glyphs: dashboard, transactions,
insights, settings, filter, calendar, plus×2); then `Settings.jsx` (sun, moon),
`PeriodSheet.jsx` (calendar), `TransactionForm.jsx` (Feather `file-text`), and
`ChevronDown` in `AccountSelect.jsx`, `CategorySelect.jsx`, `CurrencySelect.jsx`.

Leave `Sparkline.jsx` and `NoraAvatar.jsx` alone — one-off drawings, not icons.
Read `WHERE_IT_WENT.md` first. Being `visual`: screenshots in both themes at both
widths, and never auto-merged.

**Done 2026-09-21.** Seven files, seventeen glyph sites, all seven of the named
files converted; `Sparkline.jsx` and `NoraAvatar.jsx` are now the only `<svg>`
left in the app, as intended. Sizes preserved exactly (20/16/14/12px), and
`TransactionForm`'s `strokeWidth={2.5}` passed through as a prop.

Two things worth keeping for whoever takes P-001b and P-001c:

- **Only three of the seven glyphs actually change shape.** `Filter`,
  `Calendar`, `ChevronDown` and `ChartNoAxesColumn` in lucide 0.460 are the same
  coordinates as the Feather markup they replaced, to the character. The visible
  differences are the gear (lucide's is flatter), the grid (`rx="1"` on each
  square) and the sun (r=4 vs Feather's r=5). So a "before/after" here is much
  quieter than the file count suggests — check the shape before promising a
  reviewer a difference.
- **`flairLucideIcons` is a different thing and must not be confused with this.**
  That feature toggle ("Use Lucide Icons", off by default) swaps the *emoji* on
  category and account rows — `CategoryIcon.jsx` and `AccountIcon.jsx` only. The
  chrome icons were never emoji and were never behind it. Nothing here was put
  behind that flag, and nothing should be.

## R-011 — Root triage, slice 3: the remaining scratch scripts · `refactor` · `done 2026-09-22`

**Impact:** a repo root someone can read. Nothing user-facing.

`cleanup.cjs`, `debug_crash.cjs`, `debug_memento.cjs`, `dump.cjs`,
`find-covers.cjs`, `generateDemoData.cjs`, `scratch-fix.cjs`, `scratch_debug.js`,
`scratch_test.mjs`, `screenshot.js`, `steam-search.js`, `test-urls.cjs`,
`update-seed.cjs`, `validate-covers.cjs`. Same method as R-010. Note that
`dump.cjs` and `debug_memento.cjs` only ever wrote the dumps R-001 removed.

**Done 2026-09-22.** Thirteen of the fourteen deleted; **one earned its keep and
moved.** No file outside this backlog referenced any of them except
`CLICK_DECK.md` and `eslint.config.js`, both updated below.

**`generateDemoData.cjs` was the exception, and it is not a scratch file.** It is
the generator for `src/where-it-went/models/demoData.js` — 94 kB of committed
fixture that `App.jsx` and `lib/notionClient.js` both import and that Demo Mode
serves. Nine commits across a week of July iteration, against one commit for
every other file here. It now lives with the repo's other generators as
`scripts/generate-where-it-went-demo-data.mjs`, with an
`npm run gen:where-it-went-demo-data` entry beside the `gen:*-icons` ones, and a
header comment saying what it writes. Converting `require('fs')` to
`import fs from 'node:fs'` was the only edit to its body — `scripts/` is `.mjs`
by convention, and as a root `.cjs` it had been silently excluded from lint.
Verified by running it and passing `models/demoData.test.js` (11 tests) against
the regenerated file, then restoring the committed one; the output is randomised
per run, so it never reproduces byte for byte and the fixture guard is what
proves a new one valid.

The other thirteen fall into four groups, all one-shot:

- **Codemods, like R-010's `patch-*` family and equally unsafe to re-run now** —
  `cleanup.cjs` (injected `afterEach(cleanup)` into four Click Deck test files)
  and `scratch-fix.cjs` (rewrote `fireEvent.change` into click-a-button for two
  WhereItWent form tests). Both assume pre-migration source text; running either
  today would corrupt tests that already carry the result.
- **The Click Deck cover-art migration** — `find-covers.cjs`, `steam-search.js`,
  `update-seed.cjs`, `test-urls.cjs`, `validate-covers.cjs`: scrape a cover URL,
  regex it into `seed-data.js`, check for 404s. Superseded by
  `scripts/backfill-covers.py` and `api/steam-search.js`. The root
  `steam-search.js` is unrelated to the endpoint of the same name.
- **Browser-debug one-offs against `localhost:5173`** — `debug_crash.cjs`,
  `debug_memento.cjs`, `scratch_debug.js`, `screenshot.js`. The last one writes
  to a hard-coded `C:\Users\Gabriel\...` path, so it has not run on anything but
  one machine since 2026-07.
- **Dump writers whose output R-001 already deleted** — `dump.cjs`, plus
  `scratch_test.mjs` (a two-line `console.log` probe of `generateInsights`).

Two things worth carrying forward:

- **`eslint.config.js` named two of these files in its `ignores`** —
  `'steam-search.js'` and `'scratch_debug.js'` — both now removed, since a
  suppression naming a file that does not exist is a trap for whoever reads it
  next. Checked first that neither pattern reached anything else: `*.cjs` and
  these two are root-anchored in flat config, so `api/steam-search.js` was
  already being linted and stays that way. The `'*.cjs'` entry is left alone
  deliberately — it is a class of file, not a named one, and R-002 is where the
  root's future is decided.
- **R-014's step 3 is now unblocked.** `scratch_debug.js` was `puppeteer`'s only
  consumer in the repo; with it gone, `puppeteer` has none. See that item.

## R-022 — WhereItWent's empty-state float animation reaches almost nothing · `visual` · `done 2026-09-24`

**Impact:** empty states that were meant to float and no longer do. Small, but
it is a user-visible flair toggle that silently does less than it claims.

Found while doing R-020, 2026-09-22 — the fragility R-020 flagged has already
fired, so this is a live defect rather than a tidy-up.

`src/where-it-went/index.css`, the `float-icon` block under `.flair-empty`
(the `flairEmpty` feature toggle, on by default). Two rule blocks feed it:

1. `[style*="font-size: 48px"] svg`, `[style*="height: 48px"] svg`,
   `[style*="width: 48px"] svg`, `.empty-state-icon svg` — the inline-style
   selectors do match the empty-state containers in `TransactionsList.jsx:295`,
   `Dashboard.jsx:683`, `InsightsView.jsx:121` and `App.jsx:690`, but **those
   containers hold an emoji, not an `<svg>`**, so the descendant never resolves.
   `.empty-state-icon` appears nowhere in the markup at all.
2. `main > div > svg[width="48"]`, `main > div > svg[width="64"]` — these
   matched pasted Feather markup. The 2026-09-21 icon pass (P-001a) moved those
   sites to lucide components, which render a `size` prop rather than literal
   `width`/`height` attributes. `grep` finds no `width="48"` or `width="64"`
   left in the app.

So the whole block is inert today. Decide what it should do before deleting
anything: either give the four empty states a real `.empty-state-icon` hook and
let the animation work as intended, or drop the block and the keyframes with it.
The first is probably right — the toggle exists and users can turn it on.

Being `visual`: before/after screenshots in both themes, phone and desktop, on
`claude/shots`, and never auto-merged. Screenshot it with `flairEmpty` on, or
the diff shows nothing either way.

**Done 2026-09-24 — and it was not "almost nothing", it was nothing.** This
item's group 1 was too generous to the inline-style selectors: `[style*=
"font-size: 48px"] svg` does match the empty state's container, but the
container holds an **emoji** and the descendant `svg` never resolves. All four
empty states are emoji. So together with the dead `width="48"` attributes from
group 2, **`float-icon` had never once run on any screen** since it was written
— which the before shots prove rather than argue: `getComputedStyle(icon)
.animationName` is `none` on `main` and `float-icon` after.

Took the first of the two options, as the item guessed: the four empty states
now carry `className="empty-state-icon"` (`TransactionsList.jsx`,
`Dashboard.jsx`, `InsightsView.jsx`, `App.jsx`'s load error) and the six
selectors collapse to one, `.flair-empty .empty-state-icon`.

Three things worth carrying forward:

- **It animates the container, not an icon inside it.** That is what makes it
  work for an emoji, and an `<svg>` dropped in later floats identically —
  whereas animating a descendant is precisely what broke twice. The rule now
  matches a hook, never a markup shape; don't reintroduce one.
- **Turning it on meant it needed a `prefers-reduced-motion` guard**, since it
  is the first motion `.flair-empty` has ever actually produced. It is in the
  consolidated block near the top of `index.css`, with `!important` — the float
  rule sits further down the same file at equal specificity, so source order
  would otherwise beat the guard. The **other two flair animations,
  `fab-pulse` and `slideRight`, are still outside that block**; proposed
  separately rather than fixed here.
- **Playwright cannot screenshot this the obvious way.** `scrollIntoViewIfNeeded`
  and `locator.screenshot()` both wait for the element to be *stable*, which an
  infinite 4s float never is — the run times out. Park the animation first
  (`animationDelay = '-2s'`, `animationPlayState = 'paused'`), which also puts
  the still frame at the -8px peak rather than a random point on the curve.

`src/where-it-went/emptyStateFloat.test.jsx` (7 tests) pins the join the two
earlier versions had no way to notice was broken: three empty states rendered
and asserted to carry the hook, App's error state checked as source, and the
stylesheet parsed to assert the animation hangs off that class and on nothing
attribute- or `svg`-shaped. Mutation-checked both ways — dropping the class
from one component, and reverting the selector to `… .empty-state-icon svg`.

## R-026 — The theme mechanism's second half: following the OS · `refactor` · `done 2026-09-22`

**Impact:** none visible. One copy of the OS-follow effect instead of three, and
the two providers R-015 left that can still adopt `useThemeSync`.

**Rewritten 2026-09-22, hours after being filed**, because `7ca3e9f` (Law of the
Day, from a separate session) changed the answer. The original version of this
item recommended keeping `useThemeSync` narrow and recording Tempo and Daily
Stoic as deliberate exceptions, on the grounds that promoting the OS-follow
listener wanted a third app needing it. A third app turned up the same
afternoon.

### Where the six providers stand on current `main`

| App | `useThemeSync` | OS-follow listener | Lines |
|---|---|---|---|
| Cabinet | yes | — | 28 |
| Loom | yes | — | 30 |
| **Law of the Day** | **yes** | **yes** | 68 |
| Tempo | — | yes | 50 |
| Daily Stoic | — | yes | 62 |
| Sol Odyssey | — | — | 66 |

### What Law of the Day settled

It did **not** extend `useThemeSync`. It kept the hook for persist-and-cross-tab
sync and added the OS-follow effect beside it, in its own `useEffect`. So the
two concerns compose without touching the shared hook — which is the answer to
the question the first version of this item posed, and it is the answer R-015
would have wanted: the hook stays narrow.

**So the promotion is a second, separate hook** — call it `useSystemThemeFollow`
— not a `followSystem` option bolted onto `useThemeSync`. Three apps now carry
the effect and `src/shared/`'s own bar is "once a second app needed it".

**Promote Law of the Day's version, not the older two.** It is the only one that
wraps `matchMedia` in a `try`/`catch` and falls back to `addListener` for
Safari < 14; Tempo's and Daily Stoic's have neither, so folding them onto the
shared one is a small fix as well as a de-duplication.

The callback differs per app and belongs in the caller, not the hook: Tempo
calls `applyTheme(resolveTheme('system'))`, Daily Stoic calls
`syncThemeColor('system')` because its palette swaps in CSS and only the
browser-chrome tint goes stale, Law of the Day applies *and* sets state. The
hook's job is the listener's lifecycle; what to do on a change is the app's.

### The other half: two more `useThemeSync` adopters

Separate from the listener, and unchanged from the first version of this item:

- **Sol Odyssey fits `useThemeSync` as-is** — `useState(loadPreset)`, one effect
  that applies then saves, one `storage` listener. Its 66 lines are a richer
  value object (`current`, `mode`, `cycle`) the hook never touches. A clean
  conversion.
- **Daily Stoic fits too**, once the listener above is its own hook —
  `applyTheme(theme)` / `saveTheme(theme)` is exactly the hook's shape.
- **Tempo still does not.** Its effect **applies one value and saves another**
  (`applyTheme(resolved)`, `saveThemePref(pref)`) where `useThemeSync` applies
  and saves the same value. Leave it, or widen the hook deliberately and say so.

### Suggested order

One run each, in this order, so no run is both a promotion and a conversion:

1. ~~`useSystemThemeFollow` into `src/shared/theme.ts`, with Law of the Day
   importing it.~~ **Done 2026-09-22.**
2. ~~Tempo and Daily Stoic onto it.~~ **Done 2026-09-22.**
3. ~~Sol Odyssey onto `useThemeSync`.~~ **Done 2026-09-22.**
4. ~~Daily Stoic onto `useThemeSync`.~~ **Done 2026-09-22.**

`src/shared/theme.test.ts` is where each step is proven.

**Step 1 done 2026-09-22.** `useSystemThemeFollow(active, onChange)` is in
`src/shared/theme.ts` and Law of the Day imports it; its provider keeps the
callback, as designed — `applyTheme('system')` plus its own `setTheme`.

Two things the promotion settled beyond de-duplicating:

- **`onChange` is held in a ref**, so the subscription depends on `active`
  alone. Every caller passes an inline arrow and a naive dependency on the
  callback would tear the listener down and rebuild it on each render. Pinned
  by a test that changes only the callback and asserts nothing was removed,
  while the newest callback still wins.
- **The effect had no test anywhere**, in any of its three copies. It has seven
  now: subscribe while active, never while inactive, fire on change,
  unsubscribe on unmount, unsubscribe when `active` goes false (a sunset flip
  must not repaint an app the user pinned to light), the Safari < 14
  `addListener` path, and mounting anyway when `matchMedia` throws. Four
  mutations were run against the hook — dropping the Safari fallback, depending
  on `onChange`, ignoring `active`, and never cleaning up — and each was
  caught.

**Step 2 done 2026-09-22.** Tempo and Daily Stoic now call
`useSystemThemeFollow` too, so **no provider carries its own `matchMedia`
listener any more** — `grep -rn matchMedia src/*/lib/themeContext.*` comes back
empty. Both gained the Safari < 14 `addListener` fallback and the `try`/`catch`
they never had, which is the small bug fix that rode along with the
de-duplication.

Each kept its own callback, as designed: Tempo repaints
(`applyTheme(resolveTheme('system'))`), Daily Stoic re-syncs only the
browser-chrome tint (`syncThemeColor('system')`) because its palette swaps in
CSS. Neither provider had a test touching that effect before or after — the
hook's seven tests are what proves the move, which is the whole reason step 1
wrote them first.

**Steps 3 and 4 done 2026-09-22.** Sol Odyssey and Daily Stoic are on
`useThemeSync`. Where the six providers finished up:

| App | `useThemeSync` | `useSystemThemeFollow` | Own effects | Lines |
|---|---|---|---|---|
| Cabinet | yes | — | 0 | 28 |
| Loom | yes | — | 0 | 30 |
| Daily Stoic | yes | yes | 0 | 54 |
| Law of the Day | yes | yes | 1 | 58 |
| Sol Odyssey | yes | — | 0 | 61 |
| Tempo | **no** | yes | 2 | 48 |

Law of the Day's one remaining effect is app-specific derived state
(`setTheme(resolveTheme(pref))`), not mechanism.

Both conversions needed the same small thing: eslint cannot see that the setter
returned by `useThemeSync` is `useState`'s own, so it warns on a `useMemo` that
closes over it. Naming it in the deps is correct and free — it is stable — and
every converted provider now carries a line saying why.

**Tempo stays unconverted, and this is where it gets interesting.** It cannot
use `useThemeSync` because it applies one value and saves another
(`applyTheme(resolved)`, `saveThemePref(pref)`). But that incompatibility is
only with the *apply-and-save* half — Tempo's `storage` listener is still a
verbatim copy of the one inside the hook, duplicated because the hook bundles
three concerns and Tempo can only use two.

So there is a residue: one app still hand-writes cross-tab sync. The fix would
be splitting `useThemeSync` into a `useCrossTabSync(key, onExternalChange)` and
a thin apply-and-save layer over it, which Tempo could then use half of.
**Not filed as an item** — one duplicated listener is a thin case for splitting
a hook that four apps use happily, and R-015's warning about the obvious large
version applies. Recorded here so the next person weighing it has the evidence
rather than the impulse.

## P-001b — Lexi5: the sun/moon/monitor triple · `visual` · `open`

**Impact:** three fewer pasted glyphs, in an app that already ships the library
they were copied from. Part of P-001, Group 1.

`src/lexi5/components/Settings.jsx` — three pasted Feather glyphs in an app
already importing lucide in three files. Its sun and moon are byte-identical to
WhereItWent's, so P-001a settles the convention and this follows it.

Note `src/lexi5/App.jsx`'s two `<svg>` are data-URI favicons, not icons — out of
scope. Being `visual`: screenshots, and never auto-merged.

## R-002 — Stop the root from refilling with scratch files · `refactor` · `done 2026-09-22`

**Impact:** none visible; prevents R-001 from needing doing again.

Follows R-001, R-010 and R-011. `.gitignore` has no pattern for the dumps and debug scripts that
keep landing at the root. Add narrow ones (`/scratch_*`, `/debug_*`, `/*_dump.*`,
`/diff.txt`, `/lint-output.txt`) — narrow, so nothing real gets swallowed.

Add `/patch-*.cjs` to that list too (noted while doing R-010 on 2026-09-17): all
seven of those arrived in one commit as a side effect of the migration they
performed, which is exactly the accident this item is meant to stop.

And `/test-results/` (noted while doing R-011 on 2026-09-22) — Playwright's
default output directory, which is why a `.last-run.json` is tracked there. See
R-021 for the two files themselves; this item is only about stopping the next
one.

**Done 2026-09-22.** All seven patterns are in `.gitignore`, root-anchored and
narrow: `/scratch_*`, `/debug_*`, `/*_dump.*`, `/diff.txt`, `/lint-output.txt`,
`/patch-*.cjs`, `/test-results/`. Verified with
`git ls-files | git check-ignore --no-index --stdin -v` that no tracked file
matches any of them — note the `--no-index`, without which `check-ignore` stays
silent about tracked paths and the check proves nothing.

## R-029 — The most-imported module in `src/shared/` has no test · `modernise` · `open`

**Impact:** none visible. Puts coverage under the one shared module whose promise
another app's test already depends on.

Found on the Friday read, 2026-09-25. `src/shared/storage.ts` is imported by
**23 files across seven apps** (Silva, Lexi5, WhereItWent via its re-export,
Marquee, Radar-B, Fit Check, KeyPath) — the widest reach of anything in
`src/shared/` — and there is no `src/shared/storage.test.ts`. The only test file
that names `readJson` at all is
`src/where-it-went/components/TransactionForm.test.jsx`, which uses it as a
fixture helper rather than testing it.

**Why this one matters more than an ordinary coverage gap.** The module's whole
reason to exist is that it *cannot throw* — its header says so, and
`src/lexi5/lib/storageBoundary.test.js` is a boundary test whose entire job is
forcing Lexi5 through these helpers because an unguarded `setItem` in a React
effect once blanked the app in Safari private mode. So the repo already has a
test enforcing "use this module" and no test proving the module keeps its side of
the bargain. Weaken a `catch` here and the boundary test still passes.

Write `src/shared/storage.test.ts` against all six exports. What is worth pinning
is the defensiveness, not the round-trip: `setItem` throwing (quota / private
mode) returning `false` rather than propagating, malformed JSON reading as the
fallback, a missing `localStorage`/`sessionStorage` binding, `removeJson`
swallowing a throw, and — the subtle one — **a stored literal `null` reading as
the fallback**, which is what `parsed ?? fallback` does and what R-030 below
turns out to depend on. Mutation-check by removing a `catch` and confirming a
test goes red.

**Do this before R-030**, which points four more apps at this module.

## P-001c — Daily Stoic: three inline glyphs in an app that imports lucide in 23 files · `visual` · `open`

**Impact:** the smallest of the three, and the one most likely to come back
"leave it". Part of P-001, Group 1.

`src/daily-stoic/App.tsx`. **The 64×64 one is the app's own mark — check before
assuming it is an icon at all.** `components/Ornament.tsx` stays hand-drawn.

If the audit on contact says these are deliberate rather than pasted, mark the
item `dropped` with the reason and move on; that is a correct outcome, not a
failed run. Being `visual`: screenshots, and never auto-merged.

## R-012 — Audit the stale `claude/*` branches · `refactor` · `done 2026-09-22`

**Scope narrowed 2026-09-16:** `claude/refactor-*` branches now prune themselves
at the top of every run — merged ones go automatically, and anything with an open
PR or no PR at all is left alone. So this item is about the other ~35 branches,
which came from ordinary sessions rather than the daily pass and have no such
rule. The two refactor branches this item originally named are gone.

**Impact:** none visible. A branch list someone can actually read, and a
defensible answer to "has this work landed or not?"

`git branch -r` shows 33 `claude/*` branches, most from finished sessions. The
naive test is worthless here: `git log main..branch` reports unmerged commits
for anything that was **squash-merged**, which is most of them — the squash
creates a new commit, so the original is never an ancestor of `main`.

**This run audits. It does not delete anything.** For each branch establish,
in this order:

1. Its PR, via the API (`gh pr list --state all --head <branch>`). A merged PR
   is authoritative: the content landed, the branch is disposable.
2. No PR, or a PR closed unmerged: compare content, not ancestry —
   `git diff --quiet main...<branch>` means the tree is already in `main`
   whatever the history says.
3. Anything left is genuinely unlanded work. Name what it was about in one
   line, from the branch name and its commit subjects, so Gabriel can tell at a
   glance whether it is worth recovering or was abandoned on purpose.

Put the table in the **PR body**, not in a new file — a repo-root audit file
would be a fresh instance of exactly the mess this item is clearing.

Then append a follow-up item under `## Proposed` listing only the branches the
audit found disposable, with their PR numbers. **It goes under `## Proposed`
regardless of class**, because deleting 33 remote branches in one unreviewed
push is not something that should happen on an agent's own authority — a
deleted branch whose content did *not* land is work lost with no obvious trace.
Gabriel promotes it when he has read the table.

Note for whoever runs it: branch deletion from this repo's tooling has been
refused by the git proxy before (2026-09-14), so phase two may end up being a
list Gabriel clicks through in the GitHub UI rather than a push. Check whether
`git push origin --delete` works from a runner before promising otherwise.

**Done 2026-09-22.** 44 `claude/*` branches audited, not 33 — the list grew
while this item waited. The table is in **R-024**, under `## Proposed`, where
the disposal decision now sits.

Three things the run learned that this item did not know:

- **Deletion really is refused**, and it was tested rather than assumed: a
  throwaway branch pushed fine, and `git push origin --delete` on it died with
  *fatal: the remote end hung up unexpectedly*. The GitHub MCP tools have
  `create_branch` and no delete. The probe branch is still there, on R-024's
  list, because the delete that should have removed it is the broken thing.
- **Three branches share no merge base with `main` at all.** The prescribed
  `git diff main...<branch>` fails outright on them, and `git log main..<branch>`
  reports 413–658 commits that are not unlanded work but a different history
  line. This item was right that the naive ancestry test is worthless; on those
  three it is worse than worthless, because it looks like an answer.
- **`claude/shots` must never be deleted**, and would be the first casualty of a
  naive sweep: it is an orphan screenshot branch, so it reads as 1,479 files of
  pure deletion against `main`.

## R-007 — `CLAUDE.md` misstates the typecheck scope · `modernise` · `done 2026-09-22`

**Impact:** none visible. Fixes a doc a cold session trusts and would be misled by.

`CLAUDE.md` says tsconfig covers five directories. It covers seven —
`src/lexi5/lib` and `src/silva` were added and the prose never caught up. Correct
it, and check the rest of that section against `tsconfig.json` while you are
there. Documentation drift is what makes a codebase hostile to someone reading
it cold, model or human.

Found while auditing P-001 (2026-09-16): the drift is wider than the typecheck
sentence. **`src/silva/` is not mentioned anywhere in `CLAUDE.md`** — no row in
the per-app map, no link to its `SILVA.md`, absent from the typecheck list —
despite being one of the seven typechecked directories and having four
components of its own. Whoever takes R-007 should add that row too.

Wider still, found on the Friday read (2026-09-18) — **the "Cross-app shared
logic" section documents 8 of the 15 modules in `src/shared/`.** It names
`weather.ts`, `photo.ts`, `storage.ts`, `notionId.ts`, `useWakeLock.ts`,
`findings.js`, `share.js` and `installFlag.ts`; undocumented are **`anthropic.ts`,
`audio.ts`, `axisLockSlider.js`, `haptics.ts`, `mediaSession.js`, `qrCode.ts` and
`useSwipeAction.ts`**. That section exists to stop an app hand-rolling something
`src/shared/` already has, which it can only do if it is complete — so add a
clause for each in the same shape as the existing entries, naming which apps use
it. Doing this with the typecheck sentence keeps one PR per file.

One thing to write into that prose rather than file as its own item:
`src/shared/haptics.ts` exports `triggerHaptic(type)`, while
`src/lexi5/lib/haptics.js`, `src/loom/lib/haptics.js`, `src/tempo/lib/haptics.js`
and `src/wanderlist/haptics.js` each keep a local `tap(pattern)`-shaped copy.
Four apps not using the shared module — but the APIs are genuinely different (a
named intent versus a raw vibrate pattern), so this is **not** a mechanical
re-export like R-004 or R-005 and must not be filed as one. Record it as an
unreconciled overlap and leave the code alone.

**Done 2026-09-22.** All four parts:

- **The typecheck sentence** now says seven paths and names them, with a
  paragraph on why `src/lexi5/lib` is the half-measure it is.
- **`src/silva/` has a row** in the per-app map, placed beside the other
  strict-TS apps rather than in the legacy block where it would have been
  misread.
- **All seven undocumented `src/shared/` modules are documented**, each with the
  apps that use it, so the section can do the job it exists for.
- **The `haptics` overlap is recorded as an overlap**, in the words this item
  asked for: a named intent versus a raw vibrate pattern, genuinely different
  APIs, not a mechanical re-export.

Two findings the sweep turned up that this item did not anticipate:

- **`src/shared/audio.ts` has no importers at all**, and its `playChime()` is
  unrelated to the `playChime(volume, variant)` in `src/tempo/lib/sound.js` that
  every caller actually uses. Documenting it as part of the shared surface would
  have been worse than leaving it out — someone would adopt the dead one. Filed
  as **R-025** rather than deleted inside a doc sweep, and CLAUDE.md warns about
  it in the meantime.
- **The test-running caveat was half-written.** It warned about
  `NODE_OPTIONS=--no-experimental-webstorage` and said nothing about
  `TZ=Europe/Bucharest`, which the `test` script also sets. Running `npx vitest`
  bare during R-003 turned Radar-B's `detail` and `wanderlist` suites red with a
  clean three-hour shift — indistinguishable from a real date bug until you spot
  the offset. Both are now named.

## R-003 — Promote the `/api/notion` fetch wrapper to `src/shared/` · `refactor` · `done 2026-09-22 — and it was five apps, not twelve`

**Impact:** none visible. Twelve copies of one wrapper become one.

`CLAUDE.md` has flagged this for a while: the same wrapper is copied across
twelve app clients (`src/*/notionClient.{js,ts}`, `src/*/lib/notionClient.*`,
`src/daily-stoic/services/NotionService.ts`, `src/sol-odyssey/lib/notion.ts`).

Follow the promotion pattern the repo already uses: move the canonical
implementation to `src/shared/notionClient.ts`, leave each old path as a thin
re-export, and let the app's existing tests prove the move was
behaviour-preserving. **One app per run.** Start with a JSX app, not with
Fit Check or Sol Odyssey — those are strict TS and deserve a settled API first.

Update the `src/shared/` section of `CLAUDE.md` when the first slice lands.

**Slice 1 done 2026-09-22 — Loom.** `src/shared/notionClient.ts` now holds
`notionProxy(token, path, method, body?, version?)` and `PROXY_URL`, and nothing
else: each app keeps its own database ids, mappers and `createNotionClient`
shape. Loom re-exports `PROXY_URL` and aliases `proxy = notionProxy`, so its
module's API is unchanged.

Two things for whoever takes slice 2:

- **The `version` parameter reconciles the two shapes.** Journal and Wanderlist
  pass a `version`; Loom, Marquee and Radar-B do not. An absent one never
  survives `JSON.stringify`, so the shared function serves both without a
  branch. Pinned by a test.
- **The clients' own tests do not prove this move**, unlike R-004's. Every one
  of them injects a `fetchImpl` seam, so the real fetch path never ran in any
  app's suite — outside Sol Odyssey's separate `relay.ts`, the most-copied
  function in the repo had no coverage at all. `src/shared/notionClient.test.ts`
  now covers it once: the POST shape, the token header, version present and
  absent, Notion's `message`, the `error` fallback, and a non-JSON error body
  falling back to the status code.

**WhereItWent is not a slice.** Its client is 639 lines with retries, a
`NotionError` class and a `this.token` method shape — a different animal that
happens to share ten lines. Take the five remaining JSX clients (Journal,
Marquee, Radar-B, Wanderlist, then Fit Check and Sol Odyssey last as this item
already says) and leave WhereItWent to a considered item of its own.

**Slices 2–5 done 2026-09-22 — Journal, Wanderlist, Marquee, Radar-B.** All
four now import `notionProxy` and re-export `PROXY_URL`; `version` is the only
thing that differed between them and the shared function takes it optionally,
so no branch was needed.

**And the item's own premise was wrong: "twelve app clients" is five.** Reading
the other three before converting them showed they are not copies of this
wrapper at all —

- **WhereItWent** (`lib/notionClient.js`, 639 lines) and **Fit Check**
  (`lib/notionClient.ts`) are retrying client *classes*: `MAX_RETRIES`, backoff
  between attempts, a `NotionError` carrying a status, `this.token` rather than
  a token argument, and in Fit Check's case a second multipart endpoint and a
  per-call Notion version. They share about ten lines with `notionProxy` and
  differ everywhere else.
- **Sol Odyssey** (`lib/notion.ts`) has no fetch wrapper to promote. Its
  `buildRelayInit(token, req)` is a *pure* function returning a `RequestInit`,
  with the fetch performed by the caller — which is why it is the one app whose
  relay call was already tested.

So R-003 is **done**, at five apps. Folding those three in would mean changing
how they work, which is a different item and probably not a wanted one. Noted
while reading them: Sol Odyssey also carries a **fourth** `notionId` variant —
`normalizeNotionId` takes the *last* 32-hex run rather than the first. Same
family as R-004 and R-019; recorded here rather than filed, because like
WhereItWent's it is deliberate and nothing is broken.

## R-004 — Fold the two stale `notionId` copies into `src/shared/notionId.ts` · `refactor` · `done 2026-09-22`

**Impact:** none visible.

`CLAUDE.md` records that Wanderlist and Journal still carry their own older
copies. Diff them against the shared one first — if either handles a URL shape
the shared version misses, the shared version is what needs fixing. Legacy
Journal may import from `src/shared/`; that boundary only covers `src/ds/`.

**Done 2026-09-22.** Both copies turned out to be character-for-character the
shared implementation, comments aside. Proved before touching anything with a
throwaway differential test running all three against 26 inputs — bare id,
dashed UUID in both cases, slug URL, `?v=` view parameter, hash fragment,
trailing slash, a 31- and a 33-character string, an id embedded in prose — all
three agreed on every one. Then both became
`export { parseNotionId } from '../shared/notionId.ts'`, the pattern Loom's
`notion.js` already used, and each app's own `notion.test.js` still passes
unchanged, which is what proves the move.

## R-005 — Same for Journal's legacy `photo.ts` copy · `refactor` · `done 2026-09-22, partially — read why`

**Impact:** none visible.

`CLAUDE.md`: "Wanderlist re-exports it, Journal keeps its older legacy copy."
Same method as R-004, same caveat about which copy is actually correct.

**Done 2026-09-22, and it was not the same method as R-004.** Two of the three
exports folded cleanly — `isImageFile` is behaviourally identical, and
`resizePhoto` differs only in taking an options argument Journal never passes,
whose defaults are Journal's own `MAX_EDGE` and `JPEG_QUALITY` unchanged. Both
now re-export from `src/shared/photo.ts`.

**`photoFilename` did not, and must not.** Same name, different function: the
shared one slugifies an arbitrary *name*, Journal's takes a *date key* and
prefixes `delight-`. Folding it in would have renamed every photo Journal
uploads from `delight-2026-09-22.jpg` to `2026-09-22.jpg` — a change in the
Notion file list, not a refactor. It stays local, `src/journal/photo.test.js`
is new and pins the difference (Journal had no photo test at all), and the
comment at the top of `src/shared/photo.ts` — which claimed Journal kept its
copy "deliberately… nothing to gain from touching it" — now says what is
actually true.

## R-006 — Guard the Vercel 12-function cap in CI · `modernise` · `done 2026-09-16 (already in main)`

**Impact:** none visible. Turns a deploy failure into a test failure.

Already satisfied in `main` and the item was never closed: commit c94743b added
`scripts/build-meta.test.js`, whose `keeps this repo at or under the Vercel
Hobby cap of 12` asserts `countServerlessFunctions('api') <= 12`. It lives
outside `api/`, so it does not itself count as a function. Verified during the
P-001 audit run, not worked — nothing was changed for it.

## R-008 — Bring the dependency floor up, one family per run · `modernise` · `open` — jsdom and the Anthropic SDK done, four families to go

**Impact:** none visible if done right. That is the whole risk.

Measured 2026-09-13. Majors behind: `lucide-react` 0.460 → 1.45, `eslint` 9 → 10
(with `@eslint/js`), `jsdom` 29 → 30, `@types/node` 22 → 26, `@types/react` and
`@types/react-dom` 18 → 19, `@anthropic-ai/sdk` 0.110 → 0.125. Plus a long tail
of patch-level drift across `@fontsource*`, `@tanstack/react-query`,
`@testing-library/*`, `@vercel/blob`, `@vitejs/plugin-react`, `happy-dom`,
`idb-keyval`, `globals`, `autoprefixer`.

**One family per run, never a blanket `npm update`.** Read the release notes for
a major and say in the PR what actually changed. The React 19 types are the one
to leave until last — they will surface type errors across five typechecked
directories, and that deserves its own week rather than a morning.

Watch the `@fontsource` bumps for the subset trap in `CLAUDE.md`: never import a
family by bare name or weight entry point.


**jsdom done 2026-09-22 — 29.1.1 → 30.1.1.** The 25 test files carrying an
`@vitest-environment jsdom` pragma all pass unchanged; full suite 4601, typecheck
clean, build green.

The one breaking change, cited from the package rather than a summary: **the Node
floor moved** from `^20.19.0 || ^22.13.0 || >=24.0.0` to
`^22.22.2 || ^24.15.0 || >=26.0.0`. Node 20 is dropped entirely and the 22 line
moved up nine patch releases. Both workflows say `node-version: '22'`, which
`actions/setup-node` resolves to the newest 22.x and therefore satisfies it — but
it is a constraint now, and pinning an older 22.x anywhere would fail `npm ci` on
engines. The container this ran in is exactly v22.22.2, the minimum.

**jsdom 30 ships no changelog in the package** (README only), and GitHub is not
reachable from this environment, so the release notes this item asks for could not
be read. Said plainly rather than paraphrased from memory: what is verified above
is the engines change and the suite.

**`@anthropic-ai/sdk` done 2026-09-23 — 0.110.0 → 0.128.0**, eighteen minors in
one step. Suite 4646, typecheck clean, build green, `eslint` clean.

**What changed, read from the package's own `CHANGELOG.md`** rather than
paraphrased — unlike jsdom above, this one ships a full changelog, so the release
notes this item asks for were actually available:

- **Exactly one breaking change in the range, and it misses this repo entirely.**
  0.122.0 moved the beta Files and Skills namespaces (`client.beta.files`,
  `client.beta.skills`) onto GA shapes: renamed types, `display_name` for
  `display_title`, cursor pagination, `beta.skills.delete()` now cascading.
  `api/generate-law-of-the-day.js` never touches `client.beta` — it calls
  `client.messages.create` and nothing else.
- **Three changes that do land in this handler's path**, all fixes: 0.117.0
  honours a per-request timeout in the non-streaming long-request check (this
  call is non-streaming), and 0.126.0 reworked retries — invalid or
  out-of-range `Retry-After` values are ignored for the default backoff,
  `maxRetries` is validated, and an aborted request stops waiting immediately.
- 0.126.0 also added `"sideEffects": false` and pure-class annotations. Of no
  consequence here: this dependency is only ever imported by a serverless
  function, never by anything Vite bundles into `dist/`.
- 0.122.0 documents **TypeScript 5.0 as the minimum**. Irrelevant in passing —
  the handler is plain JS and not in any of the seven typechecked paths — but
  worth knowing before a strict-TS app ever adopts the SDK.

**The suite did not prove this bump, and now it does.**
`api/generate-law-of-the-day.js` was the repo's only `@anthropic-ai/sdk`
consumer *and* the only `api/` handler with no test whatsoever, so "green suite"
said nothing at all about the one file the bump could break — the first signal
would have been a 502 from a Vercel cron at 03:00 UTC.
`api/_tests/generate-law-of-the-day.test.js` is new, 11 tests, and it runs the
**real** SDK against a stubbed `globalThis.fetch`: the endpoint, `x-api-key` and
`anthropic-version`, the `thinking: {type:'adaptive'}` and `json_schema`
`output_config` body, the blob path and its `allowOverwrite`, the leak-check
retry as a real three-message turn, the give-up-after-two path, and a 400
becoming a 502 rather than a throw.

**That test was run against 0.110.0 as well as 0.128.0** — `npm install
@anthropic-ai/sdk@0.110.0 --no-save`, same 11 passing, then restored. Identical
wire call on both versions is what actually makes this behaviour-preserving,
rather than the absence of a breaking-change heading.

Two notes for whoever writes the next test against an SDK call:

- **A `Response` body can be read once.** `mockResolvedValue(messageResponse(…))`
  hands the same object to both attempts of the retry loop and the second fails
  with *Body has already been read*, which reads like a handler bug. Use
  `mockImplementation(async () => …)` so each call builds a fresh one.
- **Freeze the clock.** `getGeneratorLawId()` defaults to the real `new Date()`,
  so which of the 48 laws is generated — and therefore which words count as a
  leak — walks with the calendar. That is exactly the shape R-013 and R-018
  swept for, and it would have been a fresh instance of it.

Remaining, in the order I would take them: `@types/node` 22 → 26
(typecheck-only blast radius), `eslint` 9 → 10 with `@eslint/js`,
`lucide-react` 0.460 → **1.47** (a 1.0 major across every icon — expect renames,
and P-001's remaining slices depend on it), and the React 19 types last, as this
item already says.
## R-009 — Kettlebell Training has no tests at all · `modernise` · `open` — first tests landed

**Impact:** none visible. Makes the one untested app safe to change later.

Every other app under `src/` has test files; `src/kettlebell/` has none. It is
legacy and design-locked, but that lock is about styling — adding tests touches
no styling and imports nothing from `src/ds/`. Start with whatever holds the
session/timer state, not the render tree.


**First tests landed 2026-09-22 — `src/kettlebell/exercises.test.js`, 8 tests.**
Kettlebell no longer has zero.

This item said to start with whatever holds the session/timer state. **There is
none** — Kettlebell is a browse app, not a workout timer. `App.jsx`'s only state
is `active`, set by an `IntersectionObserver` scroll-spy. So the equivalent of
"not the render tree" here is `exercises.js`, the data module every screen is a
projection of.

They are invariants rather than a transcription: rewording a step or adding a
thirteenth exercise must not fail them. Unique ids (`App.jsx` keys cards `ex-${id}`
and the scroll-spy reads it back, so a duplicate makes one nav chip unreachable),
`num` consecutive from 1 in list order, difficulty inside the 1–3 the
`Difficulty` pips can draw, accents drawn from the `ACCENTS` palette rather than
a one-off hex, **every `phases[].pose` present in `POSES`** — a renamed pose
renders an empty frame today and nothing complains — and `flip` only on a pose
that actually repeats in its own filmstrip. Five mutations were run against the
data and each was caught by exactly one test.

**Left for a later run:** `App.jsx`'s scroll-spy, which needs an
`IntersectionObserver` stub, and `poses.jsx`. Neither is data; both are the
render tree this item told the first run to avoid.
## R-014 — Two dependencies that nothing imports, and one in the wrong list · `modernise` · `done 2026-09-22`

**Impact:** none visible. A `package.json` whose dependency list is true.

Found on the Friday read, 2026-09-18. Distinct from R-008, which raises versions
— this one **removes and reclassifies entries**, and should be done first so
R-008 never spends a morning bumping something with no importer.

Three separate findings in `package.json`, in descending order of how clear-cut
they are:

1. **`react-chartjs-2` (^5.3.1) has zero importers.** `grep -rn "react-chartjs"`
   over the whole repo minus `node_modules` and `package-lock.json` matches the
   `package.json` line and nothing else. It arrived in b3b93b2 alongside
   WhereItWent's chart work, but `src/where-it-went/components/Dashboard.jsx`
   drives `chart.js/auto` imperatively through a `useRef` — the React wrapper
   was never wired up. Straight removal.
2. **`playwright` (^1.61.1) sits in `dependencies`, not `devDependencies`** — a
   browser-automation library declared as a production dependency of a static
   site. Nothing under `src/` or `api/` imports it; its consumers are
   `screenshot.js`, `debug_crash.cjs` and `debug_memento.cjs` at the root (all
   three are R-011 targets) plus this skill's own screenshot step, which is why
   it must stay installed — `npm ci` installs `devDependencies` too, so the move
   is safe. `.claude/skills/daily-refactor/SKILL.md` already *calls* it a
   devDependency; this makes that sentence true. `node_modules/playwright` plus
   `playwright-core` is ~18 MB.
3. **`puppeteer` (^25.3.0, devDependency) has exactly one consumer:
   `scratch_debug.js`** — also an R-011 target. Once R-011 lands it has none, and
   the repo carries two browser-automation stacks for one screenshot step.
   **Sequence this after R-011**, or check the file is gone before removing it.
   **R-011 landed 2026-09-22 and deleted that file**, so the precondition is met:
   `grep -rn puppeteer` over the repo minus `node_modules` and
   `package-lock.json` should now match `package.json` alone. Re-run it to
   confirm before removing, rather than trusting this note.

Do 1 and 2 in one run; 3 is a one-line follow-up once R-011 has landed. Prove it
the usual way — the suite, typecheck, and a `npm run build` that still succeeds.

**Done 2026-09-22**, all three in one run rather than two — step 3's
precondition was already met, and `grep -rn puppeteer` over the repo minus
`node_modules` and `package-lock.json` matched `package.json` alone, as this
note predicted. `playwright` turned out to have no code consumer at all: the
three root scripts named above are gone, so only the skill's screenshot step
invokes it. Suite, typecheck and a full build all pass; the lockfile lost 350
lines.

## R-015 — The theme plumbing is written out six times · `refactor` · `done 2026-09-22 — mechanism moved, three of six providers adopted`

**Impact:** none visible. One copy of the persist-and-sync mechanism instead of six.

Found on the Friday read, 2026-09-18. **Read this carefully before starting: the
duplication is narrower than a file count suggests, and the obvious large version
of this item is the wrong one.**

Ten apps have a `theme.{js,ts}` (`src/cabinet/lib/`, `src/law-of-the-day/lib/`,
`src/loom/lib/`, `src/tempo/lib/`, `src/where-it-went/lib/`,
`src/daily-stoic/lib/`, `src/silva/lib/`, `src/sol-odyssey/lib/`,
`src/wanderlist/`, `src/journal/`) and six have a `themeContext.{jsx,tsx}`
(cabinet, daily-stoic, law-of-the-day, loom, sol-odyssey, tempo). Their
*vocabularies genuinely differ* and must stay put: Cabinet and Law of the Day are
light/dark, Tempo and Daily Stoic are three-way with `system`, Loom is a
two-preset palette system with its own `PRESETS` array and `nextTheme`. Do not
flatten those into one API — that is a behaviour change wearing a refactor's
clothes, and Loom's presets and Daily Stoic's `normalizeTheme` legacy mapping
would both lose.

What **is** duplicated, verbatim or near enough:

- `systemPrefersDark()` — the same seven-line `matchMedia` probe in a `try` in
  **seven** files (`tempo`, `wanderlist`, `where-it-went`, `daily-stoic`,
  `sol-odyssey`, `journal`, and `silva` with a `win` parameter added).
- The `themeContext` body — `useState(loadThemePref)`, an effect that applies
  and saves, a `storage`-event listener keyed on `THEME_KEY` for cross-tab and
  guide-page sync, a `useMemo`'d value. `src/cabinet/lib/themeContext.jsx` and
  `src/law-of-the-day/lib/themeContext.jsx` differ only in a comment's wording;
  Loom's differs only in naming its state `themeId` and exposing `cycle`.

So the promotion is **`systemPrefersDark` plus a `useThemeSync(key, {load, save,
apply})` hook** into `src/shared/` — the mechanism, not the vocabulary — with
each app's `theme.js` keeping its own key, palette and preference type. Follow
the repo's promotion pattern: move it, leave each old path re-exporting, let the
existing tests prove the move. **One or two apps per run**, starting with Cabinet
and Law of the Day since they are the identical pair.

`src/journal/` is legacy but may import from `src/shared/` — that boundary only
covers `src/ds/` (see `LEGACY.md`). Update the `src/shared/` section of
`CLAUDE.md` when the first slice lands.


**Done 2026-09-22, in the narrow form this item argued for.**
`src/shared/theme.ts` now holds exactly two things:

- `systemPrefersDark(win?)` — **all seven** copies now re-export it. Silva's
  signature won, because the explicit `win` parameter is a superset of the six
  that took none; the six keep calling it with no argument and it defaults to
  the real window. Note a re-export alone was not enough in four of them: they
  call the function internally, so each needed an `import` as well as the
  `export`.
- `useThemeSync(key, {load, save, apply})` — the `useState(load)` / apply-and-save
  effect / `storage`-listener trio, returning a plain `[value, setValue]` so each
  caller keeps its own vocabulary on top.

**Three of six providers adopted it**: Cabinet, Law of the Day and Loom, which
were the three that differed only in a comment's wording and, for Loom, in
naming its state `themeId` and exposing `cycle`. Tempo, Daily Stoic and Sol
Odyssey are left as they were — at 50, 62 and 66 lines against these three's 34
they carry more than the mechanism, and the item's own warning about the obvious
large version applies to them most. A follow-up should read each before assuming
it fits.

**That follow-up is R-026, and reading them showed this paragraph is half
wrong.** Sol Odyssey's provider is the same three parts as Cabinet's — its 66
lines are a richer value object the hook never touches — so it converts cleanly.
Only Tempo and Daily Stoic genuinely carry more, and what they carry is one
named thing: a `matchMedia('change')` listener for following the OS while the
preference is `system`. Judging by line count is the exact mistake this item's
own header warns about; see R-026.

The cross-tab listener had **no test anywhere in the repo** before this — six
providers, six copies, zero coverage. `src/shared/theme.test.ts` now covers the
initial load, apply-before-save ordering, an updater function, a `storage` event
on the key, a `storage` event on some other key, and unmount. That, rather than
the line count, is what the promotion bought.

## R-016 — Loom imports four `@fontsource` weight entry points · `modernise` · `done 2026-09-22`

**Impact:** ~16 font files in `dist/` where 4 would do. The only literal
violation of `CLAUDE.md`'s own font rule left in the repo.

Found on the Friday read, 2026-09-18, by auditing every `@fontsource` import
against the rule in `CLAUDE.md`'s deploy-guardrail section.

`src/loom/main.jsx:4-7` imports `@fontsource/cinzel/500.css`, `/600.css`,
`/700.css` and `/900.css` — weight entry points, named in `CLAUDE.md` as exactly
the thing not to do. Each pulls **four** files: a `latin` and a `latin-ext`
subset, each in `.woff2` *and* legacy `.woff`. Sixteen emitted assets for four
weights of a display face used on Loom's headings; the `latin-ext` files alone
are 40 kB. `@fontsource/cinzel/latin-500.css` is the per-subset form and halves
it; dropping the legacy `.woff` too needs a hand-written `@font-face` block, and
`src/yoru/fonts.css` is the worked example of that already in the repo.
Check Loom renders unchanged — Cinzel is latin-only in practice, but confirm no
heading uses a `latin-ext` glyph before removing that subset.

**While in there, correct the rule itself.** `CLAUDE.md` tells you to import
`/wght.css` for a variable family instead of the bare name. For
`@fontsource-variable/*` that is a no-op: `node_modules/@fontsource-variable/inter/index.css`
and `wght.css` reference an identical set of seven subset files, and the package
exposes no per-subset entry point at all. So the fourteen bare-name
`@fontsource-variable/{inter,fraunces,jetbrains-mono,alegreya}` imports across
eleven apps are **not** the violation the rule implies, and the next person to
audit this will waste the morning I did. Say what is actually true: for a
variable family the bare name is the correct import, and latin-only means a
hand-written `@font-face` against `files/*.woff2`.


**Done 2026-09-22 — 16 files and 232 kB become 8 and 104 kB**, via
`src/loom/fonts.css` on Yoru's pattern rather than the per-subset imports this
item and `CLAUDE.md` both recommended. **That recommendation is wrong for Loom,
and the reason is now in `CLAUDE.md`:** fontsource's per-subset files carry no
`unicode-range` — only the bare and weight entry points declare it. Importing
`latin-500.css` and `latin-ext-500.css` together would have made every browser
fetch both files unconditionally: a runtime regression bought with a build-size
win.

Loom needs both subsets. Its own source carries Romanian, and the letters
straddle the boundary — `â` (U+00E2) and `î` (U+00EE) are latin, while `ș`
(U+0219), `ț` (U+021B) and `ă` (U+0103) are latin-ext. Dropping latin-ext would
have fallen back to Georgia mid-word in display text.

So the eight `@font-face` blocks are declared by hand with fontsource's own
ranges, copied from its entry points rather than retyped, **woff2 only** — the
legacy `.woff` twins were exactly half the 232 kB. Verified in a real build: 8
Cinzel files, ranges intact in the emitted CSS, suite green.

**The four weights are unchanged, deliberately.** Which weights Cinzel actually
renders at cannot be settled from the CSS: most `--font-display` rules inherit
their weight, there is no heading reset so `h1`–`h3` are 700, and `--weight-bold`
is 700 from the DS. Dropping one is a visual judgement needing browser evidence,
not a build-size tidy-up.
## R-017 — Loom is 36 source files behind 4 test files · `modernise` · `open` — drafts.js done, five modules to go

**Impact:** none visible. Makes the least-covered non-legacy app safe to change.

Found on the Friday read, 2026-09-18. With `src/kettlebell/` handled by R-009,
Loom is the thinnest coverage left: `src/loom/lib/` has tests for `model.js`,
`rhythm.js`, `notion.js` and `notionClient.js`, and **nothing else in the app is
tested at all** — no component has a test, and these `lib` modules have none:

- `store.js` and `useLoom.js` — where the app's state actually lives
- `drafts.js` — unsaved-draft persistence
- `localClient.js` — the demo-mode data path
- `lexicon.js` / `uiStyle.js` — the word and style vocabularies

Start with `store.js` and `drafts.js`, not the render tree — same rule as R-009.
Read [`LOOM.md`](LOOM.md) and [`LOOM_RHYTHM_DESIGN.md`](LOOM_RHYTHM_DESIGN.md)
first; `rhythm.test.js` is the house style to copy. **One module per run** — a
single PR adding tests for six modules is not a ten-minute review.


**`drafts.js` done 2026-09-22 — 17 tests**, following this item's "one module per
run" and `rhythm.test.js`'s house style (the same `localStorage` stub, same shape).

What they pin, beyond the round-trip: the id counter (`Date.now()` base-36 **plus
a sequence** — without the counter two drafts saved in one tick collide and
`updateDraft` patches both), the `Untitled` fallback for a blank or whitespace
name, corrupt or non-array storage reading as "no drafts" rather than throwing on
open, and the whole cast log — settling a draft for one week only, so the offer
returns the next week, which is the entire reason the log is keyed by week rather
than flagged on the draft. Four mutations were run against `drafts.js` and each
was caught.

**Still untested, in the order this item suggests:** `store.js`, `useLoom.js`,
`localClient.js`, `lexicon.js`, `uiStyle.js`.
---

## R-018 — Sweep for the rest of the date-dependent tests · `modernise` · `done 2026-09-22 — swept clean`

**Impact:** none visible. Stops a repeat of R-013, where the suite went red on a
calendar roll and every daily run idled until someone looked.

R-013's second half, split out because it needs a different instrument than the
obvious one. **The obvious one does not work here**, and that is the finding worth
keeping: injecting a global frozen clock via a setup file produces 50 failures
across 3 files that are all the harness, not the code. `smartParser.test.js:36-49`
builds its expected dates by calling `getYesterday()` at *module load* under the
real clock, then the subject runs under the injected clock — expectation and
subject land on different days. `radar-b/App.test.jsx` has the same shape. Those
tests are correct; a global clock is simply the wrong tool.

So the sweep wants something narrower. The shape to look for is a test that
**asserts on a rendered relative label** (a weekday name, a month abbreviation,
"Today"/"Tomorrow") while its fixture date is **hard-coded** and no clock is
pinned — which in practice means component tests, since every direct `formatDay`
call already passes `now`. Candidates worth reading: Radar-B, Loom, WhereItWent
and Journal all reason about "today".

Already cleared: `src/marquee/` — `Changes`, `WeekStrip` and `App` pass under a
clock six months ahead; `Programme` is frozen as of #75.


**Done 2026-09-22, and the sweep found nothing.** That is a result, not a
shrug — it means R-013 was the only one.

The instrument is now `scripts/clock-shift.mjs`, and it is the piece worth
keeping. This item recorded that a vitest setup file calling `vi.setSystemTime`
produces 50 false failures, because a test that builds its expected dates at
*module load* computes them under the real clock and then runs the subject under
the injected one. Patching `Date` through `--import` happens **before any test
module loads**, so module load and subject see the same day and that whole class
of false failure disappears.

Proven rather than assumed: a probe test asserting the real month passes
unshifted and fails shifted, which is how we know the patch reaches vitest's
worker processes rather than only the parent.

Twelve offsets, all green at 4601 tests: **+1, +2, +3, +4, +5, +6, +7, +9, +30,
+90, +365 and +700 days** — every weekday, several month boundaries and two year
boundaries. 1–9 matters most because that is where R-013 lived, at the 2-to-6-day
window where `formatDay` switches from a bare weekday to the month form.

Re-run it before any release that worries you; the usage line is in the script's
header.
## R-019 — A third, quietly different `notionId` parser, in WhereItWent · `refactor` · `done 2026-09-22 — recorded, not reconciled`

**Impact:** none visible if done right — but read the caveat, because the naive
version *is* a behaviour change.

Found while doing P-001a, 2026-09-21. R-004 names Wanderlist and Journal as the
apps still carrying their own `notionId` copies. There is a **third**:
`extractNotionId` in `src/where-it-went/components/Settings.jsx:79`, used at nine
call sites to normalise the six database-ID fields as they are saved.

It is not the same function under another name. Against
[`src/shared/notionId.ts`](src/shared/notionId.ts)'s `parseNotionId`, it differs
in three ways that all reach storage:

1. **It keeps the dashes** — returns the matched dashed UUID as-is, where the
   shared one strips them and returns the compact 32-char form.
2. **It does not lowercase.**
3. **On no match it returns the whole trimmed input**, where the shared one
   returns `''`. So pasting nonsense into the Token-adjacent DB fields currently
   stores the nonsense, and after a swap would store nothing.

(3) is the one to think about: a stored empty string and a stored bad string
fail differently downstream, and the Notion API is what rejects them either way.
(1) and (2) matter only if anything compares saved config values as strings —
check `notionClient.js` and the config-shape tests before assuming not.

So this is **not** a mechanical re-export like R-005. Either reconcile it
deliberately, with a test pinning each of the three differences, or record it as
an unreconciled overlap the way R-007 does for `haptics` — both are correct
outcomes. Sequence it with R-004 so one PR settles the whole family, or take it
alone; do not do it *inside* R-004 without saying so.

**Done 2026-09-22 — recorded, not reconciled**, and taken alone rather than
inside R-004. Difference (3) turned out to be larger than this item knew.
`App.jsx:147` computes `hasNotionConfig = !!config.token && !!config.transactionsDb`,
so an empty string is not merely a different value downstream — it is the gate
between the configured app and the setup screen. Under `parseNotionId` a paste
that isn't id-shaped would save empty, the app would fall back to unconfigured,
and the text the user typed would disappear from the field on the next render.
A `refactor`-class item does not get to do that.

So `extractNotionId` stays, now exported and commented with the reasoning, and
`Settings.notionId.test.jsx` pins all three differences *against* the shared
parser — each test asserts both functions, so a future swap fails loudly rather
than silently. `CLAUDE.md` and `src/shared/notionId.ts` both say WhereItWent is
a deliberate exception rather than an outstanding promotion.

(1) and (2) were checked as this item asked: nothing compares saved config values
as strings — `notionClient.js` passes them straight into request URLs.

## R-020 — A CSS rule with no declarations, left behind by a heuristic that was abandoned · `refactor` · `done 2026-09-22`

**Impact:** none visible. Six lines of dead CSS and one misleading comment.

Found while doing P-001a, 2026-09-21. `src/where-it-went/index.css:682-686`:

```css
.flair-empty svg[stroke="currentColor"][fill="none"] {
  /* Simple heuristic: if it's a large unstyled SVG in an empty state, float it.
     We don't want to target small icons in buttons. We will target SVGs > 32px height if possible,
     or we can target specific empty state container paths. */
}
```

An empty rule body — it selects every icon in the app under `.flair-empty` and
then does nothing to them, which is why nothing broke. The comment is a design
note in the future tense for work that was then done differently three lines
below (`svg[width="48"]`, `svg[width="64"]`). Delete the rule; if the note is
worth keeping, keep it as a comment attached to the rules that *did* the job.

While in there: those `svg[width="48"]` / `svg[width="64"]` attribute selectors
are the fragile part of that block — they match on a literal attribute value, so
any empty-state icon that moves to a component with a `size` prop silently stops
floating. Worth one sentence in `WHERE_IT_WENT.md` rather than a fix, unless a
cleaner hook (`.empty-state-icon`, already selected two rules above) covers all
four call sites.

**Done 2026-09-22.** The empty rule is gone and the surviving part of its note
moved onto the rules that do the work. The `WHERE_IT_WENT.md` sentence turned
out to need a stronger claim than "worth one sentence" — see R-022, filed
because the fragility this item predicted has already fired.

## R-021 — Root triage, slice 4: two tracked files that are not source · `refactor` · `done 2026-09-22`

**Impact:** none visible. The last two accidental commits at the top of the tree.

Found while doing R-011, 2026-09-22 — both survived slices 1–3 because neither
is a script and neither sits loose at the root.

1. **`test-results/.last-run.json`** — three lines of Playwright state
   (`{"status": "failed", "failedTests": []}`) from a run in 2026-07, committed
   in 9d6a8f7 alongside the Daily Stoic debug scripts R-011 just removed. It is
   the *only* file in that directory. Nothing reads it; Playwright rewrites it
   from scratch on every run. Delete the directory, and add `/test-results/` to
   `.gitignore` under R-002 so the next local Playwright run does not re-add it.
2. **`scratch/test-curation.cjs`** — 2.6 kB simulating Lexi5's parse of a raw
   model response against `src/lexi5/data/words.json`, last touched in d069a2c
   (2026-08-08, *"…and remove mock"*). Judgement call rather than an obvious
   delete: it is a throwaway harness, but it encodes the fallback chain the app
   uses when the JSON array does not parse. **Read `LEXI5.md` and the live
   parser first** — if that logic has no test, the right outcome is a real test
   in `src/lexi5/` and then deleting this, not deleting this alone. `scratch/`
   is already in `eslint.config.js`'s ignores, so nothing has ever linted it.

Once both are gone the repo root is clear and R-002 can close the door behind
it. Same method as R-010 and R-011: check `git log` on a file before deleting,
and say in the PR what each one turned out to be.

**Part 1 done 2026-09-22**, together with R-002 so nothing could re-add the
file between two merges. `test-results/` was the whole directory; `git log`
confirms the tracked `.last-run.json` last changed in 92c7eb9 and nothing
reads it.

**Part 2 done 2026-09-22**, the long way round, because the check said to.
`Settings.test.jsx` covered the happy path — dedupe, case, length — and none of
the three shapes the harness documented. Six tests added for the parse chain
(prose-wrapped array, truncation before the closing bracket, the discard count
in the toast, nothing parseable, everything invalid, a bracketed body that is
not JSON), each one mutation-checked against the code it pins, and *then* the
harness deleted. `scratch/` is now gone entirely; its entry in
`eslint.config.js`'s ignores is left in place for the next one.

Two things the harness turned out to be wrong about, which is the argument
against keeping a file like it as documentation: its comment claimed the
filtering was "exactly as it is in Settings.jsx" while wrapping `JSON.parse` in
a try/catch the app has never had, and it labelled `starr` a hallucination when
it is in the guess list. See R-023 for the behaviour that divergence exposed.

## R-023 — Lexi5 shows the player a V8 parser message when curation returns bad JSON · `qol` · `done 2026-09-22`

**Impact:** one error message, in the one Lexi5 feature that talks to a model
and therefore fails most often. `LEXI5.md` line 153 promises "a readable error
inline in Settings"; this is the case where that promise is not kept.

Found while doing R-021 part 2, 2026-09-22, and pinned by
`Settings.test.jsx` — "surfaces the raw parser message when the bracketed body
is not valid JSON". That test records current behaviour rather than endorsing
it; whoever takes this item should change the test with the code.

`src/lexi5/components/Settings.jsx`: the curation reply is matched for a
bracket span, and `JSON.parse(match[0])` runs **unguarded**. A reply like
`["brave", "crazy",]` — a trailing comma, which models produce — throws, the
outer `catch` assigns `err.message` straight to `curateError`, and the player
reads something like *Unexpected token ']', ..."crazy",]" is not valid JSON*.

The fix the deleted `scratch/test-curation.cjs` harness had already sketched:
wrap the parse, and on failure fall through to the same
`matchAll(/"([a-zA-Z]+)"/g)` sweep that already handles a reply truncated
before its closing bracket. That path is tested and recovers exactly this
shape. Failing that, at minimum replace the message with the wording the
no-bracket branch already uses.

Being `qol`: it changes what the player sees, so it may be **proposed and
worked but never auto-merged**. No screenshots needed beyond the error state
itself — one theme is enough for a line of text, unlike a `visual` item.

**Done 2026-09-22**, promoted by Gabriel rather than auto-merged, which is the
only route a `qol` item has.

The fix is the one sketched above: `JSON.parse(match[0])` is wrapped, and on
failure falls through to the same `matchAll(/"([a-zA-Z]+)"/g)` sweep the
no-bracket branch already used. That sweep moved into a `recoverQuotedWords()`
helper so both paths share the "no words at all" error rather than each
carrying a copy.

What did **not** change: a reply that parses to an empty array still reaches
"AI did not return any valid 5-letter words." rather than the parse error. The
length check lives inside the recovery helper, not after the branch, precisely
so that case keeps its own message.

`Settings.test.jsx`'s pinning test was rewritten with the code, as this item
asked — `["brave", "crazy",]` now curates both words instead of showing a
parser message — and a second test covers the case the recovery must **not**
swallow: a bracketed body that is unparseable *and* holds no quoted words
(`[ 1, 2, 3, ]`) still errors. Both were mutation-checked; removing the
try/catch fails both.

**No screenshots were taken.** The change removes an error state rather than
restyling one, and reproducing it in a browser needs a real API key and an
intercepted response; the two tests show the before and after more precisely
than an image would. Flagging it rather than quietly skipping it, since `qol`
items are supposed to carry them.

## R-025 — `src/shared/audio.ts` is dead, and shadows the chime that isn't · `modernise` · `done 2026-09-22`

**Impact:** none visible today. Prevents a future app adopting the worse of two
functions with the same name.

Found during R-007's documentation sweep, 2026-09-22.
`grep -rn "shared/audio"` over `src/` matches nothing: the module has **zero
importers**. It exports one function, `playChime()`, which takes no arguments and
builds a fixed C5 sine envelope on a module-level `AudioContext`.

The hazard is the name. `src/tempo/lib/sound.js` exports
`playChime(volume = 'normal', variant = 'sitwalk')` — volume-aware, with variants,
and used from `Player.jsx` and `SettingsModal.jsx`. An app reaching for a chime
and finding the one in `src/shared/` would get the poorer of the two and think it
was the shared standard.

Check `git log` on the file before removing it — it was last touched in 92c7eb9
(Silva's share-sheet work), so confirm nothing half-built is waiting on it. If
nothing is, delete it; if Silva does want a chime, the honest move is to promote
**Tempo's** implementation and let this one go. Either way the outcome is one
`playChime` in `src/shared/`, not two functions of that name with different
signatures.

Also worth a glance while in there: it is the one file in `src/shared/` with a
`console.warn` and trailing whitespace, which is its own small signal about where
it came from.


**Done 2026-09-22 — deleted.** The `git log` check this item asked for came back
clean: added in 92c7eb9 (Silva's share-sheet work, 2026-09-02), never referenced
since, and `grep -rni 'chime|audio|sound'` over `src/silva/` and `SILVA.md`
matches nothing at all — so no half-built feature was waiting on it. Tempo's
`playChime(volume, variant)` is untouched and remains the only one.
## R-027 — Four variable font families imported by bare name · `modernise` · `open`

**Impact:** none visible. ~590 kB of `dist/`, charged against Vercel's
Deployment Storage on every push.

Found while doing R-016, 2026-09-22. With Cinzel fixed, these are what is left
of the `@fontsource` rule in `CLAUDE.md`:

| Import | Where | Files in `dist/` |
|---|---|---|
| `@fontsource-variable/inter` | Loom, and three other apps | 7 |
| `@fontsource-variable/alegreya` | Loom | 7 |
| `@fontsource-variable/jetbrains-mono` | — | 5 |
| `@fontsource-variable/fraunces` | — | 3 |

All four are imported by **bare name**, which pulls the family's `index.css` and
therefore every subset it ships — cyrillic, cyrillic-ext, greek, greek-ext,
latin, latin-ext, vietnamese. 22 `.woff2` files, ~590 kB. At runtime this costs
nothing (the ranges are intact, so a browser fetches only what it needs); the
cost is entirely build size.

Unlike Cinzel there is **no legacy `.woff` to drop** — the variable packages are
woff2-only already. So the whole win here is subsetting, which means deciding
per family which subsets an app can actually need. Read R-016's note first: the
per-subset files carry no `unicode-range`, so anything needing more than one
subset wants hand-declared `@font-face` blocks, not two imports.

**Inter is the one to be careful with** — four apps share it, so this is not a
one-app change, and any of them may render user text. Romanian alone needs
latin *and* latin-ext. Cyrillic and greek are the safe removals; vietnamese
probably.

Sequence it after R-016's lesson is settled, and do **one family per run** —
same reason R-008 does.

## R-028 — Nine of the twelve serverless functions have no test at all · `modernise` · `open`

**Impact:** none visible. But every one of these is a path whose first failure
signal today is a user seeing an error, or — for the two cron targets — nobody
seeing anything.

Found while doing R-008's Anthropic bump, 2026-09-23. Measured by matching each
`api/<name>.js` against an import of it under `api/_tests/`:

| Handler | Test |
|---|---|
| `marquee-scan.js` | yes |
| `wanderlist-remind.js` | yes |
| `generate-law-of-the-day.js` | yes — new, R-008 |
| `clickdeck-hltb.js` | — |
| `clickdeck-pricing.js` | — |
| `clickdeck-studio-search.js` | — |
| `law-of-the-day-content.js` | — |
| `notion-photo-proxy.js` | — |
| `notion-upload.js` | — |
| `notion.js` | — |
| `places.js` | — |
| `steam-search.js` | — |

**`api/notion.js` is the one to take first.** It is the relay five apps reach
through `src/shared/notionClient.ts`, so a single handler carries Loom, Journal,
Wanderlist, Marquee and Radar-B. R-003 gave the *client* half of that call its
first coverage; the server half still has none.

R-008's new test is the worked pattern and is cheap to copy: stub
`globalThis.fetch`, mock the one npm side-effect, drive the handler through the
same `makeRes()` stand-in `wanderlist-remind.test.js` uses. What is worth pinning
is the part a refactor could silently break — the `originAllowed` / `rateLimited`
gate, the method check, and what an upstream error turns into.

**One handler per run**, and **tests go in `api/_tests/`, never beside the
handler** — every `api/*.js` is a Vercel function and the repo is at the cap of
twelve.

## R-024 — Delete the 41 spent `claude/*` branches · `refactor` · `open` — **not agent-executable, see below**

**Impact:** none visible. A branch list someone can read.

The follow-up R-012's audit asked for. It sat under `## Proposed` until Gabriel
had read the table, because a branch whose content did *not* land is work lost
with no obvious trace. **As of the promotion nothing has been deleted yet.**

> **Daily agent: do not take this item.** Skip it and pick the next one. It is
> in the open list because Gabriel is working it by hand, not because it is
> yours. Nothing you can do will make the delete succeed, and burning a morning
> proving that again is the one outcome this note exists to prevent.

**Deletion is blocked from a session here**, and it was tested rather than
assumed. Twice on 2026-09-22: pushing a throwaway branch succeeded both times,
`git push origin --delete` on it failed both times — first as *fatal: the
remote end hung up unexpectedly*, then, more usefully, as **`RPC failed; HTTP
403`** on send-pack. Ordinary pushes and branch creation work; only the delete
403s. The session proxy's own README says a 403 is a policy denial that must be
reported rather than retried or routed around, and the GitHub MCP tools have
`create_branch`, `create_or_update_file` and `delete_file` — no delete-ref.

So this item has two real executors, neither of them an agent in this
environment:

1. **Gabriel, in his own clone**, where his credentials apply — one
   `git push origin --delete` with the list below, or the GitHub UI's branch
   page.
2. **A `workflow_dispatch` job** using `REFACTOR_PAT`, which runs on GitHub's
   runners and never touches this proxy. **This now exists:**
   [`.github/workflows/prune-claude-branches.yml`](.github/workflows/prune-claude-branches.yml).
   Run it from the Actions tab — `dry-run` is the default and prints a table of
   what it would remove; re-run with `delete` once that reads right.

   It deliberately does **not** carry the 41 names from the table below. A
   baked-in list is wrong the moment the next pull request merges, so the rule is
   re-derived every run, and it is the audit's own rule: a branch is spent only
   when it has at least one pull request and **every** one of them merged. No
   pull request means keep — that branch may be the only copy. An unreadable
   answer means keep. `claude/shots`, the three no-merge-base branches and
   `claude/daily-refactoring-agent-*` are refused outright whatever their pull
   requests say. A refused delete fails the run rather than passing quietly.

   The table below therefore stops being the instruction and becomes the record
   of what the audit saw on 2026-09-22.

**Promoted 2026-09-22** at Gabriel's word, after he read the table.

That probe left `claude/prune-probe-delete-me` behind, pointing at `main`'s own
commit. It is harmless, and it is on the list below; it exists because the
delete that should have removed it is the thing that does not work.

### Disposable — the content is in `main` (41 branches)

| Branch (`claude/` prefix dropped) | Why it is spent |
|---|---|
| `apollo111-and-venue-notes-fix` | merged via #44 |
| `badge-links-main` | merged via #78 |
| `badges-pin-main` | merged via #77 |
| `bucharest-event-discovery-6zeadz` | merged via #22 |
| `cabinet-webapk-minting-dnb8x2` | merged via #24 |
| `cinema-europa-teatrul-metropolis-l86rd6` | merged via #31, #32, #38, #39, #40 |
| `daily-refactoring-agent-kf8sqm` | merged via #60, #61, #62, #66 |
| `daily-stogie-lite-td0ujl` | merged via #45, #46 |
| `fit-check-recommendation-audit-plda82` | merged via #9 |
| `fix-r013-clock` | merged via #75 |
| `free-tier-optimization-qx8xau` | merged via #50, #51 |
| `gate-counts-outcomes` | merged via #80 |
| `interleave-backlog` | merged via #69 |
| `latest-card-normal-size` | merged via #76 |
| `lexi5-wake-lock-word-list-i3hjg4` | merged via #6 |
| `marquee-bot-check-issue-n7i6dl` | merged via #63, #64 |
| `marquee-filter-cascade-rebuild` | merged via #35 |
| `marquee-filter-scroll-breadcrumb` | merged via #34 |
| `marquee-filters-full-menu` | merged via #33 |
| `marquee-metropolis-prices` | merged via #37 |
| `marquee-read-through-bad-status` | merged via #36 |
| `next-app-recommendation-pr9fpj` | merged via #16 |
| `production-ci-failure-tczeu8` | merged via #25 |
| `promote-p002-backlog` | merged via #67 |
| `prune-refactor-branches` | merged via #72 |
| `radar-b-wanderlist-opwy25` | merged via #26, #27, #28, #29, #30, #56, #57, #58 |
| `raise-turn-limit` | merged via #71 |
| `recital-cameral-marquee-display-y9688r` | merged via #52, #53, #54, #55 |
| `rhythm-last-7-days-view-2v3rkg` | merged via #4 |
| `silva-audit-enhancement-62n9ko` | merged via #17, #19, #20 |
| `silva-link-sharing-audit-fyp1wd` | no PR; tree identical to main |
| `silva-link-title-prefill-qhojwq` | merged via #21 |
| `silva-walk-and-intake-62n9ko` | merged via #18 |
| `split-p001-slices` | merged via #68 |
| `tag-presentation-audit-8w6ucd` | merged via #42, #43 |
| `tickets-on-sale-discrepancy-osqpkx` | merged via #47, #48 |
| `wanderlist-dedupe-fix` | merged via #41 |
| `whereitwent-ai-transactions-1flz78` | merged via #10, #11, #12, #13, #14, #15 |
| `yoru-atmosphere-settings-bug-xfapr2` | merged via #7, #8 |
| `yoru-sound-stage-realism-m0909s` | merged via #49 |
| `prune-probe-delete-me` | the deletion probe above; points at `main` |

`daily-refactoring-agent-kf8sqm` is on that list because every one of its PRs
merged — but it is also the branch this repo's session instructions nominate for
development work. Delete it last, or re-cut it from `main`.

### Not disposable — read before touching (4 branches)

- **`shots`** — **never delete.** The screenshot branch P-001 and P-002 write
  their before/after images to, deliberately never merged, which is why it reads
  as 1,479 files of pure deletion against `main`. It is doing its job.
- **`click-deck-audit-refactor-g3o8hy`** (no PR),
  **`loom-app-design-as6ftd`** (PR #3, closed unmerged) and
  **`vercel-ci-failures-9wo5yq`** (PR #5, closed unmerged) — all three **share
  no commit at all with `main`**. `git merge-base` returns nothing, so R-012's
  prescribed `git diff main...<branch>` cannot run on them, and a naive reading
  of `git log main..<branch>` reports 413–658 "unmerged" commits that are
  nothing of the sort. They are snapshots of a history line that predates the
  one `main` is on.

  Their subject matter — Loom's SCUMM themes and Notion default database, Click
  Deck's audit, a WhereItWent test-copy fix — is all in `main` today, so the work
  almost certainly landed by another route. "Almost certainly" is why they are
  not on the list above: confirming it means reading three old trees, which is a
  separate afternoon rather than a line in a table.

## R-030 — Four apps hand-write the storage triple `src/shared/storage.ts` already is · `refactor` · `open`

**Impact:** none visible. Four private copies of the same six lines become three
one-line wrappers each.

Found on the Friday read, 2026-09-25, while checking R-029's reach. Cabinet,
Tempo, Yoru and Law of the Day each open their own `lib/storage.js` with a
private `read(key, fallback)` / `write(key, value)` / `remove(key)` triple that
is character-for-character the body of `readJson` / `writeJson` / `removeJson`,
down to the `// private browsing / quota exceeded — persistence is a
nice-to-have, skip silently` comment:

| File | Lines | Key prefix | Public exports |
|---|---|---|---|
| `src/cabinet/lib/storage.js` | 71 | `cabinet:` | 9 |
| `src/tempo/lib/storage.js` | 81 | `tempo:` | 11 |
| `src/yoru/lib/storage.js` | 226 | `yoru:` | 10 |
| `src/law-of-the-day/lib/storage.js` | 93 | `lawofday:` | 16 |

`src/cabinet/lib/storage.js`'s own header says *"Same read/write shape as Tempo's
storage"* — the duplication is acknowledged in the code. Tempo's says the copy is
kept *"per the repo's per-app convention for small pure utils"*, and **there is no
such convention**: `CLAUDE.md` says the opposite in as many words — "Promoted here
once a second app needed them — **extend these rather than copying an app's local
copy**". That sentence needs deleting along with the copy.

**This is the R-004 shape, not the `haptics` shape.** Unlike `haptics` (a named
intent versus a raw vibrate pattern, genuinely different APIs), these four take
the same arguments and mean the same thing. The only structural difference is that
the private helpers take a key *suffix* and prepend `PREFIX`, where the shared
ones take a whole key. So each app's three private functions collapse to
`const read = (k, fb) => readJson(PREFIX + k, fb)` and the app's own 9–16 public
exports (`loadOrder`, `loadModeConfig`, `loadSeason`, …) are untouched. Yoru's 226
lines are mostly its mixer vocabulary, not storage.

**Two real behavioural differences, and one of them bites** — so this is not a
blind `git mv`:

1. **A stored literal `null`.** The shared `readJson` returns `parsed ?? fallback`,
   so `'null'` in storage reads as the *fallback*. The private `read` returns
   `raw ? JSON.parse(raw) : fallback`, and `'null'` is a truthy string, so it
   returns **`null`**. Verified in node. Any of these apps that persists a
   deliberate `null` — `loadOrder()` returns `read('order', null)`, so the two
   agree there by luck — changes answer. Check each key before converting.
2. **`writeJson` returns a boolean**; the private `write` returns nothing. Adopting
   the shared one is strictly more information and no caller reads it today.

**None of the four apps has a storage test** (`ls src/{cabinet,tempo,yoru,law-of-the-day}/lib/*.test.*`
— no `storage.test.js` anywhere), so the existing suite will *not* prove this move
the way R-004's did. That is the main cost of the item: each conversion needs its
own test first. **One app per run**, and take Cabinet first — it is the smallest
and its header already admits the copy.

## R-031 — `formatRelativeTime` is byte-identical in Cabinet and Tempo · `refactor` · `open`

**Impact:** none visible. The cleanest duplicate in the repo: twelve lines and a
27-line test file, twice.

Found on the Friday read, 2026-09-25. `src/cabinet/lib/relativeTime.js` and
`src/tempo/lib/relativeTime.js` are the same function character for character
(comments aside), and `src/cabinet/lib/relativeTime.test.js` and
`src/tempo/lib/relativeTime.test.js` are both 27 lines of the same assertions.
One importer each — `src/cabinet/components/AppTile.jsx` and
`src/tempo/components/ModePicker.jsx` — both rendering a "last opened" line.

This is the R-004 pattern with nothing in the way: promote to
`src/shared/relativeTime.ts`, leave both app paths as thin re-exports, and **both
apps' existing tests prove the move** — which is exactly what R-030 above cannot
offer. It is the smaller and safer of the two, so it is the better warm-up.

`now` is already an injectable second parameter defaulting to `Date.now()`, so
there is no R-013-shaped clock hazard here. Add the `src/shared/` clause to
`CLAUDE.md` when it lands.

**Tempo's copy carries the same false convention note as R-030's** — *"kept as a
separate local copy, not shared, per the repo's per-app convention for small pure
utils"*. Delete it rather than move it; whichever of these two items lands first
should take the sentence out of `CLAUDE.md`'s way for the other.

**One more of the same family, recorded rather than filed** — `useHashRoute` is
duplicated in `src/sol-odyssey/lib/useHashRoute.ts` (31 lines) and
`src/daily-stoic/lib/useHashRoute.ts` (33), differing only in the
service-worker message type it listens for (`sol-odyssey:navigate` vs
`daily-stoic:navigate`) and its doc comment. It would promote as
`useHashRoute(navigateMessageType)`. Not filed as its own item because **neither
copy has a test in either app** — `grep -rln useHashRoute --include='*.test.*'`
is empty — so it is a promotion *and* first coverage for the thing that routes
two apps, which is a bigger morning than this item. Written down here so the
evidence survives; promote it to a real item if it is wanted.

## R-032 — `src/ds/index.ts` omits four components that four apps import past it · `refactor` · `open`

**Impact:** none visible. Makes the design system's documented front door tell the
truth.

Found on the Friday read, 2026-09-25. `src/ds/index.ts` opens with *"Public entry
for the design system. Consumers import from here"*, and mostly they do — **88
import sites** use the barrel (`from '../../ds'`). But **73 sites reach past it**
to `ds/components/<X>`, and for four components that is not a style preference,
it is the only option, because the barrel does not export them at all:

| Component | In `index.ts` | Importers | Apps |
|---|---|---|---|
| `SelectField` | no | 8 | WhereItWent, Lexi5, Marquee, KeyPath |
| `FormError` | no | 6 | WhereItWent |
| `ModalFooter` | no | 5 | WhereItWent |
| `FormField` | no | 2 | WhereItWent |

So the barrel exports all fourteen of the components an app *could* reach either
way and none of the four it *must* reach around. A new app following
`src/ds/README.md` and importing from `'../../ds'` finds no select field and
concludes the DS has none.

The fix is four `export` lines plus their prop types, in the shape the existing
entries use. Whether to then convert the deep-path call sites is a separate
question and probably a no — 73 rewrites is not a ten-minute review, and mixed
styles are not a defect once both work. **Add the exports, leave the call sites,
and say so on the PR.** Behaviour-preserving: nothing currently importing these
changes path.

Check `src/ds/boundary.test.js` still passes unchanged — it enforces the one-way
DS → new-apps rule and a new export must not give a legacy app a new way in.

## R-033 — The DS confirm/alert dialogs have no test, in five apps that delete things with them · `modernise` · `open`

**Impact:** none visible. Coverage under the component that asks "are you sure?"
before something is destroyed.

Found on the Friday read, 2026-09-25. `src/ds/components/Dialogs.tsx` (119 lines,
`ConfirmModal` / `PromptModal` / `AlertModal`) has **no test file**, and it is
reached from **48 call sites in five apps** — WhereItWent 22, Silva 13, Lexi5 6,
Fit Check 5, Marquee 2. `src/ds/components/Modal.test.tsx` mentions `ConfirmModal`
exactly once, in a comment, and never imports it.

`ConfirmModal` takes `variant: 'primary' | 'danger'` and an `onConfirm` /
`onCancel` pair, and it is what stands between a tap and a deleted transaction,
specimen or garment. The failure worth pinning is not a crash — it is
`onConfirm` firing on the cancel path, or `variant="danger"` silently rendering as
primary after a `Button` change, neither of which any current test would catch.

Three other DS components have no test either, and they are — not coincidentally
— three of R-032's four: `FormError`, `FormField`, `SelectField`. `SelectField`
has eight importers across four apps. Every other component under
`src/ds/components/` has one.

**Take `Dialogs.tsx` first**, as the item title says; the other three are a
follow-up run, not this one. `src/ds/components/Modal.test.tsx` is the house style
to copy — it already renders a nested dialog, so the harness is there.

---

## Proposed

The agent's own ideas. **Nothing here gets worked until it is moved up.** To
approve one, cut the block, paste it into the list above, and change `proposed`
to `open`.

To reject one, delete it — or just close the PR that proposed it, which is the
same answer said faster. The agent treats a proposal that vanished from `main`
as declined and will not raise it again.

## P-003 — Two WhereItWent flair animations ignore `prefers-reduced-motion` · `qol` · `proposed`

**Impact:** someone who has asked their OS to reduce motion stops seeing a
pulsing Add button and a sliding budget bar. Nobody else notices anything.

Found while doing R-022 on 2026-09-24. `src/where-it-went/index.css` has a
consolidated `@media (prefers-reduced-motion: reduce)` block (~line 296) whose
comment claims it covers "every animated affordance in the app". It does not:

- **`fab-pulse`** — `.flair-pulse .nav-add-btn:hover` and
  `.nav-add-btn-classic:hover`, a 1.5s infinite box-shadow pulse.
- **`slideRight`** — `.flair-budget .budget-bar-fill` and
  `.budget-bar-fill-large`. The block already names `.budget-bar-wrapper > div`
  and kills its `transition`, but the `fill` element's `animation` is a separate
  declaration and survives.

R-022 added the guard for `float-icon` because it was switching that animation
on for the first time and would otherwise have shipped a regression; it
deliberately left these two alone as adjacent scope. Both need the same
`animation: none !important;` treatment — `!important` because all three rules
are declared further down the file at equal specificity, so source order beats
the guard without it.

Cheap, but `qol` rather than `refactor`: it changes what a real user sees, just
only the ones who asked for it. Worth pairing with a test in
`src/where-it-went/emptyStateFloat.test.jsx`'s stylesheet style — parse the
reduced-motion block and assert every `@keyframes` name the file declares is
switched off somewhere inside it, which would stop the next animation from
arriving unguarded too.
