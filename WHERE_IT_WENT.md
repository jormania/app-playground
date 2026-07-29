# WhereItWent

WhereItWent uses Notion as its database backend. To fully use the app (beyond Demo mode), you need to create five databases in your Notion workspace and connect them to the app.

## 1. Create the Databases in Notion

Create five full-page databases anywhere in your Notion workspace with the following schemas.

### 1.1 Accounts Database
- **Name**: `Name` (Title property)
- **Type**: `Type` (Select property with options: e.g., Bank, Fintech, Cash, Broker)
- **Currency**: `Currency` (Select property with options: RON, EUR, USD, etc.)
- **Active**: `Active` (Checkbox property)

### 1.2 Categories Database
- **Name**: `Name` (Title property)
- **Type**: `Type` (Select property with options exactly as: `Income`, `Expense`)
- **Active**: `Active` (Checkbox property)
- **Monthly Limit (RON)**: `Monthly Limit (RON)` (Number property)

### 1.3 Subscriptions Database
- **Name**: `Name` (Title property)
- **Amount**: `Amount` (Number property)
- **Type**: `Type` (Select property with options: `Income`, `Expense`)
- **DayOfMonth**: `DayOfMonth` (Number property)
- **Category**: `Category` (Relation property -> Connect to Categories Database)
- **Account**: `Account` (Relation property -> Connect to Accounts Database)
- **Active**: `Active` (Checkbox property)
- **LastProcessed**: `LastProcessed` (Date property)

### 1.4 Trips Database
- **Name**: `Name` (Title property)
- **Destination**: `Destination` (Text / Rich text property)
- **Start Date**: `Start Date` (Date property)
- **End Date**: `End Date` (Date property)
- **Status**: `Status` (Select property with options: `Planned`, `Active`, `Completed`)
- **Notes**: `Notes` (Text / Rich text property)

### 1.5 Transactions Database
- **Description**: `Description` (Title property)
- **Date**: `Date` (Date property)
- **Amount (RON)**: `Amount (RON)` (Number property)
- **Original Amount**: `Original Amount` (Number property)
- **Original Currency**: `Original Currency` (Select property)
- **Type**: `Type` (Select property with options: `Income`, `Expense`, `Transfer`)
- **Category**: `Category` (Relation property -> Connect to Categories Database)
- **Account**: `Account` (Relation property -> Connect to Accounts Database)
- **Trip**: `Trip` (Relation property -> Connect to Trips Database)
- **Notes**: `Notes` (Text / Rich text property)
- **Tags**: `Tags` (Multi-select property)
- **Recurring**: `Recurring` (Checkbox property)
- **Created At**: `Created At` (Created Time property)
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
- **Time-Period Filtering**: Select from `This Month`, `Last Month`, `This Year`, or `All` to dynamically adjust the KPIs and charts. Optimized for mobile with compact sizing.
- **KPIs**: View total Income, Expenses, and Net Cash Flow for the selected period. Displayed on a touch-friendly, horizontally scrollable row for mobile devices to prevent wrapping.
- **Budget Limits**: Track your spending against monthly targets. View visual progress bars for individual categories and your **Total Global Budget**. You can edit your budget limits directly from the app using the "Edit Budgets" button, which automatically syncs your changes back to your Notion Categories database.
- **Expense Breakdown Chart**: A highly responsive, animated `Chart.js` Doughnut visualization of spending by category, themed to match the app's aesthetic. Features deterministic category coloring that creates a cohesive color language across the entire app.
- **Cash Flow Trend Visualization**: A `Chart.js` Bar chart showing daily (or monthly) spending and income patterns over the selected time period.
- **Aesthetic Refinements (Round 3 Polish)**: 
  - Implementation of a global typography update adopting the highly readable, modern `Outfit` font to impart a slick, premium feel.
  - A frosted-glass (`backdrop-filter: blur()`) sticky header for deep dimensional scrolling.
  - Animated, fintech-style "Odometer" number counters for Dashboard KPIs (`useCountUp` hook).
  - Tactile, hover-responsive row states across all lists with Category Color Edge Bleeds for rapid visual scanning.

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

### Subscriptions Engine
- **Automated Recurring Billing**: Added a Subscriptions Management panel in Settings that allows you to define recurring monthly payments (e.g., YouTube Premium, Netflix, Rent).
- **Subscription Management**: View active and inactive subscriptions with beautifully styled status badges. Click on any subscription to seamlessly edit its details directly in a modal.
- **Auto-Ledger Injection**: The App automatically evaluates missed payments on launch and injects them into the ledger on their correct day of the month.
- **Seamless Notion Sync**: Powered by a 4th Notion database ("Subscriptions") to persist subscription data.

### Settings & Customization
- **Feature Toggles**: Customize your Dashboard by enabling or disabling specific features such as the Budgeting Engine and the Cash Flow Trend chart.
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
