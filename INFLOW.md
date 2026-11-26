# InFlow — freelancer income tracker

**[coneofcold.vercel.app/inflow-react.html](https://coneofcold.vercel.app/inflow-react.html)** ·
source `src/inflow/` · entry `inflow-react.html` · strict TypeScript on `src/ds/`

A light income tracker for freelancers. Open it for twenty seconds and know how much
came in, from whom, where and for what kind of work, and how it moves. Seven parts are
optional and switch off cleanly (see *Feature switches*), among them **costs** (P&L, cash
flow, what each client and kind of work kept, break-even) and **tax** (taxability,
withholding, VAT, what to set aside). Not invoicing, bookkeeping or a CRM.

## What it does

| Place | What's there |
|---|---|
| **Overview** | Four panels (shortened 25 Nov 2026): the period total vs the previous equivalent period with its trend chart and, for a month or a year, target progress; *Worth a look*; *Where it came from* (client · source · venue · activity, with drill-down and client concentration); *Expected*, with one-tap **Received** and **Remind**, plus next month's payment from each recurring client with nothing expected yet (**Expect it** / **Not this time**). Profit, tax detail and unusual payments live in Reports and Income |
| **Income** | Every payment, expected ones grouped on top with their month; search; filters (client, source, venue, activity, tax, status); CSV |
| **Costs** *(optional)* | Every cost, unpaid ones on top; *Usually paid by now* (recurring costs not yet recorded this month); filters (kind, venue, client, activity, status); CSV |
| **Reports** | **Review**, **Clients & work** (by client, work type, venue or source, ranked by what you kept), **Venue deals** *(deals)*, **Profit** (P&L with break-even, cash flow) *(costs)*, **Tax** *(tax)*, **Print** *(printable)*. The period at the top is the only filter |
| **Settings** | Sections, each folding: *Your data* (device or Notion, demo load/clear/reset); *Appearance & guide* (theme, **Show hints**, the welcome guide); *Features* (seven switches, **Everything**, back to simple start); *Costs and cash flow* (opening cash; your own data only, with costs on); *Tax profile*; *Target and flags* (monthly target, unusual-payment flag); *Clients, sources & venues* (search past 12 entries); *Backup & export* (backup, restore, CSV) |

Periods: this week (Monday-based), this month, last month, this year, custom. One
selection drives Overview, Income, Costs and Reports; no screen has a range of its own.
Expected payments and costs still due show in Income and Costs whatever the period.

### Entering things
- **Income:** amount + client is enough. The client field is a search box (see *Clients at
  scale*): with nothing typed it lists recent clients, then businesses. A client's last
  *received* payment prefills source, venue, activity, currency, description, sessions and
  hours. Any payment can be **copied** (dated today). **Sessions** (default 1: a
  4-session package is 4, a platform payout its sessions) and optional **Hours** feed the
  per-session and per-hour figures and the venue deals. Foreign currency gets the
  ECB rate for the day from Frankfurter, editable because the BNR rate is what's declared.
- **Costs:** amount, what it was, kind (direct / operating / depreciation / interest / tax /
  investment / financing) and category. *Repeat a recent cost* offers the five costs paid
  most often in the last six months (rent, Zoom, the accountant) as one-tap copies.
  Linking is optional: a *direct* cost linked to a venue (else a client) comes off the
  nearest payment there in what Clients & work counts as kept; activity is for sorting and
  filtering.

### The welcome guide
Nine steps on first open (`components/Tour.tsx`, Release 1), at most three short points each.
Seven carry their features' switches: insights; expected payments; venue deals; costs; printable
reports and foreign currencies (one step, two switches); refunds; tax.
The last step picks between the demo and your own data, then **Start**. Skip, Back and the
forward button keep the same places on every step. Its checkbox, "Show this guide next time",
decides whether it returns. It starts unticked, so Skip, close or Start all dismiss the guide
for good unless the box was ticked (audit B-08); Settings can switch it back on or show it now.

### Reports (simplified 25 Nov 2026)
Six tabs at most, as links (`#/reports/<route>`), so back and forward work and old links
land: **Review** (`insights`), **Clients & work** (`earnings`; the old Breakdown routes
`clients|venues|activities|sources` open it on that view), **Venue deals**, **Profit**
(`pnl|cashflow`), **Tax**, **Print**. The report bar sticks under the header
(`--inflow-header`, measured in `App.tsx`). There is no report filter bar any more: the
period is the only filter, so nothing narrows a report out of sight. On a phone the tabs
are a three-column grid with no sideways scroll.

**Clients & work** (`lib/earnings.ts`, `screens/Earnings.tsx`) ranks by what you kept:
income less each payment's venue fee and the direct costs that belong to it (`recordCosts`:
each direct cost goes to the nearest payment, within a month, at its venue, else with its
client). Each row has
sessions, kept a session and, when every payment has hours, kept an hour; the detail shows
the lowest and highest session and the parts behind it (venues, or clients when ranking
venues).

**Review** follows WhereItWent's order (`lib/review.ts`, `screens/Insights.tsx`):
- *Understand*: "<period> in review", the summary as rows (`reviewHighlights`: came in,
  you kept, top client, biggest rise, biggest drop, needs a look), and *Copy summary*, which
  copies the sentence form (`reviewSummary`).
- *Main movers*: the biggest changes vs the period before, across clients, venues and
  activities (at most three from one), with a client who stopped included. Drawn either side
  of zero: green up, amber down.
- *Who carries the income*: a donut by client, venue, activity or source.
- *Act*: pain points and wins.

A section index under the tabs lights the section in view and scrolls to it. A comparison that
reaches before the first record says so instead of quoting "+1644%".

Charts follow the dataviz skill's validated palette (`--chart-1…5`, light and dark).
Part-to-whole is a donut (`components/Donut.tsx`: five named slices plus "Other", tap a slice
or its key row to narrow the screen) on the Overview and in the Review, Income ("Where it came
from") and Costs ("Where it went"). *(An earlier version used a segmented bar, `ShareBar`; it
is still in `components/charts.tsx` but no screen uses it.)* Profit has monthly income vs
costs bars (`MonthlyPair`).

Navigation: a drill-down from a report leaves a trail (`app/trail.ts`), and Income offers
"← Back to <report>" (`components/BackBar.tsx`). Month headings on Income and Costs stick while scrolling. Tapping the
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
    (`venueDeal`: each received, non-reimbursement payment at a venue counts its `sessions`,
    1 unless it is a package or a payout; a fixed fee is paid per session);
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
*(As first built; since then the toggle has four views, Client / Work / Venue / Source, a row
shows kept an hour when hours are recorded, and "kept" takes each direct cost from the nearest
payment, not only the same day. The paragraph at the top of this section is current.)*
- A summary of income, costs and kept, then one toggle (By client / By work type).
- A list ranked by total kept. Each row shows sessions, kept a session, and a bar of kept (green)
  against costs (amber). Tap a row for income, venue fees, direct costs, kept, the lowest to
  highest session, and the venues involved.
- "Kept" is the existing per-payment rule, `recordCosts` in `lib/insights.ts` (`takeHome` is
  built on it): income less the venue's deal cost and the direct costs linked to that venue
  that day, shared across that day's payments.
- A session is a received, non-reimbursement payment in the selected period (now: the
  sessions it covers). The global period is the only filter.

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
| intro-clients | individual clients only, ≥ 5 first paid between 12 and 2 months ago (the title says "this year"), and more than half never came back (a tip: some first sessions never turn into more) |
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
- **The tour** gives two to four ticked points per step *(now at most three; see The welcome guide)*.
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
  history so Back doesn't reopen them) and the Review (`#/reports/insights`). On a keyboard,
  `N` adds and `/` searches.
