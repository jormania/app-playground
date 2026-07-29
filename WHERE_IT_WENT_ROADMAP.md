# WhereItWent — Feature Roadmap (design, not yet implemented)

Design for seven features drawn from [`WHERE_IT_WENT_AUDIT.md`](WHERE_IT_WENT_AUDIT.md)
§7 ("Market comparison — what WhereItWent is missing"). Written 2026-07-29.
Nothing here is built yet; this is the plan to build against.

The remaining §7 gaps not covered here — account balances/net worth, split
transactions, CSV import/export, a rules engine, goals, receipt attachments, a
tags UI, undo, household sharing — are deliberately out of this set.

---

## Three constraints that shape everything

**1. `api/*.js` is at 12/12 — the Vercel Hobby cap.**

```bash
ls api/*.js | grep -v '^api/_' | wc -l
```

returns `12`. No feature here may add a serverless function. This directly
constrains the FX design (feature D) and rules out a server-side reminder cron
of the Wanderlist kind (feature A).

**2. No new nav items.** [`Navigation.jsx`](src/where-it-went/components/Navigation.jsx)
already carries 4 tabs + Add + Filter + Period. Every surface below lands in an
existing view, a shared dismissible banner strip, or Settings.

**3. Notion schema changes cost manual work.** Every new property has to be added
by hand in the live databases. Total across all seven features: **four new
properties across two databases**. Features A, E, F and G need **zero**.

---

## A. Recurring/bill reminders + upcoming calendar — ✅ SHIPPED 2026-07-29

Built as designed, with surfaces 1 and 2 only; **surface 3 (local
notifications via `src/shared/notify/`) remains deferred** as planned, since
it's the only part that touches the service worker. See the "Roadmap Feature A"
section of [`WHERE_IT_WENT.md`](WHERE_IT_WENT.md) for what shipped.

**No new Notion properties.** The Subscriptions DB already has `dayOfMonth`,
`amount`, `active`, `lastProcessed` — everything needed.

### New pure module `lib/upcoming.js`

```
getUpcomingBills(subscriptions, transactions, { horizonDays = 30, today })
  → [{ sub, dueDate, daysUntil, alreadyPosted, categoryId }]
```

Reuses `dueDateFor()` and `isAlreadyPosted()`, already exported from
[`lib/useSubscriptionsEngine.js`](src/where-it-went/lib/useSubscriptionsEngine.js).
Clean split with no overlap or double-counting: the engine owns
`dueDate <= today`, this module owns `dueDate > today`.

### Three surfaces, none in the nav

1. **Banner strip** — the Click Deck pattern from
   [`src/click-deck/App.jsx`](src/click-deck/App.jsx) (`cd-release-banner`),
   ported to DS tokens. Renders only when something is due inside the lead time:
   `⏰ Rent (2,400 L) due in 3 days`. A `[×]` snoozes 24h via
   `localStorage.whereItWent_upcoming_snooze`. Sits directly under
   `<Navigation>`, above `<main>`. **One reserved slot** — features D and G
   reuse it, so banners never stack.
2. **"Next 30 Days" agenda card on the Dashboard** — a chronological list grouped
   by date, *not* a month grid. A grid is heavy on mobile and adds nothing for
   ~6 recurring items. Each row: date, name, amount, category dot, and an
   "already posted" state.
3. **Local notifications (phase 2, optional)** — `src/shared/notify/` plus
   `shouldFireOncePerId` keyed `${sub.id}:${dueDate}` gives exactly-once-per-
   occurrence firing. Needs IndexedDB state mirroring for the service worker;
   **read [`NOTIFICATIONS.md`](NOTIFICATIONS.md) first**. Ship 1+2 first and
   treat 3 as a separate follow-up — it's the only part touching the SW.

### Settings

A 4th Feature Toggle "Upcoming Bills", default **on** (it's cheap, and it's the
thing the subscriptions engine has always been missing). The lead-time number
input (default 5 days) goes in the Subscriptions section, not the toggle block.

### Tests

