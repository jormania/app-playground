# Daily refactor — the autonomous upkeep agent

An agent that improves this repository one item per weekday morning, without
asking first. It picks its own work from a queue, implements it, proves it
green, opens a pull request, and — for the two classes that cannot change what
you see — merges that pull request itself. Review happens afterwards, on the PR.

The bargain is deliberate: a day's output is small enough to read over coffee,
so the cost of a bad one is a `git revert`, not an incident. Everything below
exists to keep that bargain honest.

> **The failure mode this system is built against is silent success.** Every
> failure in its short history has been a green tick over an empty result. Guards
> here are weighted accordingly: they fail loudly, or they fail open, and almost
> never quietly.

---

## The moving parts

| Piece | What it holds |
|---|---|
| [`.github/workflows/daily-refactor.yml`](.github/workflows/daily-refactor.yml) | The runner, the schedule, and every check that runs *after* the agent stops |
| [`.claude/skills/daily-refactor/SKILL.md`](.claude/skills/daily-refactor/SKILL.md) | The procedure the agent follows — ten steps, and the hard rules |
| [`REFACTOR_BACKLOG.md`](REFACTOR_BACKLOG.md) | The queue. Edit by hand; the order **is** the priority |
| [`scripts/build-meta.js`](scripts/build-meta.js) | The counts stamped into the front page footer, with their rules written down and tested |
| `index.html` footer | Where you see all of it without opening GitHub |

The workflow supplies only a runner that already has the repo and push rights.
It deliberately holds no procedure: the skill is editable without touching CI,
and the workflow is auditable without reading prose.

---

## When it runs

```yaml
- cron: '41 22 * * 0-4'  # 22:41 UTC — 01:41 Bucharest next day, 00:41 in winter
- cron: '41 0 * * 1-5'   # 00:41 UTC — 03:41 Bucharest, backstop, usually skipped
```

Monday to Friday mornings in Bucharest, plus a **Run workflow** button for
testing. Note the first cron fires the *evening before*, on days `0-4`.

**GitHub's queue fails in two independent ways, and both have happened here.**
Their docs cover the first: the `schedule` event "can be delayed during periods
of high loads", "high load times include the start of every hour", and "if the
load is sufficiently high enough, some queued jobs may be dropped."

- **Dropped.** The original `3 2 * * 1-5` sat three minutes past the hour. On
  2026-09-15 it never fired at all — no run, no delay, no record. Odd minutes and
  a second draw address this.
- **Delayed.** On 2026-09-16 the run did fire, four and a half hours late, landing
  at 08:13 Bucharest. Another attempt cannot fix that; only a bigger cushion can.

Hence the evening start. **22:41 UTC is the earliest hour that is already
"tomorrow" in Bucharest in both seasons** — 21:41 plus winter's +2 is still the
same day — which is why the hour looks arbitrary and is not. It leaves 5h19m of
slack in summer and 6h19m in winter before 07:00, against 3h19m before.

**A consequence worth knowing:** the runner's own UTC date is then *yesterday*.
A `Work out which morning this is` step computes the Bucharest date and weekday
and passes both into the agent's prompt, and the gate compares Bucharest dates
rather than UTC ones, so a run and its backstop on either side of UTC midnight
are recognised as the same morning. Nothing in the run may use bare `date +%F`.

**The `gate` job** decides whether the backstop proceeds. It stands down if any
run already went out this Bucharest morning, and goes ahead otherwise. It is a backstop for a
dropped cron, **not a retry**: a run that failed on its own merits should not
burn a second slice of the backlog.

The gate is written to fail *open*, in both halves:

- The step carries no `set -e`, and every path ends at a decision it writes last,
  so it cannot die before speaking.
- The job condition is `!cancelled() && needs.gate.outputs.run != 'false'` — only
  an explicit stand-down stops the morning. A gate that errored, timed out, or
  produced no output lets the day through.

Getting that backwards costs one duplicate PR. Getting it the other way costs the
whole day, quietly. (It was briefly backwards, on 2026-09-15, between two commits
an hour apart.)

---

## Classes — the autonomy dial

Every backlog item carries a class, and the class decides two separate things:
**who may put the item on the queue**, and **whether its PR merges itself**.

