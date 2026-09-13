# Refactor backlog

The queue the **Daily refactor** Routine burns through — one item per weekday
morning, each landing as its own PR off fresh `main`. Process lives in
[`.claude/skills/daily-refactor/SKILL.md`](.claude/skills/daily-refactor/SKILL.md).

Anyone can edit this file by hand. Reorder it to change priority; the agent
always takes the topmost eligible item. Add an item with the next free id and
enough detail that a cold session can act on it without guessing.

**States:** `open` · `claimed` (an open PR names it) · `done` · `blocked` · `dropped`

---

## R-001 — Triage the 27 scratch scripts tracked at the repo root · `open`

`cleanup.cjs`, `debug_crash.cjs`, `debug_memento.cjs`, `dump.cjs`,
`find-covers.cjs`, `generateDemoData.cjs`, `patch-*.cjs` (7 files),
`scratch-fix.cjs`, `scratch_debug.js`, `scratch_test.mjs`, `screenshot.js`,
`steam-search.js`, `test-urls.cjs`, `update-seed.cjs`, `validate-covers.cjs`,
plus the data dumps `diff.txt`, `lexi5_dump.txt`, `lint-output.txt`,
`memento_dump.html`, `notes.json`, `results.json`.

All committed, none referenced by `package.json`. For each: delete if it was a
one-shot migration, or move under `scripts/` if it still earns its keep. Check
`git log` on a file before deleting — a script someone reruns yearly is not junk.

Slice it: one PR for the inert data dumps, one for the `patch-*` family, one for
the rest. Do not do all three in one run.

## R-002 — Stop the root from refilling with scratch files · `open`

Follows R-001. `.gitignore` has no pattern for the dumps and debug scripts that
keep landing at the root. Add narrow ones (`/scratch_*`, `/debug_*`, `/*_dump.*`,
`/diff.txt`, `/lint-output.txt`) — narrow, so nothing real gets swallowed.

## R-003 — Promote the `/api/notion` fetch wrapper to `src/shared/` · `open`

`CLAUDE.md` has flagged this for a while: the same wrapper is copied across
twelve app clients (`src/*/notionClient.{js,ts}`, `src/*/lib/notionClient.*`,
`src/daily-stoic/services/NotionService.ts`, `src/sol-odyssey/lib/notion.ts`).

Follow the promotion pattern the repo already uses: move the canonical
implementation to `src/shared/notionClient.ts`, leave each old path as a thin
re-export, and let the app's existing tests prove the move was
behaviour-preserving. **One app per run.** Start with a JSX app, not with
Fit Check or Sol Odyssey — those are strict TS and deserve a settled API first.

Update the `src/shared/` section of `CLAUDE.md` when the first slice lands.

## R-004 — Fold the two stale `notionId` copies into `src/shared/notionId.ts` · `open`

`CLAUDE.md` records that Wanderlist and Journal still carry their own older
copies. Diff them against the shared one first — if either handles a URL shape
the shared version misses, the shared version is what needs fixing. Legacy
Journal may import from `src/shared/`; that boundary only covers `src/ds/`.

## R-005 — Same for Journal's legacy `photo.ts` copy · `open`

`CLAUDE.md`: "Wanderlist re-exports it, Journal keeps its older legacy copy."
Same method as R-004, same caveat about which copy is actually correct.

## R-006 — Guard the Vercel 12-function cap in CI · `open`

The repo is at exactly 12/12 top-level `api/*.js` files; a thirteenth fails the
deploy, which has happened before. `ls api/*.js | grep -v '^api/_' | wc -l` is a
manual check nobody runs. Turn it into a test (somewhere `npm test` picks up,
**not** a file directly in `api/`) that fails above 12 and names the cap in its
message.

---

## Done

_(nothing yet)_
