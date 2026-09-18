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

## R-013 — The suite goes red for a week whenever the clock walks past a fixture date · `modernise` · `open`

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

## P-001a — WhereItWent: retire the pasted Feather markup · `visual` · `open`

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

## R-011 — Root triage, slice 3: the remaining scratch scripts · `refactor` · `open`

**Impact:** a repo root someone can read. Nothing user-facing.

`cleanup.cjs`, `debug_crash.cjs`, `debug_memento.cjs`, `dump.cjs`,
`find-covers.cjs`, `generateDemoData.cjs`, `scratch-fix.cjs`, `scratch_debug.js`,
`scratch_test.mjs`, `screenshot.js`, `steam-search.js`, `test-urls.cjs`,
`update-seed.cjs`, `validate-covers.cjs`. Same method as R-010. Note that
`dump.cjs` and `debug_memento.cjs` only ever wrote the dumps R-001 removed.

## P-001b — Lexi5: the sun/moon/monitor triple · `visual` · `open`

**Impact:** three fewer pasted glyphs, in an app that already ships the library
they were copied from. Part of P-001, Group 1.

`src/lexi5/components/Settings.jsx` — three pasted Feather glyphs in an app
already importing lucide in three files. Its sun and moon are byte-identical to
WhereItWent's, so P-001a settles the convention and this follows it.

Note `src/lexi5/App.jsx`'s two `<svg>` are data-URI favicons, not icons — out of
scope. Being `visual`: screenshots, and never auto-merged.

## R-002 — Stop the root from refilling with scratch files · `refactor` · `open`

**Impact:** none visible; prevents R-001 from needing doing again.

Follows R-001, R-010 and R-011. `.gitignore` has no pattern for the dumps and debug scripts that
keep landing at the root. Add narrow ones (`/scratch_*`, `/debug_*`, `/*_dump.*`,
`/diff.txt`, `/lint-output.txt`) — narrow, so nothing real gets swallowed.

Add `/patch-*.cjs` to that list too (noted while doing R-010 on 2026-09-17): all
seven of those arrived in one commit as a side effect of the migration they
performed, which is exactly the accident this item is meant to stop.

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

## R-003 — Promote the `/api/notion` fetch wrapper to `src/shared/` · `refactor` · `open`

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

## R-004 — Fold the two stale `notionId` copies into `src/shared/notionId.ts` · `refactor` · `open`

**Impact:** none visible.

`CLAUDE.md` records that Wanderlist and Journal still carry their own older
copies. Diff them against the shared one first — if either handles a URL shape
the shared version misses, the shared version is what needs fixing. Legacy
Journal may import from `src/shared/`; that boundary only covers `src/ds/`.

## R-005 — Same for Journal's legacy `photo.ts` copy · `refactor` · `open`

**Impact:** none visible.

`CLAUDE.md`: "Wanderlist re-exports it, Journal keeps its older legacy copy."
Same method as R-004, same caveat about which copy is actually correct.

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

## R-014 — Two dependencies that nothing imports, and one in the wrong list · `modernise` · `open`

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

Do 1 and 2 in one run; 3 is a one-line follow-up once R-011 has landed. Prove it
the usual way — the suite, typecheck, and a `npm run build` that still succeeds.

## R-015 — The theme plumbing is written out six times · `refactor` · `open`

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

## Proposed

The agent's own ideas. **Nothing here gets worked until it is moved up.** To
approve one, cut the block, paste it into the list above, and change `proposed`
to `open`.

To reject one, delete it — or just close the PR that proposed it, which is the
same answer said faster. The agent treats a proposal that vanished from `main`
as declined and will not raise it again.

_(nothing proposed right now.)_