- Insight links land on their section (`#/reports/insights/heat`, `#/reports/deals/verdict`).
  A grid with fewer than two rows or columns says so instead of drawing one. *(Historical: the
  heat map and verdicts are gone. Insight links now open `#/reports/earnings`,
  `#/reports/deals`, `#/reports/tax`, `#/costs` or `#/overview`.)*

### Printable reports
Four reports, each with when to print it and what it holds (`PRESET_ADVICE`):
- **Month at a glance**: headline, *In short* with the movers, top clients, pain points.
- **Year in review**: adds the trend, venues, activities and the P&L.
- **Client statement**: asks for the client first.
- **For my accountant**: sources, P&L, tax, every payment with notes.

Optional sections (`SECTION_LABEL` in `lib/report.ts`) include *What you kept, by client &
work* (the same figures as Clients & work; offered with costs or venue deals on). The P&L
prints each cost's categories; the tax section ends with "still to set aside", as in the app.

Dates follow the selected period, with one tap to the whole year. Title, sections, rows,
comparison, currencies and notes wait under *Adjust this report*. `lib/report.ts` renders one
self-contained HTML document (inline CSS and SVG, every user string escaped). A year's P&L
uses smaller type so twelve months fit A4.

## Money in: three definitions (26 Nov 2026)

Used the same way on every screen, report and export (`lib/analytics.ts`: `isCostRecovery`,
`earned`, `recovered`, `cashOf`; audit B-01, B-04):

- **Service revenue**: received payments for work, every activity except *Reimbursement*. The
  Overview headline, Income's "earned", the trend, breakdowns, movers, insights, Clients & work,
  Venue deals and P&L *Revenue* all use it.
- **Cost recovery**: received payments with activity *Reimbursement*: money back for a cost paid
  on a client's behalf. Never revenue, margin or earnings; shown on its own line (Overview hero,
  Income header and month totals, Clients & work summary, P&L "+ Cost recovery (reimbursed)",
  cash flow "Cost recovery received", print cards and payment list, CSV `Kind`). The cost it
  repays stays a cost; in the P&L the recovery comes in beside it, so profit counts both. Not
  assumed non-taxable: taxability stays a per-payment choice, and the Tax report's split covers
  all money received.
- **Cash received**: both, less tax the payer withheld (which never reached you). Cash flow's
  "Income received (after tax withheld)" and the CSV's `Cash received RON` use it. In the P&L the
  withheld tax is part of *Tax paid* (detail "Withheld by payers"), so profit and cash count it
  once.

`summarise(service, recovery)` returns `total` (service revenue), `costRecovery`,
`receivedGross` and `cashIn`; `lib/agreement.test.ts` checks that the Overview summary, P&L,
Clients & work, cash flow, print and CSV agree for one period.

### Receiving an expected payment

One rule wherever it starts (`lib/receive.ts`, `app/receive.ts`, `components/ReceiveActions.tsx`;
audit B-02, B-03, E-01). **Received** marks all of it received today in one tap; **Part…** asks
how much and when. Every expected payment has both, on the Overview and in Income; its form has
**Part…** too (since Release 1), beside the Status field, which marks all of it received.
- *All of it*: the expected record becomes received on the receipt date, at that date's rate
  (fetched; offline, the last rate used, else its own), with the tax reserve suggested unless it
  was set by hand (`reserveSource: 'manual'` is kept).
- *Part of it*: a new received payment holds the part, with the sessions and hours and a share
  of any tax withheld; the expected record stays, holding the balance, with 0 sessions so a
  session is never counted twice. The balance can be received the same way later.
- In the edit form, switching an expected payment to *Received* does the same: today's date
  unless changed, that date's rate unless typed in the form, a suggested reserve unless set by
  hand.

Sessions may be 0 (a balance payment); every per-session figure skips it.

**Duplicate warning** (`lib/guards.ts`): the same client, amount and currency on the same day,
or on the next or previous day with the same description. Sessions two or more days apart (a
twice-a-week client) are not questioned (audit B-06).

**Empty reports:** with nothing recorded, every report shows what it will show and *Add your
first payment*; with data but an empty period, the Review says so and offers the whole year
(audit C-04).

## Estimated available to spend (26 Nov 2026, audit F-01)

Shown with Tax or Costs on (with both off it would only repeat what came in). An Overview
panel under the period's income, never in its place: roughly what of this year's
money is yours to use (`lib/available.ts`). Always 1 January to today, whatever period is
picked; it opens to show every part.

