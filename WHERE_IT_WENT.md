# WhereItWent

WhereItWent uses Notion as its database backend. To fully use the app (beyond Demo mode), you need to create six databases in your Notion workspace and connect them to the app — a seventh, Quick Templates, is optional (§1.6).

## 1. Create the Databases in Notion

Create full-page databases anywhere in your Notion workspace with the following schemas.

### 1.1 Accounts Database
- **Name**: `Name` (Title property). The page **icon** (an emoji) is read and shown wherever
  the account appears — dropdowns, the ledger's Account column, the transfer route. Two
  accounts may share a name if their currencies differ; the icon and the currency suffix are
  what tell them apart.
- **Type**: `Type` (Select property with options: e.g., Bank, Fintech, Cash, Broker)
- **Currency**: `Currency` (Select property with options: RON, EUR, USD, etc.)
- **Active**: `Active` (Checkbox property)

### 1.2 Categories Database
- **Name**: `Name` (Title property)
- **Type**: `Type` (Select property with options exactly as: `Income`, `Expense`)
- **Active**: `Active` (Checkbox property)
- **Description**: `Description` (Text / Rich text property, optional) — shown as a collapsible
  detail under the category picker in the transaction form.
- **Monthly Limit (RON)**: `Monthly Limit (RON)` (Number property) — despite the name this is
  the limit for **one budget period**, which is a month only when `Budget Period` says so. The
  property keeps its original name deliberately: renaming it would break every existing database.
- **Budget Period**: `Budget Period` (Select: `Monthly`, `Quarterly`, `Yearly`) — blank reads as Monthly
- **Budget Anchor**: `Budget Anchor` (Date, optional) — the renewal date a quarterly/yearly window
  counts from, e.g. insurance that renews each March. Ignored for Monthly.
- **Budget Rollover**: `Budget Rollover` (Checkbox) — carry unspent room (and overspend) forward

### 1.3 Subscriptions Database
- **Name**: `Name` (Title property)
- **Amount**: `Amount` (Number property) — always in RON, the source of truth. When
  the subscription is paid or collected in another currency, this is the converted
  figure, exactly like a Transaction's `Amount (RON)`.
- **Type**: `Type` (Select property with options: `Income`, `Expense`) — a
  subscription is just as often income (rent collected from a tenant) as an
  expense (a streaming plan).
- **DayOfMonth**: `DayOfMonth` (Number property)
- **Frequency**: `Frequency` (Select property with options: `Monthly`, `Yearly`) — blank
  reads as Monthly, same convention as Categories' `Budget Period`, so every
  subscription saved before this field existed keeps working unchanged.
- **Month of Year**: `Month of Year` (Number property, 1-12) — only meaningful when
  `Frequency` is `Yearly`; ignored for Monthly. Paired with `DayOfMonth` to pin a
  yearly charge (e.g. a March-renewing annual plan) to one calendar date a year.
- **Category**: `Category` (Relation property -> Connect to Categories Database)
- **Account**: `Account` (Relation property -> Connect to Accounts Database)
- **Active**: `Active` (Checkbox property)
- **LastProcessed**: `LastProcessed` (Date property)
- **Original Amount**: `Original Amount` (Number property) — informational only,
  same role as a Transaction's. What was actually paid or received in the
  original currency, when it isn't RON.
