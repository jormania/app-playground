# AI models — where they live and how to upgrade them

Every app that calls Claude takes its model from one file,
[`src/shared/models.js`](src/shared/models.js):

| Constant | Today | Used by |
|---|---|---|
| `MODEL_HAIKU` | `claude-haiku-5-5` | The Long Listen's taste, continuity, explain and resources jobs (`modelFor` in `curator.js`), Touch Grass, WhereItWent, Fit Check, Sol Odyssey, Silva, KeyPath (coach, weekly note, key test), Lexi5 (default) |
| `MODEL_SONNET` | `claude-sonnet-5-5` | Daily Stoic mentor, Law of the Day (`src/law-of-the-day/lib/generate.js`, your key), The Long Listen's curator (`src/long-listen/curator/`), KeyPath Studio, Lexi5 (option) |

No app uses Opus. The daily-refactor workflow picks its own models
(`scripts/pick-model.mjs`, see DAILY_REFACTOR.md) — that is Claude Code, not the
API, and is outside all of this.

`src/shared/models.test.js` fails the suite if a model id is written anywhere
else in `src/` or `api/` (tests excepted). The static pages in `public/` are
hand-authored and not covered — the three `touch-grass*.html` pages carry their
own id and are no longer in use.

## Why there is no "always latest"

The API has no name that follows the newest model in a tier, and one would not
help: new models change what a request may contain. Sonnet 5.5 rejects
`thinking: { type: 'disabled' }`, which Sonnet 5 accepted — switching the id alone
would have broken Daily Stoic and Lexi5 on every call. An upgrade is a code change
that has to be checked against the real API, so the job is to make it small and
checked, not automatic.

## Upgrading a tier

1. Change the constant in `src/shared/models.js`.
2. Give the new id an entry in `NO_THINKING` in the same file (what the model
   needs sent to keep it from thinking). `models.test.js` fails until you do. Read
   the migration notes for the new model — the claude-api skill's
   `shared/model-migration.md` — for anything else that changed.
3. `npm test`, `npm run typecheck`.
4. `ANTHROPIC_API_KEY=… npm run test:live` — sends each app's real request once
   (answers capped at 256 tokens, one web search; about $0.05–0.10) and fails on any the API refuses,
   naming the app, model and the API's error. Pushing the change also runs it in
   CI (below).
5. Replies are read by block type everywhere (`extractAnthropicText`), so a model
   that opens with a thinking block still parses.

## Haiku 4.5 → 5.5 (2026-10-09)

Done for cost: Haiku 5.5 is $0.10 / $0.50 per million tokens against Haiku 4.5's
$1 / $5. Two things in it would have broken requests had only the id changed:

- **Haiku 5.5 thinks by default** (4.5 didn't), and thinking counts against
  `max_tokens`. Every Haiku caller has a small cap sized for the answer (Silva's
  tension check: 8), so each one now sends `noThinking(MODEL_HAIKU)` —
  `thinking: { type: 'disabled' }`, which Haiku 5.5 accepts at its default effort
  (medium) and up to `high`. No Haiku caller sets `effort`; one that sets `xhigh`
  or `max` with thinking disabled gets a 400.
- **Sampling parameters**: `temperature` must be `1` or absent. Fit Check (0),
  Sol Odyssey's companion (0.7) and WhereItWent's parser (0.1, 0.2) sent other
  values and now send none. Touch Grass's `temperature: 1` is accepted and stays.

Also changed: the same text counts as about 30% more tokens, and a decline comes
back as `stop_reason: "refusal"` (new on the Haiku line), which every caller
already treats as no answer.

## The live check

[`scripts/anthropic.live.test.js`](scripts/anthropic.live.test.js) — one case per
request an app makes, each built by the app's own function. It checks only that
the API accepts the request; reply quality is not tested. Excluded from
`npm test` (`*.live.test.js` in `vitest.config.js`); run by
`npm run test:live` with `vitest.live.config.js`.

In GitHub, [`.github/workflows/ai-models.yml`](.github/workflows/ai-models.yml)
runs it:

- once per change, when it lands on `main` and touched `models.js` or a file that
  builds a request (the paths list is enforced by `models.test.js`) — and then only
  the requests of the apps that change touched: `scripts/live-check-needed.mjs`
  maps the changed files to apps and sets `LIVE_APPS`, so a change to The Long
  Listen's prompts sends The Long Listen's requests, not every app's. A shared file
  (`models.js`, `anthropic.ts`, the live test, the workflow) runs every app's,
- not on pull requests: in October 2026 it ran in full on every PR push that
  touched a request file, 44 times, at roughly $0.05–0.10 each. The trade is that
  a rejected request is reported minutes after the deploy rather than before the
  merge,
- every Monday at 06:23 UTC — a retired model fails here before an app finds out.
  This run sends only one tiny request per model id (`LIVE_SCOPE=models`, about a
  tenth of a cent); the full set of app requests runs on request changes and by hand,
- by hand (Actions → AI models (live) → Run workflow), every app's requests.

It needs the repository secret **`ANTHROPIC_API_KEY`** (Settings → Secrets and
variables → Actions). Without it the run fails on purpose. A failed run is emailed,
like every other workflow here.

**It spends from the same key as the apps.** On 8–9 October 2026 it ran 19
times in one working session — every push to two long PRs plus each merge, at
1,024-token answers and six web searches a run — which was most of that day's
spend. The gate and the caps above were the first fix; running once per change on `main`, for the apps it touched, the second (26 October).

Behind a proxy (e.g. a Claude Code cloud session) Node's fetch needs
`NODE_USE_ENV_PROXY=1` as well.

## Adding a new app that calls Claude

Import the model from `src/shared/anthropic` (or `models.js` from `api/`), use
`noThinking(model)` if the reply should be short and thought-free, read replies
with `extractAnthropicText`, then add a case to the live test (named `<App> — <request>`), the file to the
`paths` list in `ai-models.yml`, and the app's directory to `APP_DIRS` in
`scripts/live-check-needed.mjs`. `models.test.js` and `live-check-needed.test.js`
fail until those are done.
