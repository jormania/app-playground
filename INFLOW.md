# InFlow — freelancer income tracker

**[coneofcold.vercel.app/inflow-react.html](https://coneofcold.vercel.app/inflow-react.html)** ·
source `src/inflow/` · entry `inflow-react.html` · strict TypeScript on `src/ds/`

A light income tracker for freelancers. Open it for twenty seconds and know how much
came in, from whom and where, how it moves, and — if you want — how much of it is
taxable, what's been withheld, and what to put aside. Not accounting, invoicing or a CRM.

## What it does

| Place | What's there |
|---|---|
| **Overview** | Period total vs the previous equivalent period (to date, while the period runs), this week and this month, target progress, trend chart (days / weeks / months by period length, previous period as ghost bars), breakdown by client · source · venue with drill-down, client concentration, taxable split *(optional)*, expected payments, unusually large payments |
| **Income** | Every payment, expected ones grouped on top; search, filters (client, source, venue, tax, status), CSV of the filtered list; tap to edit |
| **Reports** | By client, venue (with 6-month sparkline) and source, each with share, count, average and change; tax report *(optional)* with the year's estimate and the VAT-threshold gauge; **Printable**: a report builder |
| **Settings** | Device or Notion; demo load/clear; tax on/off and profile; targets; clients/sources/venues; backup, restore, CSV; theme; the welcome guide |

Periods: this week (Monday-based), this month, last month, this year, custom. One
selection drives Overview and Reports; drill-downs land in Income filtered to it.

### Quick entry
Amount + client is enough. A client's last payment prefills source, venue, category,
currency and description. Foreign currency gets the ECB rate for that day from
Frankfurter (no key, CORS-open; the same host WhereItWent uses), editable because the
BNR rate is what's declared. Clients, sources and venues can be created inside the form.

### The welcome guide
Five steps on first open. Its checkbox, "Show this guide next time I open InFlow",
decides whether it returns (`settings.showTour`); Settings → Appearance & guide can
switch it back on or show it now. Step four offers the tax switch.

### Printable reports
`lib/report.ts` renders one self-contained HTML document (inline CSS and SVG, no
script, every user string escaped). The builder previews it in an iframe; *Print /
save as PDF* prints that iframe, *HTML* downloads the same string. Options: four presets
(period summary, year in review, client statement, for my accountant), title and
subtitle, dates, one client only, sections, rows per table, comparison, original
currencies, sort, notes. Options persist per device (`inflow:report-options`).

## Tax is optional

`settings.trackTax` (default on, offered in the guide and in Settings). Off: no reserve
or net cards, no taxable panel (a "regular or one-off" and currencies panel instead), no
tax tab, no tax section in the form, no tax columns in printable reports. Records still
store a suggested classification quietly, so turning it on later has a start. On: every
tax figure carries an **Optional** chip or an asterisk, and in the form the tax section
is folded to a one-line summary unless the payment needs review.

### Three separate questions per payment
Taxability (taxable / non-taxable / needs review), handling (withheld at source /
self-declared / no tax due / other) and VAT (applicable / not applicable / exempt /
reverse charge / undetermined). `tax/classify.ts` suggests each with its reason, from
the profile, the source's usual treatment, the category and the client's kind and
country. Untouched fields follow the suggestion and wear a **Suggested** badge; a change
makes it the user's choice, and `classification` becomes `confirmed`.

### The estimator (`tax/estimate.ts`, `tax/rules.ts`)
Rulesets are frozen per fiscal year (`RO-2025`, `RO-2026`); a correction ships as a new
id. A year without one borrows the nearest and says *provisional*. Each record stores
the ruleset id and the reserve it was given; nothing recomputes a stored reserve —
editing a payment offers the new suggestion, it doesn't apply it.

| | 2025 | 2026 | Source |
|---|---|---|---|
| Minimum wage for thresholds | 4,050 | 4,050 | ANAF, DU presentation, AJFP Cluj, 22.04.2026 |
| CAS 25% | on 12 or 24 min. wages | same | same |
| CASS 10% | 6–60 min. wages | 6–**72** | Legea 239/2025 |
| Income tax | 10% of (net − CAS − CASS) | same | ANAF |
| Dividend tax | 10% | **16%** | Legea 141/2025 |
| Micro tax | 1% (3% for some activities) | **1%**, threshold €100,000 | OUG 156/2024, OUG 89/2025 |
| VAT exemption threshold | 395,000 (from 1.09.2025) | 395,000 | OG 22/2025 |

HG 146/2026 raised the minimum wage to 4,325 from 1 July 2026; ANAF's 2026 table still
counts thresholds in 4,050, so the ruleset does too.

Profiles: **PFA sistem real** (expenses deducted; CAS stepped; CASS floor waived when
insured elsewhere), **PFA normă de venit** (follows the norm, not earnings), **SRL micro**
(micro tax on revenue, dividend tax on the payout share, CASS on dividends in 6/12/24
bands), **custom** (a flat rate).

**Why an effective rate and not marginal tax:** the contributions are annual and stepped
— a marginal figure would pin 2,430 lei of minimum CASS on January's first invoice and
12,150 lei of CAS on whichever payment crosses 48,600. The year's liability is read at
the projected annual income (the user's own figure, else the year so far annualised over
at least 60 days, else the actual for a closed year), divided by it, and that rate × the
payment, less tax withheld on it, is the suggestion. Pinned by tests, including ANAF's
own worked example (net 57,000 → CAS 12,150, CASS 5,700, tax 3,915).

## Data

`domain/types.ts`: `IncomeRecord`, `Client`, `Source`, `Venue`, `Settings`. All totals use
`amountRon` (`amount × fxRate`). Expected payments never enter a total.

**On this device:** one IndexedDB value (`inflow` database, key `data`) via
`shared/kvStore`. Settings in localStorage (`inflow:settings`), never in Notion.

**In Notion:** `Dev → App Databases → InFlow`, four databases. Settings take the
**Income** database link; Clients, Sources and Venues are found through its relations
(`store/notion.ts`, `discoverDatabases`). Reads and writes go through `/api/notion` with
the user's token — no new serverless function. Delete archives the page. The last load
is cached on the device for offline viewing.

| Database | Properties |
|---|---|
| InFlow — Income | Description (title), Amount, Currency (select), FX rate, Amount RON, Date, Status (Received/Expected), Client/Source/Venue (relations), Category, Recurring, Taxability, Tax handling, VAT, Classification (Suggested/Confirmed), Tax reserve RON, Reserve source (Suggested/Manual), Tax withheld RON, Tax rules, Notes |
| InFlow — Clients | Name, Kind (Individual/Business), Country (Romania/EU/Outside EU), Contact, Notes, Archived |
| InFlow — Sources | Name, Type, Description, Active, Tax default |
| InFlow — Venues | Name, Type (In person/Online/Hybrid/Client site), Location, Notes, Archived |

Select options are a closed vocabulary mirrored in `domain/vocabulary.ts`: add an option
in Notion first, or the whole write is rejected. Moving from device to Notion: Settings
offers a one-time copy of the user's own rows (never demo rows), entities first so the
relations point at the new ids.

**Demo:** `data/demo.ts` — fourteen months of a coaching practice relative to today
(deterministic per month): 30 clients including one-off intro sessions, 12 sources,
14 venues in five cities, RON/EUR/USD/GBP, a growth curve with a quiet August, withheld
royalties and lecture fees, reimbursements, an award and a barter for review, three
expected payments. Every row has `demo: true`; *Clear demo data* removes exactly those
(and keeps a demo client a user's own payment points at). Demo stays on the device.

**Backup:** JSON with all data and settings minus the token; restore replaces device data
and switches to device mode. CSV of payments, each breakdown and the tax report.

## PWA
`public/inflow.webmanifest` (id and scope `/inflow-react.html`, shared Cone of Cold icons,
shortcuts), `public/inflow-sw.js` (network-first navigations, stale-while-revalidate
assets, `/api/` never cached, only `inflow-` caches touched), registered in production
only. Favicon and logo: `public/inflow-logo.svg`, `inflow-icon.svg` →
`npm run gen:inflow-icons`.

## What was borrowed, and from whom

A short look at Bonsai, FreshBooks, Wave and HoneyBook, and at freelancers' own
tax-set-aside tools built with Claude Code and similar (TaliVue's per-invoice "tax vault"
hint, Tax Gap Tracker's full-year estimate):

- **Per-payment set-aside hint** (FreshBooks' real-time estimator, TaliVue) — adopted as
  the reserve suggestion, but from Romanian rules, not a flat 25–30%.
- **Full-year liability view** (Tax Gap Tracker) — adopted as the tax report's estimate
  with "still to set aside".
- **Money owed at a glance** (Bonsai) — adopted lightly: an *Expected* status with overdue
  flags, no invoicing.
- **Cash-flow trend against the past** (Wave) — adopted as the ghost-bar comparison.
- Not adopted: invoices, time tracking, expense ledgers, proposals, client portals,
  bank sync. Each would turn a 20-second app into accounting software.
