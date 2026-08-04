# WhereItWent — full audit, 2026-08-04

A fresh end-to-end pass over `src/where-it-went/` (~24k LOC), `api/notion.js`,
[`WHERE_IT_WENT.md`](WHERE_IT_WENT.md) and
[`public/where-it-went-guide.html`](public/where-it-went-guide.html).

Nothing here has been fixed — this is the findings list. Every claim below was
verified against the current code (a few by running it), not inferred from the
changelog.

**Verification state at time of audit**

| Check | Result |
|---|---|
| `npm test` | ✅ 2,016 passed / 176 files |
| `npm run typecheck` | ✅ clean |
| `npx eslint src/where-it-went` | ❌ **33 errors** |
| `npx vitest run src/where-it-went` (without `npm test`'s env flag) | ❌ 71 false failures — see [T2](#t2) |

---

## P0 — Broken in production

### P0-1. The Type filter does nothing in the ledger *or* the Dashboard

[`lib/filtering.js:1`](src/where-it-went/lib/filtering.js:1) destructures `filter`:

```js
export function applyFilters(transactions, { filter, categoryFilter, searchQuery }, ...)
```

Every call site passes `filterProps`, whose key is **`filterType`**
([`App.jsx:125`](src/where-it-went/App.jsx:125)). `filter` is therefore always
`undefined` and the `if (filter && filter !== 'All' …)` guard never fires.

Proven by running it:

```
filterType=Income -> [ 'Salary', 'Groceries' ]   ← both rows returned
filter=Income     -> [ 'Salary' ]                ← what was intended
```

Affects [`TransactionsList.jsx:149`](src/where-it-went/components/TransactionsList.jsx:149)
and [`Dashboard.jsx:82`](src/where-it-went/components/Dashboard.jsx:82). Selecting
"Income" or "Expense" in the Filter Sheet changes nothing in the list, the
transaction count, or the Income/Expense totals pill.

Insights is *not* affected — [`lib/analytics/index.js:40`](src/where-it-went/lib/analytics/index.js:40)
kept its own private `applyFilters` that reads `filterType` correctly. So the three
views disagree again, which is the exact drift the "Filtering Refactor" was
introduced to end. `filtering.js` has **no test file**, which is why this survived.

Both components still destructure `filterType: filter` locally (line 38 / 41) but
only use it for a `useEffect` dep and the chart type — dead leftovers that make the
bug look handled.

### P0-2. Deleting a Quick Template always fails against live Notion

[`notionClient.js:335`](src/where-it-went/lib/notionClient.js:335):

```js
return this._request({ path: `blocks/${tplId}`, method: 'DELETE' });
```

[`api/notion.js:21`](api/notion.js:21): `ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH'])`.

The proxy rejects it with `400 Method DELETE not allowed`, which `_request` treats
as non-retryable and throws. Reachable from the Dashboard's template editor
(`onDeleteTemplate` → `client.deleteTemplate`). Every other delete in the app uses
`PATCH { archived: true }`; this one is also the only *permanent* delete, so it is
inconsistent twice over.

### P0-3. `Reconciled` is written on every add but is not in the documented schema

[`notionClient.js:239`](src/where-it-went/lib/notionClient.js:239) sends
`'Reconciled': { checkbox: !!tx.reconciled }` **unconditionally** on `addTransaction`.
`Reconciled` appears **zero times** in `WHERE_IT_WENT.md` and zero times in the guide.

Anyone building the Transactions database from the documentation gets a 400
(`Reconciled is not a property that exists`) on the *first transaction they add* —
and by the app's own documented rule about atomic patches, the whole page creation
fails, not just that field. `updateTransaction` guards it (`if (updates.reconciled
!== undefined)`), so the failure is specific to adding.

Same class, lower blast radius: the Categories `Description` rich-text property
([`notionClient.js:133`](src/where-it-went/lib/notionClient.js:133)) is read but
undocumented (harmless — reads of missing properties return undefined), and the
whole **Quick Templates** database is undocumented (see [D3](#d3)).

### P0-4. Four CSS custom properties are undefined — again

`--color-primary`, `--color-on-primary`, `--color-primary-muted` and
`--weight-normal` are used across six files and **defined nowhere** in
`src/ds/tokens.css` or `src/where-it-went/index.css`. This is a regression of the
exact bug the 2026-07-30 go-live audit claimed to have fixed.

Visible consequences:

- [`TransactionsList.jsx:346`](src/where-it-went/components/TransactionsList.jsx:346) —
  a selected row's background is `color-mix(in srgb, var(--color-primary) 15%, var(--color-surface))`.
  An invalid `color-mix` is dropped entirely, so **multi-select gives no visible
  selection highlight**, and the 4px left border falls back to `currentColor`.
- [`SmartTextEntry.jsx:278`](src/where-it-went/components/SmartTextEntry.jsx:278) —
  the "Add to Subscriptions" button is `background: var(--color-primary); color:
  var(--color-on-primary)`, i.e. transparent text on a transparent button.
- [`SmartTextEntry.jsx:237`](src/where-it-went/components/SmartTextEntry.jsx:237),
  [`SmartInsightsChat.jsx:84`](src/where-it-went/components/SmartInsightsChat.jsx:84) —
  card borders and icon colours drop out.
- [`CurrencySelect.jsx:55`](src/where-it-went/components/CurrencySelect.jsx:55) — the
  selected currency's highlight.
- [`SplitTransactionModal.jsx:87`](src/where-it-went/components/SplitTransactionModal.jsx:87) —
  `--weight-normal`.

The likely intent is `--color-accent` / `--color-on-accent`; `--weight-normal` should
be `--weight-regular` or a literal.

### P0-5. Asking the AI to delete a transaction silently does nothing — and reports success

[`SmartTextEntry.jsx:115`](src/where-it-went/components/SmartTextEntry.jsx:115):

```js
} else if (t.action === 'delete' && t.id) {
  // skip — delete not fully implemented
}
```

The whole delete path is a stub. Worse, the success message that follows falls into
the single-item `else` branch (line 126) and renders
`Added: undefined RON for undefined` — the user is told a transaction was *added*
when they asked to delete one and nothing happened.

`WHERE_IT_WENT.md` advertises this ("*delete the last transaction*", "*outputs
structured `update` or `delete` actions directly mapping back to the Notion
database*"). Either wire it up or stop claiming it.

### P0-6. Splitting a transaction can invent or destroy money

[`SplitTransactionModal.jsx:69`](src/where-it-went/components/SplitTransactionModal.jsx:69)
ceilings both halves independently:

```js
splitAmount: Math.ceil(numSplit),
remainderAmount: Math.ceil(remainderAmount),
```

Split 101 L at 33%: `ceil(33.33) = 34`, `ceil(67.67) = 68`, total **102**. Every
non-integer split rounds *up on both sides*, so the ledger gains money. The
remainder must be derived from the rounded split (`total − ceil(split)`), not
rounded separately.

The same modal also computes `remainderOriginalAmount = transaction.originalAmount`
unchanged on the income path (line 44) while the RON figure grows, implying a
different exchange rate on the surviving row.

---

## P1 — Correctness and data integrity

### P1-1. The Split modal keeps the previous transaction's state

`SplitTransactionModal` is rendered unconditionally in
[`App.jsx:566`](src/where-it-went/App.jsx:566) with `isOpen={!!splittingTx}`, so it
**never unmounts**. There is no effect resetting state on a `transaction` change, so
after splitting transaction A, opening the split modal on transaction B still holds
A's mode, amount/percentage and category. On B those numbers are silently wrong.

### P1-2. A failed split leaves the original reduced with no counterpart

[`App.jsx:410`](src/where-it-went/App.jsx:410) does two sequential writes:

```js
await client.updateTransaction(originalTx.id, updatedOriginal);  // 100 → 60
await client.addTransaction(newSplitTx);                          // 40  ← if this throws…
```

If the second call fails, the original has already been reduced to the remainder and
40 L has vanished from the ledger. The catch re-throws without rolling back and
without telling the user which half landed. Notion has no transactions, but the
order can at least be reversed (add first, then reduce) so a failure leaves a
harmless extra row rather than a silent shortfall.

### P1-3. Quick Templates and the AI parser date transactions in UTC

[`Dashboard.jsx:504`](src/where-it-went/components/Dashboard.jsx:504):
`date: new Date().toISOString().slice(0, 10)`
[`aiParser.js:10`](src/where-it-went/lib/aiParser.js:10):
`const todayStr = new Date().toISOString().split('T')[0]`

This is the precise bug `lib/period.js`'s `toDateString()` exists to prevent, and
which the 2026-07-29 audit fixed in the subscriptions engine ("*never
`toISOString()`, which shifted a 1st-of-the-month charge into the previous
month*"). In Romania (UTC+2/+3) anything logged between local midnight and ~03:00
is dated **the previous day** — and the AI prompt is told the wrong "today", so
"yesterday" resolves two days back.

[`aiParser.js:28`](src/where-it-went/lib/aiParser.js:28) also uses
`new Date(t.endDate)` on a `YYYY-MM-DD` string (UTC-parsed) instead of `parseTxDate`.

### P1-4. Account and category page icons are no longer read

[`notionClient.js:132`](src/where-it-went/lib/notionClient.js:132) and
[`:159`](src/where-it-went/lib/notionClient.js:159) both hardcode
`icon: null, // Legacy emojis disabled in favor of Lucide SVGs`, and
[`accounts.js:18`](src/where-it-went/lib/accounts.js:18) has a dead
`const icon = ''`.

`WHERE_IT_WENT.md` §1.1 still states the account's Notion page icon "*is read and
shown wherever the account appears*", and a whole section documents adding
🏦/📱/💶/💳/💵 icons to the live workspace for exactly this. Those icons are now
ignored; `AccountIcon` falls back to guessing from name/type substrings, so two
same-named Revolut accounts get the *same* icon and only the `(EUR)` suffix
distinguishes them — undoing the disambiguation that section was written to
provide.

Related: the client comment says emojis are disabled "in favor of Lucide SVGs", but
`flairLucideIcons` defaults to **false**, so the default rendering is emoji. The two
statements contradict each other.

### P1-5. `formatCurrency` and `formatCurrencyCompact` are now byte-identical

[`lib/currency.js`](src/where-it-went/lib/currency.js) — both functions round to 0
decimals, yet `formatCurrency`'s docblock still reads "*Two decimals, because a
ledger whose rows don't sum to its total is worse…*" and
`formatCurrencyCompact`'s says "*Rounds, so never use it where figures must
reconcile*". One of the two is now pointless, and the documented invariant is
broken in the direction the comment warns about: three rows of 10.4 L each display
as `10 L` while their total displays `31 L`.

This may be an accepted trade-off (the changelog says decimals were removed
deliberately), but the comments now actively mislead, and
[`TransactionForm.jsx:386`](src/where-it-went/components/TransactionForm.jsx:386)
still accepts `step="0.01"` while the RON field beside it uses `step="1"` — so
fractional amounts keep entering a ledger that can no longer display them.

### P1-6. Bulk actions have no partial-failure story and no rate-limit pacing

[`TransactionsList.jsx:91-126`](src/where-it-went/components/TransactionsList.jsx:91):
delete / categorize / reconcile each loop `await` over the selection. On a failure
at item 5 of 20:

- the loop throws out to `catch`, so items 6–20 are never attempted;
- `setSelectedTxs(new Set())` is skipped, so the selection still shows all 20;
- `onDataChange()` is never called, so the 4 rows already deleted stay on screen;
- the error reads "Failed to bulk delete" with no count of what did happen.

`notionClient` has a `WRITE_SPACING_MS = 350` constant used only by `scrub` — the
bulk paths send back-to-back writes well past Notion's ~3/s limit and rely entirely
on 429 retry/backoff to recover, which is slow and invisible.

### P1-7. `lastProcessed` never advances when charges are already in the ledger

[`useSubscriptionsEngine.js:156`](src/where-it-went/lib/useSubscriptionsEngine.js:156):

```js
if (plans.every(p => p.toPost.length === 0)) return;
```

The early return fires *before* the loop that advances `lastProcessed` for
already-present occurrences. So a subscription whose charges are always entered by
hand keeps `lastProcessed` frozen forever, and `getDueDates` re-derives the same
growing list every session. Once the gap exceeds `MAX_BACKFILL_MONTHS` (12), older
occurrences fall off the window silently.

### P1-8. Bulk Categorize offers categories for Transfers

[`TransactionsList.jsx:464`](src/where-it-went/components/TransactionsList.jsx:464)
builds `selectedTypes` with `.filter(t => t && t !== 'Transfer')`, then
`return selectedTypes.size === 0 || selectedTypes.has(cat.type)`. Select only
transfers → `selectedTypes.size === 0` → **every** category is offered, and picking
one writes a category onto a transaction type the app defines as having none.

### P1-9. Search still means three different things

`lib/filtering.js` matches description, category, account, notes **and the amount**
(`String(t.amount ?? '').includes(q)`). `analytics/index.js`'s copy matches the same
four text fields but **not the amount**. So searching `45` narrows the ledger and
the Dashboard but not Insights — the same drift documented as fixed in the "Notes,
closed loop" pass, reintroduced by the second copy.

### P1-10. A same-category manual split is still flagged as a duplicate

The `(Split)` / `(Nora)` description markers only work because
[`duplicates.js:143`](src/where-it-went/lib/duplicates.js:143) requires
`similarity === 1` to pair across categories — and `"Dinner"` vs `"Dinner (Split)"`
scores 0.9. But when the user picks the **same** category for the split half,
`sameCategory` is true, that override is never consulted, and an even split (50/50,
same day, same account, 0.9 similarity) is flagged as a `medium` duplicate. The
class of false positive the markers were added for is only half closed.

### P1-11. `loadData` has no race guard

[`App.jsx:204`](src/where-it-went/App.jsx:204) — `loadData` is recreated whenever
`client`/`baseClient` change (i.e. on any config save) and re-fires via
`useEffect`. There is no request-sequence token or `AbortController`, so a slow
in-flight load from the previous config can resolve *after* a newer one and
`setData` stale results — and `saveSnapshot(fresh)` will mirror them.

### P1-12. Miscellaneous smaller correctness items

- [`Dashboard.jsx:106`](src/where-it-went/components/Dashboard.jsx:106) — foreign
  totals do `f[c].income += t.originalAmount` guarded only on `originalCurrency`;
  a row with a currency but a null amount yields `NaN` in the KPI card.
- [`outbox.js:216`](src/where-it-went/lib/outbox.js:216) — `retryFailed` pushes the
  job to the **front** of the queue. Retrying several failed jobs one at a time
  inverts their relative order, in a module whose central design rule is that order
  must never change.
- `flushOutbox` never increments `attempts` on a retryable failure, so a permanently
  5xx-ing item retries forever with no dead-letter path.
- `saveSnapshot` silently returns `false` at quota
  ([`storage.js:25`](src/where-it-went/lib/storage.js:25)); the offline mirror can
  stop updating with the only symptom being an increasingly old "Showing data
  from…" timestamp.
- [`aiParser.js:136`](src/where-it-went/lib/aiParser.js:136) — `data.content[0].text`
  and `JSON.parse(responseText)` are both unguarded. A `max_tokens` truncation
  (limit is 1000, and batch mode emits one object per transaction) surfaces as a raw
  `SyntaxError`. Neither fetch has a timeout/`AbortController`.
- [`aiParser.js:164`](src/where-it-went/lib/aiParser.js:164) — the validity filter
  lets an `update` through with no `id` (`t.amount && (… || t.action === 'update')`),
  which reaches `client.updateTransaction(undefined, …)`.
- [`SmartTextEntry.jsx:137`](src/where-it-went/components/SmartTextEntry.jsx:137) —
  a mid-batch save failure swallows the real error ("Failed to save changes."),
  leaves the input populated and never calls `onSuccess`, so already-saved rows
  don't appear and re-submitting duplicates them.
- [`noraSplit.js:106`](src/where-it-went/lib/noraSplit.js:106) — a description of
  just "with Nora" strips to `''`, producing an empty Notion title and a row
  literally named " (Nora)".
- [`budgets.js:94`](src/where-it-went/lib/budgets.js:94) — `previousWindow` steps
  back by a hardcoded 86 400 000 ms; in a timezone whose DST transition lands at
  midnight on the 1st, it can return the same window and count its carry repeatedly.

---

## P2 — UX, clarity and consistency

### P2-1. The most destructive action in the app uses `window.confirm`

[`TransactionsList.jsx:92`](src/where-it-went/components/TransactionsList.jsx:92):
`if (!window.confirm(\`Delete ${selectedTxs.size} transactions?\`)) return;`

The changelog states "*Every native `alert()` replaced with the DS `AlertModal`*",
and single-transaction delete uses `ConfirmModal` with a proper explanation ("*It
will be archived in Notion and can be restored from the trash there*"). Bulk delete
— the one that can remove 50 rows — gets an unstyled OS dialog with none of that
reassurance.

### P2-2. Multi-select is undiscoverable

Selection mode is entered only by long-press
([`TransactionsList.jsx:338`](src/where-it-went/components/TransactionsList.jsx:338)).
There is no checkbox, no "Select" affordance, no hint anywhere in the UI, and no
mention in the guide. With [P0-4](#p0-4) also killing the selection highlight, a
user who triggers it by accident gets a bottom action bar with no visible
indication of *what* is selected.

### P2-3. A Quick Template posts a real transaction with no confirmation and no undo

[`Dashboard.jsx:498-507`](src/where-it-went/components/Dashboard.jsx:498) — tapping a
template pill with an amount writes straight to Notion. No toast, no undo, no
highlight. The ledger just silently gains a row. `TransactionsList` already has a
toast system that could be reused; the Dashboard has none.

### P2-4. Two validation systems fight in the transaction form

`TransactionForm` sets HTML `required` on Description, Amount, Date, Category and
Account *and* implements the documented inline-`FormError` flow. The browser's
native validation bubble intercepts submit first, so the `FormError` banner — the
thing the changelog says replaced disabled Save buttons — only ever appears for the
cases native validation can't express (transfer with equal ends, missing RON
amount). Pick one.

`SplitTransactionModal` has the opposite problem: `handleSubmit` starts with
`if (!canSubmit) return;` and sets **no** error, so clicking "Save Split" on an
invalid split does nothing at all with no explanation.

### P2-5. Numbers and units are presented inconsistently

- `SplitTransactionModal` prints raw numbers with a literal `"RON"`
  (`{numOriginal} RON`, `Math.ceil(numSplit)} RON`) while the entire rest of the app
  uses `formatCurrency` → `1,250 L`. Same screen, two currencies by appearance.
- The budget card says "Nothing spent yet"; the changelog documents "No spending
  this period".
- Chart series use hardcoded `hsl(142, 71%, 45%)` / `hsl(348, 83%, 60%)`
  ([`Dashboard.jsx:294-320`](src/where-it-went/components/Dashboard.jsx:294)) instead
  of `--color-success` / `--color-danger`, so the two charts are the only surfaces a
  repalette or theme change won't reach.

### P2-6. Feature interactions that quietly remove information

- Turning on **Multi-Currency Totals** replaces the KPI trend badges entirely
  ([`Dashboard.jsx:546`](src/where-it-went/components/Dashboard.jsx:546)) for anyone
  with a single foreign transaction in the period. Period-over-period comparison is
  gone with no indication it was traded away.
- **Budget Left** sums only positive remainders
  ([`Dashboard.jsx:137`](src/where-it-went/components/Dashboard.jsx:137)), so a
  category 2,000 L over budget contributes 0 rather than −2,000. The KPI can read
  comfortably positive while you are badly over. No tooltip explains this.

### P2-7. Accessibility

- The action toast ([`TransactionsList.jsx:526`](src/where-it-went/components/TransactionsList.jsx:526))
  has no `role="status"` / `aria-live`, so the only confirmation of a bulk delete is
  invisible to a screen reader.
- Its `setTimeout` is never cleared on unmount (no cleanup effect on
  `toastTimerRef`) — a state update after unmount if the tab is switched inside 5s.
- Transaction rows are `role="button" tabIndex={0}` *nested inside* `SwipeableRow`'s
  own click handler — two overlapping interactive layers on the same rectangle.
- The swipe gestures (Repeat / Split) have no keyboard or pointer equivalent on the
  row itself; they're only reachable via long-press → bottom bar.

### P2-8. Privacy disclosure for the AI features

`askInsightsAI` sends the full filtered period's transactions (dates, descriptions,
amounts, categories) to `api.anthropic.com` from the browser. The Settings hint
says only "*Replaces the local Smart Text Entry parser with a Claude-powered cloud
engine*". The Notion token field carries a clear "*Stored only on this device and
sent straight to Notion — never to us*" note; the Claude key and the data it carries
deserve the same sentence. The guide mentions the AI features **zero times**.

---

## P3 — Performance and code health

- **Full refetch on every load.** `_fetchAllPages` pulls the entire Transactions
  database (100/page) on every `loadData`, including after every single write
  (`await client.addTransaction(...); await loadData()`). Adding one transaction to a
  5,000-row ledger costs 50 round trips. An incremental fetch filtered on
  `last_edited_time`, or an optimistic local insert without a full reload, is the
  obvious win.
- **Datalist of every description ever.**
  [`TransactionForm.jsx:73`](src/where-it-went/components/TransactionForm.jsx:73)
  renders one `<option>` per distinct historical description into the DOM on every
  form open — unbounded.
- **Auto-fill scans the whole ledger per keystroke**
  ([`TransactionForm.jsx:110`](src/where-it-went/components/TransactionForm.jsx:110)).
- **`engineHasRun` is module-level mutable state**
  ([`useSubscriptionsEngine.js:139`](src/where-it-went/lib/useSubscriptionsEngine.js:139)) —
  correct for the double-mount fix it was added for, but it leaks across tests and
  means the engine can never run again after a mid-session Notion connect.
- **`Settings.handleCreateTemplatesDb` calls `client._request(...)` directly**
  ([`Settings.jsx:176`](src/where-it-went/components/Settings.jsx:176)) — a component
  reaching into a private client method.
- **`handleSave` / `executeScrub` build their test clients without `templates`**
  ([`Settings.jsx:203`](src/where-it-went/components/Settings.jsx:203)), so the
  Quick Templates database id is never validated on connect and never scrubbed by
  "Erase Notion data".
- **116 `!important` declarations** in a 984-line `index.css` — the flair/density/
  layout toggles are fighting inline styles, and `.flair-empty` / `.flair-theme` /
  `.flair-tactile` each appear 5–7 times.
- **`EMPTY_DATA` is a shared module-level object** used as initial state
  ([`App.jsx:33`](src/where-it-went/App.jsx:33)) — safe today only because nothing
  mutates it.
- **Demo writes mutate the imported fixture arrays** (`DEMO_TRANSACTIONS.unshift`,
  `Object.assign(tx, updates)`), so demo data drifts from `models/demoData.js`
  within a session.

---

## T — Tests and tooling

### <a id="t1"></a>T1. Lint is not green, contrary to the changelog

`npx eslint src/where-it-went` → **33 errors**, all `no-unused-vars` /
`no-useless-escape`. `WHERE_IT_WENT.md` asserts "typecheck and lint all green" in at
least four places. Most are harmless dead imports (`Button`, `formatAccountLabel`,
`getChartColors`, `CheckCircle`, `Wallet`), but three are signals:

- `Dashboard.jsx:284-286` — `inkColor` / `mutedColor` / `borderColor` are computed
  from the theme and then never applied to the trend chart, which is why it uses
  hardcoded HSL instead ([P2-5](#p2-5)).
- `Dashboard.jsx:41` — `categoryFilter` / `searchQuery` unused, the residue of
  [P0-1](#p0-1).
- `SmartTextEntry.jsx:137` — `err` caught and discarded ([P1-12](#p1-12)).

CLAUDE.md's "before declaring any task done" gate names `npm test` and
`npm run typecheck` but **not lint** — worth adding, since the docs already claim it.

### <a id="t2"></a>T2. `npx vitest` gives 71 false failures

`npm test` runs `cross-env NODE_OPTIONS=--no-experimental-webstorage vitest`. Without
that flag Node's native `localStorage` shadows jsdom's and every storage-touching
test dies with `Cannot read properties of undefined (reading 'clear')` — 71 failures
across 4 files that look like real regressions. Worth a line in CLAUDE.md so the next
session doesn't chase it.

### T3. Coverage gaps that map directly onto the bugs above

`lib/filtering.js` — the module at the centre of [P0-1](#p0-1) — **has no test at
all**. Neither does `lib/currency.js` ([P1-5](#p1-5)), `lib/analytics/index.js` (525
lines, the largest untested file in the app), `analytics/metrics.js`,
`analytics/rules.js`, `analytics/comparisons.js`, `lib/trends.js`, `lib/theme.js`,
`lib/storage.js`, `lib/useCountUp.js`, or `lib/chartConfig.js`.

26 of 50 components have no test, including every one implicated above:
`SplitTransactionModal` ([P0-6](#p0-6), [P1-1](#p1-1)), `QuickTemplates`
([P1-3](#p1-3)), `DuplicateReview`, `SwipeableRow`, `PullToRefresh`,
`SmartInsightsChat`, `Navigation`, `OfflineBanner`, `LedgerExport`.

Existing tests are also all happy-path: nothing covers a partially-failed bulk
operation, a mid-split write failure, a rejected Notion property, or a
`max_tokens`-truncated AI response.

Suggested minimum new coverage, in order of value:

1. `filtering.test.js` asserting the exact `filterProps` shape the app passes.
2. A shared-contract test running `lib/filtering.js` and `analytics/index.js`'s
   filter over identical input and asserting identical output.
3. `SplitTransactionModal` — rounding conservation, state reset between
   transactions, invalid-submit feedback.
4. `notionClient` — that `addTransaction`'s property set matches the documented
   schema (a literal list assertion would have caught [P0-3](#p0-3)).
5. A CSS-token test: every `var(--…)` referenced under `src/where-it-went` resolves
   against `tokens.css` + `index.css` (would have caught [P0-4](#p0-4) and the
   identical 2026-07-30 regression).

---

## D — Documentation

### D1. `WHERE_IT_WENT.md` contains large duplicated blocks

- Lines **1–78** are repeated verbatim at **79–161** — including the `# WhereItWent`
  H1 and the entire §1 schema for Accounts, Categories, Subscriptions, Trips and
  Transactions.
- The sequence **"Go-live audit" → "Quality-of-life pass" → "Feedback pass on the
  1.0 release"** appears twice: lines **822–983** and again at **1017–1180**.

Roughly 350 of 1,369 lines are duplicates. Line 3 says "**five** databases", line 7
(and 81) says "**six**".

### D2. The Transactions schema list is truncated mid-list

At line 161 the §1.5 property list is running (`Recurring`, `Tags`…) and at line 162
it becomes feature bullets ("PWA Ready", "Vitest Coverage", "Deep Insights
Engine") with no heading between them. The schema section simply stops.

### <a id="d3"></a>D3. Schema documentation is behind the code

Missing from §1 entirely: the **Reconciled** checkbox ([P0-3](#p0-3)), the
**Quick Templates** database (Description/Amount/Category/Account/Active/Type —
created by `createTemplatesDatabase`), and Categories' **Description** rich-text.

### D4. Stale claims in `WHERE_IT_WENT.md`

| Claim | Reality |
|---|---|
| Repeat: "notes and tags start blank (both are instance-specific)" | `handleRepeatTransaction` copies both ([`App.jsx:446`](src/where-it-went/App.jsx:446)), and `TransactionForm` submits `tags: seed?.tags`. The JSDoc describing this sits above the *wrong function* (`submitSplitTransaction`, [`App.jsx:387`](src/where-it-went/App.jsx:387)). |
| "Date input now has `max={today}`" | No `max` on the Date field — and correctly so, since future-dated rows are now a feature. Statement is simply wrong now. |
| "Currency conversions now strictly round up (`Math.ceil`)" | [`fx.js:180`](src/where-it-went/lib/fx.js:180) uses `Math.round`. |
| "Rate: 1 EUR = 5.2353 RON (29 Jul)" | `formatRateNote` renders 2 decimals, not 4. |
| Smart Text Entry backed by `claude-3-5-haiku-20241022` | Code uses `claude-haiku-4-5-20251001`. |
| Quick template "logs a transaction … instantly without opening the modal" | True only when the template has an amount; otherwise it opens the modal, titled **"Repeat Transaction"** ([`App.jsx:552`](src/where-it-went/App.jsx:552)) because `repeatDraft` is reused for templates. |
| Account page icons are read and shown | See [P1-4](#p1-4). |
| "eslint all green" | See [T1](#t1). |
| The guide covers "the full five-database schema with every property" | See [D5](#d5). |

### <a id="d5"></a>D5. `public/where-it-went-guide.html` is materially incomplete

§4 "The database schema" documents **4.1 Categories, 4.2 Accounts, 4.3
Transactions** — and stops. **Subscriptions, Trips and Quick Templates have no
schema section**, despite §8 explaining recurring transactions and §6 explaining
trips at length. A reader following the guide cannot build the databases those
sections describe.

Undocumented features (occurrence count in the 4,599-word guide):

| Feature | Mentions |
|---|---|
| Smart Text Entry / AI parser / Claude / Anthropic | **0** |
| Quick Templates (and its "Initialize Database" button) | **0** |
| Reconcile / the Reconciled flag | **0** |
| Bulk actions, multi-select, long-press | 1 (incidental) |
| Nora auto-split | 2 |

Given that the AI parser and Quick Templates each introduce a stored credential or a
new Notion database, these are the two most important things in the app to document
and the two least documented.

### D6. Structural

`WHERE_IT_WENT.md` is a schema reference and a changelog interleaved without
separation, with a stray numbered `## 4. The AI Parser` section sitting between
changelog entries. Splitting it into `WHERE_IT_WENT.md` (schema + current
behaviour) and `WHERE_IT_WENT_CHANGELOG.md` would make the schema section
authoritative — and would have made [D1](#d1)'s 350 duplicated lines obvious.

---

## Suggested order of work

1. **[P0-1](#p0-1)** (one-line fix + test), **[P0-4](#p0-4)** (token rename),
   **[P0-3](#p0-3)** (document `Reconciled`, or make it conditional on the property
   existing) — cheapest, highest impact.
2. **[P0-2](#p0-2)**, **[P0-6](#p0-6)**, **[P1-1](#p1-1)**, **[P1-2](#p1-2)**,
   **[P1-3](#p1-3)** — small, contained, each currently corrupts data or fails
   outright.
3. **[P0-5](#p0-5)** — either implement AI delete or remove the claim and the stub.
4. **[T1](#t1)** + **T3 items 1, 2, 5** — the guardrails that stop this class
   recurring.
5. **[D1](#d1)/[D5](#d5)** — de-duplicate the MD, finish the guide's schema section,
   document AI + Quick Templates.
6. The P1/P2 backlog.
