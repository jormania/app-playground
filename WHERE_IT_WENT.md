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