| Line | What it is |
|---|---|
| Cash on 1 January | Only with an opening cash balance set (Cash flow); the figure is then a cash estimate. Without one it starts at 0 and reads as this year's money. |
| Received | Cash that arrived: payments and cost recovery, less tax withheld at source (it never arrived), less refunds paid back. |
| − Costs paid | Everything paid this year, depreciation aside. Off with costs off. |
| − Tax still owed | This year's taxable income so far × the year's effective rate (`taxPosition`, the same figure as the Tax report's), less tax withheld, less tax paid towards this year. Never below 0. Off with tax off. |
| − Costs due | Costs marked due, dated up to 30 days ahead. |

Withheld tax counts once: it is neither cash in nor still owed. Reserves set aside are not
available: that money is the tax still owed. Expected payments count only once received.

**Tax paid during the year.** A tax payment is a paid cost, so it lowers the cash; it lowers
what is still owed only when it is *for* this year: PFA (sistem real, normă) declares and pays
the year's tax the following spring, so tax paid this year is taken as last year's; SRL micro
pays quarterly, so payments after 25 January are this year's; under a custom profile all of
it is this year's. The breakdown says which way each went. **Not included:** last year's tax
still unpaid. An estimate from what is recorded, labelled as one, not advice.

The "still to set aside" of the Tax report, the printable report and this panel is now one
function (`taxPosition`, `tax/estimate.ts`); it was written out twice before.

## Release 2 (in progress): Import from Revolut — experimental (26 Nov 2026)

**Revolut provides transaction data; InFlow provides business context.** A Revolut statement
(CSV) is read in the browser, each transaction is reviewed, and the ones you say are income,
costs or refunds become ordinary `IncomeRecord`, `CostRecord` and `Refund` rows. There is no
ledger of its own, no bank connection, no sync and no AI. Off for everyone until switched on in
Settings → Features ("Import from Revolut (experimental)"); **"Everything" never switches it on**
(`EXPERIMENTAL` in `store/settings.ts`). Not in the welcome guide.

**Layers.**

| Layer | File | What it does |
|---|---|---|
| CSV | `lib/import/csv.ts` | RFC 4180; BOM; delimiter `,` `;` or tab read from the header line; 5 MB / 50,000 rows at most |
| Statement | `lib/import/revolut.ts` | Columns by name, conflicts and gaps sent to manual mapping; decimal mark and date order from the file or asked; every row read or reported; see "Statement formats" |
| Classification | `lib/import/classify.ts` | What each row is, whether InFlow already has it, rules, suggestions |
| Plan | `lib/import/plan.ts` | Rows to records with InFlow's own rules; why a row waits |
| Saving, undo | `app/import.ts` | Saves through the provider, row by row, with a ledger; batch undo |
| History | `store/imports.ts` | Batches, ledger, rules, your own names; per data set |
| Screens | `screens/Import.tsx`, `screens/ImportSettings.tsx` | `#/import` (from Income), Settings → Import from Revolut |

**Statement formats** (`lib/import/revolut.ts`; fixtures in `lib/import/fixtures/`, all invented).

*What the evidence supports.* Revolut publishes **no** CSV layout for Revolut Pro, and Pro has no
API. Its help centre (pages refuse automated reading; known from search excerpts, Nov 2026) says
Business statements use UTC by default, that CSV statements can carry both local and UTC times,
and that the Business *expenses* CSV holds: started and completed time (UTC and local),
transaction ID, status, type, description, original currency and amount, payment currency,
amount, fee. Open-source importers built on real *personal* exports agree on `Type, Product,
Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance` (dates
`YYYY-MM-DD HH:MM:SS`, dot decimals, money out negative, the fee separate and on top, one file per
currency). Neither source is an official Pro schema.

*The app's language.* Revolut's community reports that a CSV export follows the app's language:
a user with the app in French got French headers, comma decimals, spaces between thousands and
semicolons. The translated header names themselves are published nowhere, so InFlow guards three
ways (`lib/import/locale.ts`):
1. **Words** in English, Romanian, German, French, Spanish, Italian, Portuguese, Polish, Dutch,
   Hungarian and Czech, for headers, states (completed, pending, reversed, declined, failed,
   cancelled), types (card payment, transfer, exchange, top-up, fee, refund, cash), "Payment
   from X" / "To X" wording and month names. All plain translations: assumptions, not evidence.
2. **Formats** whatever the language: decimal comma or point, thousands by point, comma, space,
   no-break space or apostrophe, a typeset minus (−), currency symbols and names around the
   number (€, lei, zł, Kč, Ft); dates as ISO, `20260903`, `01.09.2026`, `01/09/2026` or
   `01-09-2026` (order from the file, else asked), the month in words in any of the languages
   above in any order (`1. März 2026`, `Mar 1, 2026`, `1 de marzo de 2026`, `2026. márc. 1.`),
   with 24- or 12-hour times; an unsigned amount with a direction column (`Af`/`Bij`,
   `Debit`/`Credit`, `S`/`H`); a currency in the amount's header (`Bedrag (EUR)`).
3. **Anything else is asked, never dropped.** Headers in a language with no words here (Swedish,
   Cyrillic or Greek: kept as written, not erased) go to the column picker, pre-filled from what
   each column holds (dates, money with both signs, currency codes, states, the most varied text)
   and marked *suggested: check it*. A state or direction word InFlow doesn't know is asked once
   ("State “SLUTFÖRD” means…"), never read as completed or as pending. What you settle is kept on
   this device per layout (the header row, `inflow:import-layouts`: choices only, never file
   contents), so the next export of the same layout reads at once, saying so, with *Set it up
   again*. A row whose values don't line up with the header (an unquoted comma) never asks a
   question: it is reported on its own.

Fixtures for each: `en-GB.csv`, `en-US.csv`, `de-DE.csv`, `fr-FR.csv`, `es-ES.csv`, `nl-NL.csv`,
`sv-SE-unknown.csv`, `bg-BG-headers.csv`; tests in `lib/import/international.test.ts`.

*Layouts read:*

| Layout | Basis | Fixture |
|---|---|---|
| Personal statement, columns above | Third-party importers (real exports) | `personal-standard.csv` |
| Business-style: `Date started (UTC)`, `ID`, `Payer`, `Orig currency`/`Orig amount`, `Payment currency`, `Amount`, `Total amount`, `Fee`, `Fee currency`, `Balance` | Fields from Revolut's help centre; header wording assumed | `business-utc.csv` |
| Money in / money out instead of a signed amount | Common bank CSVs (assumed) | `ro-money-in-out.csv` |
| Romanian names, `;`, `DD.MM.YYYY`, `1.250,00` | Common Romanian bank CSVs (assumed) | `ro-money-in-out.csv` |
| Date, description, amount only; the currency chosen for the file | Assumed | `minimal-file-currency.csv` |

*Recognised names* (case, accents, spaces, punctuation and a trailing time zone in brackets ignored):

| Field | Names | Needed |
|---|---|---|
| Date | Started Date, Date started, Start date, Transaction started, Started, Date, Transaction date, Created, Data, Data inceput, Data tranzactiei | a date or a completed date |
| Completed date | Completed Date, Date completed, Transaction completed, Completed, Booking date, Data finalizare, Data decontarii | (used when filled) |
| Amount, signed | Amount, Amount in payment currency, Payment amount, Suma | this, or money in / out |
| Money in / out | Money in, Paid in, Credit, Incoming, Intrari, Incasari / Money out, Paid out, Debit, Outgoing, Iesiri, Plati | |
| Currency | Currency, Payment currency, Moneda, Valuta | or chosen for the file |
| Description | Description, Details, Narrative, Descriere, Detalii | optional |
| Other party | Counterparty, Merchant, Payee, Payer, Beneficiary, Name, Nume, Beneficiar, Platitor (several allowed; first filled one used) | optional; else read from "Payment from X" / "To X" / "Plată de la X" |
| Fee, fee currency | Fee, Fees, Comision / Fee currency, Moneda comision | optional |
| State | State, Status, Stare | optional (absent: completed) |
| Type, product | Type, Transaction type, Tip, Tip tranzactie / Product, Produs | optional |
| Reference, balance, ID | Reference, Payment reference, Referinta / Balance, Sold / ID, Transaction ID, Id tranzactie | optional |
| Rate, original | Exchange rate, FX rate, Rate, Curs / Orig amount, Original amount / Orig currency, Original currency | optional, for the record only |

The table lists the English and Romanian names; the other languages' are in `lib/import/locale.ts`.
A direction column (`Af Bij`, `Debit/Credit`, `Soll/Haben`, `Sens`…) turns an unsigned Amount into money in or out.

Recognised and deliberately **not used**: Total amount (it may include the fee), Card number,
Card label, Card state, MCC, Account, beneficiary account details, Related transaction ID, Spend
program, Category, Notes, Tags. Anything else is listed as not recognised.

*Never guessed; asked instead* (`Statement.needs`; while any is set, nothing is read and the
Import screen asks; answers are kept per layout on this device):
- **Mapping**: a date, an amount or a currency column can't be found; two columns claim one
  meaning (`Amount` and `Suma`, two columns both called "Amount", two "Name" columns); a signed
  amount and money in/out together; a direction column without an amount; one column mapped
  twice; a manual mapping pointing at a column the file doesn't have. Exception: a UTC and a
  local column of the same date: the local one is used.
- **Currency**: no currency column (and none in the amount's header): choose the file's currency.
- **Date order**: slash or dash dates where no day is above 12 (`03/04/2026`), or some day-first
  and some month-first. Dotted dates are taken as day first (European).
- **Decimal mark**: an amount that reads two ways (`1,250`) when the *amount column itself* shows
  no decimal mark. Never inferred from the balance, fee or another column (audit A-09).
- **Time zone**: times with no zone (no `Z`, no offset, no "(UTC)" or zone in the header) when
  any of them falls where Bucharest time and UTC give different days (late evening and the small
  hours). Elsewhere both readings give the same day, so nothing is asked.
- **State**: a file with no state column: "every row is completed?" A state word in no known
  language: what it means. An *empty* state cell is never read as completed: that row is shown as
  "no state given" and not imported (audit A-19).
- **Signs**: a signed file where every amount is positive yet some rows are card payments, fees
  or cash: "money out has no minus? map the columns" or "they are all money in" (audit A-21).

*Accounting date and time zone* (audit A-13..A-17). A transaction belongs to the day it happened
in **Europe/Bucharest**: the completed date if there is one, else the started date. A time with
`Z` or an offset, or in a column labelled "(UTC)" or with a zone ("(Europe/London)"), is converted
to Bucharest time (so 31 Dec 22:30 UTC is 1 Jan, a new tax year). A time with no zone is
Bucharest time unless you say UTC (asked only when it matters, above). A date with no time is
taken as written. A completed time before the started one is noted. `startedAt` is shown in
Bucharest time.

*Values.* Each money column's decimal mark is read from its own values (`1.234,50`, `12.50`,
`1.234.567` say which). Refused, with the line and the reason: a value that contradicts its
column's mark (`12,50` in a dot column), more than two decimals, a badly grouped number
(`12.5.0`), **two signs at once** (`(-12.50)`, `-12.50-`: previously read as +12.50, audit A-07),
more than 13 whole digits. Currency symbols € £ and "lei" are read; "$" and "kr" are refused
(several currencies each). An empty fee, balance or reference is *not given* (`null` / empty),
never 0.

*Optional fields never cost a transaction* (audit A-10, A-11): an unreadable fee, balance,
exchange rate or original amount is noted on its line and left unknown; the transaction is kept.
A fee in another currency than the transaction, or fees of both signs in one file (which are
charges can't be told), are not imported, with a note saying to add them by hand.

*Every row has one outcome.* A data row is read (and then reviewed), or reported with why:
malformed CSV (text after a closing quote, a quote never closed on the last line), more values
than columns (an unquoted delimiter: never read shifted), cut short, no date, an impossible date or
time, no or zero amount, both money in and out, negative money in, a negative amount with a
direction column, an unknown currency, the same bank ID twice. Notes never remove a row. While a
question above is open, no row is read at all.

*CSV syntax* (`lib/import/csv.ts`, audit A-01..A-06): RFC 4180 quoting; CRLF, LF and a lone CR;
a UTF-8 byte-order mark. The file is decoded as strict UTF-8 (another encoding is refused rather
than turning letters into "�"). The 5 MB limit is in bytes. A header that splits equally by two
delimiters is refused. A quote inside an unquoted field is kept as a character (it can't shift
columns); text after a closing quote makes the row malformed. A quote left open before the last
line would swallow the lines after it, so the whole file is refused.

**Mapping example.**
`TRANSFER, Current, 2026-03-02 09:15:01, 2026-03-02 09:15:44, Payment from Acme SRL, 1200.00, 0.00, RON, COMPLETED, 5200.00`
→ money in, 1,200 RON on 2 Mar (the completed date), counterparty "Acme SRL"; with a client
named "ACME S.R.L." it is suggested as income from that client, with the source and activity of
their last received payment, no venue, **no sessions** (0: counted in totals, not per session,
until you add them), no tax withheld, tax classification and reserve as the payment form would
suggest, and `importMeta { key, fp, batch, counterparty }`.
`TRANSFER … To Sala Lumina, -400.00, 2.00` → two rows: 400 to Sala Lumina (yours to say what it
is) and a 2.00 bank fee (operating, bank fees). The fee is never added to the 400.

**Fields kept from the file:** date (completed, else started), direction, amount, fee,
currency, type, state, description, counterparty, and on each record only `importMeta`: its key,
its content fingerprint, the batch and the counterparty name. Balance, reference and the bank's
id feed the identity and are not stored. The original-currency amount is shown for the record and
never imported. The file itself is never stored or sent.

*Counterparty columns* (audit A-22, A-23): a Payer column names the other party only for money
in, a Beneficiary/Payee column only for money out (the other side is you); a neutral column
(Counterparty, Merchant, Name) for either. With none on the right side, the description is read
("Payment from X"). The other party is a suggestion for matching a client, never a new client.

**Duplicates and identity** (audit A-26..A-33, E-01..E-03). Each transaction has a **key**:
the bank's id (`rv:id:…`) when the file has one, else its **content fingerprint**: the instant it
started (UTC, to the second; the date when there is no time), currency, signed amount and the
balance after it, or, with no balance column, its description and reference. Not the type,
product or fee (they change with the app's language and layout), and never the file name, row
order or amount and date alone. Both key and fingerprint are stored on the record.
- *Already in InFlow* (exact): an entry carries the key, or the same fingerprint (so an export
  with ids finds rows imported from one without, and back). Two **different bank ids are never
  the same transaction**, whatever their content. Also exact: the ledger says an import made it
  and it was deleted since (stays out unless *import it anyway*).
- The **same bank id twice in a file** is one transaction listed twice: read once, the repeat
  reported. Twice with different details: neither row is read.
- **Identical rows with no id and no balance** can't be told apart (from each other or from a
  later export): they are numbered in file order (`#2`) and each is a *possible duplicate* that
  needs *import it anyway*. The numbering is not a bank identity: a later export holding only some
  of them can't be matched one-to-one, which is why each needs your decision.
- *Probably already in* (likely): one entry you typed, same currency and amount, same day, same
  client (or name in a cost's description). *Possible duplicate*: same currency and amount within
  3 days of an entry you typed or one imported before fingerprints existed, a near-identical row
  of this file, or a row whose earlier save never answered. Neither is imported until you link
  it, leave it out or say *import it anyway*.
- **Linking** and **receiving** need the target confirmed on the row ("Yes: this transaction is
  that entry"), as does a suggested refund's payment: a matching amount is not proof. Linking
  changes only `importMeta` on your entry, nothing else (E-02).
- Guarantees, tested: the same file again, an overlapping part, another order: nothing more is
  made (E-01). A reworded description with the same balance, the same transaction in UTC and in
  Bucharest time, and with and without its id: recognised (A-29, A-30, A-32).
- Limits: with no id *and* no balance, a reworded description is a new fingerprint (shown as new;
  a manually entered match would still be offered as possible). A layout that gives only a
  completed date in one export and a started time in another yields different fingerprints.
  Keys from the first version of this importer (26 Nov 2026, before fingerprints) can't be
  recognised: those rows are offered as possible duplicates instead (A-44).

**Classification.** Money in: income, money back for a cost (with the cost, part of it is
fine), refund from a supplier, transfer, leave out. Money out: business cost, bank fee, refund to
a client (against one of their received payments, checked as the refund form checks it),
transfer, personal, leave out. Pending, declined and reversed rows are shown and never imported.
Suggestions, in order: your choice on the row > a rule for this exact counterparty > a rule for
words in the description (longest first) > the plain reading (an exchange, ATM, top-up, pocket or
one of *your own names* is a transfer; FEE is a bank fee; a client's exact name on money in is
income from them, or the receipt of their expected payment, to confirm; a client's name on money
out with a payment to refund is a refund, to confirm). **Money in from a name that is no client
is not taken for income** (audit A-35): it needs a decision. Two clients whose names fold the same
("Acme SRL", "ACME S.R.L.") are never told apart for you (A-34). Rules of the same standing that
disagree are not applied (A-36); a client, source or venue a rule names that no longer exists is
dropped with a note, and a stale id blocks a row (A-37, A-38). A refund from a supplier is shown
as **unsupported**, counted apart, never "set aside" (A-42). **Money out is never called business or personal for you**:
words like "Zoom" only suggest the category if you say it was a cost. Deductibility starts where
a cost typed by hand starts (by its kind) and is shown to check.

**Rules** (Settings → Import from Revolut) are made only by ticking *Next time, treat … the same
way* on a completed, new row you decided, never on a possible duplicate, a link or a receipt, and
saved only once that row is imported. A rule matches the counterparty exactly (accents, case,
spaces and dots aside: "ACME S.R.L." is "Acme SRL") and one direction. It can set the kind,
client, source, venue, activity and cost category: the only way a venue is ever filled in for
you. Rows say *your rule* when one applied. Rules can be changed (kind) and deleted.

**Rates.** Each foreign-currency row takes the ECB rate for its own date (`fetchRonRate`), once;
offline, the last rate used for that currency. A row with no rate waits.

**Saving and undo.** Just before saving, the plan is made again from the data as it is now; if it
differs from what you reviewed (an entry edited or deleted meanwhile, another tab, a rate now
known), nothing is saved and the summary is shown again (E-08). One import runs at a time across
this device's tabs (a lock; one left by a closed tab is taken over after two minutes, E-04).
Rows are saved one at a time through `saveRecord`, `saveCost`, `saveRefund` (with every check
those make). The import key is part of the saved row itself (the Notion "Import" column), so a
row and its marker can't be separated. Each row is marked *pending* in the ledger before it is
sent: on this device a failed save wrote nothing and the mark is cleared; in Notion, where a
page can be made with its answer lost, the mark stays, the row is shown next time as *possibly
already in*, and if imported anyway, Notion is searched for the page first and that page is kept
(E-03). Stopped part way, the same file again carries on. **Undo** deletes what the import
created (the confirmation says how many were edited since), unmarks what it linked, puts expected
payments back as they were, and keeps anything something newer depends on (a refund added since,
a reimbursement naming a cost), or a balance still expected that you changed since (E-06),
saying so. An undo that can't finish says how much failed, keeps the batch undoable and its ledger
entries for what is still there; undoing again finishes it, and undoing a finished undo changes
nothing (E-05, E-07). Clients made during the review stay.

**Device and Notion.** `importMeta` lives on the row: on the device in the data, in Notion in an
"Import" text column on Income and Costs, added the first time it's needed. Without permission to
add it, an imported row is refused rather than saved unmarked. Import history (batches, ledger,
rules, own names) is kept on this device per data set (`import:device`, `import:demo`,
`import:notion:<db>`), and in device backups (`imports`, optional: older backups restore as
before; a damaged history is read as far as it goes and never refuses a backup). A second device
on the same Notion still recognises every imported row by its key; only its set-aside decisions
and rules are per device. **Not guarded:** two devices importing the same new transactions into
one Notion at the same moment (the lock is per device); the second would find the first's rows
only after a reload.

**Clients & work** shows, for the period: paying clients (clients, never payments), new and
returning, income per paying client net of refunds, and payments with no client, naming the
imported counterparties among them (`lib/clientMetrics.ts`). Cost recovery is left out.

**Privacy.** Parsed locally; nothing from the file goes to any server or AI. The only request an
import makes is the ECB rate (currency and date). Descriptions and amounts are not logged.

**Limitations.**
- **No genuine Revolut Pro export has been tested.** No official Pro sample or schema exists
  publicly. Tested layouts: the personal statement layout documented by third parties; a
  Business-style layout *built from* the field list in Revolut's help centre (its header wording is
  an assumption; it is not a real Business or Pro export); common bank conventions; eleven
  languages as plain translations. All on invented fixtures (`lib/import/fixtures/`). Until a real
  Pro export has been read and checked row by row against the app, this is for controlled testing.
- Not read: Excel, PDF, two-digit years, weekday names inside a date ("Tuesday 1 March 2026"),
  the original-currency amount as the amount (shown for the record only), "kr" and "$".
- A supplier's refund has nowhere to go in InFlow's model: shown as unsupported, never imported.
- A reimbursement is linked to one cost (part of it is fine, never more than is left of it, same
  currency); a payment that settles two expected payments can't be split here.
- Rates are fetched one currency and date at a time; reserves for several new payments in one
  import are each suggested against what was recorded before the import.
- Set-aside decisions, rules and layout answers stay on this device (a backup carries the first
  two).
- Expected payments are offered only in the same currency, for a client's exact name or the exact
  amount, and always need confirming.
- The audit report with every scenario and result: `src/inflow/lib/import/audit.test.ts`,
  `src/inflow/app/importAudit.test.tsx` (ids A-nn and E-nn).

## Release 1, the first stable release (26 Nov 2026)

Hardening after the acceptance review (findings D1–D8). Notes for users: `INFLOW_RELEASES.md`;
the number shows at the foot of Settings (`app/release.ts`).

**A refunded payment keeps what its refunds depend on** (D1, D2; `paymentEditError`,
`lib/refunds.ts`). Once a payment has a refund it stays Received (as Expected its refunds would
drop out of every figure), keeps its currency, can't be reduced below what has been refunded, and
can't be dated after its first refund. The form locks Status and Currency and says why, and
refuses the amount or date with the reason; the provider checks again on every save, whichever
screen it comes from. Nothing is deleted or detached: if the payment was wrong, delete its
refunds first.

**The refund form starts at what arrived** (D4; `defaultRefund`). With tax withheld, the default
is the amount less the withheld tax (in the payment's currency, at its rate), less what was
already refunded; the form shows gross, what arrived and the withheld tax, and says that a refund
doesn't reverse the withheld tax. Any amount up to what is left can still be entered.

**No negative tax** (D5). When refunds take a year's recorded taxable income below zero, the
estimate counts it as 0 (`projectYear`, `taxPosition`): no tax owed, no credit. The transactions
and the raw total stay as they are (`taxableGross`, `rawTaxable`); the Tax report and the print
say a refund larger than the year's income is a question for the accountant. "Ahead of your
reserve" now appears only when something is actually ahead; nothing owed and nothing set aside
reads "Nothing more to set aside".

**Available to spend adds up as shown** (D6; `shownAvailable`). Each line is rounded to whole lei
once and the headline is their sum, so the breakdown always adds up to the figure above it; the
calculation keeps its bani. "Not counted: tax still unpaid from last year" and "not a bank
balance" now sit under the headline, not only in the breakdown.

**Backups check their refunds** (D7; `readBackup`). Each refund needs an id, a payment that is in
the backup, a date, an amount, a currency, a rate and an amount in lei; one that doesn't rejects
the whole file before anything is written ("Nothing was restored"). Backups from before refunds
read with none; a missing note reads as empty.

**Venue deals rank sessions, not refunds** (D8; `venueDeal`, `refundsWithoutSessions`). A refund
in the period still comes off the venue's revenue (as in Profit) and shows as "after X refunded";
it is never a session, never a losing one, and a period holding only a refund at a venue lists no
deal there, naming it below instead ("Also this period: X refunded at …, for sessions in an
earlier period").

**Copying to Notion** looks up lost answers by InFlow ID (D3; see "Notion reliability").

**Also:** Part… in the payment form; *partly reimbursed* on costs; the design system's segmented
controls and small buttons reach 44 px through an invisible hit area, scoped to InFlow's page
(`[role='radiogroup'] > [role='radio']` and `.hit`; `src/ds` unchanged for the other apps); the
report sub-tabs and insight votes the same.

**Quick start and guide** (the user's decision, Release 1). A new user starts with income, insights
and printable reports, nothing else (`SIMPLE_FEATURES`); expected payments are a switch away. The
welcome guide has nine steps; *Print it, in any currency* carries the Printable reports and Foreign
currencies switches.

**Compatibility.** Workspaces in Notion with refunds need Release 1 or later on every device (an
older build counts a Refund row as income). The Income, Costs, Clients, Sources and Venues
databases gain an **InFlow ID** text column on the first copy from a device; ordinary use doesn't
need it. Device data: no new migration (schema stays 2); backups keep version 1.

**Known limitations, unchanged by design in this release:**
- *Effective-rate rounding* (pre-existing): the year's estimate is rounded to whole lei before the
  effective rate is derived from it, so a 10 % custom rate works out at about 9.99 %, and "owed so
  far" can be a leu off a hand calculation.
- *Expenses from costs* (pre-existing): with it on (PFA real, SRL), the first recorded deductible
  cost replaces the typed annual-expenses estimate with the recorded costs, which can move the
  estimate, and with it Available to spend, sharply early in a year.
- *PFA tax attribution* (agreed): tax paid in the year is taken as last year's, so a PFA's advance
  payments for the current year lower the cash and do not lower "tax still owed".
- *Last year's unpaid tax* is not in Available to spend (said under the headline).
- *Refund exchange rate* (agreed): a refund uses its own date's rate; the difference from the
  payment's rate stays in revenue.
- *VAT-registered use* is unsupported; there is no VAT accounting.

## Usability, performance and workflow (26 Nov 2026, audit C, E, F-03, G)

- **A shorter payment form (C-01, E-03).** Amount, currency, client, date and status first;
  then description, people, sessions, hours, source, venue, activity, recurring, the
  reimbursement's cost and notes, always in view. (A *More details* fold hid them until 26 Nov
  2026; it was removed: nothing about a payment is folded away. Only the optional Tax section
  still folds.)
- **Plain words first (C-03).** P&L: *Costs of the work (direct, COGS)*, *Left after the work's
  costs (gross margin)*, *Running costs (operating, SG&A)*, *Profit before equipment write-off
  (EBITDA)*, *Equipment written off over its life (depreciation)*, *Profit from the work (EBIT)*,
  *Loan interest*. The cost form's kinds read the same way; tags on Costs use short plain names
  (`COST_GROUP_PLAIN`). Notion's "Group" options and the CSV keep `COST_GROUP_SHORT`: a closed
  vocabulary, unchanged. The P&L's Revenue opens into its refunds like a cost line into its
  categories.
- **Touch targets (C-02).** Text links, chips, report tabs, donut keys, P&L and Tax rows and
  Settings headers answer a finger across at least 44 px, through an invisible extension of
  their hit area: nothing on screen moved. Measured at 360 px. Still under 44 px: the design
  system's `SegmentedControl` (27–40 px) and `Button size="sm"` (32–36 px), which `src/ds`
  owns for every app; changing them is a DS decision, not InFlow's.
- **Start here (C-05).** The rooms step shows only with venue deals on, as "Where you work
  (optional)".
- **The accountant's report lists every cost (F-03).** A *Costs* section (date, description,
  kind, venue or client, lei, deductible), paid ones totalled with the deductible part, due
  ones greyed. In the "For my accountant" preset; offered with costs on.
- **More ways to add a cost (E-02, E-04).** *Add a cost* on the Overview, under Available to
  spend; *+ Add a cost at {venue}* on each Venue deals row, the venue picked and *Room or venue
  hire* chosen.
- **A reminder for an expected payment.** Saving one (or moving its date) offers *Remind me*:
  a calendar file (`.ics`, `lib/ics.ts`) for the due date, all day, with a morning alert. The
  calendar app opens it; nothing is sent anywhere.
- **A reimbursement names the cost it repays** (`IncomeRecord.repaysCostId`, optional, shown when
  the activity is Reimbursement). On Costs the cost then shows *partly
  reimbursed · X lei* until the received reimbursements naming it cover it, then *reimbursed*
  (`reimbursedCosts`, `lib/finance.ts`: several add up, an expected one counts for nothing yet, a
  refund of one takes it back off). A link only: no figure changes. Notion: a "Repays cost" text column, added when first needed;
  the copy to Notion now copies costs before payments so the link points at the copied cost.
- **VAT-registered use is unsupported, and says so.** The VAT-registered setting explains that
  InFlow keeps no VAT accounts and, switched on, warns that income, the estimate and reserves
  would include VAT. Choosing "VAT applicable" on a payment says the label is only a label.
  The Tax report's panel is a *VAT threshold watch*: a running count to see the threshold
  coming, not VAT accounting, not a decision on whether to register. The welcome guide no
  longer says "VAT included".
- **Empty states.** Venue deals tells "no venue has a deal yet" (with a way to set one) apart
  from "none in this period".
- **Performance (G-01, G-04).** Cost allocation indexes payments by venue and client and finds
  the nearest date by halving (`nearest`, `lib/insights.ts`); `lib/scale.test.ts` checks it gives
  exactly the old rule's result on 5,000 payments and 600 costs. Measured there: `insights()`
  236 → 44 ms, `earnings()` 211 → 16 ms. The print preview renders once the options settle
  (300 ms, `useDebounced`); a download renders what is set at that moment. The Income list
  draws 200 rows at a time (*Show 200 more*), its totals always covering the whole list.
- **Unused code (G-03).** `ShareBar` and its styles removed.

## Refunds and venue-deal history (26 Nov 2026)

### Refunds

Optional: Settings → Features → **Refunds**, also in the guide; off by default, for new and
existing users alike. Off hides the action only (see "Feature switches").

A refund is its own transaction (`Refund`: payment id, date, amount in the payment's
currency, that date's rate, lei, note), stored beside the payments (`data.refunds`), never a
negative payment and never an edit to the original. Recorded from the payment itself: its
form lists every refund with its date and offers **Refund…** (or *Refund more (X left)*)
until it is refunded in full. Partial and several refunds are fine; together they can't
exceed the payment (`refundError`: refused in the form and again in the provider), can't be
dated before it, and only a received payment can be refunded. Deleting a payment deletes its
refunds, and *Undo* brings both back.

**How the figures take it** (`lib/refunds.ts`). Each refund becomes an *adjustment row*, a copy
of the payment dated the day the money went back with the amount negative, and every figure
reads `books` (the payments plus these rows; `state.tsx`), while lists and forms read `data`:

| Where | Effect |
|---|---|
| Overview, Income totals, Clients & work | Revenue (or cost recovery, for a reimbursement) less the refund, in the refund's period. Payment counts don't change. |
| Income list | The refund is a row of its own in its month ("Refund: …", −X), opening the payment; the payment is tagged *Partly refunded* or *Refunded*. |
| P&L | Revenue is net of refunds, with "of which refunds" beneath it. |
| Cash flow | "Refunds paid back", money out, on its own line. |
| Venue deals | Revenue at that venue less the refund. The venue's fee or share stays paid: InFlow doesn't assume a venue gives its cut back. A refund is never a "losing session". |
| Tax | Taxable income of the **refund's** year falls by it (cash basis, like everything else here). A refund in January of a payment from December leaves December's year as it was. |
| Tax reserves | The reserve stored on the payment is never rewritten (reserves are never recomputed). The year's estimate falls, so *still to set aside* falls too, and what was already put by shows as ahead. |
| Print, CSV | A refund row of its own: Kind and Status "Refund", negative amounts. |

An adjustment row covers no session, hours or people, carries no reserve and no withheld tax,
and is never recurring. Tax withheld by the payer on the original isn't reversed by the app:
what the payer does with it is between them and ANAF, so record what actually happens. How a
refund of income is treated for your tax is your accountant's call; the app's rule is only
that it counts when the money went back.

**In Notion** a refund is a row in the Income database with Status **Refund** and a
**Refund of** text column holding the payment's page id (positive amounts; the Status says
what it is). If the column is missing, InFlow adds it to the database (once); if the token
can't change the schema, the refund is refused with a message naming the column to add.
An InFlow from before refunds (any build before `6b8eaeb`) reads a Refund row as received
income, so it would count a refund as money in. Nothing written now can change what an old build
does: **every device that opens a Notion workspace with refunds must run Release 1 or later**
(Settings shows the release at the foot). An installed copy updates itself the next time it
opens online; to be sure, open InFlow online on each device and check the release before
recording the first refund. See "Release 1" below.

### Venue deals are kept per payment

Each payment at a venue stores the deal it was made under (`IncomeRecord.dealTerms`: deal,
fee, share, monthly rent). A new payment, or one moved to another venue, takes the venue's
deal as it is now (`stampTerms`, applied in the provider on every save); editing a payment
keeps its deal. Editing a venue's deal therefore changes only payments from then on: past
sessions keep what they cost. The payment form says when its deal differs from the venue's
current one and offers *Use the current deal for this payment*; Venue deals says how many
payments there were made under an earlier deal.

**Migration 2** (`store/repo.ts`, `normalise`; device data carries `schema`). What the deal was
when an old payment was made was never recorded, so payments saved before snapshots take the
venue's terms **as stored at migration**: every figure stays exactly as it was the moment
before, and later venue edits no longer reach back. Nothing is invented. It runs once, on
load, and is written back; backups restored from before it are migrated the same way.

**Notion** keeps the snapshot in a **Venue terms** text column (short JSON), added to the
database on first save when missing; without permission to add it, payments still save
without it. Rows from before snapshots fall back to the venue's current deal, and the first
time a venue's deal is edited InFlow first pins those rows to the old deal, so the edit
doesn't reach back there either.

*Also fixed:* Notion read a balance payment's 0 sessions back as 1.

## Costs, P&L and cash flow (optional)

`settings.features.costs` (an older stored `trackCosts` is migrated on load). **Cash basis**: income counts when received, a cost when paid; due
costs and expected income stay out until they happen. Structure (`lib/finance.ts`):

```
Revenue − Direct costs (COGS) + Cost recovery = Gross margin − Operating costs (SG&A) = EBITDA
− Depreciation = Operating profit (EBIT) − Interest = Profit before tax − Tax paid = Net profit
```

Revenue is service revenue. *Tax paid* is tax costs paid plus tax withheld by payers.

*Investment* (buying equipment) and *financing* (loan repayments, owner drawings,
dividends) are cash movements, never P&L lines; depreciation is the reverse. Cash flow
rolls forward from **cash on hand on a date** (Settings), backwards too if that date is
later; without one it starts at zero and says so. Loans received and capital put in are not
recorded — a deliberate limit of an income tracker.

**What each client and kind of work kept** (Clients & work, and the print's *What you kept*)
= income less the venue's deal fee and the direct costs that belong to it: each direct cost
goes to the nearest payment within a month at its linked venue, else with its linked client;
unlinked costs and overheads are not shared out. *(Until 25 Nov 2026 this was a separate
"margins" calculation over linked direct and operating costs; it was removed.)* A printed
P&L narrowed to one client, venue or activity counts only the costs linked to it, and one
narrowed to a source counts none; the note says so. **Break-even** = average monthly operating + interest costs over the last
three whole months ÷ the gross-margin rate over the same months; Profit scales it to the
selected period (a week, a month, a year, or a custom number of days).

**No balance sheet**, by design: it needs assets, liabilities and equity kept as balances —
bookkeeping, not income tracking. Cash flow's closing cash is the one balance InFlow keeps.

With costs on, the tax estimate can read deductible expenses from recorded costs
(`expensesFromCosts`), annualised like income.

## Tax is optional

`settings.features.tax` (an older stored `trackTax` is migrated on load). Off: no tax
cards, panels, tab, form section, report columns or tax insights. On: the form's tax section
is folded to a one-line summary unless the payment needs review, and folds back from its
heading. *(An "Optional" badge on tax figures was removed on 25 Nov 2026; the printed report
still marks tax figures with an asterisk and a footnote.)* The cost form shows what a
deductible cost takes off the year's estimate (`costTaxEffect`).

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

`domain/types.ts`: `IncomeRecord`, `CostRecord`, `Refund`, `Client`, `Source`, `Venue`, `Settings`.
"Activity" in the interface is `category` on income and `activity` on costs.

**On this device:** one IndexedDB value (`inflow` database, key `data`); data written
before costs existed loads with an empty cost list. Settings in localStorage (`inflow:settings`).
Every write is a change applied to what is stored at that moment, read and written in one
IndexedDB transaction (`KeyValueStore.update` in `src/shared/kvStore.ts`, `DeviceRepo.mutate`),
never a tab's in-memory copy written over it, so two open tabs (or the installed app beside a
browser tab) keep each other's records. After a write the repo posts on the `inflow-data`
BroadcastChannel and the other tabs reload (device and demo modes). *Fixed 26 Nov 2026, audit
A-01: before this, the last tab to save overwrote the other's new records.*

**Restore** (Settings → Backup & export) first copies this device's data to the key
`pre-restore` and keeps the current settings in memory; only then is the backup written, as
one write. A successful restore shows *Undo* (puts both data and settings back); a failed one
leaves the data as it was and says "Restoring failed: …" (audit B-07).

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
| InFlow — Income | Description, Amount, Currency, FX rate, Amount RON, Date, Status (Received/Expected/Refund), Client/Source/Venue (relations), Category, Recurring, Attendees, Sessions, Hours, Taxability, Tax handling, VAT, Classification, Tax reserve RON, Reserve source, Tax withheld RON, Tax rules, Venue terms, Refund of, Repays cost, Notes, InFlow ID* |
| InFlow — Costs | Description, Amount, Currency, FX rate, Amount RON, Date, Status (Paid/Due), Group, Category, Venue/Client (relations), Activity, Recurring, Deductible, Notes, InFlow ID* |
| InFlow — Clients | Name, Kind, Country, Contact, Notes, Archived, InFlow ID* |
| InFlow — Sources | Name, Type, Description, Active, Tax default, InFlow ID* |
| InFlow — Venues | Name, Type, Location, Notes, Archived, Deal, Fee per session, Share %, Monthly fee, InFlow ID* |

\* Added by InFlow on the first copy from a device (Release 1); holds the row's device id. Not needed for ordinary use.

Select options are a closed vocabulary mirrored in `domain/vocabulary.ts`: add an option
in Notion first. Saves write only the columns a database actually has (`NotionRepo.fit`), so a
copy made before a column was added keeps saving without it. The Starter Template (`Dev → Starter Templates`) has all five, linked to
each other. Moving from device to Notion: a copy of the user's own rows, entities first so relations
point at new ids, resumable, with lost answers looked up by InFlow ID (below); demo rows never leave the device.

**Notion reliability (26 Nov 2026, audit A-03, B-09).** Notion is a full path, not a
second-class one:

- *Paced and retried* (`store/notionCall.ts`). Every call waits its turn, at most 18 in any 10
  seconds (the relay allows 20 per device), and a refusal that means "later" is tried again
  after 0.5, 1, 2, 4 s (with jitter, or as long as Notion's Retry-After asks), five tries in
  all: 429 always; 500–504 and a dropped connection for reads and updates. A page create is
  retried on 429 only: after a 5xx or a lost answer it may already exist. 400/401/403/404 are
  answers and come back at once. `notionProxy` errors now carry `status` and `retryAfter`.
- *Loaded in order:* the five databases one after another, page by page, never in parallel.
- *Copy to Notion is resumable, and a lost answer is looked up, not repeated* (Release 1, D3;
  before it this said "never twice", which was not true). Each row is logged on the device
  (`inflow:notion-copy:<income db id>`) as `pending` before it is sent and with its Notion id once
  Notion answers, and is written with its device id in an **InFlow ID** text column, which InFlow
  adds to each of the five databases at the start of a copy. Running a stopped copy again skips
  what is logged; a row still `pending` (sent, but the answer lost: Notion may have made it) is
  looked up by its InFlow ID and only created if it isn't there. Where the column can't be added
  (the integration may not change the schema), a pending row is **not** created blind: the copy
  stops and says which row, and how to recover (add a text property "InFlow ID" to each
  database, or look for the row in Notion first). **What this guarantees:** within one device's
  copies, a row is not created twice, lost answers included, provided the InFlow ID column
  exists. **What it doesn't:** the log is per device, so copying the same data from a second
  device copies it again; rows made in Notion by hand, or by an ordinary save in the app, carry
  no InFlow ID and are never matched; an ordinary save whose answer is lost (not a copy) can
  still leave a row the app didn't see, and saving it again makes a second one. Payments,
  refunds (pointing at the copied payment) and costs are all copied.
- *The offline copy follows every write.* The cache (`notion-cache`) is updated after each
  save and delete, not only after a full load, so opened offline the app shows this
  session's changes. Shown the offline copy, the app reloads from Notion as soon as the
  browser says it is back online.
- *Tested* against an in-memory Notion that pages its results, turns requests away with 429
  and drops connections, on a simulated clock (`store/notionReliability.test.ts`), including
  parity: the demo copied to Notion and loaded back gives the same summary, P&L and
  Clients & work figures as on the device. **Not run against live Notion:** the relay's real
  429s, Notion's real Retry-After, the select option "Refund" being created on first use,
  adding the "Venue terms" and "Refund of" columns with a real integration's permissions,
  and timing on a large real workspace.

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
in state). Seven switches since 25 Nov 2026; eight since 26 Nov (Refunds); nine with Import from
Revolut, the first *experimental* one: off for everyone, never switched on by "Everything" or the
guide (`EXPERIMENTAL`), and added later as off for existing users (`ADDED_LATER`).

**Simple start for new users only.** With no stored settings, InFlow starts on
`SIMPLE_FEATURES` (insights and printable reports; since Release 1, expected payments are no
longer in it) and no target, and the Overview shows a
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
| deals | Venue deals report, deal fields on venues, the head-count field, venue fees in what Clients & work counts as kept, venue insights |
| costs | Costs tab, Profit (P&L, cash flow, break-even), direct costs in what Clients & work counts as kept, cost insights, cash and expense settings |
| tax | tax tiles and panels, Tax report, reserves, tax fields in the form and report, the tax-review insight |
| expected | Expected status, panel, suggestions from recurring payments and overdue insight |
| currencies | currency select (lei only; an existing foreign record keeps its currency) |
| printable | Print tab |
| refunds | the Refund action on a received payment (and the guide's step says so). **Starts off for everyone**, existing users too (`ADDED_LATER` in `store/settings.ts`): a switch added later is introduced, never sprung on anyone. Unlike the others, off does not take refunds out of the figures: money paid back is never hidden from a total, so a refund already recorded still counts and stays listed on its payment, deletable. |

**Complexity comes in when it's asked for (26 Nov 2026).** The basic workflow is amount, client
and date. What the remediation added sits behind the switch it belongs to, or folds away:

| Added | Shown when |
|---|---|
| Refunds | Refunds on (or the payment already has one) |
| Part received, Remind me (.ics) | Expected payments on |
| Available to spend (Overview) | Tax or Costs on; with both off it would only repeat what came in |
| Add a cost (Overview, a venue's row) | Costs on |
| "Counted under the deal when it was added" | Venue deals on, and the venue's deal has since changed |
| Repays which cost | Costs on, activity Reimbursement |
| Description, sessions, hours, source, venue, activity, recurring, notes | always shown, after amount, client and date |

Screens enter with Stillflow's 320 ms rise (`.screenIn`, off under reduced motion); the
theme is Device / Light / Dark.

## PWA
`public/inflow.webmanifest` (`id` and scope `/inflow-react.html`, shared Cone of Cold icons,
three shortcuts), `public/inflow-sw.js` (network-first navigations with a cached fallback,
stale-while-revalidate for everything else, the `/api/notion` relay never cached, only
`inflow-` caches touched), registered from `main.tsx` with scope `/inflow-react.html`,
production only. Exchange rates fetched for a date are kept in localStorage
(`inflow:fx-rates`).

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

*(Historical: the filter bar and pivot it mentions were removed later the same day; see
"Less and more".)*

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

## Exchange rates and field hints, 25 Nov 2026
- **Rates.** A foreign amount gets the ECB reference rate for the payment's own date from
  Frankfurter (as WhereItWent does): published each working day around 16:00 CET; a weekend or
  holiday gets the last working day's. Fetched rates are now kept on the device
  (`inflow:fx-rates`, the last 300), so an offline form still finds a day fetched before; with
  nothing kept, the form starts from the last rate you used for that currency and says so
  ("Offline: the last rate you used"). The BNR rate is what's declared; the hint says to check it.
- **Hints.** Every field whose use could be debated explains itself in one line: status,
  sessions, hours, people per session, source, venue, activity, recurring (and what it
  triggers), the cost's kind, category, status, links, deductible; the client/source/venue
  editor (name, kind and country for VAT, source type, active, venue type, each deal field);
  and Settings (Notion token, tax profile, company fields, the lists). Settings → Appearance &
  guide → **Show hints** turns them off (`settings.showHints`, `app/hints.ts`, as Sol
  Odyssey's guidance). Hints that report something live (a rate being fetched, a per-head
  figure, a tax saving, the tax suggestion's reasons) are not wrapped and always show.

## Clients at scale, 26 Nov 2026
Years of one-off 1:1 clients would turn a dropdown into hundreds of names. Every place a
client is chosen is now a search box (`components/ClientPicker.tsx`, `lib/clients.ts`):
- **Typing** finds anyone not archived by the start of any word of the name, accents ignored
  ("stef" finds Ștefănescu), quiet clients included and marked so.
- **With nothing typed:** the five clients paid most recently, then your businesses.
- **Quiet:** an individual with no payment received for 12 months leaves that list. They are
  still found by search and in every report, and come back with their next payment. Businesses
  and people not yet paid never go quiet. Nothing is deleted.
- **Adding:** a name that matches no one exactly is offered as "+ Add …", which opens the
  new-client form with it filled in; a name reading as a company (SRL, SA, Ltd, GmbH, …)
  starts as a business.
- **Where:** the payment form (with Add), the cost form's client link, the Income and Costs
  filters (with "No client"; archived clients reachable), and the client statement in Print.
  Settings' client list gains a search box past 12 entries and shows 30 at a time.
