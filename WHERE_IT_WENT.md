# WhereItWent

WhereItWent uses Notion as its database backend. To fully use the app (beyond Demo mode), you need to create three databases in your Notion workspace and connect them to the app.

## 1. Create the Databases in Notion

Create three full-page databases anywhere in your Notion workspace with the following schemas.

### 1.1 Accounts Database
- **Name**: `Name` (Title property)
- **Type**: `Type` (Select property with options: e.g., Bank, Fintech, Cash, Broker)
- **Currency**: `Currency` (Select property with options: RON, EUR, USD, etc.)
- **Active**: `Active` (Checkbox property)

### 1.2 Categories Database
- **Name**: `Name` (Title property)
- **Type**: `Type` (Select property with options exactly as: `Income`, `Expense`)
- **Active**: `Active` (Checkbox property)

### 1.3 Transactions Database
- **Description**: `Description` (Title property)
- **Date**: `Date` (Date property)
- **Amount (RON)**: `Amount (RON)` (Number property)
- **Original Amount**: `Original Amount` (Number property)
- **Original Currency**: `Original Currency` (Select property)
- **Type**: `Type` (Select property with options: `Income`, `Expense`, `Transfer`)
- **Category**: `Category` (Relation property -> Connect to Categories Database)
- **Account**: `Account` (Relation property -> Connect to Accounts Database)
- **Notes**: `Notes` (Text / Rich text property)
- **Tags**: `Tags` (Multi-select property)
- **Recurring**: `Recurring` (Checkbox property)
- **Created At**: `Created At` (Created Time property)
- **Updated At**: `Updated At` (Last Edited Time property)

## 2. Generate a Notion Integration Token
1. Go to [Notion Integrations](https://www.notion.so/my-integrations).
2. Create a new integration, give it a name (e.g., "WhereItWent").
3. Copy the **Internal Integration Secret**.
4. In Notion, go to each of the three databases you created, click the `...` menu on the top right -> `Connections` -> `Add connections` and search for your integration name to share the database with it.

## 3. Configure the App
Open the WhereItWent application and navigate to the **Settings** tab.

Enter the following:
- **Notion Integration Token**: The secret you copied in step 2.
- **Transactions Database ID**: The ID from your Transactions database URL.
- **Categories Database ID**: The ID from your Categories database URL.
- **Accounts Database ID**: The ID from your Accounts database URL.

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
- **Deep Insights Engine**: Advanced analytics including 50/30/20 rule mapping, daily burn rate forecasting, Savings Rate, and behavioral habit tracking (the "Latte Factor") across selectable time horizons (Month/Quarter/Year).
