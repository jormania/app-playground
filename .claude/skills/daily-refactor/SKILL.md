---
name: daily-refactor
description: The autonomous daily improvement pass over app-playground. Picks exactly one item from REFACTOR_BACKLOG.md, implements it on a fresh branch off main, proves it green, and opens a PR for after-the-fact review. Run each weekday by .github/workflows/daily-refactor.yml; also available by hand as /daily-refactor.
---

# Daily refactor

One improvement per run. No approval beforehand, full review afterwards on the PR.
The whole point is that a day's output is small enough that Gabriel can read the
diff over coffee and merge or close it without a conversation.

Read `CLAUDE.md` and `.agents/AGENTS.md` first — every rule there outranks this file.

## Where this runs

[`.github/workflows/daily-refactor.yml`](../../../.github/workflows/daily-refactor.yml),
on a GitHub runner, weekday mornings. By the time you read this the runner has
already checked the repo out with full history and run `npm ci` — so you have
the code, the dependencies, and push rights. Don't clone, don't reinstall.

## 1. Orient

**The date is given to you, and it is not `date +%F`.** The schedule fires the
evening before, so the runner's clock often reads yesterday while the run belongs
to this morning in Bucharest. The workflow prompt states the date to use; take it
from there and use it everywhere — branch name, the backlog's `done` stamp, any
screenshot directory. Running by hand with no date supplied, use
`TZ=Europe/Bucharest date +%F`.

```bash
git fetch origin main
DAY=<the date the prompt gave you>            # e.g. 2026-09-16
BR=claude/refactor-$DAY
# a second run on the same day must not land on the first run's branch
n=2; while git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; do BR=claude/refactor-$DAY-$n; n=$((n+1)); done
git checkout -B "$BR" origin/main
```

**Never force-push over an existing `claude/refactor-*` branch.** One of them is
probably behind an open PR, and overwriting it silently rewrites a change
Gabriel may already be reading.

Always branch off fresh `origin/main`. Never stack on yesterday's branch — each
day's PR must be independently mergeable and independently discardable.

Then find out what is already in flight:

- List open PRs whose head branch starts with `claude/refactor-`.
- Each carries a `Backlog-Item: R-0xx` line in its body. Those items are **claimed** — skip them.
- **If six or more such PRs are open, stop.** Do not open a seventh. Report that
  the queue is backed up and that merging or closing some would let the agent
  resume. A growing pile of unreviewed refactors is worse than no refactors.

## 2. Classes, and what each one is allowed to do

Every backlog item carries a class. The class decides the burden of proof and
whether the agent may put the item on the queue itself.

| Class | What it is | Agent may self-promote? | Proof required |
|-------|-----------|------------------------|----------------|
| `refactor` | Behaviour-preserving restructuring | **Yes** | The existing suite, still green against the moved code |
| `modernise` | Dependency currency, deprecated APIs, typecheck/test coverage, documentation drift | **Yes** | Suite green; for a dep bump, name what changed in its release notes |
| `qol` | Small user-visible improvement | **No — propose only** | A test pinning the new behaviour, plus screenshots |
| `visual` | SVG, icons, spacing, motion, empty states | **No — propose only** | Screenshots: both themes, phone width and desktop |
| `idea` | A proposal not yet worked out | n/a | n/a — an `idea` is promoted to a real class before anyone builds it |

**Self-promote** means: you noticed it, you added it, you may work it the same
day. `refactor` and `modernise` have a small blast radius and a mechanical
notion of correctness, so they run free.

`qol` and `visual` change what Gabriel sees when he opens an app. Those you may
**propose** — append them under `## Proposed` with a class and an `Impact:`
line — but you may not work them until a human moves the item up into the main
list. Do not lobby, do not work a proposed item because it seems obviously
right. The queue is his steering wheel; proposing is how you hand him one.

## 3. Pick

Read `REFACTOR_BACKLOG.md`. **Take the topmost eligible item. The order is
absolute** — it is Gabriel's steering wheel, and a run that drives somewhere else
has taken the wheel off him.

An item is eligible when its `## ` header is **all** of these:

- in the main list, not under `## Proposed`;
- in state `open` — not `done`, `blocked` or `dropped`;
- not claimed — no open PR carries its id on a `Backlog-Item:` line;
- not marked **not agent-executable** in its header.

That is the whole test. **Class is not in it.** A `visual` or `qol` item a human
has moved into the main list is as eligible as any `refactor` — you take it, you
do the screenshots, and it waits for review because its class never auto-merges.
**Neither is the order of classes around it.** The backlog header asks whoever
arranges the queue to interleave review-needed items with self-merging ones;
that is advice for arranging, never licence for you to skip. If three `visual`
items sit at the top, the top one is today's.