Frozen-clock unit tests on `getUpcomingBills`: month-end clamping, inactive subs,
already-posted suppression, horizon boundaries. A component test that the banner
respects the snooze key.

---

## B. Non-monthly budget periods & per-category periods

### Notion — Categories DB gains two properties

- `Budget Period` (Select: `Monthly`, `Quarterly`, `Yearly`) — blank reads as
  Monthly, so existing setups keep working untouched.
- `Budget Anchor` (Date, optional) — lets "insurance renews in March" define its
  own year boundary.

The existing `Monthly Limit (RON)` number **keeps its name** (renaming would
break every existing DB) but its meaning becomes "limit per budget period".
That naming wart gets documented explicitly in the guide — one documented wart
beats a two-source-of-truth migration.

### New pure module `lib/budgets.js`

```
getBudgetWindow(category, now)      → { start, end, label }  // "July 2026" / "Q3 2026" / "Mar 26–Feb 27"
computeBudgetStatus(cat, txs, now)  → { limit, spent, remaining, percent, window, daysLeft, pace }
```

`Dashboard.jsx`'s `budgets` useMemo delegates to this. The audit's rule holds:
budgets stay pinned to *their own* window, independent of the selected period
and of active filters.

### UI

Each budget bar gets its window label — a yearly bar sitting at 40% must not
read as "40% of this month". `BudgetEditorModal` gets a compact per-category row
(`[amount input] [period select]`) rather than a second stacked field.

---

## C. Rollover / envelope budgeting

Builds directly on B. **One new Categories property:** `Budget Rollover`
(Checkbox), per-category opt-in.

### Key design decision: carry is *derived*, never stored

```
carry(w)     = limit + carry(w-1) − spent(w-1)
effective(w) = limit + carry(w)
```

Computed by walking back over prior windows, bounded at 12 (the same spirit as
`MAX_BACKFILL_MONTHS`) and clamped to the earliest transaction date. Nothing is
written to Notion, so there is no state to desync, no extra writes, and editing
a three-month-old transaction correctly re-derives every subsequent window.

Overspend carries forward as a negative (YNAB semantics). The bar floors at 0
and the deficit shows as a separate chip (`−140 L carried from June`) rather
than a silently shrunken limit.

### UI

A `+240 rolled over` chip on the budget bar; a rollover checkbox per category in
the editor. **No new global toggle** — it lives under the existing "Budgeting
Features" switch.

---

## D. Multi-currency with live FX

> Hard requirement from the brief: **the transaction modal must not wrap or
> scroll vertically after this ships**, and travel scenarios take priority.

### Rate source: keyless and client-side

Because of the 12/12 function cap this must not be a new endpoint. Frankfurter
(`api.frankfurter.dev`, ECB daily reference rates, no key) is the candidate —
**but its CORS behaviour must be verified live before committing to it.** If it
doesn't hold, the fallback is folding a `mode=fx` branch into the existing
[`api/notion.js`](api/notion.js), *not* adding a new file.

**Caching:** `localStorage.whereItWent_fx_rates` =
`{ [date]: { base: 'RON', rates: {...}, fetchedAt } }`. One fetch per date.
Past-dated transactions use that date's historical rate. Offline → last cached
rate, explicitly labelled stale. **A RON-only user never makes a network call.**

**No new Transactions properties.** `Original Amount` / `Original Currency`
already exist and already round-trip; the implied rate is derivable as
`amount / originalAmount`. Behaviour: type the foreign amount → RON auto-fills;
edit RON → the implied rate is recomputed and shown. **RON stays the source of
truth for every total**, unchanged.

### The layout requirement, made concrete

Today the foreign block is a dashed box *below* Account in
[`TransactionForm.jsx`](src/where-it-went/components/TransactionForm.jsx),
costing ~90px. Naively adding a rate line makes the modal scroll.

**The redesign makes the form shorter, not taller:**

- **Delete the dashed box entirely.** Fold the currency into the existing
  `[Date][Amount]` grid: the Amount cell becomes an input with an inline
  currency `<select>` as a suffix inside its border (~4.5ch wide).
