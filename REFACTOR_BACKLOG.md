# Backlog — refactors, modernisation, and enhancements

The queue the **Daily refactor** Routine burns through — one item per weekday
morning, each landing as its own PR off fresh `main`. Fridays are discovery runs:
nothing ships, the agent reads the codebase and adds to this file instead.
Process lives in [`.claude/skills/daily-refactor/SKILL.md`](.claude/skills/daily-refactor/SKILL.md).

Edit by hand freely. Reorder to change priority — the agent always takes the
topmost eligible item, so the order of this file is the steering wheel.

**States:** `open` · `claimed` (an open PR names it) · `done` · `blocked` · `dropped`

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

## R-007 — `CLAUDE.md` misstates the typecheck scope · `modernise` · `open`

**Impact:** none visible. Fixes a doc a cold session trusts and would be misled by.

`CLAUDE.md` says tsconfig covers five directories. It covers seven —
`src/lexi5/lib` and `src/silva` were added and the prose never caught up. Correct
it, and check the rest of that section against `tsconfig.json` while you are
there. Documentation drift is what makes a codebase hostile to someone reading
it cold, model or human.

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

## R-006 — Guard the Vercel 12-function cap in CI · `modernise` · `open`

**Impact:** none visible. Turns a deploy failure into a test failure.

The repo is at exactly 12/12 top-level `api/*.js` files; a thirteenth fails the
deploy, which has happened before. `ls api/*.js | grep -v '^api/_' | wc -l` is a
manual check nobody runs. Turn it into a test (somewhere `npm test` picks up,
**not** a file directly in `api/`) that fails above 12 and names the cap in its
message.

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

### P-001 — 38 hand-rolled inline `<svg>` blocks while lucide-react sits in the deps · `visual` · `proposed`

**Impact:** icons that finally look like one family instead of twelve people's
handwriting; a smaller bundle where a hand-rolled path duplicates a lucide one.

Inline `<svg>` appears in 38 files across twelve apps — WhereItWent and Touch
Grass have nine each, Silva four. Some are genuine one-offs that should stay
hand-drawn. Others are a lucide icon someone retyped.

Audit first, replace second, and **one app per run**. Touch Grass is legacy and
design-locked: its icons are part of its look, so it is the last candidate, not
the first, and possibly never. Needs before/after screenshots in both themes.
