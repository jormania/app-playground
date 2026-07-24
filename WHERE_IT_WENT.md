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
- **KPIs**: View total Income, Expenses, and Net Cash Flow for the current month.
- **Monthly Chart**: A Chart.js visualization of spending trends over the month.

### Insights & Reflection
- **Monthly Review**: Compare current month spending to the previous month.
- **Actionable Insights**: Automatic detection of spending increases, missing income (e.g. rent not received yet), and recurring transactions.
- **Reflection Card**: A generated summary of the month's financial activity asking a prompt to encourage mindfulness about spending habits.

### Transactions Management
- **CRUD Operations**: Add, edit, and delete transactions.
- **Filtering & Sorting**: Filter transactions by category or type, and sort by date or amount.
- **Category Emojis**: Native Notion emojis are automatically pulled and displayed inline for each category.
- **Category Descriptions**: Add descriptions to your Notion Categories database to have them show up as tooltips in the app, helping you remember what each category is for.

### Under the Hood
- **React + Vite**: Fast, modern frontend.
- **BYO Token**: "Bring Your Own Token" architecture ensures your Notion data remains private and is only accessed by your local browser.
- **PWA Ready**: Offline-capable app shell.
- **Vitest**: Fully covered by component tests.