**Every item you pass over, you name.** For each header above the one you take,
the PR body gets one line — the id and which of the four conditions made it
ineligible (`R-024 — not agent-executable`, `R-031 — claimed by #92`). Those are
the only valid reasons. There is no other kind of skip:

- an item that turns out to be a **bad idea on contact** is marked `dropped` in
  the backlog with a one-line reason, in this run's commit — it is not passed over;
- an item you **cannot finish** is marked `blocked` with the reason, and the run
  opens no PR — see step 5;
- an item that is **too big** is split into slices in the backlog and you do the
  first — see step 4.

In each case the backlog changes and says why. Silently taking the second item
instead of the first is a failed run, however good the second item's work is.
2026-09-23 is why this paragraph exists: the run passed over three `visual`
items to take R-008, did excellent work on it, merged itself — and left nothing
for the human who had put R-022 on top to review, with no word as to why.

**An item is a `## ` header, and only that.** Nothing nested inside one is a
separate item, however much it looks like a queue. When a big item splits into
slices, each slice becomes its own `## ` header in the order it should be taken —
otherwise it is invisible to the footer's backlog count, and "topmost eligible"
stops meaning anything once a slice sits inside a parent already marked `done`.

**Fridays are discovery runs** — Friday by the date you were given, not by the
runner's clock, which is a day behind when the evening cron fires. Ship nothing. Spend the session reading the
codebase against current standards — deprecated APIs, dependency generations
behind, duplicated patterns that want promoting to `src/shared/`, documentation
that has drifted from the code, apps with no test coverage, places where the
design system could replace something hand-rolled. Append what you find: up to
five items, each with a class, an `Impact:` line, and a concrete file path.
Commit that alone, then **push and open a PR exactly as any other run does** —
step 9 applies. A discovery run that never opens a PR is a discovery run whose
findings die on a branch nobody visits.

