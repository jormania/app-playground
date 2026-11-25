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

### Reports (simplified 25 Nov 2026)
Six tabs at most, as links (`#/reports/<route>`), so back and forward work and old links
land: **Review** (`insights`), **Breakdown** (`clients|venues|activities|sources`, a second
row), **Venue deals**, **Profit** (`pnl|cashflow`), **Tax**, **Print**. The report bar sticks
under the header (`--inflow-header`, measured in `App.tsx`); the filter bar opens from a
*Filter* button and stays open while a filter is set.

**Review** follows WhereItWent's order (`lib/review.ts`, `screens/Insights.tsx`):
- *Understand*: "<period> in review", a plain summary paragraph (`reviewSummary`), KPIs,
  *Copy summary*.
- *Main movers*: the biggest changes vs the period before, across clients, venues and
  activities (at most three from one), with a client who stopped included. Drawn either side
  of zero: green up, amber down.
- *Who carries the income*: a share bar by any dimension.
- *Act*: pain points and wins. *Explore*: the heat map.

A section index under the tabs lights the section in view and scrolls to it. A comparison that
reaches before the first record says so instead of quoting "+1644%".

Charts follow the dataviz skill: part-to-whole is a tall segmented bar (`ShareBar`, ≤ 5
named parts plus "Other"), never a donut. `--chart-4`/`--chart-5` were added and the five
hues validated together, light and dark. Breakdown, Income ("Where it came from") and Costs
("Where it went") each carry one. Profit has monthly income vs costs bars (`MonthlyPair`).

Navigation: a drill-down from a report leaves a trail (`app/trail.ts`), and Income offers
"← Back to Review". Month headings on Income and Costs stick while scrolling. Tapping the
current tab scrolls to the top. Each screen names itself in the browser tab.

**Venue deals** (`screens/VenueDeals.tsx`, `lib/deals.ts`), simplified 25 Nov 2026 to answer
one question: which deals make the freelancer the most money.

- **The actual deal is fact.** Every venue has its deal set by the venue owner: a *fixed fee* per
  session, or a *revenue share* of each session's revenue. The page shows it and never offers
  to change it. The venue form offers Fixed fee, Revenue share or No venue cost. A venue saved
  earlier as "fixed + share" or "monthly rent" keeps its terms, and they still calculate.
- **Summary:** revenue, paid to venues, kept, sessions (`dealTotals`).
- **One row per venue, best average first:**
  - the deal and its terms, sessions, revenue, paid to the venue, kept, and kept per session
    (`venueDeal`: each received, non-reimbursement payment at a venue is one session);
  - fixed fee: "Fee covered at <fee> of session revenue", plus the head count at the venue's
    recorded price per head when there is one (`feeCoveredAt`);
  - revenue share: "You keep <100 − share>%".
- **What if… (one per row):** a hypothetical fixed fee or share, run over the same sessions and
  revenue (`scenario`). It shows actual kept, hypothetical kept, and the difference in lei and
  %. The terms live in the component's state only; nothing is saved.
- **One data note, only when true:** at a fixed-fee venue, two payments on the same day count
  as two sessions and two fees (`sameDayRepeats`).

Removed: verdicts and thresholds, seat strips, per-session bars, the deal-type comparison and
its advice, the deal curve and crossover, and the section index. The Review's pain points still
read `venueDeal` (sessions that lost money at a fixed-fee room).

**Clients & work** (`screens/Earnings.tsx`, `lib/earnings.ts`) replaced the Review's heat map
on 25 Nov 2026. It answers one question: which clients and kinds of work earn the most.
- A summary of income, costs and kept, then one toggle (By client / By work type).
- A list ranked by total kept. Each row shows sessions, kept a session, and a bar of kept (green)
  against costs (amber). Tap a row for income, venue fees, direct costs, kept, the lowest to
  highest session, and the venues involved.
