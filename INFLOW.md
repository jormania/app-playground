# InFlow — freelancer income tracker

**[coneofcold.vercel.app/inflow-react.html](https://coneofcold.vercel.app/inflow-react.html)** ·
source `src/inflow/` · entry `inflow-react.html` · strict TypeScript on `src/ds/`

A light income tracker for freelancers. Open it for twenty seconds and know how much
came in, from whom, where and for what kind of work, and how it moves. Two things are
optional and switch off cleanly: **costs** (P&L, cash flow, margins, break-even) and
**tax** (taxability, withholding, VAT, what to set aside). Not invoicing, bookkeeping or a CRM.

## What it does

| Place | What's there |
|---|---|
| **Overview** | Period total vs the previous equivalent period (to date while it runs), this week and this month, target progress, trend chart (days / weeks / months, the previous period as ghost bars), breakdown by client · source · venue · activity with drill-down, client concentration, *What you kept* (profit after costs, break-even gauge, costs to pay) *(costs)*, taxable split *(tax)*, expected payments with one-tap **Received**, unusually large payments |
| **Income** | Every payment, expected ones grouped on top with their month; search; filters (client, source, venue, activity, tax, status); CSV |
| **Costs** *(optional)* | Every cost, unpaid ones on top; filters (kind, venue, client, activity, status); CSV |
| **Reports** | Clients · Venues · Activities · Sources (total, share, count, average, **margin** with costs, change, 6-month sparkline, and a *split by* pivot), **P&L**, **Cash flow** *(costs)*, **Tax** *(tax)*, **Printable**. One filter bar (client, venue, activity, source) narrows every report at once; every row drills down to its payments |
| **Settings** | Device or Notion; demo load/clear; costs on/off and opening cash; tax on/off and profile; targets; clients/sources/venues; backup, restore, CSV; theme; the welcome guide |

Periods: this week (Monday-based), this month, last month, this year, custom. One
selection drives Overview, Income, Costs and Reports.

### Entering things
- **Income:** amount + client is enough. Recent clients are chips above the picker; a
  client's last *received* payment prefills source, venue, activity, currency and
  description. Any payment can be **copied** (dated today). Foreign currency gets the
  ECB rate for the day from Frankfurter, editable because the BNR rate is what's declared.
- **Costs:** amount, what it was, kind (direct / operating / depreciation / interest / tax /
  investment / financing) and category. *Repeat a recent cost* offers the five costs paid
  most often in the last six months (rent, Zoom, the accountant) as one-tap copies.
  Linking a venue, client or activity is optional and only feeds the margins.

### The welcome guide
Six steps on first open, including the costs and tax switches. Its checkbox, "Show this
guide next time I open InFlow", decides whether it returns; Settings can switch it back on
or show it now.

### Printable reports
`lib/report.ts` renders one self-contained HTML document (inline CSS and SVG, no script,
every user string escaped). Presets: period summary, year in review, client statement, for
my accountant. Options: title, subtitle, dates, client / venue / activity / source filters,
sections (incl. margins, P&L and cash flow when costs are on), rows per table, comparison,
original currencies, sort, notes. *Print / save as PDF* prints the preview; *HTML* downloads it.

## Costs, P&L and cash flow (optional)

`settings.trackCosts`. **Cash basis**: income counts when received, a cost when paid; due
costs and expected income stay out until they happen. Structure (`lib/finance.ts`):

```
Revenue − Direct costs (COGS) = Gross margin − Operating costs (SG&A) = EBITDA
− Depreciation = Operating profit (EBIT) − Interest = Profit before tax − Tax paid = Net profit
```

*Investment* (buying equipment) and *financing* (loan repayments, owner drawings,
dividends) are cash movements, never P&L lines; depreciation is the reverse. Cash flow
rolls forward from **cash on hand on a date** (Settings), backwards too if that date is
later; without one it starts at zero and says so. Loans received and capital put in are not
recorded — a deliberate limit of an income tracker.

**Margins** per venue, client or activity = income less the direct and operating costs
*linked* to it; unlinked overheads are not shared out. A filtered P&L counts only linked
costs and says so. **Break-even** = average monthly operating + interest costs over the last
three whole months ÷ the gross-margin rate over the same months.

**No balance sheet**, by design: it needs assets, liabilities and equity kept as balances —
bookkeeping, not income tracking. Cash flow's closing cash is the one balance InFlow keeps.

With costs on, the tax estimate can read deductible expenses from recorded costs
(`expensesFromCosts`), annualised like income.

## Tax is optional

`settings.trackTax`. Off: no tax cards, panels, tab, form section or report columns.
On: tax figures carry an **Optional** chip or asterisk; the form's tax section is folded to
a one-line summary unless the payment needs review.

Taxability, handling and VAT are separate suggestions (`tax/classify.ts`), each with its
reason and a **Suggested** badge until changed. The estimator (`tax/estimate.ts`,
`tax/rules.ts`) reads the year's liability at the projected annual income and turns it into
an effective rate per payment. **The rate is capped at 45%**: on a small or early-year
income the fixed CASS minimum alone can exceed the income (the audit found 395%), and a
reserve larger than the payment helps nobody; the estimate still shows the full minimum.

| | 2025 | 2026 | Source |
|---|---|---|---|
| Minimum wage for thresholds | 4,050 | 4,050 | ANAF, DU presentation, AJFP Cluj, 22.04.2026 |
| CAS 25% | on 12 or 24 min. wages | same | same |
| CASS 10% | 6–60 min. wages | 6–**72** | Legea 239/2025 |
| Income tax | 10% of (net − CAS − CASS) | same | ANAF |
| Dividend tax | 10% | **16%** | Legea 141/2025 |
| Micro tax | 1% (3% for some activities) | **1%**, threshold €100,000 | OUG 156/2024, OUG 89/2025 |
| VAT exemption threshold | 395,000 (from 1.09.2025) | 395,000 | OG 22/2025 |

Rulesets are frozen per year; records keep the ruleset id and stored reserve, never
recomputed. Tests reproduce ANAF's own worked example (net 57,000 → CAS 12,150,
CASS 5,700, tax 3,915).

