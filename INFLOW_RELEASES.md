# InFlow releases

InFlow is the freelancer income tracker in `src/inflow/` (design and behaviour: [`INFLOW.md`](INFLOW.md)).
A release is a point on `main` worth naming; the number shows at the foot of Settings
(`src/inflow/app/release.ts`).

## Release 2 — in progress

**Import from Revolut (experimental).** Off unless you switch it on in Settings → Features;
"Everything" leaves it off. Details in `INFLOW.md`, "Release 2".

- **Read a Revolut statement (CSV)** on your device; the file is never uploaded. See what it
  holds (dates, currencies, money in and out, rows it couldn't read) before anything is added.
- **Review each transaction**: income, money back for a cost, a business cost, a bank fee, a
  refund to a client, a transfer, personal, or left out. Bulk choices for a month at a time.
- **Nothing twice.** Each transaction has a fingerprint; importing the same or an overlapping
  file again finds what is already in. Entries you typed by hand are offered to link, never
  silently duplicated.
- **Your context, not guesses.** A client is suggested only by their exact name, a venue only by
  a rule you saved, deductibility only as for a cost you add by hand.
- **Rules you can see and delete**, made only from choices you confirmed.
- **Undo a whole import**, with what it will do shown first.
- **Clients & work** now counts paying clients, new and returning, and income per client.

- **Audited** (adversarial, 26 Nov 2026): fixed a sign flip on `(-12.50)`, the same bank ID
  imported twice, UTC times on the wrong day, empty states read as completed, the payer taken
  for the payee, a silent pick between same-named clients, stale ids from rules, and valid
  transactions lost to an unreadable fee. Matches now need confirming; a plan that went stale is
  never saved. Still experimental: no genuine Revolut Pro export has been tested.

**Using Notion:** the first import adds an "Import" text column to Income and Costs. Without
permission to add it, InFlow refuses to import rather than lose track of what came in.

## Release 1 — 2026-11-26

The first stable release. What came in, what you kept, and what is yours to spend, the same on
every screen, with your data protected. Details in `INFLOW.md`, "Release 1".

- **One set of figures.** Service revenue, money back for costs you paid (cost recovery) and the
  cash that actually arrived are kept apart and agree on the Overview, Income, Clients & work,
  Profit, Cash flow, Tax, print and CSV. Tax withheld by a payer is tax paid, never cash.
- **A simpler start.** New: income, insights and printable reports, nothing else. Expected
  payments, costs, tax, venue deals, foreign currencies and refunds are a switch away, in
  Settings or in the welcome guide.
- **A shorter payment form.** Amount, client and date first; the rest follows below them.
- **Expected payments**, when switched on: *Received* in one tap at that day's rate with a tax
  reserve suggested, or *Part…* when only some of it arrived, from the Overview, Income or the
  payment itself; a calendar reminder for the due date.
- **Refunds**, when switched on: money paid back against a payment, in part or in full, counted
  in the month it went back. The payment itself never changes, and can't be edited in a way its
  refunds no longer fit. With tax withheld, a refund starts at what actually arrived.
- **Venue deals keep their history.** Each payment keeps the deal it was made under; changing a
  venue's deal changes only what comes after.
- **Estimated available to spend** (with tax or costs on): this year's money after costs, this
  year's tax still owed and bills due, with every part shown and adding up.
- **Safer data.** Two open tabs never overwrite each other; a restore can be undone and refuses
  a damaged backup; Notion loads steadily, retries when busy, resumes a stopped copy without
  making rows twice, and keeps an offline copy current.
- **Plain words, bigger targets.** "Costs of the work" before "COGS"; every control answers a
  finger across 44 px.
- **The accountant's report** lists every cost with whether it is deductible.

**Using Notion with refunds:** open InFlow online on every device you use and check it shows
Release 1 before recording the first refund. An older copy would count a refund as income.

**What InFlow is not:** an accounting system, an invoicing tool or VAT accounting. VAT-registered
use isn't supported. Tax figures are estimates from published Romanian rules to plan with, not
tax advice: some deliberate simplifications are listed in `INFLOW.md`, "Known limitations".