- "Kept" is the existing per-payment rule, `recordCosts` in `lib/insights.ts` (`takeHome` is
  built on it): income less the venue's deal cost and the direct costs linked to that venue
  that day, shared across that day's payments.
- A session is a received, non-reimbursement payment in the selected period. The global
  period is the only filter.

**Insights** (`lib/insights.ts`), reworked 25 Nov 2026 for relevance. `practice()` reads the
records first: regular clients (paid in ≥ 3 separate months in the last year), full months of
history, whether there is group work. Each rule then fires only where it applies:

| Rule | When it fires |
|---|---|
| losing-sessions | a fixed-fee room had sessions that lost money; advice: confirm once N have booked (terms are the venue's) |
| close-to-break-even | ≥ 3 sessions averaging within 30% of a fixed fee's break-even |
| venue-for-the-same-work | the same work, ≥ 3 sessions at each of two in-person rooms, ≥ 15% apart (never an online platform paid monthly) |
| best-work | ≥ 2 kinds of work with ≥ 5 sessions each, the best ≥ 25% ahead |
| thin-margin | work keeping < 50% after venue and direct costs, ≥ 4% of income |
| regular-fading / -growing | regular clients only, ≥ 6 full months, last 3 months vs the 3 before |
| one-client | ≥ 35% of the last 12 months from one client (never read from a short period) |
| intro-clients | individual clients only (not companies with a project), ≥ 5 new this year |
| overdue | an expected payment past its date |
| quiet-month | ≥ 9 complete months, never the running month or a start-up month |

**Feedback** (`app/insightFeedback.ts`, this device): 👍 keeps an insight first. 👎 asks
"Hide this one" or "Hide all about <rule>", with Undo. Settings → Features shows how many are
hidden, with "Show them again". Hidden insights stay out of the Review's summary count and the
printable report.

**Break-even** on Venue deals sits beside "What if…". It takes a price per person (the venue's
recorded one is filled in), and seat icons show how many people cover the fee
(`breakEvenPeople`) and what each person after that leaves you (`keptPerPerson`). A revenue
share has no break-even.

### Information mapping (25 Nov 2026)
No paragraphs to read where facts can be laid out.
- **The Review's summary** is rows (`reviewHighlights`): came in, you kept, top client, biggest
  rise, biggest drop, needs a look. Each row has an icon tile coloured by how it reads: green good,
  amber bad, blue neutral. The printout's *In short* uses the same rows. The sentence form
  (`reviewSummary`) survives only for *Copy summary*.
- **The tour** gives two to four ticked points per step.
- **Settings → Features:** each twisty lists what the feature adds (ticks) and one "Off:" line.
- **The demo, device mode and backup:** chips or ticks. **Notion setup:** numbered steps.
- **Report notes:** one fact per line.
- Movers keep each dimension's biggest drop, so the summary can always name one.

### Small conveniences (25 Nov 2026)
- **Usual amounts**: pick a client and their three most frequent amounts appear as chips.
- **People × price**: a head count at a venue (or for an activity) with a known price per head
  offers the amount ("9 × 220 lei = 1,980 lei · Use"), from the median of past sessions.
- **Automatic descriptions**: an empty description is saved as "activity · venue" (or the
  client), shown as the field's placeholder.
- **Remind**: an expected payment on the Overview copies a polite reminder. People are greeted
  by first name, businesses with a plain hello.
- **Shortcuts**: the manifest's shortcuts open forms (`#/add/income`, `#/add/cost`, replaced in
  history so Back doesn't reopen them). On a keyboard, `N` adds and `/` searches.
- Insight links land on their section (`#/reports/insights/heat`, `#/reports/deals/verdict`).
  A grid with fewer than two rows or columns says so instead of drawing one.

### Printable reports
Four reports, each with when to print it and what it holds (`PRESET_ADVICE`):
- **Month at a glance**: headline, *In short* with the movers, top clients, pain points.
- **Year in review**: adds the trend, venues, activities and the P&L.
- **Client statement**: asks for the client first.
- **For my accountant**: sources, P&L, tax, every payment with notes.

Dates follow the selected period, with one tap to the whole year. Title, sections, rows,
comparison, currencies and notes wait under *Adjust this report*. `lib/report.ts` renders one
self-contained HTML document (inline CSS and SVG, every user string escaped). A year's P&L
uses smaller type so twelve months fit A4.

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
before costs existed loads with an empty cost list. Settings in localStorage (`inflow:settings`).

**Demo or my data (`settings.workspace`).** The demo practice lives under its own key
(`demo`), never in `data` and never in Notion; the screens show one or the other. A first
run opens on the demo; a banner on every screen and the header chip say so, with a way out.
*Clear demo data* empties the `demo` key and switches to your data, and its toast offers the
demo back; choosing *Demo practice* again rebuilds it; *Reset demo* drops changes made
while exploring. The demo shows its own opening cash and never writes it into your settings.
An older InFlow that mixed demo rows into `data` is split on load (`withoutDemo`, which keeps
any demo client your own payment points at).

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

**Demo:** `data/demo.ts`, twenty-six months of a coaching practice relative to today, so
every feature has something real to show (extended 25 Nov 2026):
- **Two years.** A smaller first year has Orion Pharma's monthly contract (ended after ten
  months), Elena Dobre's weekly 1:1 (finished), smaller platform payouts, a summer retreat and
  a lecture. The second year grows. "Year" therefore compares with a full last year, movers
  show drops as well as rises, the quietest month has settled history, and both the 2025 and
  2026 tax rulesets and May tax payments appear.
