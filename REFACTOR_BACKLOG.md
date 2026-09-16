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

## R-001 — Root triage, slice 1: the inert data dumps · `refactor` · `done 2026-09-14`

**Impact:** a repo root someone can read. Nothing user-facing.

Deleted `diff.txt` (a UTF-16 `git diff` capture), `lexi5_dump.txt` and
`memento_dump.html` (regenerable output of `dump.cjs` and `debug_memento.cjs`),
`lint-output.txt` (a captured `eslint .` run), `notes.json` (a one-shot Click
Deck payload, no reader) and the empty `results.json`. Each was committed once,
incidentally, alongside unrelated work; none is read by any code. All remain
recoverable from git history.

Left alone on purpose: `mcp-payloads.json`, which was not in this item's scope.

## P-002 — A bundle-size gauge in the footer, beside the function one · `qol` · `open`

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

Each is its own top-level item below — **P-001a**, **P-001b**, **P-001c** — sitting
directly under this block in the order they should be taken. They live out there
rather than as bullets in here because the queue is read by header: a sub-item is
invisible to the footer's backlog count, and "the topmost eligible item" stops
meaning anything when one sits nested inside a finished parent.

### Explicitly not doing, so nobody re-audits this

Cabinet, Loom, Law of the Day, Radar-B, Tempo, Wanderlist — Group 2 above.
Touch Grass, Journal of Delights, Kettlebell — legacy and design-locked
(`LEGACY.md`); their glyphs are part of a look nobody may restyle.
Silva's four, Sol Odyssey's `Logo`/`Sparkline`, Yoru's `MoonGlyph`, Tempo's
`CountdownRing`, Click Deck's watchlist mark, `src/ds/components/GuideNote.tsx`,
`src/ds/showcase/Showcase.tsx`, Fit Check's guide mark — genuine one-off
drawings (graphs, rings, avatars, logos) that no icon library contains.

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

## P-001b — Lexi5: the sun/moon/monitor triple · `visual` · `open`

**Impact:** three fewer pasted glyphs, in an app that already ships the library
they were copied from. Part of P-001, Group 1.

`src/lexi5/components/Settings.jsx` — three pasted Feather glyphs in an app
already importing lucide in three files. Its sun and moon are byte-identical to
WhereItWent's, so P-001a settles the convention and this follows it.

Note `src/lexi5/App.jsx`'s two `<svg>` are data-URI favicons, not icons — out of
scope. Being `visual`: screenshots, and never auto-merged.

## P-001c — Daily Stoic: three inline glyphs in an app that imports lucide in 23 files · `visual` · `open`

**Impact:** the smallest of the three, and the one most likely to come back
"leave it". Part of P-001, Group 1.

`src/daily-stoic/App.tsx`. **The 64×64 one is the app's own mark — check before
assuming it is an icon at all.** `components/Ornament.tsx` stays hand-drawn.

If the audit on contact says these are deliberate rather than pasted, mark the
item `dropped` with the reason and move on; that is a correct outcome, not a
failed run. Being `visual`: screenshots, and never auto-merged.

## R-010 — Root triage, slice 2: the `patch-*.cjs` family · `refactor` · `open`

**Impact:** a repo root someone can read. Nothing user-facing.

`patch-accounts.cjs`, `patch-bulk.cjs`, `patch-categories.cjs`,
`patch-currency.cjs`, `patch-forms.cjs`, `patch-modal.cjs`,
`patch-remaining.cjs` — seven files, none referenced by `package.json`. Delete
the one-shot migrations, move anything still earning its keep under `scripts/`.
Check `git log` on a file before deleting — a script someone reruns yearly is
not junk.

## R-011 — Root triage, slice 3: the remaining scratch scripts · `refactor` · `open`

**Impact:** a repo root someone can read. Nothing user-facing.

`cleanup.cjs`, `debug_crash.cjs`, `debug_memento.cjs`, `dump.cjs`,
`find-covers.cjs`, `generateDemoData.cjs`, `scratch-fix.cjs`, `scratch_debug.js`,
`scratch_test.mjs`, `screenshot.js`, `steam-search.js`, `test-urls.cjs`,
`update-seed.cjs`, `validate-covers.cjs`. Same method as R-010. Note that
`dump.cjs` and `debug_memento.cjs` only ever wrote the dumps R-001 removed.

## R-002 — Stop the root from refilling with scratch files · `refactor` · `open`

**Impact:** none visible; prevents R-001 from needing doing again.

Follows R-001, R-010 and R-011. `.gitignore` has no pattern for the dumps and debug scripts that
keep landing at the root. Add narrow ones (`/scratch_*`, `/debug_*`, `/*_dump.*`,
`/diff.txt`, `/lint-output.txt`) — narrow, so nothing real gets swallowed.

## R-012 — Audit the 33 stale `claude/*` branches · `refactor` · `open`

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

---

## Proposed

The agent's own ideas. **Nothing here gets worked until it is moved up.** To
approve one, cut the block, paste it into the list above, and change `proposed`
to `open`.

To reject one, delete it — or just close the PR that proposed it, which is the
same answer said faster. The agent treats a proposal that vanished from `main`
as declined and will not raise it again.

_(nothing proposed right now.)_