- **Original Currency**: `Original Currency` (Select property, same registered
  option list as Transactions' `Original Currency` — see §1.5).

### 1.4 Trips Database
- **Name**: `Name` (Title property)
- **Destination**: `Destination` (Text / Rich text property)
- **Start Date**: `Start Date` (Date property)
- **End Date**: `End Date` (Date property)
- **Status**: `Status` (Select property with options: `Planned`, `Active`, `Completed`)
- **Currency**: `Currency` (Select property — same option list as `Original Currency` below)
- **Notes**: `Notes` (Text / Rich text property)

### 1.5 Transactions Database
- **Description**: `Description` (Title property)
- **Date**: `Date` (Date property)
- **Amount (RON)**: `Amount (RON)` (Number property)
- **Original Amount**: `Original Amount` (Number property)
- **To Account**: `To Account` (Relation property -> Connect to Accounts Database) — a
  Transfer's destination; `Account` is its source. Empty for Income and Expense.
- **Original Currency**: `Original Currency` (Select property). **Every currency the app offers
  must be registered here as an option.** Notion selects are a closed vocabulary and a page update
  is atomic, so writing an unregistered option makes Notion reject the *entire* patch — silently
  dropping the amount, notes and everything else in the same write. The registered set is
  `RON, EUR, USD, GBP, CHF, PLN, HUF, CZK, BGN, TRY, SEK, NOK, DKK, JPY, CAD, AUD`, mirrored in
  `CURRENCIES` in [`lib/fx.js`](src/where-it-went/lib/fx.js). Keep the two in step.
- **Type**: `Type` (Select property with options: `Income`, `Expense`, `Transfer`)
- **Category**: `Category` (Relation property -> Connect to Categories Database)
- **Account**: `Account` (Relation property -> Connect to Accounts Database)
- **Trip**: `Trip` (Relation property -> Connect to Trips Database)
- **Reconciled**: `Reconciled` (Checkbox property) — written on every add/update. Without this
  property present, creating the very first transaction 400s and (per the atomic-patch rule
  above) the whole write is rejected, not just this field.
- **Notes**: `Notes` (Text / Rich text property)
- **Tags**: `Tags` (Multi-select property)
- **Recurring**: `Recurring` (Checkbox property)

### 1.6 Quick Templates Database (optional)
Only needed if Settings → Feature Toggles → Quick Templates is turned on. Settings has a
1-click "Initialize Database" button that creates this automatically as a child of the same
parent page as the Categories database — manual setup below is only for reference.
- **Description**: `Description` (Title property)
- **Amount**: `Amount` (Number property)
- **Type**: `Type` (Select property with options: `Income`, `Expense`, `Transfer`)
- **Category**: `Category` (Relation property -> Connect to Categories Database)
- **Account**: `Account` (Relation property -> Connect to Accounts Database)
- **Active**: `Active` (Checkbox property)

## Feature Summary (1.0 Overhaul)

- **PWA Ready**: Offline-capable app shell that can be installed on iOS, Android, or Desktop.
- **Vitest Coverage**: Robust component testing with 100% pass rates across the suite.
- **Scrub & Demo Mode**: Instantly archive live data to start fresh, and seamlessly switch between live Notion data and comprehensive local demo data for testing or showcasing the app safely without affecting your real finances.
- **Deep Insights Engine (1.0 Overhaul)**:
  - **Information Hierarchy**: Reorganized into three actionable sections: **Act** (Attention Needed & Financial Wins), **Understand** (Primary KPI Savings Rate Hero, Fixed & Structural Costs, 50/30/20 Rule, Income Sources), and **Explore** (Category Trends, Frequent Spending, Largest Transactions with Category Badges, Travel Insights, Property Insights, and Nora Insights).
  - **Travel Insights Engine**: Analyzes travel spending within any selected period without assuming single trips or itineraries. When purchases, bookings, or expenses are logged under the **Travel** category, the engine calculates period-based metrics (Total Travel Spend, Share of Budget, Average Transaction), compares spend against previous equivalent periods and historical baselines, tracks dominant subcategories, splits Prepaid vs In-Destination spending, and isolates mobility/tourism costs from normal household budgets.
  - **Property Insights Engine (Operations Dashboard)**: Tracks real estate operating performance without accounting bloat or single-property assumptions. For every headline KPI (Net Cash Flow, Rental Income, Expenses, Expense Ratio), it provides instant historical context comparing against previous equivalent periods. Features include an actionable Pattern Deviation alert identifying primary cost growth drivers, a compact Net Cash Flow Trend indicator across active months, primary operating cost highlights, percentage breakdowns for top expenses, and a deterministic Operations Executive Summary describing cash flow health and maintenance stability.
  - **Nora Insights Engine (Family Support Dashboard)**: A warm, priority-focused family support dashboard that shifts away from generic cost reporting. Features **Share of Budget** as the primary KPI with historical period comparisons, a **Primary Focus** summary highlighting dominant commitments, and a **Support Breakdown** that visually separates **Recurring Commitments** (Education & Tuition, Healthcare) from **Activities & Enrichment** (Sports, Clothing, Gifts) without judgment. Includes driver-based pattern deviation alerts with **Seasonal Recognition** (identifying expected tuition or holiday gift cycles) and a deterministic **Support Executive Summary** describing priority allocation and core support stability.
  - **Alimony & Support Auto-Elevation**: Automatically detects alimony, child support, and maintenance obligations under child/family categories (e.g., Nora), dynamically elevating them from discretionary Wants into mandatory **Needs (50%)** and **Fixed & Structural Costs**.
  - **Modular Architecture**: Decoupled analytics into dedicated modules (`metrics.js`, `comparisons.js`, `rules.js`, `summaries.js`) with historical pace comparisons and deterministic monthly editorial summaries.
  - **Mobile & Responsive Polish**: Refactored transaction ledgers with horizontal scroll safety containers to prevent column collapse on narrow viewports (360px+), optimized Settings action button stacking, and adjusted Demo Mode banner positioning to prevent collisions with the frosted-glass sticky navigation header.
  - **Global Romanian Lei Formatting (" L")**: Standardized monetary display across all components, charts, tooltips, and analytics summaries to append `" L"` (e.g., `1,250 L`) for clean, space-efficient Romanian currency depiction on mobile devices.
  - **Resilient Insights Rendering**: Updated Property and Nora analytics engines to return structured analysis objects even when 0 transactions exist in the selected time period, presenting helpful, educational empty states instead of hiding dashboard cards.
  - **Timestamp Indicator**: Real-time "Insights generated" timestamp indicating when analytics were last calculated.

## Early Hardening & Polish Pass

Predates the "Full Audit & Hardening Pass" below.

### 🔴 Blockers Fixed
- **Notion Pagination** (`notionClient.js`): Added `_fetchAllPages()` helper that loops on `has_more` + `next_cursor` with `page_size: 100`. All five fetch methods (Categories, Accounts, Transactions, Subscriptions, Trips) now retrieve unlimited records. Previously silently capped at 100 results.
- **Error UI on Failed Load** (`App.jsx`): Added `loadError` state. When the live Notion `Promise.all` fetch fails, a full-screen error card is shown with the error message, a Retry button, and an Open Settings button. Previously the app silently rendered an empty dashboard with only a `console.error`.

### 🟡 High-Priority Polish
- **ISO Date Format on Dashboard** (`Dashboard.jsx`): Transaction rows in the "Latest Transactions" preview now show formatted dates (e.g., "26 Jul 2026") instead of raw ISO strings ("2026-07-26").
- **Responsive Loading Skeleton** (`App.jsx`, `index.css`): The 3-column KPI shimmer skeleton now collapses to 1 column on mobile via the `.skeleton-kpi-grid` class, matching the real KPI card layout on narrow viewports.
- **Missing Period Filters in TransactionsList** (`TransactionsList.jsx`): Added `last_3_months` and `last_6_months` period cases that were present in Dashboard but missing in TransactionsList — previously selecting those periods showed all transactions unfiltered.
- **Budget Zero-Data Note** (`Dashboard.jsx`): When a budget category has zero spending in the current period (all bars at 0%), the amount display now shows *"No spending this period"* in italic instead of "0 L / 150 L".
- **Chart Theme Refresh on Switch** (`Dashboard.jsx`): Both chart `useEffect` dependency arrays now include `config?.theme`. Switching between dark and light mode rebuilds the charts with correct colour values immediately.
- **Income Row Visual Distinction** (`Dashboard.jsx`, `TransactionsList.jsx`): Income transaction rows now have a subtle 3–4% green surface tint across the full row in both the Dashboard preview and the full Transactions list.

### 🟢 QoL / UX Enhancements
- **InsightsView Empty State** (`InsightsView.jsx`): Removed the early `return` guard that rendered a bare text line when `insights` was null. Now renders a proper styled empty-state card with ✨ icon while still showing the header.
- **Section Header Icons** (multiple): Added emoji icons to all major section headers: 🧾 Latest Transactions, 📊/📈 Expenses/Income by Category, 💰 Budget Limits, 📊 Cash Flow Trend, 📅 Period in Review (InsightsView + Insights.jsx), ✨ Actionable Insights.
- **Period-Aware "in Review" Title** (`InsightsView.jsx`, `Insights.jsx`): "Month in Review" heading now derives from the selected period. Shows e.g. "July 2026 in Review", "Last 3 Months in Review", "2025 in Review" instead of always displaying the current calendar month.
- **Sort Grouping Separators** (`TransactionsList.jsx`): Non-date sort modes (Category, Account, Description) now show sticky group header separators — category name groups, account name groups, or alphabetical letter groups — matching the date-sort UX.
- **Chart Legend Resize Listener** (`Dashboard.jsx`): Added a `resize` event listener that updates chart legend position (`bottom` < 768 px, `right` ≥ 768 px) and axis font size when the browser window is resized or device rotated.
- **Mobile Overflow & Modal Polish** (`TransactionForm.jsx`, `SubscriptionEditorModal.jsx`, `TripEditorModal.jsx`): Added grid constraints (`minmax(0, 1fr)`) and hidden overflow handling to prevent form elements from stretching Modals beyond the screen on mobile devices. Un-nested the Type selector in Subscriptions and shortened placeholder text in Add Trip to prevent text overflow.

### 🔵 Corner Cases / Data Integrity
- **Empty Category Names Filtered** (`notionClient.js`): Categories and Accounts with blank Notion page titles are now filtered out on fetch, preventing blank `<option>` elements in the Transaction form.
- **Unknown Category Visual Callout** (`Dashboard.jsx`, `TransactionsList.jsx`): Transactions with a deleted or missing category now display a ⚠️ Unknown badge (muted styling) instead of silently falling back to the word "Unknown" in the category color. Account lookup falls back to "—" dash instead of "Unknown".
- **Negative Amount Prevention** (`TransactionForm.jsx`): Amount input now has `min="0"`. Negative values could corrupt Insights totals and savings rate calculations.
- **Notion Query Sort Order** (`notionClient.js`): `fetchTransactions` now sends `sorts: [{ property: 'Date', direction: 'descending' }]` so results are deterministically ordered across pagination pages.

## Full Audit & Hardening Pass (2026-07-29)

A complete audit (`WHERE_IT_WENT_AUDIT.md`) found the app had never been exercised
against live Notion end-to-end — adding a transaction, the single most-used
action, threw before it reached Notion. Every finding was fixed and covered by
tests (82 WhereItWent-specific tests, up from 30; full repo suite 1638 tests /
typecheck / eslint all green).

### 🔴 Blockers Fixed
- **Adding a transaction was completely broken**: `TransactionForm` always calls
  `onSave(id, data)`; `App.handleAddTransaction` took a single `tx` argument, so
  it received `id` (`null`) and threw on every "+ Add". Demo mode masked this by
  pushing an all-`undefined` row instead of throwing. Fixed in `App.jsx`.
- **`Settings.handleClear` did not exist**: emptying the config and saving called
  a function that was never defined anywhere in the file — a `ReferenceError`
  that left the "disconnect" flow permanently broken. Implemented.
- **Subscriptions posted to the wrong month and rendered "Invalid Date"**: the
  engine wrote `date.toISOString()` for a locally-built date, shifting a 1st-
  of-month charge into the previous month east of UTC; list views then parsed
  the resulting full timestamp as `+ 'T00:00:00'`. Rewrote the engine
  (`lib/useSubscriptionsEngine.js`) around plain local `YYYY-MM-DD` strings.
- **Day-of-month 29–31 overflowed and compounded**: `new Date(y, m, 31)` rolled
  a February charge into March, then seeded the *next* candidate from the
  drifted date. Now clamped to the real length of each target month.
- **No idempotency guard**: a failed `lastProcessed` write (only
  `console.error`'d) re-posted the same charges on the next launch. The engine
  now checks the ledger for an existing (description, amount, month) match
  before writing.
- **Every Notion write ignored the HTTP status**: only pagination checked
  `response.ok`; all ten write methods returned a 400/429 body as if it had
  succeeded. `notionClient.js` now routes every call through one `_request()`
  helper that throws a typed `NotionError` on failure and retries 429/5xx with
  backoff.

### 🟡 Correctness
- **One shared period module** (`lib/period.js`): Dashboard, the ledger and the
  Insights engine each had their own copy of the period-filter switch, and the
  Insights copy silently had no `last_3_months` / `last_6_months` case
  (fell through to "everything ever"). All three now share `getPeriodRange` /
  `filterByPeriod`; the picker now offers both periods.
- **Budgets are pinned to the current calendar month** regardless of the
  selected period or active filters — previously a monthly cap measured against
  "This year" turned every bar red, and filtering to one category emptied all
  the others.
- **Trend badges compare like-for-like**: a month in progress now compares
  against the *same number of days* of the previous period instead of a partial
  month vs. a complete one (which always read as a huge improvement early in
  the month).
- **Currency shows two decimals** (`lib/currency.js`): the old formatter rounded
  to whole lei (`12.50 → "13 L"`, `0.40 → "0 L"`), so a ledger's rows never
  summed to its own total. A `formatCurrencyCompact` helper covers chart axes
  and KPI headlines where rounding is fine.
- **`Notes` is now fetched and editable** — the Travel/Property/Nora classifiers
  always read it, but it was never pulled from Notion or exposed in the form.
- **Editing a transaction no longer silently rewrites its Account**: the
  keyword-based auto-picker used to fire on mount for existing transactions too.
- **Trip dates/validation**: `validateTrip` (end-before-start) is now actually
  called; a stray full timestamp in a date field no longer blanks the input.

### 🟢 Analytics Soundness
- **Savings rate no longer punishes saving**: money moved into
  Investing/Savings categories was counted as consumption *and* as savings, so
  investing lowered the reported rate. `metrics.js` excludes it from spend.
- **Keyword matching uses word boundaries**, not raw substrings: `ac` no longer
  matches inside "contract", `bar` no longer matches inside "Barcelona", `art`
  no longer matches inside "apartment" (`lib/analytics/constants.js`).
- **Historical baselines exclude the period being judged** and require ≥2
  months of real data before firing a "spike" alert — previously a single
  month of history was divided by a hardcoded 3, tripling the apparent average.
- **Alerts are ranked and capped** at 6 instead of firing one per top-5
  transaction unprompted.
- **"Biggest win" category is computed, not hardcoded to Dining.**

### 🔵 Polish & Accessibility
- Added a `danger` `Button` variant to the design system — every Delete button
  in the app was silently falling back to unstyled default CSS because
  `variant="danger"` didn't exist on `ButtonVariant` (this was also failing
  `npm run typecheck`).
- `BottomSheet` now traps focus, locks body scroll, and restores focus on close
  (matching `ds/Modal`); `BudgetEditorModal` now uses `ds/Modal` instead of a
  hand-rolled overlay and excludes Income categories.
- Every native `alert()` replaced with the DS `AlertModal`; sort headers,
  transaction rows and Settings list rows are real keyboard-operable buttons.
- `useCountUp` no longer calls hooks conditionally (was violating
  rules-of-hooks) and now respects `prefers-reduced-motion`.
- Demo data dates are now rebased onto "today" on every load instead of being
  hardcoded to a fixed calendar year — transactions never land in the future,
  and demo trips keep their intended Planned/Active/Completed spread by
  anchoring on the fixture's own "Active" trip rather than reusing the
  transaction offset.
- Mobile no longer hides the Amount column from the ledger.

## Follow-up: Contrast Fix + Transfers/Multi-Currency (2026-07-29)

- **Alert-card contrast fixed**: the "Attention Needed" cards in Insights (Category
  Spike, High Spending Pace) used solid `--color-warning`/`--color-success` fills
  with white text — roughly 2:1 contrast in dark theme, well under the WCAG AA
  4.5:1 minimum. Switched to the same tinted-background pattern already used by
  every other alert box in the app (`color-mix` background + token-colour text +
  token-colour border); measured contrast in dark theme is now 10.5–13:1.
- **Transfers** shipped as a new transaction type, gated behind a Settings →
  Feature Toggles switch that defaults **off** (most people don't need to track
  internal account-to-account moves). Turning it on adds "Transfer" to the
  type selector, hides the (inapplicable) Category field, and excludes the
  transaction from every income/expense total automatically. Editing an
  existing Transfer still works even if the toggle is later switched off, so
  disabling the feature can never silently reclassify old data.
- **Multi-currency amounts** shipped: Accounts can carry a `Currency` other than
  `RON` (the demo's Revolut account is now EUR); selecting such an account in
  the transaction form reveals an optional "Original amount" + currency pair,
  written to Notion's existing `Original Amount` / `Original Currency`
  properties and displayed as a small secondary line under the amount
  everywhere transactions are listed. Purely informational — no live FX
  conversion, and the RON amount stays the source of truth for every total.
- 20 new tests added for this pass (period/notionClient/TransactionForm/
  Settings/TransactionsList/analytics coverage of Transfers and multi-currency);
  full suite (1,651 tests), typecheck, and eslint all green; verified live
  against a running dev server including a real dark-theme contrast
  measurement.

## Roadmap Feature A: Upcoming Bills (2026-07-29)

First feature from [`WHERE_IT_WENT_ROADMAP.md`](WHERE_IT_WENT_ROADMAP.md). **No Notion
schema change** — the Subscriptions database already carried everything needed.

- **New pure module `lib/upcoming.js`.** `getUpcomingBills()` reuses `dueDateFor()`
  and `isAlreadyPosted()` from the subscriptions engine, so month-end clamping
  (day 31 in a 30-day month) and duplicate detection behave identically in both.
  The split against the engine is on `dueDate > today` and is total: the engine
  owns everything up to and including today, this owns everything after, and no
  date is ever claimed by both.
- **One entry per occurrence, not per subscription** — a 90-day horizon yields
  three rows for a monthly bill, which is what the cash-flow forecast (feature E)
  will sum.
- **`alreadyPosted` is reported, not filtered.** The agenda greys those rows out,
  the banner skips them entirely (no nagging about a bill you already entered),
  and the forecast will still count them, because the money is committed either
  way.
- **The banner is the app's one interrupt surface** and is deliberately
  dismissible — a warning you can't silence becomes furniture within a week.
  It reuses the tinted-background contrast pattern rather than a solid fill.
  Features D and G are specified to reuse this same slot so banners never stack.
- **Defaults to on**, and reads `features.upcoming !== false` so configs saved
  before this key existed opt in without a migration.
- 37 new tests (24 unit on the module with a frozen clock, 9 component, 4 on the
  new Settings controls); WhereItWent's own suite went from 106 to 132.
  Verified live against the demo fixtures at desktop and 375px: the banner
  correctly surfaced "Gym Membership · 150.00 L due in 3 days", the agenda listed
  all four upcoming charges with a −290.00 L net, dismissing stored a 24-hour
  snooze and hid only the strip, and neither surface overflowed at 375px.

## Roadmap Features B–G (2026-07-29)

The remaining six features from [`WHERE_IT_WENT_ROADMAP.md`](WHERE_IT_WENT_ROADMAP.md),
shipped in one pass after feature A. Repo suite went 1,688 → 1,820 tests.

### Schema sync (found while applying the roadmap's changes)

Auditing the five live databases against the code turned up two drifts that had
nothing to do with the new features:

- **`Monthly Limit (RON)` did not exist on the Categories database at all.** The app
  has always read it, so every budget silently came back `null` and the whole
  Budget Limits panel was dead against live Notion — it only ever worked in demo
  mode. Added.
- **Trips had no `Currency`**, needed by the new FX defaulting. Added.
- The `Currency` option lists on **Accounts** and `Original Currency` on
  **Transactions** were extended from `RON/EUR/USD` to the full 16-currency set,
  because an unregistered select option rejects the entire atomic patch.

### B — Non-monthly budget periods & per-category periods

Each category now owns its window: `Monthly`, `Quarterly` or `Yearly`, optionally
anchored to a renewal month. Annual costs (insurance, taxes) were previously
impossible to express — a 6,000 L yearly premium had to be entered as 500 L/month
and then blew the bar apart in whichever month it actually landed. Every budget
bar carries its window label (`Jul 2026`, `Q3 2026`, `2026`); without it a yearly
budget sitting at 40% reads as "40% of this month".

### C — Rollover / envelope budgeting

Per-category opt-in. **Carry is derived, never stored**: it's recomputed by
walking back over prior windows (bounded at 12, and never past the category's
first transaction). Nothing is written to Notion, so there's no second source of
truth to desync, and correcting a three-month-old transaction re-derives every
window after it automatically. Overspend carries forward as a negative — money
already spent can't be un-spent, and a clean slate each window would quietly
forgive it.

### D — Multi-currency with live FX

Rates come from **Frankfurter** (`api.frankfurter.dev`, ECB daily reference
rates, no API key), called straight from the browser. That was a structural
requirement, not a preference: `api/*.js` sits at 12/12 against the Vercel Hobby
cap, so a server-side proxy was never available. CORS was verified against a real
browser before the code was written (the older `api.frankfurter.app` host does
*not* send the headers; `api.frankfurter.dev` does).

- **The form got shorter, not taller.** The old dashed "Original amount" box
  below Account is gone; currency is now a suffix inside the Amount control, with
  a single ellipsised helper line showing the RON total and the implied rate.
  Measured on a 375×812 viewport, the edit modal went from needing a scrollbar
  (689px of content in a 622px body) to fitting exactly (592px in 592px).
- **RON stays the source of truth** for every total. Typing a foreign amount
  fills the RON figure from the rate; editing the RON figure by hand stops it
  being overwritten, because a card's own fee beats any published rate. Reopening
  a saved transaction keeps the RON figure that was saved rather than restating
  it at today's rate — but changing the foreign amount re-derives it.
- **Trip currency beats account currency**: on a trip you spend the destination's
  money whatever card settles it.
- **BGN is recordable but never converted** — Bulgaria adopted the euro and the
  ECB stopped quoting it. A missing rate can never block recording a transaction.

### E — Cash-flow forecast (Insights → "Next 90 Days")

Deliberately **not** a balance forecast: the app has an Accounts database but no
balances, so projecting a balance would mean inventing an opening figure. It
projects net flow, and says so on screen. Committed (scheduled subscriptions) and
estimated (trailing 3-month **median**, so one holiday doesn't poison three
months) are drawn as separate bar segments rather than one total, because merging
them would give a guess the same authority as a fact. Below three complete months
of history it reports low confidence and estimates nothing.

### F — Duplicate detection & merge

A review card at the top of the ledger, scanning the **whole** ledger rather than
the filtered view. Matching needs an exact amount, dates within ±3 days and a
similar normalized description; two same-amount purchases on the same day in
different categories are explicitly *not* flagged (two coffees, not a
double-entry). Merging keeps the row you pick, copies over any notes/trip/tags it
lacks, and archives the rest behind a confirmation. "Not duplicates" is remembered
device-locally rather than in Notion Tags — an unregistered multi-select option
would reject the whole patch.

### G — Offline support / optimistic writes

- **Reads**: every successful load is mirrored, so the app paints instantly and a
  failed refresh shows the cached ledger behind a "Showing data from 14:32 —
  offline" strip instead of an error card implying the data is gone.
- **Writes**: an ordered outbox, but only for **transactions** — `createOfflineClient`
  wraps `addTransaction`/`updateTransaction`/`deleteTransaction` with `Object.create`
  (not a spread — the methods live on the class prototype), so every call site for
  those three gained offline support without changing. **Subscriptions and Trips are
  not wrapped** — those writes need a live connection and fail directly while
  offline. Flushing **stops at the first retryable failure** rather than skipping
  ahead; reordering writes can resurrect a deleted row or edit something that
  doesn't exist yet. Anything Notion rejects outright is parked in Settings →
  "Changes Notion rejected" with the real error and Retry/Discard, never dropped
  silently.
- **The sharpest edge**: the subscriptions engine is now blocked while offline,
  while showing a stale snapshot, or with writes still queued. It decides what to
  post by checking the ledger for an existing charge — run it against data that
  predates the queue and that check reads a ledger missing those rows, so it
  posts every one of them a second time.
- **The service worker was not touched.** It stays cache-first for assets with
  its production-only registration guard.

### Also fixed

`demo_tx_31` and `demo_tx_32` were **duplicated ids** in the demo fixture (the
multi-currency rows added earlier reused ids already held by "Tenant Rent" and
"Salary"), which would collide on any id-based lookup. Renumbered, and the whole
fixture is now checked for duplicate ids.

## Roadmap Feature A, surface 3: background bill reminders (2026-07-29)

The last deferred piece of the roadmap. Built on `src/shared/notify/` following
[`NOTIFICATIONS.md`](NOTIFICATIONS.md)'s checklist — WhereItWent is now the
fourth app on that foundation, after Touch Grass, Sol Odyssey and Journal of
Delights. **No Notion schema change.**

- **The page owns the date maths, the worker owns almost nothing.**
  `lib/reminders.js` reuses the already-tested `getUpcomingBills` to build a
  flat snapshot (45 days of bills — deliberately wider than the lead time, since
  the worker may not be woken for days) and mirrors it into IndexedDB, which is
  the only channel a worker has, being unable to read `localStorage`.
- **One notification per bill per due date, ever.** The shared
  `shouldFireOncePerId` helper tracks a *single* last-sent id, which fits a
  one-stream nudge but not this: several bills can sit inside the lead window at
  once and each needs its own guard. `billsToNotify` uses a bounded set instead.
- **The duplicated predicate is tested against itself.** A service worker is a
  classic script and can't import the page's ES module, so `billsToNotify` is
  written twice. `lib/reminders.sw.test.js` lifts the worker's copy out of
  `public/where-it-went-sw.js` with `new Function` and runs both against the same
  cases — editing one without the other fails the suite. (Verified by breaking
  the worker copy on purpose and watching it go red.)
- **The caching half of the worker is untouched**, and registration stays gated
  on `import.meta.env.PROD`. The entry point re-arms Periodic Background Sync on
  load for anyone already opted in, because registrations don't survive every
  browser restart.
- **Honest degradation**: the toggle only reports "on" if permission actually
  came back `granted`, and explains itself when notifications are blocked or
  when background wake-ups aren't available.

### Known sharp edge (in the shared layer, not this app)

`gatherDiagnostics` awaits `navigator.serviceWorker.ready`, which never settles
when no worker has been registered — which is *always* the case in local dev,
where registration is deliberately skipped. `ReminderSettings` races it against a
3-second timeout so the button reports something useful instead of hanging
silently. The same hang affects Touch Grass, Sol Odyssey and Journal of Delights
in dev; fixing it in `src/shared/notify/periodicSync.ts` would let this local
workaround be removed.

## Enhancements (2026-08-01)

### Daily Totals in Ledger
The Transactions list now shows Income and Expense totals directly on each group's sticky header (e.g. `Income +150 L · Expense -50 L`). This provides immediate visibility into daily cash flow without needing to calculate mentally, matching the style found at the top of the list.

### UI Alignment & Smart Text Polish
- **Overall Ledger Header**: Updated the overall transaction list header to use `space-between` alignment, pushing the Income and Expense totals to the right to mirror the new daily header layout, while keeping the transaction count on the left.
- **Smart Text Entry**: Redesigned the text input to feature a fully rounded "pill" shape (`borderRadius: 99px`) to match the Insights chat input. Simplified the placeholder text to `"✨ Describe a transaction..."` to reduce visual noise.
- **Modal & Form UX Standardization**: Extracted common patterns into reusable Design System components (`FormError`, `ModalFooter`, `SelectField`). All modals and forms now use these components to guarantee consistent, safe wrapping on mobile viewports (preventing horizontal scroll) and deterministic label/input alignments.
- **Inline Validation**: Replaced silently disabled "Save" buttons with inline validation errors. Users can now click "Save" on incomplete forms to immediately see what fields require attention via a standardized `<FormError>` banner.

## Feedback pass (2026-07-29)

### Merging a duplicate failed in demo mode

`path.page_id should be a valid uuid, instead was "demo_tx_271"` — the error
named a uuid problem, but the cause was that **demo mode kept the live Notion
token**. `loadData` served the fixtures while the client still pointed at the
real workspace, so every *write* went to Notion carrying a fixture id. Editing
or deleting any demo transaction hit the same wall; merging just found it first.
The client is now built with no token whenever demo mode is on, which routes
every write to its in-memory demo path and makes it impossible to touch live
data from demo mode at all.

### Duplicate detection tightened

The old rules flagged anything with a matching amount within **three days**,
which is a commute charged the same fare on Monday and Wednesday. Now:

- **The window is one day.** A real double-entry is same-day, or a
  midnight-boundary neighbour.
- **A habit index, built from the ledger itself.** For every (vendor, amount)
  pair the engine counts how many *distinct days* it appears on. A pair seen on
  three or more separate days is a fixed price — the same coffee, the same metro
  fare — where matching amounts mean nothing, so it is never flagged across
  days. A vendor whose charges vary (a taxi, a supermarket shop) landing on the
  identical figure twice stays flagged, which is exactly the distinction that
  matters. Derived from the data rather than a hardcoded vendor list, so it
  adapts to how someone actually spends.
- **Different categories no longer pair across days.** Filed differently at the
  time means they were understood as different purchases.
- **`high` now requires same day + identical description + same account.**
  Anything crossing a date boundary is a suggestion, capped at `medium`.
- **Candidate rows are clickable**, opening the full transaction so the choice
  of which copy to keep is an informed one, and each row shows its category
  icon, account and notes inline.

### Bill reminders are persistent

The banner used to snooze for 24 hours. Dismissing an *unpaid* bill hides the
one thing worth being told about and keeps it hidden, so the dismiss control is
gone: the strip clears itself when the charge lands in the ledger, and not
before. Both the strip and the agenda now show the category's own emoji.

### Layout and input polish

- **The transaction modal no longer scrolls.** Category and Account share a row
  (both are dropdowns classifying the same transaction), the row gap is 8px, and
  the FX helper is two short clamped lines instead of one crowded one. Measured
  at 920x700: 464px of content in a 464px body. At 375px the paired row falls
  back to one column and still fits.
- **The rate line reads in plain language** — `Rate: 1 EUR = 5.24 RON
  (29 Jul)` (two decimal places — `formatRateNote` in `lib/fx.js`). It previously
  rendered `· 1 EUR = 5.2353 L · ECB 29 Jul`, where the second "L" collided with
  the amount field's own "L" and `ECB` was unexplained.
- **Add Trip no longer scrolls either**: Status and Currency share a row.
- **Number inputs lost their spinner arrows.** Nobody nudges a grocery bill up
  by one leu, and the steppers ate room in a tight field. `inputMode="decimal"`
  keeps the numeric keypad on mobile.

### Two bugs found while verifying, both pre-existing

- **The nav bar overflowed its own box at every width above 650px.** It lived
  inside the 800px reading column while needing ~885px once tab labels showed —
  spilling into the centring margin, and causing real horizontal page scroll
  around 900px. It now renders outside that column so it spans the window
  naturally. (`100vw` was tried and rejected: it counts the scrollbar and
  reintroduced the overflow.) Labels stay hidden below 940px, and the mobile tab
  padding was trimmed to fix a further 11px overflow at 375px that appeared
  whenever both the filter and period buttons were showing.
- **The "lag" when tapping buttons on mobile** was the platform tap-highlight —
  a translucent box the OS paints over the control and leaves for a beat after
  the touch. Every control already has its own `:active`/`:hover` feedback, so
  the highlight is now suppressed.

## Bugfix & clarity pass (2026-07-29)

An end-to-end pass over the whole app after a week of feature work, rather than
component-by-component. Six real bugs, all found by walking flows.

### Bugs

- **First run showed sample data with nothing saying so.** The DEMO MODE banner
  keyed off an explicit `demoMode` flag, but a fresh install has no config at
  all — no token means the client falls back to the fixture, so a brand-new user
  saw a full ledger of invented transactions presented as their own. The banner
  now appears whenever the figures are samples, and offers **Connect Notion**
  when there is no connection to switch back to (the old "Stop Demo" button
  would have done nothing).
- **`handleClear` claimed demo mode without entering it.** Emptying the config
  announced "you are now in demo mode" but never set the flag, so the app served
  fixtures while the subscriptions engine, the reminder snapshot and the offline
  outbox all treated sample data as real.
- **Turning off Upcoming Bills left notifications running.** The toggle also
  hides the reminder controls, so background notifications kept arriving with no
  visible way to stop them. The mirrored snapshot now respects both the feature
  toggle and demo mode — and it writes a disabled snapshot rather than bailing
  out, so disconnecting from Notion can't leave a stale one firing.
- **KPI headline figures could sit at `0 L` forever.** `useCountUp` animates via
  `requestAnimationFrame`, which never fires in a context that isn't compositing
  — a hidden tab, a backgrounded PWA. The card showed "0 L" next to a trend badge
  reading a real percentage. A timeout now guarantees the final value.
- **Both Dashboard charts overflowed their cards.** Chart.js sizes to its parent,
  but the canvas sat directly inside a fixed-height card, so it was measured
  against the whole card rather than the space left under the heading — 423px of
  content in a 398px box on the trend chart. The doughnut had the same shape of
  bug papered over with a hardcoded `calc(100% - 45px)` (the heading is really
  ~49px). Both now use a flex column with the canvas taking the remainder.
- **Trip currency leaked from a trip that wouldn't be saved.** Switching a
  transaction from Travel to another category hides the trip picker and drops the
  trip on save, but the currency still defaulted from it.

### Clearer language

The aim was for every screen to say what it is and what to do next.

- **Feature toggles now explain themselves.** Four unlabelled switches were four
  things you had to flip to find out. Each has a one-line hint (the DS toggle
  already supported one; none were using it).
- **Empty states say what to do**, not just that something is missing: the
  budgets card explains periods and rollover, the ledger points at the period and
  filter controls, Insights explains that it compares against previous periods
  and needs history.
- **"Scrub Live Data & Demo Mode"** — which read like jargon for something
  destructive — is now **"Erase Notion data & use samples"**, and its
  confirmation says plainly that Notion keeps archived pages for 30 days.
- **Insights percentages stop being absurd.** "1452% higher than your 3-month
  average" is not readable; past 3x it now reads "15.5x your usual average".
- **"Strong cash retention"** and similar became plain English ("You kept more
  than a fifth of what came in").
- **Nora has her own avatar** instead of 👧, which renders dark-haired and
  toddler-proportioned in every emoji font.

## Notes, closed loop (2026-07-29)

`Notes` was write-only from the user's side: you typed it into the form, the
Travel/Property/Nora classifiers read it, and it was never shown or searched
again.

- **Notes are searchable** in all three places that filter transactions — the
  ledger ([`TransactionsList.jsx`](src/where-it-went/components/TransactionsList.jsx)),
  the Dashboard ([`Dashboard.jsx`](src/where-it-went/components/Dashboard.jsx)),
  and the insights engine
  ([`lib/analytics/index.js`](src/where-it-went/lib/analytics/index.js)) — which
  had to stay in step or the three views would scope a search differently. So
  "plumber" now finds the row described `Invoice 4471`.
- **The note shows in the ledger row**, one truncated line under the
  description with a 📝 marker (full text on hover).
- **Every rich-text run is joined on read.** Notion splits styled text into
  runs, so a note typed in Notion with one bold word or a link arrived as
  several runs and `rich_text[0].plain_text` cut it at the first one. The same
  one-line `plainText()` helper now covers every rich-text *and* title read in
  [`notionClient.js`](src/where-it-went/lib/notionClient.js) — a category name or
  transaction description with a styled word had exactly the same truncation.

### Modal layout, second pass (2026-07-29)

Two failures reported from a real phone, both from grid tracks that refuse to
shrink:

- **Add Trip overlapped Status with Currency.** The `SegmentedControl` has three
  fixed-width segments and will not compress, so pairing it with anything made
  the two collide. Currency now sits beside **Destination** (a plain text field
  that shrinks happily) and Status has its own full-width row again — same row
  count, no overlap.
- **End Date ran off the right edge**, because the date row used a bare
  `1fr 1fr`. A `fr` track floors at its content's min-content width, and a
  `<input type="date">` is intrinsically wide. Now `minmax(0, 1fr)`, the same
  fix applied to the transaction form earlier.
- **Add Transaction cut off Notes and the buttons when the category was Travel.**
  The trip picker was a dashed callout box with its own padding, border and
  caption — about 90px for one dropdown. It is now a plain labelled select like
  every other field, and Category/Account pair from 135px so they share a row on
  a phone too.

Measured at 375x812 with the worst case on screen at once (Travel category, a
EUR account, so both the trip picker *and* the FX rate line): 568px of content
in a 568px body, nothing clipped, Save visible. Editing an existing transaction
(which adds the Delete button) sits at 489/489, and Add Trip at 448/448.

## Transfers get two ends, plus an external-audit pass (2026-07-30)

### Transfers now record From and To

A transfer had a single `Account`, so "Revolut top-up from rent cash" lived
entirely in the description with nothing the app could reconcile. The
Transactions database gains a **`To Account`** relation (source stays in
`Account`), the form shows **From** and **To** — which must differ — and the
ledger renders the pair as `Cash → Revolut`. The old "transfers aren't
categorized" paragraph is gone; the two labelled fields say it better, and
reclaiming the row keeps the modal scroll-free.

### Account defaults are currency-aware

The picker matched on account *name* alone, so with two accounts called
"Revolut" — one RON, one EUR, a real and common setup — whichever Notion
returned first won, silently turning a domestic expense into a foreign-currency
one. Preferences are now (name, currency) pairs in `lib/accountPicker.js`:
exact name+currency first, then name alone, then whatever exists. Routing:
expenses to the RON Revolut, Salary and Loan to Checking, Rent and Gift to Cash,
Freelance to the RON Revolut.

> **Note:** the live Accounts database has no **Cash** account, so Rent and Gift
> currently fall through to Checking. Add one and they will route as intended.

The demo fixture now mirrors the real setup — two same-named Revolut accounts in
different currencies — so that disambiguation is actually exercised, plus Loan
and Gift income categories. Live Notion category pages gained emoji icons:
💰 Salary, 🔑 Rent, 🏦 Loan, 🎁 Gift.

### Findings from an external review

An outside audit (Gemini) was checked claim by claim rather than applied. Five
were valid and are fixed; two were declined with reasons.

**Valid, and worse than reported — optimistic writes were not optimistic.**
`applyLocally` existed but was *never called*, and nothing read the `pending`
flag. So an offline save enqueued the change, then `loadData` failed and fell
back to a snapshot predating it: the transaction the user had just typed
vanished until the next sync. Queued writes are now laid over whatever is
displayed, and pending rows carry a `⏳ Syncing` badge.

**Valid — the account auto-picker overwrote edits.** It skipped only the first
render, so correcting a category on an existing transaction rewrote the account
it was filed against. It no longer runs at all for an existing transaction.

**Valid — a hand-picked currency shadowed the account permanently.** Changing
the account now adopts that account's currency.

**Valid — amount sorting ignored direction.** Amounts are stored unsigned, so an
Income of 100 and an Expense of 100 compared equal. The sort is now signed, to
match the `+`/`−` the row actually shows.

**Valid, cheap — duplicate detection ignored foreign amounts.** Two foreign
charges converting to the same RON figure could pair. When both carry an
original amount, it must now match too.

**Declined — allowing zero-amount transactions.** The guard also catches an
empty form, and a 0.00 row adds noise to every total and average for a
record-keeping case Notion handles better directly.

**Declined for now — replacing bottom sheets with modals on desktop.** The split
is deliberate: sheets are for *view controls* (period, filters), modals for
*editing records*. Worth revisiting as a considered redesign, not a quick swap.

**UX findings:** the hardcoded `rgba()` status banners in Settings now derive
from `--color-danger`/`--color-success`, so a repalette reaches them;
`BottomSheet` gained a labelled close button (backdrop-tap and Escape both
worked but neither is discoverable, leaving "Apply Filters" as the only obvious
exit). The inconsistent-empty-states and raw-input findings were judged cosmetic
against native selects the app already uses elsewhere, and left.

### Layout

Focus rings are box-shadows, and `overflow-x: hidden` was clipping them off the
right-hand field of every paired row — which read as the field being cut off.
Both forms now carry 3px of horizontal padding and no clipping.

### Fixture guard

`models/demoData.test.js` now asserts that no id repeats within or across the
demo collections, and that transactions, transfers and subscriptions all point
at records that exist. Duplicate ids had already caused two silent bugs — the
reused `demo_tx_31`/`demo_tx_32`, and a new income "Gift" category given
`cat_gift`, which the expense category "Gifts" already held, so selecting Gift
as income resolved to the expense record and routed to the wrong account.

### Guide rewritten

`public/where-it-went-guide.html` was a 147-line description of a much older
app. It is now a 15-section reference (~3,700 words) covering sample mode, the
full five-database schema with every property and the closed-vocabulary
warning, transfers, foreign currency and trips, budget periods and rollover,
recurring bills and notification limits, Insights and the forecast basis,
duplicate rules, offline behaviour, a settings reference, PWA install, an
explicit list of what the app does *not* do, and a troubleshooting FAQ. Schema
tables scroll in their own containers so the page never scrolls sideways on a
phone.

## Account icons, defaults and dropdown wording (2026-07-30)

- **Account page icons are now read and displayed**, matching how category icons
  already worked. `formatAccountLabel` in `lib/accounts.js` is the single source
  for how an account is written — icon, name, and the currency suffix *only* when
  it differs from RON. It is used by the transaction form (both ends of a
  transfer included), the ledger's Account column and its group headers, the
  duplicate review, and the subscription editor. Those five had genuinely
  drifted: some appended the currency, some didn't, and none showed the icon.
- **A `Cash` account was created** in the live Accounts database. The rule
  routing Rent and Gift income to Cash had been correct since it was written, but
  there was no Cash account to route *to*, so both silently fell through to
  Checking. Live accounts also gained icons: 🏦 Checking, 📱 Revolut (RON),
  💶 Revolut (EUR), 💳 Credit Card, 💵 Cash — the EUR one deliberately different,
  since currency is the only thing distinguishing it from its namesake.
- **A transfer now starts with both ends unset**, each reading `Select…`.
  Pre-filling *From* with the first account meant the most likely mistake —
  leaving it alone — was also the easiest one. Neither end offers the account the
  other is using.
- **Dropdown placeholders are consistent**: `Select…` for a required choice
  (category, account, from, to). Optional selects say **`None`** instead — the
  trip on a transaction, and a trip's own currency — because for a nullable field
  "Select…" implies you must choose, when "not part of a trip" is a real answer.
- **The description hint follows the type**: `e.g. Salary` for income rather than
  `e.g. Groceries`, which read as though the form hadn't noticed what you were
  doing.

## Go-live audit (2026-07-30)

A full pass before switching to live Notion data — bugs, styling, and a schema
cross-check against this guide. Full suite (741 → 748 tests at this point),
typecheck and lint all green; verified live in the browser in both themes.

- **Undefined CSS custom properties**: `--color-brass`, `--color-purple`,
  `--color-primary`, `--radius-full` and `--text-md` were used across Insights,
  Dashboard, the ledger, Settings and the forecast card with no definition
  anywhere in the design system — every `var()` silently resolved to nothing,
  dropping colour, radius or font-size on ~19 rendered elements. The three with
  exact DS equivalents were renamed (`--color-accent`, `--radius-pill`,
  `--text-base`); `--color-brass` and `--color-purple` are genuinely distinct
  accent hues used consistently for the Travel and Nora cards, so they were
  added as WhereItWent-scoped tokens in `index.css` rather than collapsed into
  an existing colour.
- **Native form chrome had no theme**: `src/ds/tokens.css` never declared
  `color-scheme`, so every `<select>`'s open dropdown and every date input's
  calendar popup rendered stark default-light browser chrome regardless of the
  app's own theme. Fixed at the DS level (`color-scheme: light` / `dark`),
  which benefits every app on the shared design system, not just this one.
- **Gray form fields**: the Amount box and several hand-rolled `<select>`s
  (Category, Account, To, Trip, Currency, the budget editor's period picker)
  were filled with `--color-bg` (the page background) instead of
  `--color-surface` (what `ds/Field`'s own inputs use) — next to a real Field,
  they read as a flat grey slab. Unified across `TransactionForm`,
  `SubscriptionEditorModal`, `BudgetEditorModal` and `TripEditorModal`.
- Widened the Date/Amount gap in the transaction form (12px → 16px column gap;
  doesn't affect the documented no-scroll height budgets).
- **Add Subscription's default category** was whatever Notion returned first;
  now prefers a category literally named "Subscriptions" when one exists.
- Confirmed no schema drift between `notionClient.js` and this guide's §4, and
  confirmed demo/live data stay fully isolated (demo mode always builds the
  Notion client with an empty token, so writes silently no-op onto the
  in-memory fixture and can never reach a live workspace).

## Quality-of-life pass (2026-07-30) — the 1.0 release

Ten ideas from a fresh read of the codebase, independent of
[`WHERE_IT_WENT_ROADMAP.md`](WHERE_IT_WENT_ROADMAP.md) (which covers the seven
features shipped 2026-07-29). Nine shipped; bulk ledger actions is deliberately
deferred — see below. Full suite: 741 → 755 tests.

- **Theme follows the OS on first run** (`lib/theme.js`). The app always
  opened in dark theme regardless of the device's own setting — every other
  themed app in this repo (Journal, Wanderlist, Sol Odyssey, Daily Stoic)
  seeds its initial theme from `prefers-color-scheme`. Only affects a brand
  new install; once a theme is explicitly chosen, it always wins. An inline
  script in `where-it-went-react.html` applies it before first paint, so a
  light-mode device doesn't flash dark before React mounts.
- **"+ Add" remembers the last-used type.** Frequent income loggers
  (freelancers, landlords) used to reselect Income on every single Add. Scoped
  to *adding* — never touches what type an edit shows — and falls back
  gracefully if Transfers gets toggled off between visits.
- **"Repeat" on a ledger row** reopens Add pre-filled from that transaction —
  the same coffee, the same parking fee, without retyping it. Explicit about
  what carries over: date resets to today, notes and tags start blank (both
  are instance-specific), and the category-suggests-account effect is skipped
  entirely so a repeat can never silently swap the account you actually used.
- **A duplicate-count dot on the Transactions tab** (matching the existing
  filters-active dot), so a pending review is discoverable without already
  being on that screen. `DuplicateReview`'s dismissed-list state moved up to
  `App.jsx` so the dot clears the instant something is dismissed, not just on
  the next reload.
- **The currency picker is ordered by relevance** (`orderedCurrencies` in
  `lib/fx.js`): RON first, then the account's/trip's own currency, then
  recently-used currencies, then the rest — instead of one flat 16-item list
  every traveler scrolled through the same way regardless of which two or
  three currencies they actually use.
- **"View this trip in Insights"** on a transaction with a trip assigned jumps
  straight to the Travel Insights card with that trip pre-selected, instead of
  requiring a manual pick from the trip-filter dropdown after navigating over.
- **The Total Global Budget bar no longer mixes timescales.** Summing a
  500/month category and a 6,000/year one straight together produced "6,500" —
  a number on no coherent scale. `monthlyEquivalent()` in `lib/budgets.js`
  normalizes every category's contribution to its monthly-equivalent share
  first; the card says "(per month)" and explains itself whenever a
  non-monthly budget is in the mix.
- **Settings sections are collapsible and remember your choice.** Notion
  config, feature toggles, subscriptions and trips used to be one
  uninterrupted scroll — fine with a couple of each, unwieldy with a dozen+.
  Every section still defaults open (nothing changes for anyone who never
  touches this); a collapsed choice persists per device, so putting a section
  away is a one-time action.
- **"Copy summary" in Insights** copies the period's editorial paragraph plus
  the headline figures (income, expenses, net, savings rate) as plain text —
  for pasting into a chat or a note without screenshotting the card.
- **Deferred: bulk actions in the ledger.** Multi-select plus move-to-category
  / move-to-account / delete, for cleaning up several misfiled transactions at
  once. Scoped and designed, kept on the backlog at the user's request rather
  than shipped in this pass.

### Also fixed: the "Latest" pill on the front page

`index.html`'s app-grid card carried a manually-set `latest: true` flag per
app in `apps-registry.js` — it had drifted to **three** apps simultaneously
(WhereItWent, Click Deck, Loom), because adding a new "latest" app never
reminds you to unset it on the previous one. Replaced with a structural rule:
`APPS[0]` — new apps go at the top of the registry — is authoritative, so
there's nothing to remember and nothing that can desync again.

## Feedback pass on the 1.0 release (2026-07-30)

Real usage against the golden release surfaced seven issues. All fixed; full
suite (755 → 770 tests), typecheck and lint all green.

- **"View this trip in Insights" landed at the top of the page.** The trip
  filter *was* being pre-selected correctly, but nothing scrolled to the
  Travel Insights card — reaching it still meant scrolling past three other
  sections by hand. Fixed with a mount-only `scrollIntoView`, the same
  one-shot pattern the jump itself already used.
- **The Repeat icon was breaking the ledger's two-line-per-row limit.** It sat
  stacked below the amount pill, so a foreign-currency transaction (which
  already uses a second line for its original amount) grew a third line.
  Moved onto the amount pill's own row.
- **Form polish**: "View this trip in Insights" now shares the Trip label's
  row instead of adding one below it (the edit modal had started scrolling
  again — a regression from adding that link in the first pass). The Amount
  box gets an explicit 44px height to match `Field`'s own inputs pixel-for-
  pixel, and the Date/Amount gap widened from 12px to 24px.
- **The Upcoming banner didn't scroll to the agenda either** — same fix,
  same one-shot pattern, applied to Dashboard's `upcoming-bills-card`.
- **"Bill" language didn't fit every scenario.** A recurring subscription is
  just as often income (rent collected from a tenant) as an expense
  (Spotify) — "Upcoming Bills", "Bill Reminders" and "3 bills due soon" all
  assumed the wrong direction for half the use cases. Renamed throughout to
  "Upcoming Activity" / "Recurring Reminders" / neutral phrasing, and every
  amount shown in a reminder or banner is now signed (`+`/`−`) so the
  direction is legible without reading the word "bill" into it. The banner's
  multi-item total is now netted (income − expense) rather than summed raw,
  which had the same "6,500" mixed-timescale problem the budget total once did.
- **Subscriptions can now be recorded in another currency**, reusing the exact
  FX pattern from Add Transaction: an inline currency picker on the Amount
  field, live ECB-rate conversion to RON (using today's rate, since a
  subscription has no fixed calendar date to convert against), and an
  overridable RON figure. Two new Notion properties on the Subscriptions
  database — `Original Amount` (Number) and `Original Currency` (Select,
  same 16-currency vocabulary as Transactions) — applied directly to the live
  workspace via the Notion MCP, matching `notionClient.js`. The subscriptions
  engine carries the foreign-currency context onto whatever it auto-posts,
  so an auto-generated ledger row shows the same secondary currency line a
  manual entry would.
- **The Next 30 Days widget was sparse and under-used.** Three changes:
  - Split into **Expenses** and **Income** sections (the combined Net stays a
    single figure at the top — that's the number that actually answers "am I
    in the clear").
  - **Future-dated transactions already logged by hand** now appear alongside
    subscription occurrences — a hotel stay booked ahead of time, not just
    recurring charges. New pure function `getUpcomingTransactions()` in
    `lib/upcoming.js`, de-duplicated against subscription occurrences so
    entering next month's rent by hand can never show up twice.
  - **Deliberately not added to notifications**: a one-off future transaction
    is already visible twice over (future-dated rows sort first in the
    ledger, and now in this agenda) — a third nudge would be noise, not help.
    Background reminders stay scoped to subscriptions, where the app is the
    only thing that knows a charge is coming. They have also been reorganized
    under the "Recurring" section in Settings and renamed to "Notifications"
    for a cleaner hierarchy.
- **Verified the "Pattern Deviation" percentage math** (Travel/Property/Nora
  alerts): `((current − baseline average) / baseline average) × 100` is the
  standard "percent above" formula — "300% above average" correctly means
  4× the average, not 3×. No bug found; the baseline itself already excludes
  the period being judged and requires ≥2 months of real history, per the
  audit pass from 2026-07-29.
- **Holistic UX Upgrades**: Applied a suite of toggleable aesthetic and structural changes under the Visual Flair settings block.
  - **Modern Layout**: Toggles the navigation structure. Replaces the top navigation bar with a fixed left sidebar on desktop widths, and a sticky bottom tab bar on mobile (e.g. S24), keeping the UI clear and navigation easily reachable.
  - **Compact Density**: Tightens CSS padding and spacing variables across the app allowing more data density on screen.
  - **Sparklines**: Added background inline SVG sparkline charts to the Income, Expenses, and Net KPI cards on the dashboard, visualizing the trailing 30-day cash flow at a glance.
  - **Skeleton Loading States**: Replaced the text-based loading fallbacks in App.jsx with structured pulsating skeleton blocks mapping accurately to the component dimensions of Dashboard, Transactions, Insights, and Settings.
  - **Professional Iconography**: Migrated Dashboard emoji headers (e.g., ?? Latest Transactions, ?? Income by Category) to professional vector SVGs using the lucide-react library.
## Visual Flair and Laptop Nav Tweak
- Created a 'Visual Flair' section in Settings with a Master Toggle.
- Implemented Tactile Press States, FAB Pulse, Animated Empty States, Budget Bar Growth, Theme Transitions, and Active Tab Glow.
- Added Master Toggle support for existing legacy flair options.
- Centered the SVG and text horizontally within the navigation tabs on the laptop view.

## Transaction List Grid Alignment
- Modified grid-template-columns in mobile layout to use fixed widths for consistent vertical spreadsheet-like alignment.
- Moved the Repeat button to its own dedicated column for both mobile and desktop views.

## UI & Navigation Refinements
- **Transaction List Summary Redesign**: Extracted the transaction list summary (transaction count, total income, total expense) from the main list card into its own distinct, full-width pill matching the visual styling of the "Upcoming" banner. Spaced elements evenly (`space-between`) for clarity.
- **Mobile Navigation Header Refinements**: Changed the logo text to "WiW" on mobile screens (while retaining "WhereItWent" on desktop) and adjusted margin spacing to save horizontal space and prevent header elements from crowding the "Add" button.
- **Modern Layout Navigation Alignment**: Adjusted the desktop sidebar navigation tabs (`.layout-modern .nav-tab-btn`) from center-aligned to left-aligned (`justify-content: flex-start`). This ensures the navigation icons form a strong, clean vertical line, vastly improving visual scanning and eliminating the ragged-edge effect.
- **Settings State Initialization Fix**: Fixed a visual glitch where "Compact Density" and "Modern Layout" did not correctly reflect their toggled state when re-opening the Settings tab. They are now properly loaded into the initial component state in `Settings.jsx`.

## Automatic Trip Status Engine
- **Background Synchronization**: Implemented `useTripEngine`, a new background worker that runs once per session to evaluate trip start and end dates against the current date.
- **State Boundaries**: 
  - Trips missing dates remain unchanged.
  - Trips whose start date has arrived (but haven't passed their end date) automatically transition to **Active**.
  - Trips that have crossed the day *after* their end date automatically transition to **Completed**.
- **Notion Syncing**: Transitions are immediately persisted to the underlying Notion database via `client.updateTrip()`, ensuring the backend matches the frontend reality.
- **Safety**: Uses the same safety net as the Subscription Engine—skipping updates when offline, when showing sample data, or during pending network queues. Tests guarantee boundary edge cases behave correctly.

## Currency Formatting & UI Refinements
- **Currency Rounding**: Removed decimal places when displaying Lei across the application, as they were unnecessary visual noise. `lib/currency.js` rounds (not ceils) to the nearest integer for display; `lib/fx.js`'s `convert()` does the same for FX conversions.
- **Mobile Transaction Grid**: Reduced the width of the Amount column on mobile screens from 64px. Because decimals were removed, this column no longer needed extra width, allowing that space to be reclaimed for the Description field.

## Quick Templates & Smart Auto-Fill Updates
- **1-Tap Quick Entry Shortcuts**: Added Quick Templates to the Dashboard (toggled via Feature Toggles). This introduces a new Notion database (Quick Templates, §1.6) to persistently store these shortcuts. Clicking a template with a pre-filled amount logs a transaction with that amount, type, category, and account using today's date instantly without opening the modal; a template saved with no amount instead opens the Add form pre-filled, since there's nothing to log yet.
- **Template Management**: Provided an embedded "Edit Mode" in the Dashboard to add, modify, and delete templates natively within the app, synchronizing back to Notion.
- **Automated Database Provisioning**: In the Settings UI, added a 1-click "Initialize Database" button that dynamically uses the Notion API to create the Quick Templates Database structure as a child of the `App Databases` page, saving the user from manual schema setup.
- **Inline Edit Action**: The Edit button for templates was moved directly inline with the template pills themselves, matching their styling and maintaining horizontal alignment without breaking layout.
- **Smart Duplicate Defaults**: Clicking the "Duplicate" action on any historical transaction now correctly seeds the duplication form with **today's date**, instead of the historical date, matching real-world logic that duplicated transactions usually happen *now*. It does not auto-save, preserving the opportunity to make adjustments before submission.

  - **Transaction List Actions Layout**: Replaced the space-inefficient Flex wrap layout of the transaction selection bottom bar with a strict two-row layout on mobile and a perfectly centered single-row layout on desktop. It uses horizontally scrolling pills (`action-pill-btn`) to ensure action buttons never collapse onto a third row or wrap improperly regardless of screen size or selection count.
  - **Quick Transactions Redesign**: Upgraded the Quick Transactions pills on the Dashboard to use the same horizontal scroll pattern with translucent backgrounds and no borders, saving vertical space and looking much cleaner.
  - **Trip Export Crash Fix**: Decoupled `TripExportModal` from the global `generateDeepInsights` engine to prevent a React crash when evaluating trip data, resolving the bug that opened a blank screen. Replaced it with a fast, specialized reduce function tailored for trip exports.

## Smart Text Entry (Claude AI Integration)
- **Natural Language Parsing**: Added a sleek glassmorphic text input on the Dashboard backed by the **Claude API** (`claude-haiku-4-5-20251001`). This replaces the rigid local regex parser, allowing users to log transactions conversationally (e.g., "bought a pizza for 45 lei", "25 uber to the mall"). It instantly extracts amounts, currencies, inferring the date relative to today ("yesterday"), and mapping to the exact Categories and Accounts.
- **Voice-to-Text Dictation**: Integrated the Web Speech API directly into the text input via a microphone icon. Users can tap to dictate complex transactions verbally, which are seamlessly piped into the AI parser for evaluation without ever touching the keyboard.
- **Batch Processing**: The AI handles multiple transactions in one go. Saying "15 for lunch and 50 EUR for groceries" logs two discrete transactions perfectly classified into their respective categories and currencies instantly.
- **Context-Aware Follow-Ups & Edits**: The AI reads the last 15 recorded transactions to support conversational corrections (e.g., "change that lunch to 25 instead of 15" or "delete the last transaction"). It outputs structured `update` or `delete` actions directly mapping back to the Notion database to patch the previous entry.
- **Smart Splits**: Native support for splitting expenses on the fly. Inputting "paid 120 for dinner but Alex owes me 60" prompts the AI to log the 120 Expense while simultaneously logging a 60 Transfer/Receivable to track the owed amount automatically.
- **Subscription Detection**: Uses schema intelligence to detect when an entry sounds like a recurring bill (e.g., "Netflix 60"). The entry is logged as a normal transaction, but drops down a smart prompt asking if the user wants to officially add the merchant to the Subscriptions database with one click.
- **Chat with your Data**: On the Insights tab, users can ask questions about their spending for the active period (e.g., "What was my biggest expense?"). The AI analyzes the local JSON data of the filtered transactions and responds instantly.
- **Romanian Cultural Context**: The system prompt is explicitly primed with Romanian merchant contexts (eMAG, Sezamo, Catena, Cinema City, PPC, Enel) ensuring it understands and correctly categorizes local consumer chains without manual oversight.
- **Smart Defaults**: Ensures standard default values—currency snaps to RON unless stated otherwise, and the default "Revolut" account is utilized implicitly to prevent accidental logging against specialized accounts like "Revolut (EUR)".

## Codebase Audit Fixes (Section 1)
- **Dashboard & KPIs**: Fixed a CSS parsing error that caused KPI sparkline margins to collapse on mobile due to invalid negations (e.g., `-var(--space-md)`). Simplified upcoming bills calendar logic.
- **Currency Presentation**: Completely removed decimal places from Lei app-wide. The app now strictly rounds to integers (e.g. `Math.round`) for display, conversion math, and inputs (using `step="1"`), optimizing the UI for personal finance rather than business ledger granularity. The conversion rate string now cleanly truncates to 2 decimal places.
- **Settings State Persistence**: Resolved a bug where toggling visual flair configurations or the mathematical trend line modes would not immediately persist to local state or Notion, ensuring toggles always apply predictably.
- **API Optimization**: Completely refactored the bulk operations handler (Delete, Categorize, Reconcile) in `TransactionsList.jsx` to execute sequentially instead of heavily parallelizing requests via `Promise.all()`, mitigating Notion API `rate_limit_error` bottlenecks when selecting large batches of transactions.
- **Mobile Race Conditions**: Hardened the mobile swipe handler (`SwipeableRow.jsx`) with a `hasSwiped` ref boundary, preventing touch event propagation that mistakenly fired the transaction edit click handler immediately after a swipe-to-split gesture on devices like the S24.
- **Duplicate Subscriptions Bug**: Fixed a race condition in `useSubscriptionsEngine.js` where React 18's strict mode (or quick app reloads) could cause the background worker to mount twice simultaneously and double-post subscription entries before the first batch finished synchronizing.

## App Audit Enhancements (August 2026 - Sections 2 & 3)
- **Pull-to-Refresh**: Added Pull-to-Refresh functionality (`PullToRefresh.jsx`) to `Dashboard` and `TransactionsList` for intuitive manual synchronization on mobile devices.
- **Monthly & Yearly Summaries**: Added `MonthlyDigest` cards directly to the Insights tab, displaying Income, Expenses, Remaining, and Top Category metrics prominently for the current month and year. Removed the redundant page title from Insights.
- **Auto-Complete Suggestions**: Integrated a `datalist` dropdown in the `TransactionForm`'s Description field based on historical entries to speed up manual input.
- **Ledger Export**: Implemented a "Data Export" section in `Settings.jsx` featuring `LedgerExport.jsx`, allowing users to download their full transaction history as a clean CSV file.
- **Filtering Refactor & Duplicate Logic**: Extracted scattered filtering logic into a centralized `lib/filtering.js` for consistency across all views (Dashboard, TransactionsList).
- **Chart Reactivity & UI Polish**: Fixed Chart.js initialization in `Dashboard.jsx` to dynamically respect theme changes via `useLayoutEffect`. Added selection highlights to `PeriodSheet`. Added a visual "✈️ Trip" badge to the Date field in `TransactionForm` when a transaction belongs to a trip. Organized "Multi-Currency Totals" correctly inside the Feature Toggles section.

## 4. The AI Parser
WhereItWent includes a powerful, Claude-powered AI parser that allows you to log transactions conversationally rather than filling out forms manually.

### How it Works
When enabled in **Settings** (under **AI & Automation**), the main "Smart Text Entry" box on your dashboard switches from basic keyword matching to full natural language processing. 

The AI engine is deeply context-aware. It has real-time access to your:
- **Accounts:** (e.g., it knows if you say "paid from BCR" to route it there instead of the default Revolut account).
- **Categories:** (It uses its broad knowledge of merchants to perfectly assign "Mega Image" to Groceries or "Cinema City" to Entertainment).
- **Active Trips:** (If you log a transaction in PLN while on an active Poland trip, it links the transaction to that trip automatically).
- **Recent Transactions:** (It can understand updates and deletions to recent entries).

### What to Expect & Best Practices

1. **Title-Cased & Clean Descriptions:** The AI will automatically clean up your conversational input. It formats descriptions neatly (e.g. "Dinner at McDonald's") and strips out filler verbs ("I bought", "Paid on card").
2. **Brand Standardization:** If you type shorthand (like "McD" or "e-mag"), the parser will expand these to their official brand names ("McDonald's", "eMAG").
3. **Multi-Item Purchases:** You don't need to categorize every single item in a grocery haul. If you type *"bought milk, eggs, and bread at Mega Image for 200"*, the AI will log the description as **"Groceries at Mega Image"**, and neatly store the specific items ("milk, eggs, and bread") in the transaction's **Notes** field!
4. **Split Expenses:** The AI understands debt and splits. If you type *"Paid 100 for dinner but John owes me 50"*, the AI will create **two** transactions for you: one 100 RON Expense, and one 50 RON Income (or Transfer) representing the pending debt.
5. **Editing/Deleting:** Because it sees your recent ledger, you can just tell it to fix mistakes. Typed *"change that lunch to 20"* or *"delete the coffee expense"* and it will find the correct row and modify it in place.

### The "Examples" Feature (Few-Shot Learning)
Under the hood, the AI uses a concept called **Few-Shot Prompting**. We supply the engine with structural examples of what a perfect transaction looks like. This forces the LLM to adhere to a strict, highly organized ledger format rather than just guessing.
For example, the engine sees this exact rule under the hood:
- *Input:* "bought milk, eggs, and bread at e-mag for 200"
- *Expected:* Logs `description: "Groceries at eMAG"`, `notes: "milk, eggs, and bread"`.
This guarantees consistent, clean data across all your entries without you needing to do the manual organizing.

## Bugfix pass: Property Insights rent, and Nora-split false duplicates (2026-08-04)

Two bugs reported from real use, both traced to features that shipped without
updating the two systems that classify transactions by shape rather than by
an explicit flag: Property Insights' `isPropertyTx` and duplicate detection's
same-day/identical-description override.

- **Rent income sat at 0 L in Property Insights despite a logged "Rent"
  transaction.** `isPropertyTx` (`lib/analytics/index.js`) matched category
  names against `propert`/`rental`/`real estate` and description text against
  `propert`/`tenant`/`mortgage`/`rental` — none of which match a category
  literally named **Rent**, or a description like "Rent from Sinaia" (`rent`
  is not a substring of `rental`). Property expenses filed under Maintenance
  &amp; Repairs matched fine and looked correctly analyzed, which made the
  zeroed income line read as an isolated data problem rather than a
  classifier gap. Added `=rent` (exact word) to the category check and
  `landlord` to the text check.
- **Nora auto-split transactions were flagged as duplicates.** The manual
  **Split** modal has always appended `(Split)` to its new row's description
  specifically so duplicate detection's same-day + identical-description
  override (the one case that pairs transactions across different
  categories) doesn't catch it. `applyNoraSplit` (`lib/noraSplit.js`), added
  later, never got the same marker — an even-numbered split (2 people, 50/50)
  produces two rows with the *same* amount, same day, same account and an
  *identical* description in two different categories (the regular category
  and Nora), which is exactly what that override exists to catch. `noraTx`'s
  description now gets ` (Nora)` appended, the same convention as `(Split)`.
  Odd-numbered splits (e.g. 1/3 to Nora) were never affected, since the two
  shares aren't equal and duplicate detection buckets by exact amount first.
  Repeat was checked too — reported alongside splits as a source of false
  positives, but not found to have any beyond correctly flagging two rows
  that genuinely are identical (same description, amount, category, account,
  same-day), which is the intended behaviour.
- **Documented for the first time**: Split and the `with Nora` auto-split
  were not in `where-it-went-guide.html` at all — §14 ("Honest limits") still
  claimed *"No split transactions"*, a leftover from before either feature
  existed. Added a Split subsection to §5, corrected §14 (also documenting
  the CSV export in Settings, similarly undocumented), and added a note to
  §10 explaining why a genuine split doesn't trip the duplicate reviewer.

## Offline-audit fixes: workspace isolation, id-map durability, merge order, posting race (2026-08-04)

Five issues from an external code audit, re-verified against current code
before fixing (a couple had already been overtaken by other work — see the
"still valid" note on each below where it matters).

- **Switching Notion workspaces could leak data across them.** The snapshot
  mirror and outbox (`lib/outbox.js`) are a single, unscoped cache of
  "whatever's currently connected" — reconnecting to a different token/set of
  database ids didn't clear it, so a write still queued for workspace A could
  flush into workspace B once it finally sent, and B's first paint could
  briefly show A's cached ledger. Rather than scoping every cache key per
  workspace (real fix, much bigger surface, needs a migration), `handleConfigSave`
  now refuses to switch while anything is still queued (`canSwitchWorkspace`)
  and clears the snapshot/outbox/failed-jobs/id-map (`clearWorkspaceCache`)
  whenever the token or any database id actually changes. Simpler and
  correct for an app one person uses on one workspace at a time.
- **A partially-flushed offline sequence could lose its own id mapping.**
  `flushOutbox`'s local-id → real-Notion-id map used to live only in memory
  for the duration of one call — if an `add` succeeded and the very next
  queued `update`/`delete` for that same row hit a retryable failure, the
  next flush (next reload, or the next `online` event) started from a blank
  map and sent the stale `local_tx_*` string as if it were a real page id.
  The map is now persisted (`whereItWent_outbox_idmap`) and rehydrated at the
  start of every flush, pruned back down once nothing queued or failed still
  needs an entry.
- **Merging 3+ duplicate transactions could drop an earlier loser's rescued
  data.** `DuplicateReview`'s merge loop diffed every loser against the
  *original* survivor object, so a later loser's `mergeFields` call couldn't
  see what an earlier loser had just contributed and could overwrite it.
  Fixed by folding each merge's result into a running copy before diffing
  the next one.
- **Two devices could both post the same subscription occurrence.**
  `isAlreadyPosted` only ever checked whatever `data` the engine happened to
  have in memory — on a tab left open for hours, that's a wide window for
  another device to post the same charge first without this one noticing.
  The engine now re-fetches the ledger immediately before writing anything
  and re-checks against that fresh copy. This narrows the race a lot but
  doesn't close it entirely — Notion has no atomic check-and-write primitive
  to build true idempotency on, so a genuinely simultaneous post from two
  devices is still possible; the duplicate reviewer remains the backstop.
- **The Notion token had no session-only option.** It's always been stored
  in plaintext `localStorage` with no alternative — reasonable for a personal
  daily-use app, but a bad fit on a shared or public machine. Added
  **Settings → Connection Details → "Remember me on this device"** (on by
  default, matching every existing install's behaviour exactly): switching
  it off stores the config in `sessionStorage` instead, cleared once the tab
  closes, and clears any leftover `localStorage` copy.

## AI parser hardening (2026-08-05)

The AI Parser was deliberately left free to make its own best call on
ambiguous input — no review step before a parsed transaction saves, even for
a batch that creates several at once. That's a considered trade-off, not an
oversight, but it raises the bar on everything *around* the model's own
judgment: a hallucinated id, an unregistered currency, or a slow connection
must never be able to corrupt or block the save.

- **Foreign-currency amounts are re-derived from a live ECB rate, not the
  model's own guess.** The prompt only ever asked it for "your best estimate";
  the manual entry form has never trusted an LLM for that, and this shouldn't
  either. `lib/aiParser.js`'s `hardenTransaction` calls the same
  `fetchRate`/`convert` from `lib/fx.js` that `TransactionForm` uses, keyed on
  the transaction's own date. A missing or unavailable rate (BGN, or a network
  hiccup) falls back to the AI's figure rather than blocking the save — the
  same rule `lib/fx.js` applies everywhere else.
- **`categoryId` / `accountId` / `toAccountId` / `tripId` are validated
  against the lists actually offered**, not trusted as returned. A
  hallucinated or malformed category/trip id is dropped (the row still saves,
  just uncategorised — a one-tap fix); a bad `accountId` falls back to the
  same category-aware default `pickDefaultAccount` (`lib/accountPicker.js`)
  the manual form uses, rather than losing the whole transaction. A Transfer
  that can't resolve to two distinct real accounts is dropped outright — that
  case isn't "mostly right" the way a wrong category is.
- **`originalCurrency` is validated against the registered 16-currency
  vocabulary** (case-normalized). An unregistered value used to reach
  `notionClient` and reject the *entire* atomic write per the closed-select
  rule documented in §1.5; it's now stripped (along with `originalAmount`)
  before that can happen, falling back to a plain RON transaction instead of
  a failed save.
- **A parsed batch containing a delete now waits for one explicit
  confirmation** before anything in it runs — creates and updates alone still
  execute instantly. Every other delete path in the app (single row, bulk)
  already confirms; natural-language matching against the last 15
  transactions is exactly the kind of match that can pick the wrong row, and
  unlike a wrong amount or category, a delete has no "fix it after" recovery
  inside the app.
- **A batch failing partway through now reports exactly how far it got**
  ("1 added before this failed: …") and still refreshes the ledger to show
  what did save, instead of a flat "Failed to save changes" that hid
  successful earlier items and invited a duplicate resubmit.
- **Both Claude calls now time out** (20s) instead of leaving the input
  disabled indefinitely on a hung connection, and `askInsightsAI` gained the
  same empty-response guard `parseTextWithAI` already had.
- **Voice dictation sets its recognition language from the device's own
  locale** instead of leaving it to the browser's inconsistent default, and
  reports a clear message when microphone access is denied rather than
  silently doing nothing.

## Categories actually respect `Active` (2026-08-05)

`Active` has existed on the Categories schema since §1.2 was first written,
and `lib/aiParser.js` was already filtering on it — but `notionClient.js`'s
`fetchCategories()` never read the property off the Notion row in the first
place, so every category's `active` came back `undefined` and every filter
checking it (`!== false`) silently always passed. In the live workspace,
every Income category had `Active` checked and every Expense category
didn't — a real, deliberate-looking split that had zero effect anywhere in
the app.

- **`fetchCategories()` now reads `Active`** off the Notion page.
- **New `lib/categories.js`** (`selectableCategories`) is the one place that
  decides what a category picker offers: inactive categories are hidden from
  a *new* pick, but a category already assigned to the row being edited (or
  already applied as the ledger's filter) is never dropped — deactivating
  "Travel" can't retroactively blank the category on every trip you've
  logged, or make it impossible to filter the ledger down to just that
  category's history. Wired into `TransactionForm`, `TemplateEditorModal`,
  `SplitTransactionModal`, the bulk-categorize picker in `TransactionsList`,
  and `FilterSheet`'s category filter. `BudgetSettings` and `lib/aiParser.js`
  were intentionally left alone — the former is a management view that needs
  to show everything to let you reactivate a category, and the latter
  already had its own correct `active !== false` filter, which simply never
  had real data to filter on before.
- **Live workspace data updated to match intent**: every category is now
  `Active` except **Other**, which stays off — every other category is in
  genuine current use.

## "+ Add" defaults to Expense, "Other" always sorts last, Weekly subscriptions (2026-08-05)

Three requests from real usage, unrelated except in size.

### "+ Add" no longer remembers Income

The 2026-07-30 QoL pass added remembering the last-used type on "+ Add", so a
freelancer logging mostly Income wouldn't have to reselect it every time. In
practice one Income entry left every subsequent "+ Add" — including ordinary
everyday expenses — defaulting to Income too. Removed `whereItWent_last_add_type`
entirely; a blank "+ Add" now always opens on Expense, unconditionally.
**Repeat is unaffected** — it still reopens on the original transaction's own
type, since carrying that over is the whole point of Repeat.

### "Other" always sorts last

`notionClient.js`'s `sortCategories()` has pinned "Other" last (instead of
wherever it falls alphabetically) since categories were first fetched — but
`TransactionForm`, `TemplateEditorModal` and `SplitTransactionModal` each ran
their own plain `.sort((a, b) => a.name.localeCompare(b.name))` on top of that
correctly-ordered list, silently undoing it. New `compareCategories` in
`lib/categories.js` is now the single comparator every category list in the
app sorts with — `notionClient.js` reuses it too, so the rule can no longer
drift between the fetch-level sort and whatever a component re-sorts with.

### Weekly subscriptions

`Frequency` gains a third option alongside Monthly and Yearly, registered on
the live Notion Subscriptions database. A week doesn't fit the existing
month-cursor model at all — it needs no clamping (unlike a month, every week
has exactly seven days) and can recur several times inside one calendar
month, which the model was never built to expect:

- **`DayOfMonth` is reused for a day of week (0–6, matching `Date#getDay()`)
  when `Frequency` is Weekly** — the same "one field means something
  different depending on Frequency" convention `Month of Year` already
  established for Yearly. `SubscriptionEditorModal` swaps the number input
  for a weekday picker so this is never typed by hand.
- **New `getWeeklyDueDates`** in `lib/useSubscriptionsEngine.js` walks real
  calendar days by sevens from the first matching weekday, rather than
  reusing the month-cursor loop. With no history it starts from *this* week
  only, matching the existing "no history = just this period" rule Monthly
  ("just this month") and Yearly ("just this year") already follow — not a
  52-week backfill for a subscription that was only just added.
- **`isAlreadyPosted` had to stop matching by month for Weekly.** Its
  Monthly/Yearly matching (same description + amount within the same
  calendar month) assumes at most one occurrence a month; a Weekly
  subscription can have four or five in the same month, and month-matching
  would have silently treated all of them as duplicates of the first. Weekly
  now matches the exact date instead.
- **`lib/upcoming.js`'s forecast agenda** gained the equivalent forward-looking
  weekly walk, so the Next 30 Days card and the cash-flow forecast both
  project weekly bills correctly instead of only ever showing Monthly/Yearly
  ones.
- Settings' subscription list and the guide's schema table were updated to
  match; the live Notion `Frequency` select now has Monthly/Weekly/Yearly
  registered as options.

## Duplicate detection: two more false-positive shapes, and dropping the `(Nora)` marker (2026-08-07)

Reported from real use: a routine STB bus fare and a manually-edited Nora
split both got flagged as possible duplicates.

- **A habitual charge repeating on the *same* day was still flagged.** Once a
  vendor+amount pair is established as habitual (3+ distinct days —
  `HABITUAL_OCCURRENCES`), `scorePair` used to keep flagging it anyway if two
  occurrences landed on the same day, on the theory that a same-day repeat
  "stands out" more than a cross-day one. Backwards for a fixed-price
  habitual charge (a transit fare, a daily coffee) that can legitimately
  happen twice in a day — nothing about the same-day case distinguishes it
  from a second real purchase. `scorePair` now excludes a habitual pair
  regardless of the day gap.
- **Dropped the same-day/identical-description cross-category override
  entirely**, not just for Nora splits. It existed to catch "typed the same
  purchase twice, picked a different category by mistake" — but a
  deliberately split expense (Nora's share vs. yours, or a manual Split where
  both halves keep the parent's wording) produces the exact same shape on
  purpose: same day, same amount, same description, different category.
  There's no way to tell the two apart from these fields alone, and per this
  module's own bias, a false positive (inviting you to delete half of a real
  split) is worse than a missed one. A cross-category pair is now never
  flagged, full stop.
- **`applyNoraSplit` no longer appends ` (Nora)`** to the split-off row's
  description (2026-08-04 added it specifically to dodge the override just
  removed above) — the `Nora` category already says whose share it is, and
  the suffix was reported as redundant. Safe now that identical-description
  cross-category pairs are never flagged regardless. Existing rows with the
  old suffix are unaffected; nothing rewrites past data.

## Trip-aware transaction entry (2026-08-13)

"30 PLN for lunch at restaurant" during a Poland trip should not need the trip,
the category and the currency corrected by hand afterwards — the PLN alone says
where you are. It didn't work, and the guide had claimed it did since the
feature was written: `lib/aiParser.js` passed the model `- Name (ID: x)` and
nothing else. No dates, no status, no destination, no currency — every one of
which `fetchTrips()` already read off Notion — plus a rule saying only to link a
trip when the transaction "is associated with" one, with no definition of that.
The model could pattern-match your literal words against a trip name and
nothing more.

### The fix is prompt context, not a rule engine

The first attempt also added a deterministic layer that linked any expense
dated inside a trip's window, defaulted its currency to the trip's and forced
the Travel category. It was **removed before merge**, and the reasoning is
worth keeping: the date rule is right often enough to be tempting, but it turns
a judgment into a route, and the exceptions are real. A trip to somewhere whose
currency isn't one of the sixteen registered codes records as RON while still
being a trip. Plenty of spending inside a trip window isn't trip spending. The
model is better placed to weigh that than a date comparison — provided it is
actually told what the trips are, which is the part that was missing.

So the parser is given the facts and left to judge:

- **Trip lines carry everything.** `- Poland Autumn 2026 — Kraków, 10–17 Aug
  2026, ONGOING NOW, spends PLN (ID: …)`, sorted ongoing-first rather than in
  whatever order Notion returned. `isTripOngoing` (now in
  [`domain/Trip.js`](src/where-it-went/domain/Trip.js)) computes that label; it
  is used to *describe* trips to the model, never to decide what belongs to one.
- **Rule 14 frames trip linking as a judgment.** The date is named as the
  strongest signal and an ONGOING NOW trip as the obvious candidate for
  anything logged today, currency as corroboration and the usual tie-breaker
  between overlapping trips — explicitly *not* a requirement, since a trip that
  spends RON or lists no currency is just as much a trip. It asks for the
  exceptions to be thought about rather than the date rule applied
  mechanically, and for the field to be omitted when two trips overlap with
  nothing to tell them apart.
- **Rule 15 (trip ⇒ Travel) is stated as the app constraint it is.**
  `TransactionForm` only stores `tripId` on Travel-category transactions, so a
  trip on a Dining row is silently lost on the next save, and Travel Insights
  reads the same category. Detail goes in the description instead.
- **Rule 16 covers bare amounts.** On a trip whose currency isn't RON, an
  amount with no currency named is almost certainly the trip's currency; a
  currency the user did name always wins ("30 lei" on a Poland trip is 30 RON).
- **Rule 6 recognises currencies as words and symbols**, not just codes — zł,
  €, Ft, Kč, kr, ¥ and the rest — and says what to do with a currency outside
  the registered sixteen (record RON, put what was said in the notes) rather
  than letting an unregistered select value reject the whole atomic write.

### `lib/vendorMemory.js` — your ledger beats the hardcoded merchant list

Prompt rule 11 carries a static list of Romanian chains. It can't know that
*you* file Glovo under Groceries, or which card you actually put it on. A
vendor → (category, account) index is now derived from the whole ledger on
every parse — never stored, so there's no second source of truth and correcting
a mis-filed row re-teaches it immediately — and injected as "how this user has
filed these vendors before", which rule 11 defers to. A vendor needs 2+
sightings and a majority category to qualify, so a genuinely ambiguous venue
teaches nothing rather than being resolved by a coin toss.

It is also the one place `hardenTransaction` still contributes a *decision*
rather than validation, and only as a gap filler: when the model returns no
category at all, the vendor's usual category beats leaving the row "⚠️
Unknown". A category the model did pick always stands. The same module supplies
`preferredAccountForTrip` — when the model names no account on a trip, the card
you've actually been using there beats the "always the RON Revolut" default.

### The trip is stated, and one tap from being changed

Filing something under Travel on a trip is a judgment made from context rather
than from your words, and a judgment you can't see is one you can't correct. A
single add that came out attached to a trip now shows a card under the input —
*"Logged on ✈️ Poland Autumn 2026, under Travel, as 30 PLN"* — with **Change**,
which opens the saved transaction in the edit form. It reports what was saved,
not what a rule decided; an add with no trip keeps the plain toast.

### The keyword parser is on the same path

`parseSmartText` now detects currency words and symbols itself, and its result
runs through the same `hardenTransactions` the AI path uses — so it gains
vendor memory and live FX conversion, and the two parsers can no longer file
the same sentence differently. It still doesn't know about trips; that's the
AI path's job.

### Measured against the real model, three times over

The prompt was run against `claude-haiku-4-5` on eleven synthetic scenarios —
an ongoing PLN trip, an ongoing trip with **no currency recorded**, two
overlapping trips, and no trip at all — because a prompt nobody has run is a
guess. Two findings changed the code:

- **Guidance buried in the rules didn't survive contact.** With trip linking
  described only in rule 14, twelve rules below the trip list, currency ended
  up doing all the work: `30 PLN for lunch` linked correctly, but a bare
  `25 for coffee` mid-trip linked nothing, and the blank-currency trip never
  linked anything at all — the exact case the deterministic layer was removed
  to serve. Stating the situation **where the trips are listed** (`>>> THE USER
  IS ON A TRIP RIGHT NOW: …`) rather than as a rule to apply fixed all three.
  The callout is generated per request: one ongoing trip gets a definite
  instruction naming its id; several get "one of these, use the currency to
  tell which, omit if you can't"; a trip with no currency is told in so many
  words that this doesn't make it any less of a trip.
- **The model occasionally returns a state the schema can't hold.** Roughly one
  reply in three on an ambiguous vendor set a `tripId` while keeping a
  non-Travel category — a row the manual form would silently strip the trip
  from on its next save. `hardenTransaction` now pairs the two. This is not
  second-guessing the trip judgment (the model already made it); it resolves an
  internally inconsistent answer in favour of the field the model went out of
  its way to set.

Final measured behaviour, stable across three consecutive runs: `30 PLN`,
`30 zl` and a bare `25` during a PLN trip all land on the trip as Travel with
the right currency; a bare amount on the no-currency trip links the trip and
stays RON; `netflix 25` and an out-of-country supermarket stay off the trip;
overlapping trips with no distinguishing currency link nothing; `50 lei` on a
PLN trip stays domestic. The two judgment calls (`50 lei for a book`, a
Romanian chain mid-trip) go the way the model reads them, which is the point of
leaving them to it.

### A wider sweep, beyond trips

Thirty-four scenarios across the parser's whole surface — multi-transaction
messages, splits, edits and deletes against recent rows, relative dates,
income, transfers, account routing, merchant knowledge, subscriptions, notes
extraction, decimals, European thousands separators, foreign and *unregistered*
currencies, Romanian-language input, typos, and messages that aren't
transactions at all. Most of it already worked: `am cumparat paine si lapte de
la mega 45 lei` comes back as "Groceries at Mega Image", Food, with the items
in the notes; `1.500 lei` reads as 1500; `cofee 15` is Coffee; and a vendor the
ledger files under Food beats the general knowledge that would call it Dining.

Three defects surfaced, all now fixed:

- **A question or a greeting produced "the AI response may have been cut off.
  Try a shorter description."** The reply to "how much did I spend on food last
  month?" is `\`\`\`json\n{"transactions":[]}\n\`\`\`` *followed by a paragraph*
  explaining it can't see your data. The old fence-stripping required the fence
  to end the reply, so the trailing prose broke the parse and produced advice
  that makes no sense for a five-word message. `extractJsonObject` now tries the
  fenced block, then the raw text, then the span between the first `{` and last
  `}`, and only reports a truncation when there is genuinely no object to find.
  Rule 1 was also made categorical — the entire reply is JSON, in every
  situation, never a question back.
- **A split filed its repayment against an expense category.** "Paid 200 for
  dinner but Alex owes me 100" returned the 100 as Income *on Dining*, which
  would quietly distort that category's spending totals. Rule 3 now says to use
  an Income category or omit the field.
- **An unregistered currency silently lost the original figure.** "300 rsd for
  dinner" recorded a RON estimate with nothing recording that dinar was ever
  involved. Rule 6 now requires the original wording in the notes.

One regression was caught by re-running the sweep rather than assuming: making
rule 2 explicit about empty results *also* made the model likelier to answer in
prose when it couldn't match an edit ("change the gym membership to 200" → "I
cannot find a gym membership… please confirm"). Rules 1 and 4 were tightened
until "create it" beat "ask about it". Final state verified over two
consecutive full sweeps.

**Known weak spot:** for a currency outside the registered sixteen there is no
rate source, so the RON figure is the model's unaided guess — measured at 15
and 250 on two runs of the same "300 rsd" input, against a true value near 13.
The notes preserve what was said, but the amount can't be trusted. If a
destination becomes a regular one, the fix is to register its currency in the
Notion `Original Currency` select and in `CURRENCIES` (see §1.5), which puts it
back on live ECB rates.

39 new tests (17 vendor memory, 9 on the hardening pipeline, 6 on JSON
extraction, 5 on `isTripOngoing`, 2 on the notice card); repo suite
2,528 → 2,567, typecheck and eslint green. Verified in a browser against demo data with a PLN trip running
today, using the keyword parser: "30 zl for lunch at restaurant" recorded 30
PLN, and the trip notice card renders and opens the row. The ECB conversion
could not be exercised live (outbound calls to `api.frankfurter.dev` are
blocked in that sandbox, which is exactly the "keep the figure" fallback) and
is covered by unit test instead.

## Zero-amount foreign rows, and a modal that scrolled under scaled text (2026-08-13)

Two problems reported from a real phone, from one screenshot each. They look
unrelated and one turned out to be a consequence of the trip-aware parser
shipping earlier the same day.

### "No exchange rate was available" — while a rate was on screen

The edit form showed `73 PLN`, `0 RON`, the rate line `1 PLN = 1.22 RON
(12 Aug)`, and refused to save with *"Enter the RON amount — no exchange rate
was available to work it out automatically."* Both halves of that were wrong:
a rate was available, and the real fault was that the row had been **stored
with a RON amount of 0**.

- **How a zero gets stored.** Both write paths did `Number(tx.amount) || 0`, so
  any unparseable amount — a malformed figure from the model, an undefined
  field from a caller — became a transaction saved as 0. Nothing surfaced: the
  write succeeded and the row joined the ledger reading 0 L, counted in every
  total. `requireAmount` in [`notionClient.js`](src/where-it-went/lib/notionClient.js)
  now throws instead. Failing loudly beats a silently wrong ledger.
- **Why the parser could produce one.** `hardenTransaction` re-derives the RON
  figure from a live ECB rate, but a *failed* rate lookup falls back to the
  model's own number by design — and that number is only sanity-checked for
  creates (`!!t.amount`), never for updates. It now coerces the amount at the
  end of hardening: a create with nothing usable is dropped, an **update** has
  the field removed so the stored figure survives untouched rather than being
  zeroed, and a malformed `originalAmount` is cleared along with its currency.
- **Why the form couldn't recover.** Reopening a foreign transaction
  deliberately keeps the saved RON figure rather than restating it at today's
  rate — correct, except that 0 isn't a figure worth keeping. The rule now
  applies only to a usable one, so a broken row repairs itself from the live
  rate the moment it opens, and the message only blames the rate when the rate
  is actually missing.

**Why it appeared "suddenly":** nothing here is new. What changed is exposure —
the trip-aware parser now records trip spending in the destination's currency,
so the FX path that used to be occasional runs on every transaction logged
abroad, and a latent weakness became a daily one.

### The modal scrolled before there was anything to scroll to

Reported as "a bit of vertical scroll" *before* the error appears (scrolling
once it does is fine and expected). It didn't reproduce at the documented
375/412px measurements — because the cause isn't width. Two things:

- **The binding constraint was `max-height: min(90vh, 720px)`**, not the
  viewport. A tall handset has 780–870 CSS px of height, so the hard 720px cap
  was cutting the dialog short on exactly the devices with room to spare.
- **Android text scaling.** At a 18px root font (the common "Large" setting)
  the same content needs ~10% more height — measured 653px against 622px of
  body, an overflow of 31px; at 19px, 62px.

Fixed in [`ds/components/Modal.module.css`](src/ds/components/Modal.module.css)
for every app on the design system: below 480px the dialog is bounded by the
viewport (`92vh`) rather than the 720px cap, and the dialog padding, overlay
padding and header margin tighten by a row's worth. The cap still applies on
desktop, where a 900px-tall dialog looks absurd. Measured on the reproduced
worst case (edit modal, Travel category, trip picker, FX line, Delete button)
at a 786px viewport: **fits with no scroll at 16, 18 and 19px root font**,
where before it overflowed at 18px and above. A 700px viewport at 18px still
overflows by 35px — that much content genuinely doesn't fit, and it scrolls
rather than clipping.

## Confirmation messages: a wrong figure, an overlap, and an unsaid word (2026-08-13)

Three things from one screenshot of a real trip entry.

- **The toast announced the wrong number.** `Added: ${tx.amount} ${tx.originalCurrency}`
  paired the **RON** figure with the **foreign** currency code, so a 67 PLN shop
  that converts to 82 RON was confirmed as "Added: 82 PLN" — while the ledger
  row directly below it read `−82 L (67 PLN)`. Both numbers are real, which is
  what made the mismatch read as the app disagreeing with itself. It now
  reports the figure actually spent (`Added 67 PLN · Shopping at Żabka`).
- **The toast was printed on top of the placeholder.** It's absolutely
  positioned inside the pill with no background, right-aligned, and the input
  keeps showing "✨ Describe a transaction…" underneath — fine on a wide screen
  where they sit apart, unreadable on a phone where they collide. It now starts
  after the wand icon, carries the pill's own background so it *replaces*
  rather than floats over, and ellipsises instead of colliding with the edge.
- **The trip card never said "trip".** *"Logged on ✈️ 2026 – Poland, under
  Travel"* names the trip without ever saying one was attached, leaving it
  ambiguous whether anything beyond the category had been decided — and the
  trip link is precisely the part not visible anywhere else on the row. Now:
  *"Saved — added to your ✈️ 2026 – Poland trip, filed under Travel, recorded
  as 67 PLN."*

Also: a single add that produces a trip card no longer *also* fires the toast.
The card says everything the toast did and more, and stacking them put two
overlapping messages in the same 40px of screen.

## The trip card, turned into a save notice (2026-08-14)

Two rounds on the same card, in opposite directions, and the second one is the
one that stands.

**Round one, wrong.** Reported from a phone: *"if I don't interact with this
for 4s, it goes away, dismissed."* Read as a bug, root-caused as one, and
fixed — the card really was being destroyed by a remount rather than by any
timer, and the mechanism is worth keeping on the record (below). But the
report was a *feature request*: the card **should** go, and going after four
seconds was the desired behaviour it didn't yet have.

**Round two, the actual design.** Three changes:

- **It shows for every save**, not only trip-linked ones. Every route into the
  ledger decides things you can't see from the row — category, account, trip,
  and what a foreign amount converted to — so restricting the confirmation to
  trips meant the one time the app said what it had decided was the one time
  you were abroad. Now the text box, dictation and the **+ Add** form all
  report: `Saved 30 PLN (25 L) — filed under Travel, on your ✈️ 2026 – Poland
  trip, from Revolut.`
- **It leaves by itself after `SAVE_NOTICE_MS` (4s).** A confirmation you have
  to dismiss is a chore attached to every single save — the opposite trade to
  the bill reminders, which persist because they're about something *not yet
  handled*. This one is about something already done.
- **Only Change survives as a control.** Dismissal isn't a decision worth a
  button when waiting four seconds does the same thing; being wrong about the
  figure or the filing is.

It lives in [`SaveNotice.jsx`](src/where-it-went/components/SaveNotice.jsx),
owned by `App` and rendered outside `<main>` — see below for why that matters.

### The remount, still worth knowing

`loadData` opens with `setLoading(true)`, and `App` renders
`{loading ? <SkeletonState/> : … <Dashboard/>}`, so any moment `loading` is
genuinely true the whole tab — and everything stateful inside it — is destroyed
and rebuilt. Normally the flip is invisible: `loadData` reads the mirrored
snapshot and clears `loading` in the same synchronous block, so React batches
the pair and the skeleton never paints. That only holds while a snapshot
exists, and the whole dataset has to fit in `localStorage` for one to. With
the mirror disabled in Chromium, the notice was destroyed the instant it was
set — it never even rendered.

Which is why the notice is owned by `App` and rendered outside `<main>`: not
to make it persist (it doesn't), but so its four seconds are its own rather
than however long the refresh happens to take. Anything else stateful under
`<main>` is still exposed to the same teardown.

## The footer that rearranged itself as you pressed Save (2026-08-15)

Reported from the Edit modal mid-save: the three buttons don't line up. Two
causes, both in the shared [`ModalFooter`](src/ds/components/ModalFooter.tsx),
so the fix lands for every modal that uses it — Transaction, Split, Trip,
Subscription, Template.

- **The button grew as you pressed it.** "Saving..." is wider than "Save", and
  the label was swapped outright. Both labels now sit stacked in one grid cell
  with the inactive one hidden, so the button is sized for its widest state
  from the start and nothing reflows. Written as a DS-wide rule in
  [`src/ds/README.md`](src/ds/README.md).
- **Three buttons never fit one row on a phone.** Measured at a 390px viewport:
  they need ~346px of a 327px row at the default text size, and Android's
  larger text sizes push that to ~392px. So the row wrapped — Delete stranded
  on its own line, Cancel and Save shoved right beneath it, all three different
  widths. Under 480px the footer now stacks deliberately: Cancel and Save side
  by side and equal, Delete full-width on its own row underneath, which also
  puts the destructive action somewhere other than a thumb's width from Save.

Measured before and after in Chromium at root sizes 16/18/19/20px: Cancel and
Save come out identical at every one, and idle and saving lay out the same.