- **Rooms on both kinds of deal:**

  | Room | Deal | Role in the demo |
  |---|---|---|
  | Studio Lumina | fixed 60 | 1:1 |
  | Casa Verde loft | fixed 600 | uneven turnout, one losing evening |
  | Sala Lumière | fixed 450, 120 a seat | turnout 4–6 against a break-even of 4: close, never losing |
  | Coworking Cotroceni | 30% | |
  | Yoga Shala Herăstrău | 40% | |
  | Coachlane | 20% | platform |
  | Courseline | 15% | platform |

  The same workshop runs at three rooms.
- **Also covered:** four currencies, withheld royalties and lecture fees, reimbursements, an
  award and a barter for review, two overdue and two upcoming payments, intro clients who never
  came back, and regular clients going quiet and growing.
- **About 300 payments and 435 costs:** room bookings and shares, co-facilitators, materials,
  platform commissions, a home office then a coworking desk, software, accountant, supervision,
  two certification modules, a laptop depreciated over 36 months, and owner drawings.
- Cash stays positive from a 14,000 lei start.

## Feature switches

Settings → Features (`FEATURES` in `screens/Settings.tsx`, `settings.features`, `on(key)`
in state). All on for a new user; *Simple start* keeps income, insights, expected payments
and the target. Off means gone from the UI *and* the logic: no tab, panel, field, report
section, insight rule or computed reserve. Data recorded under a feature stays stored and
returns when it is switched back on. Each toggle has a one-line hint and a "What this does"
twisty; every Settings section folds, remembered per device (`inflow:settings-open:<id>`).
`App.test.tsx` → "feature switches" checks each key's UI disappears.

| Key | Off removes |
|---|---|
| insights | Overview "Worth a look", Insights report and heat map |
| deals | Venue deals report, deal fields on venues, the head-count field |
| costs | Costs tab, P&L, cash flow, margins after costs, break-even |
| tax | tax panels, Tax report, reserves, tax fields in the form and report |
| expected | Expected status, panel and overdue insight |
| currencies | currency select (lei only; an existing foreign record keeps its currency) |
| targets | monthly target bar |
| unusual | "Out of the ordinary" flags |
| reportTools | report filter bar and split-by |
| printable | Printable tab |

Screens enter with Stillflow's 320 ms rise (`.screenIn`, off under reduced motion); the
theme is Device / Light / Dark.

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
