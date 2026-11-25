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
| **Overview** | Four panels (shortened 25 Nov 2026): the period total vs the previous equivalent period with its trend chart and, for a month or a year, target progress; *Worth a look*; *Where it came from* (client · source · venue · activity, with drill-down and client concentration); *Expected*, with one-tap **Received** and **Remind**, plus next month's payment from each recurring client with nothing expected yet (**Expect it** / **Not this time**). Profit, tax detail and unusual payments live in Reports and Income |
| **Income** | Every payment, expected ones grouped on top with their month; search; filters (client, source, venue, activity, tax, status); CSV |
| **Costs** *(optional)* | Every cost, unpaid ones on top; filters (kind, venue, client, activity, status); CSV |
| **Reports** | **Review**, **Clients & work** (by client, work type, venue or source, ranked by what you kept), **Venue deals** *(deals)*, **Profit** (P&L with break-even, cash flow) *(costs)*, **Tax** *(tax)*, **Print** *(printable)*. The period at the top is the only filter |
| **Settings** | Device or Notion; demo load/clear; costs on/off and opening cash; tax on/off and profile; monthly target and unusual-payment flags; clients/sources/venues; backup, restore, CSV; theme; the welcome guide |

Periods: this week (Monday-based), this month, last month, this year, custom. One
selection drives Overview, Income, Costs and Reports; no screen has a range of its own.
Expected payments and costs still due show in Income and Costs whatever the period.

### Entering things
- **Income:** amount + client is enough. Recent clients are chips above the picker; a
  client's last *received* payment prefills source, venue, activity, currency and
  description. Any payment can be **copied** (dated today). **Sessions** (default 1: a
  4-session package is 4, a platform payout its sessions) and optional **Hours** feed the
  per-session and per-hour figures and the venue deals. Foreign currency gets the
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
land: **Review** (`insights`), **Clients & work** (`earnings`; the old Breakdown routes
`clients|venues|activities|sources` open it on that view), **Venue deals**, **Profit**
(`pnl|cashflow`), **Tax**, **Print**. The report bar sticks under the header
(`--inflow-header`, measured in `App.tsx`). There is no report filter bar any more: the
period is the only filter, so nothing narrows a report out of sight. On a phone the tabs
are a three-column grid with no sideways scroll.

**Clients & work** (`lib/earnings.ts`, `screens/Earnings.tsx`) ranks by what you kept:
income less each payment's venue fee and its share of same-day direct costs. Each row has
sessions, kept a session and, when every payment has hours, kept an hour; the detail shows
the lowest and highest session and the parts behind it (venues, or clients when ranking
venues).

**Review** follows WhereItWent's order (`lib/review.ts`, `screens/Insights.tsx`):
- *Understand*: "<period> in review", a plain summary paragraph (`reviewSummary`), KPIs,
  *Copy summary*.
- *Main movers*: the biggest changes vs the period before, across clients, venues and
  activities (at most three from one), with a client who stopped included. Drawn either side
  of zero: green up, amber down.
- *Who carries the income*: a share bar by any dimension.
- *Act*: pain points and wins.

A section index under the tabs lights the section in view and scrolls to it. A comparison that
reaches before the first record says so instead of quoting "+1644%".

