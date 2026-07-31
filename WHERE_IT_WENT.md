# WhereItWent

WhereItWent uses Notion as its database backend. To fully use the app (beyond Demo mode), you need to create five databases in your Notion workspace and connect them to the app.

## 1. Create the Databases in Notion

Create five full-page databases anywhere in your Notion workspace with the following schemas.

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
- **Notes**: `Notes` (Text / Rich text property)
- **Tags**: `Tags` (Multi-select property)
- **Recurring**: `Recurring` (Checkbox property)
- **Reconciled**: `Reconciled` (Checkbox property) — marks if the transaction matches the bank statement.
- **Created At**: `Created At` (Created Time property)

### 1.6 Quick Templates Database
  - **Description**: `Description` (Title property)
  - **Amount**: `Amount` (Number property, formatted as number)
  - **Type**: `Type` (Select property with options: `Income`, `Expense`)
  - **Category**: `Category` (Relation property -> Connect to Categories Database)
  - **Account**: `Account` (Relation property -> Connect to Accounts Database)
- **Updated At**: `Updated At` (Last Edited Time property)

## 2. Generate a Notion Integration Token
1. Go to [Notion Integrations](https://www.notion.so/my-integrations).
2. Create a new integration, give it a name (e.g., "WhereItWent").
3. Copy the **Internal Integration Secret**.
4. In Notion, go to each of the five databases you created, click the `...` menu on the top right -> `Connections` -> `Add connections` and search for your integration name to share the database with it.

## 3. Configure the App
Open the WhereItWent application and navigate to the **Settings** tab.

Enter the following:
- **Notion Integration Token**: The secret you copied in step 2.
- **Transactions Database ID**: The ID from your Transactions database URL.
- **Categories Database ID**: The ID from your Categories database URL.
- **Accounts Database ID**: The ID from your Accounts database URL.
- **Subscriptions Database ID**: The ID from your Subscriptions database URL.
- **Trips Database ID**: The ID from your Trips database URL (e.g., `3a8d3e6d60db81ec9b43f3c7cb9c0c4a`).

*(To find a database ID, look at its Notion URL: `https://www.notion.so/{workspace}/<DATABASE_ID>?v=...`. The ID is the 32-character string before the `?v=`)*

Click **Save Configuration**. The app will now read and write directly to your Notion workspace!


## 4. Features Overview

### Dashboard & Analytics
- **Time-Period Filtering**: `This Month`, `Last Month`, `Last 3 Months`, `Last 6 Months`, `This Year` or `All Time`, adjusting the KPIs, charts and Insights together. Optimized for mobile with compact sizing.
- **KPIs**: View total Income, Expenses, and Net Cash Flow for the selected period. Displayed on a touch-friendly, horizontally scrollable row for mobile devices to prevent wrapping.
- **Budget Limits**: Track spending against a limit per category, set **per month, per quarter or per year** — optionally anchored to a renewal date, and optionally carrying unspent room (and overspend) into the next period. Each bar is labelled with its own window (`Jul 2026`, `Q3 2026`, `2026`) and is measured against that window regardless of the selected period or filters. Edit limits, periods and rollover from "Edit Budgets"; changes sync back to your Notion Categories database.
- **Expense Breakdown Chart**: A highly responsive, animated `Chart.js` Doughnut visualization of spending by category, themed to match the app's aesthetic. Features deterministic category coloring that creates a cohesive color language across the entire app.
- **Cash Flow Trend Visualization**: A `Chart.js` Bar chart showing daily (or monthly) spending and income patterns over the selected time period. Features mathematical trend lines (Moving Average, Linear Regression Trajectory, or Smooth Curves) controllable via a Segmented Control in Settings to visualize spending momentum.
- **Aesthetic Refinements (Round 3 Polish)**: 
  - Implementation of a global typography update adopting the highly readable, modern `Outfit` font to impart a slick, premium feel.
  - A frosted-glass (`backdrop-filter: blur()`) sticky header for deep dimensional scrolling.
  - Animated, fintech-style "Odometer" number counters for Dashboard KPIs (`useCountUp` hook).
  - Tactile, hover-responsive row states across all lists with Category Color Edge Bleeds for rapid visual scanning.
  - **Premium Visual Flair (Opt-in via Settings):**
    - **Ambient Mesh Glow:** Animated, hardware-accelerated blurred gradients mapped to accent colors in the background.
    - **Glassmorphism Elevation:** Translucent UI cards (`backdrop-filter: blur(16px)`) that float over the ambient mesh.
    - **Staggered Waterfall Entrances:** CSS-driven cascading load animations for data sections.
    - **Reactive Hover States:** Soft, metric-tinted (green/red) glow shadows on touch/hover, strictly guarded by `@media (hover: hover)` for perfect mobile degradation on devices like the Galaxy S24.

### Advanced Insights Engine
- **Monthly Reflection Highlights**: Generates beautiful, metric-driven cards summarizing the top takeaways for the month (Spending Trend, Top Discretionary Expense, Rent Coverage, and Unexpected Expenses) utilizing a clean, highly scannable UI.
- **Income Insights**: Automatically separates and tracks `Salary`, `Rent`, and `Other` income. Flags when expected monthly income has not yet been collected.
- **Smart Recurring Expense Detection**: 
  - **Subscriptions & Utilities**: Dedicated alerts for recurring bills, making sure nothing slips through the cracks.
  - **Variable Precision Guard**: Custom logic prevents false positives on highly variable "daily" categories (like `Food`, `Groceries`, `Transport`) by demanding exact amount + description matches, while allowing flexibility in categories like `Alimony` where amounts may change.
- **Investment Tracking**: Automatically detects if an investment deposit was made this month and reminds you if you haven't done so.
- **Top Increases**: Compares current month spending to the previous month on a category-by-category basis, flagging significant surges in spending.

### Transactions Management
- **Full Ledger Control**: Click on any transaction from the Dashboard or Transactions list to open a modal where you can completely edit its details (amount, category, description, date) or delete it from the Notion database entirely.
- **Global Search & Filter**: Powerful, instant search across transaction descriptions, categories, and amounts. Includes a quick category dropdown filter.
- **Multi-Column Sorting**: Sort your ledger by Date, Description, Amount, Category, or Account, in both ascending and descending order.
- **Auto-Account Preselection**: When adding a new transaction, selecting a Category (e.g., `Salary`) automatically preselects your preferred default Account (e.g., `Checking`), dramatically speeding up data entry.
- **Category Emojis**: Native Notion emojis are automatically pulled and displayed inline for each category.
- **Category Tooltips**: Add descriptions to your Notion Categories database to have them show up as helpful tooltips in the app.
- **Deterministic Color Tags**: Categories maintain the same elegant, modern color capsules across tables, charts, and lists, establishing a recognizable visual identity.
- **Slim Interface**: A highly optimized, compact design using `size="sm"` components, ensuring dense information display without horizontal wrapping.
- **Transfers** (opt-in — off by default, see Settings → Feature Toggles): a third transaction type alongside Expense/Income for money moving between your own accounts. A transfer names **both ends — From and To** — which must differ, stored as `Account` and `To Account`; the ledger renders the pair as `Cash → Revolut`. Transfers skip categorization entirely and are excluded from every income/expense total, budget, and Insights calculation, showing a `🔁 Transfer` badge and a `±` sign instead of `+`/`−`.
- **Multi-Currency Amounts with live FX**: Give an Account — or a Trip — a `Currency` other than `RON` and the amount field lets you type what you actually paid. The RON figure fills in from the **European Central Bank's rate for that transaction's date**, with the rate shown in words (`Rate: 1 EUR = 5.2353 RON (29 Jul)`). RON remains the source of truth for every total; the foreign amount is recorded alongside and shown as a secondary line in the Dashboard and the ledger. You can override the RON figure by hand — a card's own fee beats any published rate — and a trip's currency takes precedence over the account's. Rates are cached per day; offline, the last known rate is used and labelled as such.

### Subscriptions Engine
- **Automated Recurring Billing**: Added a Subscriptions Management panel in Settings that allows you to define recurring monthly payments (e.g., YouTube Premium, Netflix, Rent).
- **Subscription Management**: View active and inactive subscriptions with beautifully styled status badges. Click on any subscription to seamlessly edit its details directly in a modal.
- **Auto-Ledger Injection**: The App automatically evaluates missed payments on launch and injects them into the ledger on their correct day of the month.
- **Seamless Notion Sync**: Powered by a 4th Notion database ("Subscriptions") to persist subscription data.
- **Upcoming Activity** (on by default, see Settings → Feature Toggles): the engine *posts* each occurrence on its due date, and this *warns* you before it does — a subscription is just as often income (rent collected as a landlord) as an expense (Spotify), so nothing here assumes which. Two surfaces, neither of which adds anything to the navigation bar:
  - A **"Next 30 Days" agenda** on the Dashboard, split into Expenses and Income with a combined net total, listing every scheduled occurrence with its date and how far away it is. It also surfaces **future-dated transactions you've already logged by hand** — a hotel stay booked ahead of time, a plane ticket — not just subscriptions; an occurrence a subscription already claims is never listed twice. Like budgets, it ignores the selected period and any active filters — something due next week is due next week whether you're looking at July or at 2026. An occurrence you've already entered by hand is greyed out and marked "already recorded".
  - A **slim reminder strip** above the content, shown only when something falls inside your lead time (default 5 days, configurable in Settings → Recurring Subscriptions), signed so a charge and a payment due to you read differently at a glance. It clears itself once the transaction lands in the ledger — not dismissible, since silencing something still outstanding would hide the one thing worth being told about.
  - **Background notifications** (opt-in, Settings → Recurring Reminders): a notification when something falls inside the lead time, even with the app closed. On-device only — nothing is sent anywhere. Background delivery needs an **installed PWA on Chromium**; iOS Safari and ordinary browser tabs fall back to the in-app strip, and the settings panel says so rather than offering a toggle that can't work. Seven taps on the "Recurring Reminders" heading reveals a diagnostics panel for when a reminder goes quiet.

### Settings & Customization
- **Feature Toggles**: Customize your Dashboard by enabling or disabling specific features — the Budgeting Engine, the Cash Flow Trend chart, Transfers (see above; off by default), and Upcoming Activity (see above; on by default).
- **Theme Support**: Seamlessly toggle between Light and Dark mode using a clean, icon-based toggle switch.

### Under the Hood
- **React + Vite**: Fast, modern frontend toolchain for instantaneous HMR and optimized production bundles.
- **BYO Token Architecture**: "Bring Your Own Token" design ensures your Notion data remains completely private. The app talks directly to Notion from your local browser via a lightweight MCP proxy, with no central database.
- **Custom Design System (DS)**: Built entirely on a custom, state-of-the-art CSS custom property architecture (`--color-surface`, `--color-ink`, `--space-md`, etc.) for seamless light/dark themes and a premium aesthetic without heavy CSS frameworks.
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
- **UI Polish (2026-07-25 → 2026-07-26)**:
  - **KPI Stat Grid Layout**: Replaced horizontal flexbox + `1px` divider strips in Travel, Property, and Nora Insight card headers with responsive `auto-fit` CSS grids. KPIs now tile cleanly on all widths and never overflow horizontally.
  - **Specialty Insights Out of Grid**: Moved Travel Insights, Property Insights, and Nora Insights cards out of the shared `auto-fit` grid into standalone full-width sections inside the Explore block. Eliminates the "shifted right" overflow visible on mobile when these wide cards were treated as equal-width grid columns alongside narrow panels (Category Trends, Frequent Spending, Largest Transactions).
  - **Insights Grid Overflow Safety**: Added `overflow: hidden` and `boxSizing: border-box` to both Understand and Explore section grids so child cards can never escape the viewport on narrow screens.
  - **Dashboard Chart Title**: Moved "Expenses / Income by Category" title from inside the Chart.js canvas (where it overlapped the legend) into a standalone HTML `<h2>` heading above the chart. Legend is now positioned to the right on desktop and moves to the bottom on screens below 768 px.
  - **Add Trip Modal — No Scroll on Laptop**: Reduced form gap from `--space-md` to `--space-sm` so the Add Trip form content fits within the modal's 720 px max-height constraint without a scrollbar on standard 1080 p laptop screens.
  - **Add Trip Modal — Dates Side-by-Side on Mobile**: Changed Start Date / End Date grid from `repeat(auto-fit, minmax(140px, 1fr))` (which collapsed to two separate rows on narrow screens) to a fixed `1fr 1fr` two-column layout so both date fields always render side by side regardless of screen width.
  - **Colored Dot Removal**: Removed 8px circular legend-style dot indicators from all four breakdown lists in the Insights page (Travel, Property, Nora ×2). These were chart-legend markers with no accompanying chart, causing confusion (e.g., a red dot on "Maintenance & Repairs" that looked like a warning signal). Category emojis provide sufficient visual identity.

## Pre-Production Hardening (2026-07-26)

A complete audit and hardening pass before switching to live Notion data. 19 issues addressed across 7 files.

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
- **Future Date Prevention** (`TransactionForm.jsx`): Date input now has `max={today}`. Prevents accidentally logging transactions with future dates.
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
- **Writes**: an ordered outbox. `createOfflineClient` wraps the Notion client
  with `Object.create` (not a spread — the methods live on the class prototype),
  so every existing call site gained offline support without changing. Flushing
  **stops at the first retryable failure** rather than skipping ahead; reordering
  writes can resurrect a deleted row or edit something that doesn't exist yet.
  Anything Notion rejects outright is parked in Settings → "Changes Notion
  rejected" with the real error and Retry/Discard, never dropped silently.
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
- **The rate line reads in plain language** — `Rate: 1 EUR = 5.2353 RON
  (29 Jul)`. It previously rendered `· 1 EUR = 5.2353 L · ECB 29 Jul`, where the
  second "L" collided with the amount field's own "L" and `ECB` was unexplained.
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
    only thing that knows a charge is coming.
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
- **Currency Rounding**: Removed decimal places when displaying Lei across the application, as they were unnecessary visual noise. Currency conversions now strictly round up (`Math.ceil`) to the nearest integer.
- **Mobile Transaction Grid**: Reduced the width of the Amount column on mobile screens from 84px to 64px. Because decimals were removed, this column no longer needed extra width, allowing that space to be reclaimed for the Description field.

## Quick Templates & Smart Auto-Fill Updates
- **1-Tap Quick Entry Shortcuts**: Added Quick Templates to the Dashboard (toggled via Feature Toggles). This introduces a new Notion database (Quick Templates) to persistently store these shortcuts. Clicking a template logs a transaction with the pre-filled amount, type, category, and account using today's date instantly without opening the modal.
- **Template Management**: Provided an embedded "Edit Mode" in the Dashboard to add, modify, and delete templates natively within the app, synchronizing back to Notion.
- **Automated Database Provisioning**: In the Settings UI, added a 1-click "Initialize Database" button that dynamically uses the Notion API to create the Quick Templates Database structure as a child of the `App Databases` page, saving the user from manual schema setup.
- **Smart Duplicate Defaults**: Clicking the "Duplicate" action on any historical transaction now correctly seeds the duplication form with **today's date**, instead of the historical date, matching real-world logic that duplicated transactions usually happen *now*. It does not auto-save, preserving the opportunity to make adjustments before submission.