Title it so it reads as safe at a glance ("Backlog: five proposals from the
Friday read"), and say in the body that it touches `REFACTOR_BACKLOG.md` and
nothing else. It should be the easiest merge of the week. A week that adds five good
proposals is worth more than a week that ships five shrugs.

If the backlog has no eligible items on a non-Friday, do a discovery run instead
and say so.

If an item turns out to be a bad idea on contact with the code — mark it
`dropped` with a one-line reason, commit that, and move to the next item.

## 4. Size

The target is a diff a human reviews in ten minutes. If the chosen item is
larger, split it **in the backlog** into numbered slices and do only the first
one this run. Leave the rest as new items. Never let one run sprawl.

## 5. Execute

A `refactor` or `modernise` item is behaviour-preserving, full stop — one that
changes what an app does is a feature change wearing a disguise, and it will get
closed. A `qol` or `visual` item changes behaviour on purpose, but only the
behaviour its own description names: if you find yourself improving something
adjacent because you are already in the file, stop and propose it instead.

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

## 6. Screenshots — for `qol` and `visual` items only

Preview deploys are off for `claude/*` branches, so a screenshot in the PR is
the only look Gabriel gets before merging. Skip this for `refactor` and
`modernise`; a picture of an unchanged screen tells nobody anything.

Playwright is a devDependency, so `npm ci` has already installed the library —
but **not the browser binary**. On a GitHub runner you must fetch it first:

```bash
npx playwright install --with-deps chromium    # ~30s, once per run
```

Only Chromium; the other engines are a slow download for no benefit here.

Capture the affected screen **four ways** — light and dark, 390px wide and
desktop — before your change and after it. `npm run build && npm run preview`
serves the real thing; screenshotting the dev server can mislead you, since the
service worker is gated off under `vite dev`.

Screenshots must not land in `main`. Put them on the dedicated `claude/shots`
branch, which exists only to hold them and is never merged:

```bash
git fetch origin claude/shots 2>/dev/null && git checkout claude/shots || git checkout --orphan claude/shots
mkdir -p <today>-R-0xx && cp /tmp/shots/*.png <today>-R-0xx/
git add <today>-R-0xx && git commit -m "shots: R-0xx" && git push -u origin claude/shots
git checkout claude/refactor-<today>
```

Then embed them in the PR body by raw URL, which GitHub renders inline:

```
![before](https://raw.githubusercontent.com/jormania/app-playground/claude/shots/<today>-R-0xx/before-dark-390.png)
```

Never delete someone else's directory on that branch — it only ever grows, and
the files are small.

## 7. Prove

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

## 8. Record

In the same commit as the change, edit `REFACTOR_BACKLOG.md`:

- Mark the item `done` with today's date.
- Append any new candidates you noticed while working — **at most three**, each
  with a class, an `Impact:` line, and a concrete file path or symbol. Vague
  aspirations rot the backlog.
- `refactor` and `modernise` candidates go in the main list, ready to work.
  `qol` and `visual` candidates go under `## Proposed` and wait for a human.

**A proposal only reaches the queue when that day's PR is merged.** You write it
on a branch; `main` is what the next run reads. So before appending, check the
open `claude/refactor-*` PRs for the same idea already written down and waiting —
if it is there, do not write it again. Two PRs proposing the same thing in
different words is how a backlog stops being trustworthy.

If an idea you proposed in an earlier run is absent from `main`'s backlog and
absent from every open PR, its PR was closed. That was an answer: do not
re-propose it.

## 9. Land

```bash
git push -u origin "$BR"
```

Open a PR, ready for review, against `main`. **The body's first line is
`@jormania`, alone.** That mention is what actually delivers the report: it
notifies under GitHub's default settings whatever his watch state is, and a
bot-opened PR on a repo he merely owns may not otherwise reach him at all. It
is not decoration — without it the run can succeed and he can still never hear
about it.

The rest of the body:

```
Backlog-Item: R-0xx
Class: refactor | modernise | qol | visual

**What you'd notice** — one sentence, in the second person, about opening the
app. For a `refactor` or `modernise` item write "nothing — this is invisible
from the outside", and mean it.

**What** — one paragraph, plain language.
**Why** — the problem this removes.
**Behaviour** — "unchanged", or exactly what changed and why that was the point.
**Proof** — the three gates, any test added, and the screenshots for a `qol` or
`visual` item.
**Risk** — what a reviewer should look at hardest. Say "none I can see" if that is true.
```

**Then record what you did**, in `/tmp/refactor-result.json`:

```json
{"branch": "claude/refactor-2026-09-14", "class": "refactor", "pr": 59}
```

Add an `outcome` too — `shipped`, `nothing-eligible` or `blocked`:

```json
{"branch": "claude/refactor-2026-09-14", "class": "refactor", "pr": 59, "outcome": "shipped"}
```

`branch` and `pr` are null if you opened none; `class` must match the PR's
`Class:` line exactly. **`blocked` deliberately fails the workflow run**, which
is the only notification Gabriel gets by default — so use it when you tried and
could not finish, and never to mean "there was nothing to do". `nothing-eligible`
is the quiet, correct outcome for an empty queue; a false alarm on a calm day
teaches him to ignore the alarm that matters. Do not commit this file. The workflow reads it, re-runs
the repo's gates against a clean clone of your branch, and — for `refactor` and
`modernise` only — merges the PR itself once that passes. `qol` and `visual`
wait for Gabriel however green they are.

Two consequences worth holding in mind. Your `class` line decides whether a
change reaches production without a human reading it, so classify honestly: if
a "refactor" turns out to alter behaviour even slightly, it is not a refactor.
And the verification is a fresh clone, so anything that only passes in your
working tree — an uncommitted file, a stale cache — fails there and stops the
merge.

Then subscribe to the PR's activity and drive it to green if CI disagrees with
your local run.

**Verify the push landed** — `git ls-remote --heads origin <branch>` — before
you claim anything about it. A fired session may have no push credentials, and
a report that says "pushed" when nothing left the container is worse than a
report that says it failed.

If the push succeeded but PR creation did not (no GitHub tooling, or the API
refuses), report the compare link
`https://github.com/jormania/app-playground/compare/main...<branch>` and paste
the PR body into your closing report, so it opens by hand in a click.

If the **push itself** failed, the work dies with this container. Say so as the
first line of your report, name the error, and paste the full `git diff` into the
report — that is the only copy anyone will ever see, and it is recoverable by
hand from there.

## 10. Report

Close the session with a short note: which item, what changed, the PR link, and
anything you deliberately left alone. Write it for someone who has not seen the
code today.

**Lead with the class and the one-sentence "what you'd notice".** A dependency
bump and a redesigned empty state must not arrive in the same inbox reading
identically — the first line is what tells them apart on a phone screen, so give
an invisible change an honestly boring opening and a visible one the weight it
has earned. Never inflate: "nothing changes on screen" is a fine first line and
Gabriel would rather read it than hunt for the catch.

If the run produced proposals under `## Proposed`, list them at the end in one
line each. They are the part he decides on, so they should be easy to say yes or
no to without opening anything.

This report is what the completion email carries, and the email is read on a
phone by someone who was not here. So **end every report that produced a PR
with the merge instruction, verbatim in this shape**, real values substituted:

```
TO MERGE — open https://github.com/jormania/app-playground/pull/<N>
Check the CI check is green, then click "Squash and merge" → "Confirm".
Merging pushes to main, which auto-deploys to Vercel.
Nothing to do if you'd rather not — click "Close pull request" and the item
goes back on the backlog.
```

Name the actual PR number. If CI was still running when you finished, say so on
the first line rather than implying it was green.

When no PR was opened — nothing eligible in the backlog, the gates wouldn't go
green, the queue was already six deep — say that in one sentence and **do not**
include a merge block. An email telling Gabriel to merge something that doesn't
exist is worse than no email.
