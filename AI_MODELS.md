# AI models — where they live and how to upgrade them

Every app that calls Claude takes its model from one file,
[`src/shared/models.js`](src/shared/models.js):

| Constant | Today | Used by |
|---|---|---|
| `MODEL_HAIKU` | `claude-haiku-4-5-20251001` | Touch Grass, WhereItWent, Fit Check, Sol Odyssey, Silva, KeyPath (coach, weekly note, key test), Lexi5 (default) |
| `MODEL_SONNET` | `claude-sonnet-5-5` | Daily Stoic mentor, Law of the Day (`api/`), The Long Listen's curator (`src/long-listen/curator/`), KeyPath Studio, Lexi5 (option) |

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
   (max_tokens capped at 1024; a few cents) and fails on any the API refuses,
   naming the app, model and the API's error. Pushing the change also runs it in
   CI (below).
5. Replies are read by block type everywhere (`extractAnthropicText`), so a model
   that opens with a thinking block still parses.

## The live check

[`scripts/anthropic.live.test.js`](scripts/anthropic.live.test.js) — one case per
request an app makes, each built by the app's own function. It checks only that
the API accepts the request; reply quality is not tested. Excluded from
`npm test` (`*.live.test.js` in `vitest.config.js`); run by
`npm run test:live` with `vitest.live.config.js`.

In GitHub, [`.github/workflows/ai-models.yml`](.github/workflows/ai-models.yml)
runs it:

- on a push to `main` or a PR that touches `models.js` or any file that builds a
  request (the paths list is enforced by `models.test.js`),
- every Monday at 06:23 UTC — a retired model fails here before an app finds out,
- by hand (Actions → AI models (live) → Run workflow).

It needs the repository secret **`ANTHROPIC_API_KEY`** (Settings → Secrets and
variables → Actions). Without it the run fails on purpose. A failed run is emailed,
like every other workflow here.

Behind a proxy (e.g. a Claude Code cloud session) Node's fetch needs
`NODE_USE_ENV_PROXY=1` as well.

## Adding a new app that calls Claude

Import the model from `src/shared/anthropic` (or `models.js` from `api/`), use
`noThinking(model)` if the reply should be short and thought-free, read replies
with `extractAnthropicText`, then add a case to the live test and the file to both
`paths` lists in `ai-models.yml`. `models.test.js` fails until the last two are
done.