Charts follow the dataviz skill: part-to-whole is a tall segmented bar (`ShareBar`, ≤ 5
named parts plus "Other"), never a donut. `--chart-4`/`--chart-5` were added and the five
hues validated together, light and dark. Review, Income ("Where it came from") and Costs
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
| losing-sessions | a fixed-fee room had sessions that lost money; advice: confirm once N have booked (terms are the venue's). A pain point from two sessions or 300 lei lost, a tip below that |
| close-to-break-even | ≥ 3 sessions averaging within 30% of a fixed fee's break-even |
| venue-for-the-same-work | the same work, ≥ 3 sessions at each of two in-person rooms, ≥ 15% apart (never an online platform paid monthly) |
| best-work | ≥ 2 kinds of work with ≥ 5 sessions each, the best ≥ 25% ahead |
| thin-margin | work keeping < 50% after venue and direct costs, ≥ 4% of income |
| regular-fading | *a recurring arrangement that stopped* (tip, not a pain point): ≥ 3 payments marked recurring, not platform or royalty payouts or content, nothing expected, silent for more than twice its rhythm (≥ 45 days) and at most 180 days. Clients finishing coaching are normal and never flagged |
| regular-growing | regular clients who paid in ≥ 2 of the earlier 3 months (a new client ramping up is not growth), up ≥ 50% and ≥ 1,000 lei |
| one-client | ≥ 35% of the last 12 months from one client (never read from a short period) |
| intro-clients | individual clients only, ≥ 5 new this year, and more than half never came back (a tip: some first sessions never turn into more) |
| overdue | an expected payment past its date |
| quiet-month | ≥ 9 complete months, never the running month or a start-up month |
| tax-review | *(tax)* payments this year marked "review": the estimate leaves them out until decided |
| costs-overdue | *(costs)* costs still due after their date |

Pain points are kept for what costs money or needs a decision: overdue payments, open tax
questions, overdue costs, thin margins, a pattern of losing sessions, leaning on one client
(audited 25 Nov 2026). Everything else is a win or a tip.

**Feedback** (`app/insightFeedback.ts`, this device): 👍 keeps an insight first. 👎 asks
"Hide this one" or "Hide all about <rule>", with Undo. Settings → Features shows how many are
hidden, with "Show them again". Hidden insights stay out of the Review's summary count and the
printable report.

**Break-even** on Venue deals sits beside "What if…". It takes a price per person (the venue's
recorded one is filled in), and seat icons show how many people cover the fee
(`breakEvenPeople`) and what each person after that leaves you (`keptPerPerson`). A revenue
share has no break-even.

### Audit, 25 Nov 2026 (second)
**Defects fixed:**
- **Amounts were misread.** "1.500" (the Romanian way to write 1500) was read as 1.5 lei. So was
  "2,500". One separator before exactly three digits now groups thousands. Otherwise it's
  the decimal point, and with both separators the last one is the decimal (`parseAmount`, tested
  case by case). Exchange rates use `parseRate`, where a single separator is always the decimal, so
  4.976 stays 4.976.
- **CSV exports could run formulas.** Text starting with `=`, `+`, `-` or `@` would run as a formula
  in Excel or Sheets; it is now kept as text.
- **Reimbursements absorbed costs.** A reimbursement took a share of the same day's direct costs at
  a venue, understating what the session cost.
- **Clients & work was filtered unseen.** It applied a report filter left set elsewhere while
  showing no filter bar. The period is now its only filter, with a test that fails without the fix.
- **Two smaller fixes.** The what-if and break-even fields now read "30%" and "220 lei". `N` no
  longer opens a form over a confirmation dialog.

**Improvements:**
- **A first run starts with steps,** not a dashboard of zeros: add a payment, add your rooms, record
  a cost, or see the demo.
- **Income search finds amounts:** "450", "6.500".
- **A backup nudge:** on the Overview, for your own data on this device, after 30 days without a
  backup.
- **No empty copy button:** "Copy summary" hides when there's nothing to copy.

**Checked and sound:**
- A sweep of every screen and report in three states (demo, empty, simple start), on
  Week/Month/Last month/Year, at 340, 412 and 1280 px, in light and dark: no errors, no overflow,
  no NaN or undefined in the page.
- The service worker serves pages network-first and hashed assets.
- Reversed custom periods are swapped.

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
| InFlow — Income | Description, Amount, Currency, FX rate, Amount RON, Date, Status, Client/Source/Venue (relations), Category, Recurring, Attendees, Sessions, Hours, Taxability, Tax handling, VAT, Classification, Tax reserve RON, Reserve source, Tax withheld RON, Tax rules, Notes |
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
  | Casa Verde loft | fixed 400, 150 a seat | uneven turnout, a losing evening |
  | Sala Lumière | fixed 350, 100 a seat | turnout 4–6 against a break-even of 4: close, never losing |
  | Coworking Cotroceni | 30% | |
  | Yoga Shala Herăstrău | 40% | |
  | Coachlane | 20% | platform |
  | Courseline | 15% | platform |

  The same workshop runs at three rooms.
- **Also covered:** four currencies, withheld royalties and lecture fees, reimbursements, an
  award and a barter for review, two overdue and two upcoming payments, intro clients (most came
  back), and an NGO programme that ended.
- **About 300 payments and 435 costs:** room bookings and shares, co-facilitators, materials,
  platform commissions, a home office then a coworking desk, software, accountant, supervision,
  two certification modules, a laptop depreciated over 36 months, and owner drawings.
- Cash stays positive from a 14,000 lei start.
- **Prices follow the Bucharest market (checked 25 Nov 2026)**, not guesses: 1:1 coaching
  250–350 lei (intro 150, packages about 225–250 a session; listings put life coaching at
  150–400 and career coaching at 200–500), couples 400, group circles 100 a seat, public
  workshops 150–220 a seat, evening rooms 350–400 (about 80 lei an hour to rent), a guest
  lecture 270–300 (university hourly rates of 95–135 lei), a corporate training day about
  6,500 lei, monthly corporate coaching 4,500–5,000 lei for two sessions, an accountant 300 a
  month. Retreat facilitation is the agency's fee to the coach (1,500–2,400 EUR), not the
  participants' price. Owner drawings follow the income, so the first year never runs out of
  cash and the second builds a reserve for May's tax.

## Feature switches

Settings → Features (`FEATURES` in `screens/Settings.tsx`, `settings.features`, `on(key)`
in state). Seven switches since 25 Nov 2026.

**Simple start for new users only.** With no stored settings, InFlow starts on
`SIMPLE_FEATURES` (insights and expected payments) and no target, and the Overview shows a
*Simple start* notice: **Turn everything on**, **Choose features** (to Settings) or **Got
it** (`settings.simpleStartNotice`). Anyone with stored settings keeps their switches, all
on by default. Settings → Features opens with how this works, an **Everything** master
switch (on = all, off = none) and **Back to simple start**. The tour's last step says the
same. Old `targets: false` becomes `monthlyTarget: 0`, old `unusual: false` becomes
`largeMultiple: 0`; `reportTools` is dropped. Both now live under Settings → *Target and
flags*. Off means gone from the UI *and* the logic: no tab, panel, field, report
section, insight rule or computed reserve. Data recorded under a feature stays stored and
returns when it is switched back on. Each toggle has a one-line hint and a "What this does"
twisty; every Settings section folds, remembered per device (`inflow:settings-open:<id>`).
`App.test.tsx` → "feature switches" checks each key's UI disappears.

| Key | Off removes |
|---|---|
| insights | Overview "Worth a look", the Review's pain points and wins |
| deals | Venue deals report, deal fields on venues, the head-count field |
| costs | Costs tab, P&L, cash flow, margins after costs, break-even |
| tax | tax panels, Tax report, reserves, tax fields in the form and report |
| expected | Expected status, panel, suggestions from recurring payments and overdue insight |
| currencies | currency select (lei only; an existing foreign record keeps its currency) |
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

## Less and more, 25 Nov 2026
- **Less:** Breakdown folded into Clients & work; the report filter bar, scope and split-by
  pivot removed; the Overview cut to four panels (no week/month tiles that repeated the
  headline or ignored the selected period); range chips gone from Income and Costs; the
  `targets`, `unusual` and `reportTools` switches became settings.
- **More:** sessions per payment, optional hours (kept an hour), expected payments suggested
  from recurring ones (`suggestExpected` in `lib/analytics.ts`; a dismissal is remembered
  per device under `inflow:suggest-dismissed`), break-even in Profit, simple start with a
  master switch.
- **Periods:** under *Custom* (or any period), insights that read a fixed window say so
  beside their label ("Worth knowing · past 12 months") and come after the ones about the
  period; Profit's break-even scales to the period ("Break-even for 41 days", a week, a
  month, a year); the trend chart says "one bar a week" rather than "per week".
