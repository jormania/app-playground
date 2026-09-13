---
name: daily-refactor
description: The autonomous daily refactoring pass over app-playground. Picks exactly one item from REFACTOR_BACKLOG.md, implements it on a fresh branch off main, proves it green, and opens a PR for after-the-fact review. Invoked by the "Daily refactor" Routine; can also be run by hand with /daily-refactor.
---

# Daily refactor

One improvement per run. No approval beforehand, full review afterwards on the PR.
The whole point is that a day's output is small enough that Gabriel can read the
diff over coffee and merge or close it without a conversation.

Read `CLAUDE.md` and `.agents/AGENTS.md` first — every rule there outranks this file.

## 0. Install

A fired session starts from a fresh clone with no `node_modules`. Run `npm ci`
before anything else — without it `npm test` dies on a missing `cross-env` and
`npm run typecheck` on missing type definitions, neither of which is a real
failure. It takes a couple of minutes; the full suite is another ninety seconds.

## 1. Orient

```bash
git fetch origin main
git checkout -B claude/refactor-$(date +%F) origin/main
```

Always branch off fresh `origin/main`. Never stack on yesterday's branch — each
day's PR must be independently mergeable and independently discardable.

Then find out what is already in flight:

- List open PRs whose head branch starts with `claude/refactor-`.
- Each carries a `Backlog-Item: R-0xx` line in its body. Those items are **claimed** — skip them.
- **If six or more such PRs are open, stop.** Do not open a seventh. Report that
  the queue is backed up and that merging or closing some would let the agent
  resume. A growing pile of unreviewed refactors is worse than no refactors.

## 2. Pick

Read `REFACTOR_BACKLOG.md`. Take the topmost item that is not `done`, not
`blocked`, and not claimed by an open PR.

If the backlog has no eligible items, spend the run on discovery instead: read
around the codebase, append up to five new grounded candidates to the backlog,
commit that alone, and say so. A run that adds nothing but honest backlog is a
fine run. Inventing busywork to have something to show is not.

If an item turns out to be a bad idea on contact with the code — mark it
`dropped` with a one-line reason, commit that, and move to the next item.

## 3. Size

The target is a diff a human reviews in ten minutes. If the chosen item is
larger, split it **in the backlog** into numbered slices and do only the first
one this run. Leave the rest as new items. Never let one run sprawl.

## 4. Execute

Behaviour-preserving unless the item says otherwise in as many words. A
refactor that changes what an app does is a feature change wearing a disguise,
and it will get closed.

Hard rules — a run that breaks one of these is a failed run, not a judgement call:

- **Never push to `main`.** `main` auto-deploys to Vercel.
- **Never add a new top-level `api/*.js`.** The repo sits at the Vercel Hobby cap
  of 12 functions. Tests for top-level handlers go in `api/_tests/`.
- **Never make a legacy app import from `src/ds/`** (`src/touch-grass/`,
  `src/journal/`, `src/kettlebell/`) and never restyle them — they are
  design-locked. See `LEGACY.md`.
- **Never skip, disable, quarantine, or weaken a test** to get green.
- **Never remove a service-worker `import.meta.env.PROD` guard.**
- **Never import a `@fontsource` family by bare name or weight entry point.**
- No new runtime dependencies. A dev dependency needs a sentence of
  justification in the PR body.
- `src/sol-odyssey/` has its own `CLAUDE.md` and `DESIGN.md` — read them before
  touching that directory, and defer to them.
- Update the app's own root Markdown doc when the change is visible there
  (`.agents/AGENTS.md` requires it).

## 5. Prove

All three, every run, no exceptions:

```bash
npm test -- --run
npm run typecheck
npx eslint <the paths you changed>
```

Run `npm test`, never bare `vitest` — without
`NODE_OPTIONS=--no-experimental-webstorage` every storage-touching test fails
for reasons that have nothing to do with your change.

Where a refactor has any chance of altering behaviour, add or extend a test that
would have caught the difference. A pure-move refactor is proven by the existing
tests still passing against the moved code.

**If you cannot get all three green: throw the work away.** `git checkout main`,
delete the branch, mark the item `blocked` in the backlog with the reason, push
only that backlog note, and report it. Never push a red branch, never open a PR
to "see what CI says".

## 6. Record

In the same commit as the change, edit `REFACTOR_BACKLOG.md`:

- Mark the item `done` with today's date.
- Append any new candidates you noticed while working — **at most three**, each
  with a concrete file path or symbol. Vague aspirations rot the backlog.

## 7. Land

```bash
git push -u origin claude/refactor-$(date +%F)
```

Open a PR, ready for review, against `main`. Body must contain:

```
Backlog-Item: R-0xx

**What** — one paragraph, plain language.
**Why** — the problem this removes.
**Behaviour** — "unchanged", or exactly what changed and why that was the point.
**Proof** — the three gates, and any test added.
**Risk** — what a reviewer should look at hardest. Say "none I can see" if that is true.
```

Then subscribe to the PR's activity and drive it to green if CI disagrees with
your local run.

If no GitHub tooling is available in the fired session, or the API refuses,
**do not lose the work**: the branch is already pushed. Report the compare link
`https://github.com/jormania/app-playground/compare/main...<branch>` and paste
the PR body into your closing report so it can be opened by hand in a click.

## 8. Report

Close the session with a short note: which item, what changed, the PR link, and
anything you deliberately left alone. Write it for someone who has not seen the
code today.
