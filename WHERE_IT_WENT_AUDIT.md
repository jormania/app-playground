# WhereItWent — Full Audit (2026-07-29)

Scope: every file under `src/where-it-went/` (~10.2k lines incl. demo data), plus
`api/notion.js`, `public/where-it-went-sw.js`, and the DS components it consumes.

**Method.** Full read of all 42 source files; `npm test` (152 files / 1586 tests — pass),
`npm run typecheck` (**fails**, see T-4), `npx eslint src/where-it-went` (21 errors, 2 warnings),
plus a throwaway probe test that exercised `TransactionForm` → `App.handleAddTransaction`,
the subscription date pipeline, and `formatCurrency`. Findings marked **[verified]** were
reproduced by running code, not just read.

---

## 0. Verdict

The app is feature-rich and visually finished, but it has **not been exercised against a live
Notion workspace end-to-end**. The single most-used action in the app — adding a transaction
from the "+" button — throws before it reaches Notion. Several other paths (clearing the
config, subscription auto-posting) fail in ways that are silent or produce wrong data. The
analytics layer is broad but keyword-driven and statistically loose; several headline numbers
(savings rate, 50/30/20, budget bars, MoM badges) are computed in ways that will mislead.

| Severity | Count | Theme |
|---|---|---|
| **P0 — broken / data corrupting** | 6 | Add-transaction, config clear, subscription engine, silent write failures |
| **P1 — wrong or misleading numbers** | 14 | Period handling, budgets vs period, currency rounding, unused `notes` |
| **P2 — analytics soundness** | 11 | Keyword false positives, baselines, hardcoded personal semantics |
| **P3 — perf / a11y / polish** | 18 | Chart thrash, no memoisation, unlabeled inputs, no focus trap |
| **Testing gaps** | 8 | Engine untested, orphan test, date-fragile test |

---

## 1. P0 — Blockers

### P0-1. Adding a transaction is broken (live mode throws; demo mode silently writes junk) **[verified]**
`components/TransactionForm.jsx:66` always calls the two-arg form:

```js
onSave(initialTx ? initialTx.id : null, { description, amount, ... })
```

`Dashboard`/`TransactionsList` pass `onSave(id, txData)` handlers — correct. But `App.jsx:121`
declares:

```js
const handleAddTransaction = async (tx) => { await client.addTransaction(tx); ... }
```

It receives only the **first** argument, which for a new transaction is `null`.

Probe output:
```
ONSAVE ARGS: [null,{"description":"Milk","amount":10,...}]
ADD RESULT ERROR: Cannot read properties of null (reading 'description')
```

