# Backlog — refactors, modernisation, and enhancements

The queue the **Daily refactor** Routine burns through — one item per weekday
morning, each landing as its own PR off fresh `main`. Fridays are discovery runs:
nothing ships, the agent reads the codebase and adds to this file instead.
Process lives in [`.claude/skills/daily-refactor/SKILL.md`](.claude/skills/daily-refactor/SKILL.md).

Edit by hand freely. Reorder to change priority — the agent always takes the
topmost eligible item, so the order of this file is the steering wheel.

**States:** `open` · `claimed` (an open PR names it) · `done` · `blocked` · `dropped`

**One item = one `## ` header.** A big item that splits into slices gets one
header per slice, in the order they should be taken — nesting them as bullets
hides them from the footer's backlog count and makes "the topmost eligible item"
ambiguous.

**The order alternates on purpose.** `refactor` and `modernise` items merge
themselves once the workflow's independent run is green; `qol` and `visual` ones
never do, however green — they wait for a human. So they are interleaved rather
than grouped, and a run of four review-needed items in a row would mean four
mornings where nothing reaches production on its own. Keep that alternation when
adding an item or reordering: put a new `qol` or `visual` item where the
neighbours on both sides are self-merging.

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

---

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

## R-022 — WhereItWent's empty-state float animation reaches almost nothing · `visual` · `open`

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

## P-001c — Daily Stoic: three inline glyphs in an app that imports lucide in 23 files · `visual` · `open`

**Impact:** the smallest of the three, and the one most likely to come back
"leave it". Part of P-001, Group 1.

`src/daily-stoic/App.tsx`. **The 64×64 one is the app's own mark — check before
assuming it is an icon at all.** `components/Ornament.tsx` stays hand-drawn.

If the audit on contact says these are deliberate rather than pasted, mark the
item `dropped` with the reason and move on; that is a correct outcome, not a
failed run. Being `visual`: screenshots, and never auto-merged.

## R-012 — Audit the stale `claude/*` branches · `refactor` · `open`

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

## R-007 — `CLAUDE.md` misstates the typecheck scope · `modernise` · `open`

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

## R-003 — Promote the `/api/notion` fetch wrapper to `src/shared/` · `refactor` · `slice 1 done 2026-09-22 — eleven clients to go`

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

## R-008 — Bring the dependency floor up, one family per run · `modernise` · `open`

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

## R-009 — Kettlebell Training has no tests at all · `modernise` · `open`

**Impact:** none visible. Makes the one untested app safe to change later.

Every other app under `src/` has test files; `src/kettlebell/` has none. It is
legacy and design-locked, but that lock is about styling — adding tests touches
no styling and imports nothing from `src/ds/`. Start with whatever holds the
session/timer state, not the render tree.

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

The cross-tab listener had **no test anywhere in the repo** before this — six
providers, six copies, zero coverage. `src/shared/theme.test.ts` now covers the
initial load, apply-before-save ordering, an updater function, a `storage` event
on the key, a `storage` event on some other key, and unmount. That, rather than
the line count, is what the promotion bought.

## R-016 — Loom imports four `@fontsource` weight entry points · `modernise` · `open`

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

## R-017 — Loom is 36 source files behind 4 test files · `modernise` · `open`

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

---

## R-018 — Sweep for the rest of the date-dependent tests · `modernise` · `open`

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

## R-023 — Lexi5 shows the player a V8 parser message when curation returns bad JSON · `qol` · `open`

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

## Proposed

The agent's own ideas. **Nothing here gets worked until it is moved up.** To
approve one, cut the block, paste it into the list above, and change `proposed`
to `open`.

To reject one, delete it — or just close the PR that proposed it, which is the
same answer said faster. The agent treats a proposal that vanished from `main`
as declined and will not raise it again.

_(nothing proposed right now.)_