- **One single-line helper directly beneath**, `--text-xs` / `--color-muted`:
  `≈ 210.45 L · 1 EUR = 4.98 L · ECB 28 Jul`
  with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and the
  full string in `title`. It can never wrap to a second line.
- **A `<select>`, not a free-text input** — this deletes the uppercase /
  `maxLength=3` / validation dance. Options = union of account currencies + trip
  currencies + a short travel list (EUR, USD, GBP, CHF, HUF, TRY, JPY, RON),
  capped so it never becomes a 160-item scroll.
- **Regression guard, not eyeballing.** A test at 375×812 and at 320px width
  asserting, with FX visible: `form.scrollHeight <= modalBody.clientHeight`,
  `document.body.scrollWidth === document.body.clientWidth`, and no descendant
  with `scrollWidth > clientWidth`. `ds/components/Modal.module.css` caps the
  dialog at `min(90vh, 720px)` with `.body { overflow-y: auto }`, so this is a
  real, checkable threshold.

### Travel gets first-class treatment

- **One new Trips property: `Currency` (Select).** When a transaction has a Trip
  assigned, the currency defaults to the *trip's* currency, not the account's —
  which is the actual travel case (RON card, EUR trip).
- `TripEditorModal` gains the currency field.
- **Insights → Travel** gains a per-currency breakdown (`€312 · 1,554 L` per
  trip), so a trip reads in the currency you actually experienced it in.
- Ledger rows keep their existing single secondary line; the implied rate goes
  in the `title` attribute only, so list density doesn't change.

---

## E. Cash-flow forecast / projection (Insights)

**Zero schema change.** Inputs already exist: subscriptions (committed future
charges), `monthlyBaseline()` in `analytics/comparisons.js`, current-month
actuals.