| Class | What it is | Agent may queue it? | Auto-merges? | Proof required |
|---|---|---|---|---|
| `refactor` | Behaviour-preserving restructuring | **yes** | **yes** | Existing suite, green against the moved code |
| `modernise` | Dep currency, deprecated APIs, coverage, doc drift | **yes** | **yes** | Suite green; for a dep bump, what changed in its release notes |
| `qol` | Small user-visible improvement | no — proposes only | **no** | A test pinning the new behaviour, plus screenshots |
| `visual` | SVG, icons, spacing, motion, empty states | no — proposes only | **no** | Screenshots: both themes, 390px and desktop |
| `idea` | A proposal not yet worked out | n/a | n/a | Promoted to a real class before anyone builds it |

The line is *what you'd notice when you open an app*. `refactor` and `modernise`
have a mechanical notion of correctness and a small blast radius, so they run
free. `qol` and `visual` change what you see, so they wait for a human — however
green they come back.

**Approving a proposal is one edit.** Items under `## Proposed` are the agent's
own ideas. Cut the block, paste it into the main list, change `proposed` to
`open`. To reject one, delete it — or close the PR that proposed it, which says
the same thing faster. A proposal that vanishes from `main` is treated as
declined and is never raised again.

**The class line is load-bearing.** It is the agent's own declaration of whether
its change may reach production unread. The skill says so plainly: if a
"refactor" turns out to alter behaviour even slightly, it is not a refactor.

---

## One run, start to finish

**1 — Orient.** Branch off fresh `origin/main` as `claude/refactor-<date>`,
appending `-2`, `-3` if that name is taken. Never stack on yesterday's branch;
each day's PR must be independently mergeable and independently discardable.
Never force-push over an existing `claude/refactor-*` branch — one is probably
behind a PR someone is reading.

**2 — Check what's in flight.** Open `claude/refactor-*` PRs carry a
`Backlog-Item:` line; those items are claimed and get skipped. **At six open PRs
the agent stops** and says the queue is backed up. An unreviewed pile that grows
without bound is worse than no refactors at all.

**3 — Pick.** The topmost item that is not `done`, `blocked`, under `## Proposed`,
or claimed.

**Fridays are discovery runs.** Nothing ships. The session reads the codebase
against current standards and appends up to five findings, each with a class, an
`Impact:` line and a concrete file path — then opens a backlog-only PR like any
other run. Findings that stay on a branch nobody visits are findings that die.

**4 — Size.** Target a diff reviewable in ten minutes. Anything larger is split
*in the backlog* into numbered slices, and only the first is done.

**5 — Execute.** Hard rules, each a failed run rather than a judgement call:
never push to `main`; never add a new top-level `api/*.js` (the repo sits at the
Vercel Hobby cap of 12); never make a legacy app import from `src/ds/`; never
skip, disable or weaken a test; never remove a service-worker
`import.meta.env.PROD` guard; never import a `@fontsource` family by bare name.
No new runtime dependencies.

**6 — Screenshots** (`qol` and `visual` only). Preview deploys are off for
`claude/*`, so a picture in the PR is the only look you get before merging. Four
captures before and after: light and dark, 390px and desktop, against
`npm run build && npm run preview` rather than the dev server. Playwright is a
devDependency so the library is installed, but **the browser binary is not** —
a runner needs `npx playwright install --with-deps chromium` first. They go on
the orphan `claude/shots` branch, which is never merged and only ever grows,
and are embedded by raw URL.

**7 — Prove.** All three gates, every run: `npm test -- --run`,
`npm run typecheck`, `npx eslint <changed paths>`. If they will not go green,
**the work is thrown away** — branch deleted, item marked `blocked` with the
reason, no PR. Never push a red branch to see what CI says.

**8 — Record.** In the same commit: mark the item `done`, and append at most
three new candidates. A proposal only reaches the queue when that day's PR
merges, so the agent checks open PRs for the same idea before writing it again.

**9 — Land.** Push, open a PR against `main`, ready for review, with
`Backlog-Item:` and `Class:` lines and a **`@jormania` mention as the body's
first line** (see *Reaching a human*, below). Then write
`/tmp/refactor-result.json` — uncommitted — which is how the workflow learns
what happened:

```json
{"branch": "claude/refactor-2026-09-14", "class": "refactor", "pr": 59, "outcome": "shipped"}
```

**10 — Report.** The closing report leads with the class and one sentence on
what you'd notice, and ends with verbatim merge instructions and a real PR
number. "Nothing changes on screen" is a preferred opening when true — a
dependency bump and a redesigned empty state must not arrive reading identically
on a phone.

---

## What happens after the agent stops

Everything below the agent's step in the workflow runs where the agent cannot
influence it. That separation is the point: **a run that merges to production on
its own must not be the thing that decides it passed.**