## Data

`domain/types.ts`: `IncomeRecord`, `CostRecord`, `Client`, `Source`, `Venue`, `Settings`.
"Activity" in the interface is `category` on income and `activity` on costs.

**On this device:** one IndexedDB value (`inflow` database, key `data`); data written
before costs existed loads with an empty cost list, and a demo seeded then gets the demo's
costs. Settings in localStorage (`inflow:settings`).

**In Notion:** `Dev → App Databases → InFlow`, five databases. Settings take the
**Income** link; Clients, Sources and Venues are found through its relations, **Costs** as a
sibling database on the same page (`store/notion.ts`). Without a Costs database the app
still works and says costs can't be saved there. Reads and writes go through
`/api/notion` with the user's token (no new serverless function).

| Database | Properties |
|---|---|
| InFlow — Income | Description, Amount, Currency, FX rate, Amount RON, Date, Status, Client/Source/Venue (relations), Category, Recurring, Taxability, Tax handling, VAT, Classification, Tax reserve RON, Reserve source, Tax withheld RON, Tax rules, Notes |
| InFlow — Costs | Description, Amount, Currency, FX rate, Amount RON, Date, Status (Paid/Due), Group, Category, Venue/Client (relations), Activity, Recurring, Deductible, Notes |
| InFlow — Clients | Name, Kind, Country, Contact, Notes, Archived |
| InFlow — Sources | Name, Type, Description, Active, Tax default |
| InFlow — Venues | Name, Type, Location, Notes, Archived |

Select options are a closed vocabulary mirrored in `domain/vocabulary.ts`: add an option
in Notion first. The Starter Template (`Dev → Starter Templates`) has all five, linked to
each other. Moving from device to Notion: a one-time copy of the user's own rows, entities
first so relations point at new ids; demo rows never leave the device.

**Demo:** `data/demo.ts` — fourteen months of a coaching practice relative to today:
186 payments from 30 clients at 14 venues in five places, RON/EUR/USD/GBP, growth with a
quiet August, withheld royalties and lecture fees, reimbursements, an award and a barter for
review, three expected payments — and 225 costs: studio hire per session, the Saturday
room and snacks, co-facilitators on retreats and bank workshops, platform commissions,
coworking desk, software, accountant, supervision, a laptop bought and depreciated, last
year's tax paid on 25 May, monthly owner drawings, two costs still due. *Clear demo data*
removes exactly the demo rows.

## PWA
`public/inflow.webmanifest` (scope `/inflow-react.html`, shared Cone of Cold icons),
`public/inflow-sw.js` (network-first navigations, `/api/` never cached, only `inflow-`
caches touched), production-only registration.

## What others build, and what was borrowed

Bonsai, FreshBooks, Wave, HoneyBook; FreshBooks' and Zoho Books' per-client and per-project
profitability (their premium tier); event and workshop P&L models (revenue per event,
facilitator and materials as the swing costs, a monthly break-even floor set by fixed
overhead); freelancers' own Claude Code builds (income + expenses + estimated tax;
TaliVue's per-invoice set-aside; Tax Gap Tracker's full-year estimate).

Adopted: per-payment set-aside; full-year tax view; money owed at a glance (expected, one-tap
received); trend against the past; **profit per client, venue and activity**; **break-even**;
P&L and cash flow from the same records. Not adopted: invoices, time tracking, proposals,
client portals, bank sync, a balance sheet — each would turn a 20-second app into accounting.

## Audit, 2026-11-25

A browser script (Playwright, phone 412 px, desktop 1280 px dark, narrow 340 px) exercised
every use case: tour, every period, every breakdown and drill-down, search and filters, add /
edit / copy income, mark received, add / repeat cost, every report tab, the filter bar, the
pivot, every printable preset, settings toggles, Notion with a bad token, clear and reload
demo. Found and fixed:

- Toasts sat over the add button and tab bar for five seconds after every save →
  `--toast-offset` lifts them above both.
- Picking a client prefilled their *upcoming expected* payment → last *received* one.
- Due and expected rows showed "20 Sun" with no month → month shown for those rows.
- Number fields swallowed the decimal point ("12." → "12") → `NumberInput` keeps the text.
- On a tiny income the effective tax rate read 395% → capped at 45%, explained.
- The cost shortcuts ranked a future due cost first → ranked by how often paid.
- At 340 px the custom date range overflowed the page → it wraps.
- On a phone the P&L's year total was off-screen → Total and % sit beside the labels.
- The add button covered list rows while scrolling → it folds to a round "+" scrolling down.
- Demo costs gave a 93% margin → realistic overheads and platform commissions.
- A failed Notion connection said "request failed (404)" → plain-language messages.

Full-page screenshots draw fixed elements (tab bar, add button) at the scroll position, mid-
page; viewport screenshots while scrolling confirm the tab bar stays at the bottom.