- **Tidy:** one `DIM_FILTER` map in `app/state.tsx` instead of three copies; unused
  `Sparkline`, `pivot` and the scope/filter CSS removed; the section index observes on the
  next frame and the `/` shortcut focuses search on `hashchange`, not after guessed delays.
  The edit forms' button bar is pinned flush to the bottom of the dialog so Save and Cancel
  stay inside it on a phone.

## Audit of the last commits, 25 Nov 2026
- **Notion, older databases:** a database duplicated before a column was added (Sessions,
  Hours, Attendees, a venue's deal) would have refused every save that named it. `NotionRepo`
  now reads each database's columns once and writes only those (`fit`); if the schema can't
  be read, everything is sent as before.
- **Simple start notice:** ticking a feature in the welcome guide now retires it, as Settings
  already did, so it never claims a feature is off that was just switched on.
- **Losing sessions** count sessions, not payments, in their title and pain/tip threshold.
- **Conveniences:** "Expect it" confirms with an **Edit** button (a payout's amount varies);
  a payment covering more than one session is tagged "N sessions" in Income; the target hint
  says it also applies to a year.
- Checked and sound: per-session venue costs and monthly rent split, people per session, kept
  per hour, settings migration for new and existing users, feature gating of insights, Income
  and Costs donuts (received only), no sideways overflow on any screen at 360 px in Month or
  Custom, no runtime errors.

## Guards against a believable wrong number, 25 Nov 2026
Tax rulesets are frozen and stored reserves are never recomputed, so a slip there gives a
plausible figure, not a crash. Two layers now catch it:
- **Tests.** `tax/frozen.test.ts` holds each published ruleset's figures by hand: editing
  RO-2025 or RO-2026 in place fails with "ship a corrected ruleset under a new id". Rates
  must be shares (0–1), not percentages.
- **Before a save** (`lib/guards.ts`, shown by `components/Findings.tsx`): warnings, never
  blocks, each with a one-tap fix where the right value is plain, then *Save anyway*.
  Compared with the person's own history, never a price list:
  - an amount 8× above or below the client's usual (an extra zero offers the corrected amount);
  - far above anything received, for a new client;
  - received or paid on a future date (offers expected / due);
  - dated over a year ago or ahead;
  - a rate more than a third off the last one used for that currency (inverted or a lost decimal);
  - the same payment or bill twice within three days;
  - absurd sessions, hours or head counts;
  - a stored reserve whose amount has changed: kept, as the rule says, but the new
    suggestion is shown, one tap away;
  - a reserve above 45% of the payment.

  Refused outright: tax set aside or withheld above the payment, or a negative reserve.

**Quality of life, same pass:** "1.5k" and "2k" are read as thousands. Today and Yesterday
sit under every date. Costs shows *Usually paid by now*: recurring costs paid last month and
not yet this month, once their day has passed, with one-tap Add (a copy). Each P&L cost line
opens its own categories in place, replacing a "Show categories" link. The bottom tabs lose
their link underline. The "Optional" badge is gone from tax, which only shows once switched on.

## Profit, Tax and Print audit, 25 Nov 2026
- **"Kept" counted costs paid on another day.** A direct cost came off a payment only when
  linked to the same venue on the same day, so retreat materials bought days before and flights
  the week before never counted, and Clients & work overstated what that work kept.
  `recordCosts` now gives each direct cost to the nearest payment (within a month) at its venue,
  or with its client when it has no venue; payments sharing that date split it.
- **One "kept" everywhere.** The print's old Margins section (linked costs only, no venue
  deals) became *What you kept, by client & work*, the same figures as Clients & work. The
  old `margins()` is gone.
- **Columns name their days** when they hold part of a month ("23–29 Nov"), so a week's P&L
  no longer reads as all of November.
- **Tax report:** the tax rows sit apart from the income lines (they are not their total);
  the tab is "Tax" (the asterisk had no footnote); expenses show what they take off the tax.
- **Print:** the P&L lists each cost's categories (paper can't expand); the tax section adds
  the app's "still to set aside"; the tax footnote prints whenever an asterisk does; the cash
  flow note appears only when the report is narrowed.
- **Cost form:** under Deductible, what the cost takes off this year's estimate
  (`costTaxEffect`: the estimate without it, less with it); under normă or a custom rate it
  says costs don't change the tax. A foreign-currency cost, with tax on and not VAT-registered,
  notes reverse-charge VAT (art. 317).
- **Payment form:** the Tax section folds back from its heading; every list says where it
  comes from ("+ New…" for clients, sources, venues; a set list for activities); "People per
  session" is a head count, one number.