1. **Publish the report** to the run summary, parsed out of the action's output.
2. **Read the result file** — defensively. Missing or malformed means "nothing to
   merge", never a red run; a forgotten file should cost a click, not a morning.
   A `branch` that isn't `claude/refactor-*` is refused outright.
3. **Assert nothing reached `main`.** Pushing to `main` is forbidden in three
   separate places, so this should never fire — which is exactly why it is
   asserted rather than assumed.
4. **Re-verify in a clean clone.** The pushed branch is checked out fresh into
   `verify/` and put through `npm ci`, all three gates. Anything that only passed
   in the agent's working tree — an uncommitted file, a stale cache — dies here.
5. **Confirm the PR is this run's:** head ref matches the branch, head repo is
   this repo, base is `main`, state is open. With auto-merge on, a wrong number
   would merge something else entirely.
6. **Merge, if the class allows it.** `refactor|modernise` → squash and delete
   the branch. Everything else is left for you, with a line in the summary saying
   why.
7. **Fail loudly if the run got stuck.** See below.

---

## Reaching a human

GitHub's defaults are the constraint: a *successful* workflow emails nobody, and
a bot-opened PR on a repo you merely own may not notify you either. Two channels
were chosen because they work without anyone changing a setting.

**`@jormania` as the PR body's first line.** A mention notifies under
"Participating and @mentions" — the notification class essentially nobody turns
off — regardless of watch state. It is delivery, not decoration. A future run
tidying it away as noise would silently sever the reporting channel, which is why
both the skill and the workflow prompt say so explicitly.

**A stuck run fails on purpose.** GitHub *does* email about failed workflows by
default, so the final step borrows that alarm:

| `outcome` | Meaning | Run result |
|---|---|---|
| `shipped` | A PR exists | quiet, green |
| `nothing-eligible` | Backlog empty, or the six-PR queue was full | quiet, green |
| `blocked` | Tried and could not finish — gates red, push failed, item wrong on contact | **fails** |
| *missing, empty, corrupt, unrecognised* | The session stopped early — turn limit, crash, timeout | **fails** |

That last row matters more than it looks. The skill writes the result file on
every path it can finish, so its absence is evidence, not an edge case. Before
2026-09-15 a session that died partway printed `Outcome: unrecorded` and exited 0
— green tick, empty repository, no email. That is precisely how the first two
runs passed unnoticed.

A run that correctly did nothing stays quiet. Crying wolf on calm mornings is how
a person learns to ignore the alert that matters.

---

## Where you see it

The front page footer carries the automation's vital signs, in three layers that
degrade independently:

- **Two workflow badges** — Daily refactor and CI — static images from GitHub, so
  they still say pass/fail when the API below is unreachable.
- **The upkeep line**: last run number, verdict, how long ago, how many
  `claude/refactor-*` PRs are waiting against the six that pause the workflow,
  and backlog depth. Two unauthenticated GitHub calls, the second independent of
  the first, every failure silent — but backlog depth is stamped at build time,
  so it paints first and survives a rate-limited or offline GitHub alone.
- **The build line**: commit, deploy time, branch when it isn't `main`, and gauges
  for the two Vercel ceilings this repo has actually hit. Both appear only once
  they have something to say — the serverless-function count (visible from 10, red
  at the 12 cap), and the built size of `dist/` (visible from 20 MB, red at 40 MB,
  against a usual ~10 MB). Stamped at build
  time by `buildMetaPlugin` in `vite.config.js`, so it costs nothing against
  GitHub's 60-requests/hour unauthenticated limit and always describes the build
  you are looking at. The counting rules live in `scripts/build-meta.js` and are
  tested — a gauge that silently under-reports is worse than no gauge.

  The size gauge is the one exception to "stamped by `buildMetaPlugin`": a
  bundle's weight is not knowable from `transformIndexHtml`, which runs while the
  bundle is still being made, so `stampBuildSizePlugin` measures the finished
  output and writes the tag into the emitted HTML from `closeBundle` instead. That
  hook is ordered `post` deliberately — vite-plugin-pwa generates its service
  workers from a post hook of its own, and measuring before them under-reports.

---

## Running it, and steering it

**To change what it does next:** reorder `REFACTOR_BACKLOG.md`. The agent always
takes the topmost eligible item, so the order of that file is the steering wheel.

**To approve a proposal:** move it out of `## Proposed` into the main list and
change `proposed` to `open`.