- **Live mode:** `addTransaction(null)` throws a `TypeError` inside the fetch body builder. The
  rejection is unhandled (`handleSubmit`'s `finally` only resets `isSaving`), so the modal stays
  open with no error message and nothing is saved.
- **Demo mode:** `{ ...null }` is legal, so it pushes `{ id: 'demo_tx_…' }` with **every field
  undefined** into `DEMO_TRANSACTIONS`. That row then breaks `TransactionsList`'s description
  sort (`a.description.toLowerCase()` on `undefined`) and renders as a blank row with `NaN`.

**Fix:** `handleAddTransaction = async (_id, tx) => …`, and make `TransactionForm.handleSubmit`
surface a save error to the user instead of swallowing it.

### P0-2. `handleClear` is not defined — clearing the config crashes `Settings` **[verified by eslint `no-undef`]**
`components/Settings.jsx:41` calls `handleClear()` when the user empties token + all DB IDs and
presses Save. No such function exists in the file (the only `handleClear` in the codebase is a
local in `FilterSheet.jsx:25`). Result: `ReferenceError`, the Save handler dies, and the
documented "clear my configuration" path is unreachable.

### P0-3. Subscription auto-posting writes the wrong date, and the UI renders it as "Invalid Date" **[verified]**
`lib/useSubscriptionsEngine.js:56` stores `date.toISOString()` for a date built in **local**
time (`new Date(y, m, dayOfMonth)`).

```
new Date(2026, 6, 1).toISOString()  →  "2026-06-30T21:00:00.000Z"   // Europe/Bucharest
```

Two consequences:
1. A subscription due on the **1st** is posted to the **previous month** — it lands in the wrong
   budget period, the wrong Insights period, and the wrong monthly total.
2. Notion returns a full timestamp, and both list views do `new Date(tx.date + 'T00:00:00')`
   (`Dashboard.jsx:409`, `TransactionsList.jsx:152` and `:184`) → `"…000ZT00:00:00"` →
   **`Invalid Date`** printed in the UI.

**Fix:** write a plain `YYYY-MM-DD` string (build it from the local components) and make date
parsing tolerate both forms (`String(tx.date).slice(0,10)`).

### P0-4. Day-of-month 29–31 overflows and then permanently drifts **[verified]**
`getMissedMonths` builds candidates with `new Date(y, m, dayOfMonth)`:

```
new Date(2026, 1, 31)  →  Tue Mar 03 2026
```

A rent subscription set to the 31st posts on **3 March** for February, and the *next* candidate
is computed from that drifted date (`currentCandidate.getMonth() + 1`, `.getFullYear()`), so the
error compounds month over month. **Fix:** clamp to the last day of the target month.

### P0-5. The subscription engine has no idempotency guard
`useSubscriptionsEngine.js:60-74`: each generated transaction is written, then `lastProcessed` is
patched. If the `updateSubscription` call fails (it is caught and only `console.error`'d), or the
tab is closed mid-loop, **the next launch re-posts the same transactions**. There is no check for
an already-existing transaction with the same (subscription, month). Two devices opening the app
the same day will also double-post. Additionally, `addTransaction` is called with
`categoryId: ''` when a subscription has no category — Notion rejects `relation: [{id: ""}]` with
a 400, and (see P0-6) the failure is invisible.

### P0-6. Every Notion **write** ignores the HTTP status — failures are reported as success
`lib/notionClient.js` checks `response.ok` only inside `_fetchAllPages`. `addTransaction` (:119),
`updateTransaction` (:148), `updateCategoryLimit` (:189), `addSubscription` (:243),
`updateSubscription` (:272), `deleteTransaction` (:158), `deleteSubscription` (:283),
`addTrip`/`updateTrip`/`deleteTrip` all `return response.json()` (or nothing) regardless of a
400/401/429. Callers `await` them, see no throw, close the modal and show the optimistic result.
A rate-limited or schema-mismatched write looks exactly like a successful one until the next
reload. **This is the highest-leverage single fix in the codebase**: add an `ok` check + typed
error in one shared `_request()` helper.

---

## 2. P1 — Wrong or misleading numbers

**P1-1. Insights ignores `last_3_months` / `last_6_months`.** `lib/analytics/index.js:36-68` has
no case for them, so it falls through to `return true` — the Insights tab silently shows **all
transactions ever** while the Dashboard shows 3 months. Those two periods are also *not offered
anywhere in the UI* (`PeriodSheet.jsx` only has this month / last month / this year / all time +
month/year pickers), despite `WHERE_IT_WENT.md` claiming they were added. Either wire them into
`PeriodSheet` and `analytics`, or delete the dead branches in `Dashboard.jsx:52-59` and
`TransactionsList.jsx:53-60`.

**P1-2. `notes` is never fetched, so half the classification logic is dead.**
`fetchTransactions` (`notionClient.js:76-87`) maps description/date/amount/type/category/account/
trip/tags — **not `Notes`**, although the Notion schema documents it and the Travel, Property and
Nora engines all read `t.notes` (`analytics/index.js:173, 273, 297, 435, 457, 483`). There is
also no Notes field in `TransactionForm`. The advertised "multi-field discovery" only ever sees
description + tags.

**P1-3. Budget bars compare a *monthly* limit against *whatever period is selected*.**
`Dashboard.jsx:319-325` computes `spent` from `filteredTransactions`. Select "This year" and a
1500 limit is measured against 12 months of spending — every bar is red at 100%. Select "All
time" and it is meaningless. Budgets must either pin to the current month regardless of period,
or scale the limit by the number of months in the period (and say so).

**P1-4. Budget bars also inherit the category filter and search box.** Filter to "Dining" and
every other budget row reads *"No spending this period"* — which looks like a data problem, not a
filter effect.

**P1-5. MTD is compared against a full month.** `getTrendBadge` (`Dashboard.jsx:122`) compares
this month's partial total to last month's complete total. On the 3rd of the month the Expenses
badge shows a large green "improvement" every single time. Either annualise/pro-rate, or label it
"vs. same day last month" (the pace machinery in `comparisons.js` already knows how).

**P1-6. Currency is rounded to whole units everywhere.** **[verified]**
`lib/currency.js`: `maximumFractionDigits: 0` → `12.5 → "13 L"`, `0.4 → "0 L"`, `NaN → "NaN L"`.
In a finance app the displayed rows will not sum to the displayed total, and sub-1 amounts vanish.
Show 2 decimals (or round only in chart axes/KPI headlines), and guard `NaN`.

**P1-7. Multi-currency is fetched and then discarded.** Accounts carry `currency`
(`notionClient.js:64`) and the Notion schema has `Original Amount` / `Original Currency`, but no
component reads or writes any of them. A EUR card purchase is stored as a bare RON number the
user must convert by hand. Either implement it or drop the columns from the schema doc.

**P1-8. `Transfer` transactions are half-supported.** The schema allows `Type: Transfer` and
`fetchTransactions:81` will fall back to `Income`/`Expense` **by sign** when Type is empty. But
the form only offers Expense/Income, and no analytics path excludes transfers — so a transfer
logged as an expense on one side and income on the other inflates both totals and deflates the
savings rate. Add an explicit Transfer type that is excluded from income/expense/insights.

**P1-9. Insights renders `NaN%` for an empty or income-only period.**
`generateDeepInsights` returns `null` only when the **entire dataset** is empty
(`analytics/index.js:73`), not when the selected period is empty. So the "Not Enough Data Yet"
card almost never appears; instead the 50/30/20 panel divides by `totalExpense === 0`
(`InsightsView.jsx:234, 251, 268`) and prints `NaN%`, and the summary asserts *"You spent more
than your incoming cash flow this period."* for a period with no data at all.

**P1-10. Editing a transaction silently rewrites its Account.** `TransactionForm.jsx:27-58` runs
the keyword-based account preselector whenever `categoryId`/`selectedCat` changes — **including on
mount when editing an existing transaction**. Open a transaction that was paid from "Cash", save
it unchanged, and it becomes "Revolut". The effect must be skipped when `initialTx` is present (or
gated on a user-initiated category change).

**P1-11. Scrub deletes Trips, but the warning only mentions Transactions and Subscriptions.**
`Settings.jsx:416` vs `notionClient.js:311-316`. It also doesn't say that pages are *archived*
(recoverable from Notion's trash), and it runs unbounded sequential deletes — a 500-row ledger
will hit Notion's ~3 req/s limit, 429, and abort half-scrubbed with a generic "check console".
Same rate-limit exposure in `BudgetEditorModal` (one PATCH per changed category).

**P1-12. "Connection successful!" only proves the *Categories* DB is reachable.**
`Settings.jsx:61` tests `fetchCategories()` only. A typo'd Transactions ID saves cleanly and then
fails on the next load with the generic error card. Validate all configured IDs.

**P1-13. Demo data is hardcoded to calendar 2026 and ~190 rows are in the future.**
`models/demoData.js` spans 2026-01-01 → 2026-12-28 (386 dated rows, Aug–Dec all future as of
today). "This year"/"All time" demo totals include the future; historical baselines average over
it; and on 2027-01-01 the demo silently shows an empty "This month". Generate demo dates relative
to `now`. (Note the form blocks future dates via `max`, so the app forbids what its own demo data
does.)

**P1-14. Trip dates can be silently blanked on edit.** `TripEditorModal` binds
`trip.startDate` straight into `<input type="date">`. If Notion ever returns a datetime
(the same class of value P0-3 creates), the input renders empty and saving writes `null` over the
real dates. Also, `domain/Trip.js:validateTrip` — which catches end-before-start — **is never
called**; the modal accepts an inverted range.

Smaller ones in this tier: `Navigation.formatPeriodLabel` returns "All Time" for every
month/year/3-6-month selection (wrong tooltip); the period and filter buttons show **no
indication of the active period or of active filters**, so every number on screen can be silently
scoped; the cash-flow trend groups by `MM-DD` and sorts as a string, so a window crossing a year
boundary plots January before December (`Dashboard.jsx:232-240`); the search box matches
description+category+account in Dashboard, +amount in the list, and description+category only in
Insights — three different semantics for one field; `localStorage.setItem` is unguarded
(`App.jsx:38`, `TransactionsList.jsx:19`) and throws in Safari private mode / on quota.

---

## 3. P2 — Analytics soundness

**A-1. The savings rate punishes saving.** `metrics.js:10` computes
`savingsRate = (totalIncome - totalExpense) / totalIncome` where `totalExpense` **includes**
transfers into Investing/Savings categories (which `:39` simultaneously counts as `savingsTotal`).
Move 1000 into a brokerage and the app reports you saved *less*. Exclude savings/investment
categories from `totalExpense` for this ratio.

**A-2. The 50/30/20 rule is computed against expenses, not income.**
`InsightsView.jsx:19-21`: `targetNeeds = totalExpense * 0.5`. The canonical rule is a split of
*after-tax income*, which is what makes it able to say "you're overspending". As implemented it
can only ever say "your spending is split 50/30/20-ish", and the Savings bucket counts only
explicit investment *transactions* — never unspent income — so it reads near-0 for most users.

**A-3. Every uncategorised expense becomes a "Want".** `metrics.js:45-47` — the `else` branch.
A new user with categories that don't match the hardcoded keyword lists sees 100% Wants.

**A-4. Substring keyword matching produces obvious false positives.** All classification is
`text.includes(keyword)` over concatenated description/notes/tags:
- `'ac'` (property maintenance) matches **"contract"**, "vacation", "farmacie".
- `'bar'` (travel dining) matches **"Barcelona"**.
- `'art'` (travel shopping) matches **"apartment"**, "departure", "Carte".
- `'budget'` (car rental) matches any description containing the word budget.
- `'park'` appears in **both** transit and activities lists; `'gas'`/`'electric'` in both property
  utilities and maintenance — first-match-wins ordering silently decides.
- `'nora'`, `'kid'`, `'child'` are in the **travel activities** list, so family spending leaks
  into travel analytics.
Recommend: word-boundary regexes, a single ordered rule table, and (better) a user-editable
mapping rather than code constants.

**A-5. Historical averages divide by a fixed 3 months.** `comparisons.js:34` divides by
`HISTORICAL_MONTHS_LOOKBACK` regardless of how many of those months actually contain data. A new
user with one month of history gets an average 3× too low → `ruleCategorySpike` fires "50%+ above
your historical average" on almost everything. Divide by months with data, and suppress the rule
below a minimum sample.

**A-6. Category-spike alerts silently disappear for every period except "this month".**
`getHistoricalAverages` only populates when `currentPeriodStr === 'this_month'` (`:14`); otherwise
it returns all-zero averages and `ruleCategorySpike` returns nothing. Nothing tells the user the
rule was skipped.

**A-7. Deviation baselines include the current period and exclude quiet months.** Travel,
Property and Nora baselines (`analytics/index.js:228-234, 357-363, 519-525`) average
`monthlyTotals` over **only months that have activity**, and include the month being judged. Both
biases push the "Pattern Deviation" alert toward never firing (or firing on a single-month
history where average == current).

**A-8. Alerts are uncapped and noisy.** `ruleLargeTransaction` runs over the top-5 expenses and
can emit five alerts at once, on top of every category spike. There is no ranking, dedupe, cap, or
dismissal.

**A-9. Personal semantics are hardcoded into a general engine.** "Nora" appears as a first-class
analytics module and as a travel keyword; `generateWins` hardcodes the `'din'` (dining) category;
currency is a hardcoded `" L"` suffix; `SPORADIC_CATEGORIES` and the Needs/Wants lists are code
constants. Fine for a personal app, but it means the app can't be shared or re-templated — and the
guide advertises a de-personalised starter DB.

**A-10. Dead/no-op code in the rules layer.** `rules.js:8-9` computes `daysInMonth` and
`currentMonthPacePct` and never uses them; `summaries.js:3` accepts `alerts` and `wins` and ignores
both; `analytics/index.js:466` computes `topNoraExpenses` and discards it (a second, identical
computation follows at `:583`). All flagged by eslint.

**A-11. "Latest Transactions" relies on Notion's sort order, not its own.** `Dashboard.jsx:385`
takes `filteredTransactions.slice(0, 5)` with no sort. It happens to be right because
`fetchTransactions` requests `Date descending` and the demo array is pre-sorted — but a single
locally-appended row (or a schema without a Date sort) makes "Latest" wrong. Sort explicitly.

---

## 4. P3 — Performance

**PERF-1. Both charts are destroyed and rebuilt on every render.** `Dashboard.jsx:214` depends on
`chartData` and `:300` on `filteredTransactions` — both freshly-created arrays, so the dependency
array never matches. Every keystroke, hover state change or parent re-render tears down and
re-instantiates two Chart.js instances (with animation). Wrap the derived arrays in `useMemo`.

**PERF-2. Nothing in `Dashboard` is memoised.** `filteredTransactions` runs 4 chained `.filter()`s,
each allocating a `new Date()` per transaction, plus `categories.find()`/`accounts.find()` per
transaction for search — recomputed on every render. `previousTransactions` does it again.

**PERF-3. `InsightsView`'s `useMemo` never hits.** `App.jsx:214` passes
`filterProps={{ filterType, categoryFilter, searchQuery }}` — a new object literal each render —
and `InsightsView.jsx:9` lists it as a dependency. The entire ~650-line deep-insights engine
(which itself does linear `categories.find()` lookups inside per-transaction loops, i.e. O(n·m),
several times over) re-runs on every render. Memoise `filterProps` in `App`, and build a
`Map<categoryId, category>` once inside the engine.

**PERF-4. `new NotionClient(...)` is constructed on every `App` render** (`App.jsx:60`), which is
also why `useSubscriptionsEngine`'s effect (deps `[data, client, onDataChange]`) re-runs
constantly and needs the `hasRun` ref as a band-aid. `useMemo` it on the config fields.

**PERF-5. Every write triggers a full five-database refetch** (`loadData`). Adding one transaction
re-pulls the entire ledger. Optimistic local update + targeted refresh would be far snappier and
would reduce rate-limit exposure.

**PERF-6. `TransactionsList` renders every matching row** with no pagination or virtualisation, and
re-sorts on every render. At a few thousand transactions (the pagination fix now makes that
possible) this becomes a visibly slow tab.

**PERF-7. The resize listener isn't debounced** (`Dashboard.jsx:303-316`) and calls
`chart.update()` on every resize event.

---

## 5. Accessibility & UI

- **Form `<select>`s have no accessible name** — verified: testing-library reports the Category and
  Account comboboxes with no name at all. The `<label>`s in `TransactionForm`,
  `SubscriptionEditorModal` and `FilterSheet` are plain `<label>` elements with no `htmlFor`/`id`
  pairing. Screen-reader users get "combobox" with no context.
- **`variant="danger"` is not a real DS variant.** `ButtonVariant = 'primary' | 'secondary' |
  'ghost'` and `Button.module.css` has no `.danger` rule, so `styles['danger']` is `undefined` and
  the class is dropped. Every **Delete** button in the app (`TransactionForm`, `TripEditorModal`,
  `SubscriptionEditorModal`) and the confirm button in the DS `ConfirmModal` render with base
  styling — destructive actions don't look destructive. This is also the cause of the **currently
  failing `npm run typecheck`** (`src/ds/components/Dialogs.tsx:34,88`). Add a `danger` variant to
  the DS.
- **`BottomSheet` has no focus trap, no focus restore, and no body-scroll lock** — the page scrolls
  behind the sheet on iOS and Tab walks into the page underneath.
- **`BudgetEditorModal` is a hand-rolled overlay** (not the DS `Modal`): no Escape key, no backdrop
  click, no focus management, no `role="dialog"`. It also lists **Income categories** (a budget
  limit on Salary is meaningless) and shows the total as a bare `toFixed(0)` with no currency.
- **Clickable rows are `<li>`/`<div>` with `onClick`** (`Dashboard.jsx:390`,
  `TransactionsList.jsx:177`, subscription and trip cards in `Settings`): not focusable, no
  keyboard activation, no `role="button"`.
- **`alert()` is still used in four places** (`Dashboard.jsx:565,575`,
  `TransactionsList.jsx:239,249`, `BudgetEditorModal.jsx:48`) even though commit `41e0a0e` replaced
  native dialogs with DS modals elsewhere.
- **Alert cards use white text on `--color-warning`** (`InsightsView.jsx:80-86`) — likely below
  WCAG AA on a yellow/amber token.
- **Category colours: 15-entry hash palette** (`lib/colors.js`) — with ~20 categories collisions are
  near-certain, so two categories share a colour in the doughnut, the badges and the row edge. The
  palette is also fixed HSL (not theme-aware) and not checked for colourblind separation.
- **No `prefers-reduced-motion` handling** anywhere: the count-up odometer, 1s budget-bar
  transitions, shimmer skeleton and sheet slide-up all animate unconditionally.
- **`useCountUp` calls hooks conditionally** (early `return end` in test mode before `useState`) —
  two eslint `rules-of-hooks` errors. Return a static value from inside the hook instead, and use
  the same escape hatch for reduced motion.
- **Sticky group headers in `TransactionsList`** are all `position: sticky; top: 0` siblings inside
  a flex column — they stack on top of each other rather than pushing one another out.
- **Mobile hides the Amount column entirely** (`index.css:168-170`) — the ledger on a phone shows
  description + category with **no amounts**, which is a strange trade for a spending app.
- **Ordinal suffixes are wrong** for 21/22/23/31 in `Settings.jsx:266` ("Every 21th of month").

---

## 6. Testing

- **T-1. Orphan component + orphan test.** `components/Insights.jsx` (110 lines) is imported by
  nothing but `Insights.test.jsx`, which mocks `generateInsights` — an export that **no longer
  exists** in `lib/analytics`. The test passes and asserts nothing real. Delete both, or re-wire.
- **T-2. The analytics engine is effectively untested.** `Dashboard.test.jsx`,
  `Insights.test.jsx` and `InsightsView.test.jsx` all mock the engine; the only real coverage is
  `analytics.test.js` — two cases. `metrics.js`, `rules.js`, `comparisons.js`, `summaries.js` and
  the period filter have **zero** direct tests. P1-1 (missing 3/6-month cases) would have been a
  one-line test.
- **T-3. `analytics.test.js` is date-fragile.** It builds "last month" with
  `lastMonth.setMonth(m - 1)`, which on the 31st of a month following a 30-day month lands back in
  the *current* month (Jul 31 → Jun 31 → Jul 1), making `totalExpense` 400 instead of the asserted
  250. It will fail on 31 Mar / 31 May / 31 Jul / 31 Oct / 31 Dec. Inject a fixed `now` (the engine
  already threads one) and use `vi.setSystemTime`.
- **T-4. `npm run typecheck` currently fails** (2 errors in `src/ds/components/Dialogs.tsx`, see
  the `danger` variant above). Per CLAUDE.md this gate must be green before anything ships.
- **T-5. `npm test` passes only via the npm wrapper.** `npx vitest run src/where-it-went` fails
  with `Cannot read properties of undefined (reading 'setItem')` at `TransactionsList.jsx:19` —
  the suite depends on `NODE_OPTIONS=--no-experimental-webstorage`. Guarding the `localStorage`
  writes would make the tests environment-independent (and fix the Safari-private-mode crash).
- **T-6. No tests at all** for `notionClient` (pagination, property mapping, error paths),
  `useSubscriptionsEngine` (all four P0 bugs are pure functions and trivially testable),
  `TransactionForm` (would have caught P0-1), `currency`, `BudgetEditorModal`, or `App`.
- **T-7. `TransactionsList.test.jsx` verifies nothing about ordering** — its own comment admits it
  only checks "it didn't crash". Assert the rendered row order.
- **T-8. `SubscriptionEditorModal.test.jsx` imports `fireEvent` and never uses it** (eslint) — a
  hint that the interaction case was never written.

---

## 7. Market comparison — what WhereItWent is missing

Benchmarks: YNAB, Monarch Money, Copilot, Lunch Money (commercial); Actual Budget, Firefly III,
ezBookkeeping (self-hosted, closest in spirit to a BYO-Notion app).

**Table stakes that are absent:**

| Feature | Who has it | Why it matters here |
|---|---|---|
| **Account balances / net worth** | all of them | WhereItWent has an Accounts DB but *no balances* — it can tell you what you spent, never how much you have. The single biggest gap. |
| **Split transactions** | YNAB, Lunch Money, EveryDollar | A supermarket run that is half groceries, half household currently must be entered twice. |
| **CSV / OFX / QIF import** | Lunch Money, Actual, Skwad, Monarch | The realistic substitute for bank sync in a BYO app; today every row is hand-typed. |
| **Export (CSV/PDF)** | Spendee, Lunch Money, CountAbout | Notion is the store, but there's no in-app export or report. |
| **Rules / auto-categorisation** | Lunch Money, Copilot, Firefly III | Would replace the hardcoded keyword lists in §3 with something the user owns. |
| **Recurring/bill reminders + upcoming calendar** | Spendee, Monarch, YNAB | The subscriptions engine *posts* charges but never *warns* — and `src/shared/notify/` already exists in this repo. |
| **Rollover / envelope budgeting** | YNAB, Actual | Current budgets are flat monthly caps with no carry-over and no "assign every leu a job". |
| **Non-monthly budget periods & per-category periods** | YNAB, Actual | Annual costs (insurance, taxes) can't be budgeted sanely today. |
| **Goals / savings targets** | Monarch, YNAB, Copilot | Insights measure a savings rate but there's nothing to save *toward*. |
| **Multi-currency with live FX** | Spendee, Lunch Money (160+), Firefly III | Schema fields exist (`Original Amount/Currency`), code doesn't. |
| **Receipt / document attachments** | Toshl, CountAbout | Notion supports file properties and the repo already has `api/notion-upload.js`. |
| **Tags UI** | Lunch Money | Tags are fetched and written but there is no way to edit them in the form. |
| **Cash-flow forecast / projection** | Monarch, Copilot | The subscription data makes a 30/60/90-day forecast almost free. |
| **Duplicate detection & merge** | Monarch, Lunch Money | Directly relevant given P0-5. |
| **Offline support / optimistic writes** | Actual (local-first), all mobile apps | The SW caches only GETs; offline the app shows the shell then the error card. |
| **Undo** | Lunch Money, most mobile apps | Deletes are archived in Notion but there's no in-app undo. |
| **Household / shared access** | Monarch, YNAB | Out of scope for a personal BYO app, but worth an explicit "no" in the docs. |

**Where WhereItWent already beats the field:** the Notion-as-database BYO model (no vendor lock-in,
no subscription, data lives somewhere you already work), the narrative/editorial insight summaries,
and the domain-specific dashboards (Travel/Property/family support) that generic apps don't offer.
Those are the differentiators worth protecting — which is exactly why the classification quality
issues in §3 matter more than they would in a generic app.

---

## 8. Suggested order of work

1. **Ship-blockers:** P0-1 (add transaction), P0-2 (`handleClear`), P0-6 (write-status checking).
   Add a regression test for each.
2. **Subscription engine rewrite:** P0-3/4/5 — pure functions, cheap to test, currently corrupting
   the ledger every month.
3. **Period correctness:** P1-1 (Insights period gap + PeriodSheet options), P1-3/4 (budget scope),
   P1-5 (MTD comparisons), P1-9 (empty-period NaN).
4. **Money display:** P1-6 (decimals + NaN guard) — one file, everything downstream benefits.
5. **The `danger` variant + accessible labels + focus trap** — small, high-visibility polish;
   also unblocks `npm run typecheck`.
6. **Perf pass:** memoise `filterProps`, `filteredTransactions`, `chartData`, and the client.
7. **Analytics soundness:** savings rate, 50/30/20 basis, keyword word-boundaries, baseline maths.
8. **Test debt:** delete the orphan, freeze the clock, cover `notionClient` + the subscription
   engine + `TransactionForm`.
9. **Feature gaps, in likely value order:** account balances/net worth → CSV import → split
   transactions → rules engine → bill reminders (reusing `src/shared/notify/`).

Sources for §7: [NerdWallet](https://www.nerdwallet.com/finance/learn/best-budget-apps),
[Forbes Advisor](https://www.forbes.com/advisor/banking/best-budgeting-apps/),
[Lunch Money features](https://lunchmoney.app/features),
[Firefly III vs Actual Budget](https://selfhostable.dev/blog/firefly-iii-vs-actual-budget-self-hosted-finance/),
[ezBookkeeping comparison](https://ezbookkeeping.mayswind.net/comparison/).