**Honesty constraint:** the app has no account balances (the audit's #1 gap), so
a *balance* projection is impossible. This forecasts **net cash flow**, and says
so in the UI.

### New pure module `lib/analytics/forecast.js`

```
projectCashFlow(data, { horizonMonths = 3, now })
  → [{ monthKey, expectedIncome, committed, discretionaryEstimate, net, confidence }]
```

- `committed` = subscription charges due that month — **reuses `lib/upcoming.js`
  from feature A**. High confidence.
- `discretionaryEstimate` = trailing 3-month **median** of non-subscription,
  non-Transfer spend. Median, not mean, so one holiday doesn't poison three
  months of forecast.
- `confidence: 'low'` with fewer than 3 months of history → renders a "not
  enough history yet" state instead of a fabricated number. Same discipline as
  the audit's ≥2-month rule for spike alerts.

### UI

A "Next 90 Days" section placed after "Immediate Attention & Action" in
`InsightsView.jsx` — stacked committed-vs-estimated bars on the existing
Recharts setup, a one-line narrative in the app's editorial voice, and a callout
naming the first month projected negative. **Gated behind the existing
`features.cashFlow` toggle** — no new switch.

---

## F. Duplicate detection & merge

**Zero schema change.**

### New pure module `lib/duplicates.js`

```
findDuplicateGroups(transactions, { dayWindow = 3 })
  → [{ txs, confidence: 'high' | 'medium', reason }]
```

Matching: exact amount, dates within ±3 days, normalized description similarity
(lowercase, strip punctuation/diacritics, then equality / containment /
token-overlap ≥ 0.6). Same account raises confidence. Bucket by rounded amount
first so it stays near-linear rather than O(n²).

Deliberate negative rule: two same-amount transactions on the *same* day in
*different* categories score low — that's two coffees, not a double-entry.
Description similarity is weighted heaviest.

### "Not a duplicate" dismissals live in `localStorage`

`whereItWent_dupe_dismissed`, keyed by a stable hash of the pair's ids — **not**
in Notion Tags. A Tags-based flag would need the option pre-registered in the
multi-select vocabulary, and an unregistered option 400s the *entire atomic
patch*, silently failing unrelated fields with it. The cost of localStorage is
re-dismissing once per device. Documented as a trade-off.

### Merge

Keep one, archive the other via the existing `deleteTransaction`, back-filling
any field the survivor lacks (notes, trip, tags, original amount) through
`updateTransaction`. Behind a `ConfirmModal` — never a silent delete.

### Surface

A dismissible review card at the top of the Transactions list
(`3 possible duplicates · Review`), expanding inline to side-by-side pairs, plus
a full-scan entry point in Settings. Memoized over the loaded ledger.

---

## G. Offline support / optimistic writes

**Ships last** — widest blast radius, and it interacts with the subscriptions
engine's idempotency guarantee.

**Explicitly out of scope: the service worker.** It stays cache-first for assets
with the `import.meta.env.PROD` registration guard untouched (see CLAUDE.md,
"Service workers & dev"). Everything here is page-context. That's the low-risk
path and it should stay that way.

### Layer 1 — offline reads

Mirror each successful `loadData()` payload into IndexedDB via
`src/shared/notify/idbKv.ts` (it's in `shared/`, not `ds/`, so it's fair game
for any app). On launch: hydrate from cache instantly (kills the skeleton), then
revalidate. On fetch failure *with* a cache → render cached data behind a
`Showing data from 14:32 — offline` banner, reusing feature A's banner slot. The
existing error card stays for the no-cache case.

### Layer 2 — the outbox

`lib/outbox.js`: an IndexedDB FIFO of
`{ id, op, entity, payload, attempts, lastError }`. `App`'s handlers apply
changes to local state immediately, enqueue, and flush on `online` / next load.

- Temp ids `local_tx_<uuid>`, swapped for real Notion ids on flush. Nothing
  currently references a transaction id, so this is safe.
- Flush strictly FIFO, **stop on first failure** — the exact policy the
  subscriptions engine already uses; skipping ahead reorders writes.
- Non-retryable 4xx → a "failed" list surfaced in Settings with the real error
  text and Retry/Discard. Nothing gets swallowed — that's the whole theme of the
  audit.
- Rows with a temp id get a small pending dot.

### Layer 3 — the critical guard

**`useSubscriptionsEngine` must not run while offline or while the outbox is
non-empty.** Its `isAlreadyPosted` check reads the ledger; a stale ledger means
double-posting every subscription. This is the single highest-risk interaction
in the whole set and needs its own regression test.

---

## Sequencing

Only two hard dependencies: **A → E** (shared `upcoming.js`) and **B → C**
(rollover needs periods). D and F are independent and can be pulled forward.
G must be last.

| # | Feature | Schema cost | Risk |
|---|---------|-------------|------|
| 1 | ~~A — Upcoming bills (banner + agenda)~~ ✅ shipped | none | low |
| 2 | E — Cash-flow forecast | none | low |
| 3 | F — Duplicate detection & merge | none | low-med |
| 4 | B — Non-monthly budget periods | 2 Categories props | medium |
| 5 | C — Rollover | 1 Categories prop | medium |
| 6 | D — Live FX + travel | 1 Trips prop | med-high (network + layout) |
| 7 | G — Offline / outbox | none | high |

### Total manual Notion work: 4 properties

| Database | Property | Type | For |
|---|---|---|---|
| Categories | `Budget Period` | Select (`Monthly`/`Quarterly`/`Yearly`) | B |
| Categories | `Budget Anchor` | Date (optional) | B |
| Categories | `Budget Rollover` | Checkbox | C |
| Trips | `Currency` | Select | D |

### Per-feature definition of done

- Pure module + frozen-clock unit tests
- Component tests for each new surface
- `npm test` + `npm run typecheck` + eslint all green
- Demo fixtures in `models/demoData.js` (a planted near-duplicate pair, a
  yearly-budget category, a trip with a currency)
- [`WHERE_IT_WENT.md`](WHERE_IT_WENT.md) updated
- Live browser verification
- **Feature D additionally:** the 320px / 375px no-scroll assertions pass