**To run one now:** Actions → Daily refactor → **Run workflow**. A manual run
always proceeds; the gate only applies to scheduled ones.

**To stop it:** Actions → Daily refactor → **⋯ → Disable workflow**.

**Requirements:**

- `CLAUDE_CODE_OAUTH_TOKEN` — repository secret, required.
- `REFACTOR_PAT` — **not optional in practice, and not currently set.** A PR the
  workflow opens is authored by `github-actions[bot]` using the default
  `GITHUB_TOKEN`, and GitHub does not trigger `pull_request` workflows for those.
  PR #65 has zero checks and a `pending` status as a result. (An earlier note here
  claimed CI did run, citing #59 — that was a bad inference: #59 was opened under
  Gabriel's own identity, not the bot's.) Auto-merge is unaffected, since the
  workflow verifies independently, but a `qol` or `visual` PR waiting for a human
  shows no green tick at all.
- Settings → Actions → **Allow GitHub Actions to create and approve pull
  requests** must be **on**. It was off for the second-ever run, which is why that
  run could not open its PR.

**Costs:** ~$1–2 of token value per run at Opus 5 rates, which is a meter rather
than a charge when the OAuth token is subscription-backed. Budget per run:
45 minutes wall clock, 60 turns, tools limited to
`Bash,Read,Edit,Write,Glob,Grep,TodoWrite`.

---

## Known gaps

Recorded because a system that hides its own weak points cannot be trusted with
production.

- **The queue is still the weakest link.** Two draws at different hours is much
  better than one, but GitHub guarantees neither that a run fires nor that it
  fires on time. The evening start buys five to six hours of slack; a delay
  longer than that still arrives after breakfast, and a morning where nothing
  fires at all is silent. There is no external watchdog — the one gap that cannot
  be closed from inside Actions.
- **The `visual` path has never run end to end.** Playwright install on the
  runner, four captures, the `claude/shots` branch (which does not exist yet),
  raw-URL embedding — none of it has been exercised. P-001 will be the first.
- **The 60-turn budget is untested for a visual item.** Browser install plus
  screenshots plus three gates may not fit. It would now fail loudly rather than
  vanish, but that is a consolation, not a fix.
- **Agent PRs get no CI at all** until `REFACTOR_PAT` exists — see the
  requirements above. And even where `CI` does run it is the weaker signal: two
  gates (`npm test`, `npm run typecheck`) against the pre-merge verification's
  three, which adds `npx eslint .` on a clean clone. A green tick on a PR
  therefore means less than an auto-merge does.
- **Squash-merge breaks ancestry**, so `git log main..<branch>` reports a merged
  branch as unmerged. Anything reasoning about stale branches must compare content,
  not ancestry.

---

## History, and what each failure taught

| Date | What happened | What changed |
|---|---|---|
| 2026-09-14 | Cloud Routine ran three times, produced nothing. The session had read but not write access — the git proxy's writable-repo set cannot be widened by any credential | Abandoned Routines for a GitHub Action, where push rights come by construction |
| 2026-09-14 | Run #1: green, empty, 28 permission denials | `--allowedTools`, and `show_full_output` so the next failure is readable |
| 2026-09-14 | Run #2: could not open its PR | Repository setting enabled |
| 2026-09-14 | Verification ran two gates, not three | Added `eslint` to the independent run |
| 2026-09-14 | Screenshot instructions assumed preinstalled browsers, true in the Claude container and false on a runner | `npx playwright install --with-deps chromium` |
| 2026-09-15 | The scheduled run never fired — dropped from GitHub's queue at `:03` | Two crons at `:41`, plus the `gate` job |
| 2026-09-15 | That gate was itself a fail-*closed* single point of failure | Both halves made to fail open |
| 2026-09-15 | A session dying partway ended green and silent | Any outcome that isn't `shipped` or `nothing-eligible` now fails the run |
| 2026-09-16 | The first scheduled run worked end to end — gate, agent, independent verification, correct refusal to auto-merge a `visual` item — but arrived four and a half hours late, at 08:13 Bucharest | Primary cron moved to 22:41 UTC the evening before, with the Bucharest date computed and handed to the agent |
| 2026-09-16 | That run's PR (#65) had zero checks: a PR opened by `github-actions[bot]` does not trigger `pull_request` workflows, and this document had claimed otherwise from a bad reading of #59 | Claim corrected; `REFACTOR_PAT` reclassified from optional to missing |

The pattern is one thing, seven times: **the danger is not a bad change reaching
production. It is a morning where nothing happened and nobody was told.**
