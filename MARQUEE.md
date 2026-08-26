# Marquee — venue watcher

**The venues you actually go to, checked for new shows and newly-opened tickets.**

Lives at `src/marquee/`, entry `marquee-react.html`. React + Vite + `src/ds/`.
Reads venue programme pages through one serverless endpoint; writes nothing but
saves, and those go to **Wanderlist Findings** like everything else.

> Sections 1–8 are the specification agreed before implementation. Sections 9+
> describe what actually shipped (added as it does).

---

## 1. What this is, and what it deliberately is not

Marquee watches a **small, hand-picked list of venue programme pages** and tells you
what changed since you last looked: a show that wasn't there before, tickets that
just went on sale, a night that just sold out.

It is **not** a discovery engine and shares no machinery with `/recommend in
Bucharest`. Radar-B answers *"what's happening in this city?"* by reading event
intelligence a skill produced. Marquee answers *"did Excelsior put anything new up?"*
by reading Excelsior's own page. Different question, different failure modes,
different cost profile.

| | Radar-B | Marquee |
|---|---|---|
| Sources | 8 editorial publications | the venue sites you chose (7 today, 4 readers) |
| Ingest | the `/recommend in Bucharest` skill (Claude parses) | a serverless HTML parser (no AI at all) |
| Wire format | Notion 📡 Radar | none — the scan result is transient |
| Judgement | taste-filtered by the skill | none; the venue's programme is the truth |
| Cost per run | 0 (the skill already ran) | a handful of HTTP GETs |

**No LLM is involved anywhere in Marquee's pipeline.** No web search. That is the
whole point: a venue's programme page is authoritative and structured, so parsing it
is cheap, exact, and needs no judgement.

---

## 2. The one-function constraint (read this before adding files to `api/`)

Vercel Hobby caps the **whole repo** at 12 serverless functions, and it was already
at 12 when Marquee was designed. Marquee therefore ships **exactly one** new
top-level endpoint:

```
api/marquee-scan.js          ← the only new function
api/_lib/marquee/            ← adapters; files under api/_* are NOT functions
```

The slot was freed (2026-08-26) by merging `api/wanderlist-reminders.js` into
`api/wanderlist-remind.js` behind `?mode=prefs` — the same app, same KV key, same auth
gate, already sharing `api/_lib/reminders.js`. `api/marquee-scan.js` spent it: the repo
is back at **12 of 12**, and the next app to want an endpoint has to free its own.

Note that a `.test.js` file placed directly in `api/` counts as a function too — the
tests for this endpoint live in `api/_tests/`, and that is why.

**Consequence, and the core architectural idea:** *one function, N adapters.* A new
venue never costs a function. Never add a per-venue endpoint; it cannot deploy.

---

## 3. The parse ladder

Each venue adapter uses the highest rung that works for that site:

1. **JSON-LD `@type: Event`** — structured, free, near-zero maintenance. Preferred
   wherever a site emits it.
2. **A machine feed** — ICS, or `/wp-json/wp/v2/<post-type>` where a WordPress venue
   models shows as a custom post type.
3. **CSS-selector adapter** — a saved fixture, a `parse(html)` function, a test.
   ~30 lines. This is where Teatrul Excelsior lands.

An adapter is a module, not config:

```js
// api/_lib/marquee/excelsior.js
export default {
  id: 'excelsior',
  name: 'Teatrul Excelsior',
  url: 'https://teatrul-excelsior.ro/program/',
  rung: 'selector',
  minItems: 4,          // health assertion — see §6
  parse(html) { /* → RawEvent[] */ },
}
```

### The seven venues, as inspected 2026-08-26

One adapter per SITE, not per venue — `eventbook` alone covers four of them.

| Venue | Site | Rung | What the reader gets |
|---|---|---|---|
| **Filarmonica George Enescu** | filarmonicaenescu.ro | **2 · feed** | A public Strapi API: `fgestrapi.filarmonicaenescu.ro/api/events`. 87 upcoming events with `startDateAndTime`, `venue`, `room`, `ticketUrl`, `categories`, and — the gift — `buyLabel` (`Cumpără bilete` / `Sold Out`) plus `disableBuy`. |
| **Expirat Halele Carol** | tickets.expirat.org | **1 · JSON-LD** | 16 complete schema.org `Event` objects: name, `startDate`, image, `offers` with price in RON. An iabilet.ro whitelabel, so the same reader should serve any other iabilet venue. |
| **Cinema Union**, **Elvira Popescu**, **Muzeul Țăranului**, **Club Control** | eventbook.ro | **3 · selector** | Server-rendered, one `id="performance"` block per showing, date *with* year, title in `.event-title`. Ticket state = presence of the `add_in_cart` button. |
| **Teatrul Excelsior** | teatrul-excelsior.ro | **3 · selector** | See below. |

Three things the survey turned up that the adapters have to respect:

- **Filarmonica's own listing page is unparseable.** It is a Next.js App Router page
  that emits `BAILOUT_TO_CLIENT_SIDE_RENDERING` — the HTML a server fetch receives
  contains no events at all. The feed above is the *only* server-side route in.
- **Filarmonica's feed rate-limits.** A short burst of requests starts returning
  `403 ForbiddenError` from an origin that answered moments earlier. One request per
  scan is well inside it, but a 403 must be read as **throttled, not broken** — it
  must not trip the parser-broken alarm in §6.
- **eventbook paginates**, ten showings per `?page=N` (Elvira Popescu had 8 pages).
  The adapter walks pages until it passes the horizon or runs out, with a page cap.

### Teatrul Excelsior, in detail

Server-rendered WordPress 7.1, no hydration, no login wall, 24 items on the page.
Every item is one anchor with stable classes:

```html
<a href="https://teatrul-excelsior.ro/spectacol/marile-sperante/" class="el-agenda-item">
  <div class="el-column-date"><span class="day">Sâm</span><span class="month">5 Sep</span></div>
  <div class="el-column-time"><span class="time">19:00</span></div>
  <div class="el-column-title"><h3 class="serif">Marile speranțe</h3></div>
  <div class="el-column-location"><span class="location">SPECTACOL ITINERANT</span></div>
  <div class="el-column-tickets"><span class="soText">SOLD OUT</span></div>
</a>
```

The tickets column carries exactly two values across all 24 items — `Cumpără bilete`
and `SOLD OUT` — which *is* the ticket signal, already in the markup. The page also
carries Yoast JSON-LD, but only `WebPage`/`Organization`, **no `Event` objects** —
so rung 1 does not apply here. Don't be fooled by the `application/ld+json` tag.

**Dates carry no year** (`27 Aug`). Year inference is real logic, not a detail — §5.

---

## 4. The event model

Field names deliberately track Radar-B's vocabulary so a save into Wanderlist is
lossless and the two apps could share a reader later.

| Field | Type | Notes |
|---|---|---|
| `key` | string | `venue-slug:YYYY-MM-DD:title-slug` — the identity everything diffs on |
| `title` | string | The show, without the venue (Wanderlist's `Name` rule) |
| `when` | ISO date + optional time | Local Bucharest time |
| `venue` | string | From the adapter, not the page |
| `hall` | string? | The location column, when it says something (`SPECTACOL ITINERANT`) |
| `link` | url | The show's own page |
| `ticketState` | enum | `open` · `sold-out` · `none` (announced, no ticket link yet) |
| `ticketsUrl` | url? | When it differs from `link` |

Derived by the client, never parsed: `firstSeen`, `ticketsOpenedAt`, `lastSeen`.

**Productions, not rows.** Excelsior lists *Marile speranțe* twice and *Familia
Addams* twice. The card is a **production** (`venue` + `title`) with its dates
nested; a save can be the whole run or one specific night.

---

## 5. Pure logic that must be tested

Everything here is a pure function in `src/marquee/lib/`, with its own test — the
same split as the rest of the repo.

- **`inferYear(dayMonth, today)`** — `27 Aug` → 2026-08-27. Rolls forward when the
  month is behind the current one (a programme showing `10 Ian` in December means
  next January). Must be tested across the year boundary; it is the piece of this
  app most likely to be quietly wrong for two weeks a year.
- **`eventKey(venue, date, title)`** — slug, diacritics stripped (`speranțe` →
  `sperante`), so a title tweak on the venue's side doesn't fake a new event.
- **`groupIntoProductions(events)`**
- **`diff(previousSnapshot, currentScan)`** — §7.
- **`toFindingsProps(...)`** — reused from `src/shared/findings.js`, not rewritten.

---

## 6. Adapter health — the thing that kills scrapers

A parser that silently returns zero is worse than one that throws. Every adapter
declares `minItems`, and the endpoint asserts, per venue:

- HTTP 200 and a non-trivial body, **and**
- `parse()` returned ≥ `minItems`, **and**
- at least one item has a parseable date.

Any failure returns `{ venue, status: 'parser-broken', detail }` and the app shows
**"Excelsior's page changed — the parser needs updating"** in Settings. Never an
empty list, never a silent no-op. With a handful of venues this is cheap to maintain, and
it is the difference between a tool you can trust and one you stop believing.

**Politeness:** identifying User-Agent, one request per venue per scan, conditional
requests (`If-Modified-Since`) where the server supports them.

---

## 7. The diff is the product

```
diff(previous, current) → Change[]
  'new-event'      key never seen before
  'tickets-opened' ticketState: none → open        ← the one you actually want
  'sold-out'       open → sold-out
  'cancelled'      seen last scan, absent now, date still in the future
```

**v1 holds no server state.** The client posts its venue list, the endpoint returns
parsed events, and the client diffs against a snapshot in `localStorage` — exactly
the shape of `api/clickdeck-studio-search.js` (client owns the list, endpoint is
stateless, client owns dedupe). Nothing to configure, nothing to back up.

**Deferred (build only when asked):** mirror the venue list into Vercel KV, add one
`vercel.json` cron line, run the same `diff()` server-side, and hand changes to the
existing `wanderlist-remind` email path or `src/shared/notify/`. The diff function is
written to be callable from either side so this stays a small change.

---

## 8. The app

Radar-B's presentation layer, its own data.

- **What changed** — a strip at the top that is the `diff()` output and nothing else.
  Its empty state says "nothing new since Tuesday", which is a real answer.
- **Programme** — DS cards grouped by date, one per production, dates nested.
  Signal chips: `nou`, `bilete disponibile`, `sold out`.
- **Filters** — by venue, and hide-past.
- **Detail sheet** — dates, hall, ticket state, link out.
- **Save** — Radar-B's `SaveSheet` → Wanderlist Findings via `src/shared/findings.js`
  through the existing `/api/notion` relay with a BYO token. **No new Notion
  database.** Category defaults to `play` for theatres, editable.
- **Triage** — seen / ignored / saved in `localStorage` (Click Deck's Anteroom idea).
  Ignoring a production silences it permanently, including future dates.
- **Venues** — the list of what gets read. Paste a URL → the reader resolves from it → the
  app **shows you what it found**, or tells you plainly that this venue needs an adapter.
  Sorted **alphabetically by name**, paused venues in place rather than sunk to the bottom:
  the list is short and you look things up in it by name.
- **Settings** — theme (system/light/dark, where system keeps following the OS), the three
  view toggles (hide sold-out runs, show what you've ignored, keep today's started
  showings), the Notion token and database, and a link to the guide.

### The honest caveat about adding venues

Adding a venue is **not always pure config**. If the site has JSON-LD Events or a
feed, the generic adapter handles it and Settings really is just "paste a URL".
Otherwise the venue needs a ~30-line adapter file — a small commit, not a UI action.
Settings must say so rather than failing vaguely. With a target of a handful of venues this
is the right trade; it would be the wrong one at fifty.

---

## Repo paperwork (per CABINET.md's new-app checklist) — done

- `marquee-react.html` entry + `vite.config.js` input, and the dev relay for the endpoint
  (`devBodyRelay`, not `devApiRelay` — the scan is a POST)
- `watchInstalled('marquee-react.html')` at startup
- `src/apps-registry.js` card entry, pointing at `marquee-guide.html`
- `public/marquee.webmanifest`, PNG icons at 192/512/512-maskable/32 (generated from
  `public/marquee-icon.svg` with sharp), and `public/marquee-sw.js`
- Service-worker registration gated on `import.meta.env.PROD`
- `public/marquee-guide.html` — the user guide
- A row in `CLAUDE.md`'s per-app map pointing here

## 9. What shipped (2026-08-26)

Both halves are built, verified against the live sites, and complete as specified.

### 9.1 The venue manager

**The store:** Notion database **Marquee — Watched Venues**, under Dev → App Databases
(`7c2ed57e41b74660868f014e9965ff19`), seeded with the seven venues above.

Marquee **owns** this database — unlike Radar-B, which is a guest in a table the skill
writes. Every column is the app's to write and the app is its only writer, which is why
removing a venue archives the page rather than flagging it.

| Property | Type | Why |
|---|---|---|
| `Name` | title | As it should read on a saved Wanderlist finding. |
| `Programme URL` | url | The exact page fetched. The listing page, never the homepage. |
| `Adapter` | select | `excelsior` · `eventbook` · `filarmonica` · `expirat` · `jsonld` · `unsupported`. Resolved from the URL, never typed. |
| `Adapter Config` | text | The per-venue parameter its site needs — today only the eventbook hall slug, derived from the URL. |
| `Status` | select | `active` · `paused`. **User intent only.** A broken parser is a runtime fact and is never written here. |
| `Category Default` | select | Wanderlist's Category for saves from this venue. Keeps a save lossless. |
| `Area` | select | Neighbourhood. |
| `Address` | text | So a saved finding drops its map pin first try. |
| `Last Checked` / `Last Result` | date / text | Written by a scan and by nothing else — editing a venue cannot blank its history. |
| `Notes` | text | |

Two rules the code enforces and the tests pin down:

1. **Selects stay inside their closed vocabulary.** Notion rejects an unregistered select
   name by failing the *entire* patch, silently taking unrelated fields with it.
   `toVenueProps` drops or defaults an out-of-vocabulary value instead.
2. **Narrow patches for narrow jobs.** Pausing writes one column (`statusProps`); a scan
   writes two (`scanResultProps`); neither can disturb the rest of the row.

### 9.2 The scan

```
api/marquee-scan.js            the one endpoint — stateless, no Notion, no secret
api/_lib/marquee/
  ├── registry.js              id → adapter
  ├── shared.js                inferYear, eventKey, slug, entities, makeEvent
  ├── scan.js                  fetch → parse → assess → horizon filter
  ├── excelsior.js             rung 3
  ├── eventbook.js             rung 3, four venues, self-discovering pagination
  ├── filarmonica.js           rung 2 (Strapi feed)
  ├── jsonld.js                rung 1, generic — also serves Expirat
  └── __fixtures__/            markup as actually served on 2026-08-26
```

The client owns the venue list and the diff; the endpoint holds nothing between calls.

### 9.3 Things the real markup taught us

Every one of these was found by running the readers against pages the sites actually
served, and every one is now a test:

- **Two showings of one production on one day are two events.** Excelsior lists Tomcat at
  17:00 *sold out* and at 20:00 *on sale*, same date. A key of venue+date+title collided,
  dedupe dropped the second, and the survivor reported SOLD OUT for both — the app lying
  about a show you could still get into. The time is part of the identity.
- **eventbook's listing is not all showings.** Each hall page opens with ticket-carnet rows
  whose "date" is prose (*"Valabil 6 luni de la data achizitiei"*). No date means no
  identity, so they are dropped — which is also the general rule, not a special case.
- **A length-capped regex silently lost every eventbook time.** The time sits as bare text
  behind ~40 spaces of template indentation; a `[\s\S]{0,40}` window ran out before
  reaching it. Match to the next tag, not to a character budget.
- **Filarmonica's `ticketUrl` is not the ticket signal.** Rows labelled *"Cumpără bilete"*
  routinely carry no `ticketUrl`, so trusting the URL reported concerts with tickets on
  sale as having none. `buyLabel` + `disableBuy` lead.
- **A hall that repeats the venue is noise.** Expirat's JSON-LD names its location "Expirat
  Halele Carol", rendering "Expirat Halele Carol · Expirat Halele Carol" on every card.
  Containment, not equality — "Sala Mare" at "Ateneul Român" is a real hall.
- **The keep sheet crashed the app right after a successful save.** `showing` is cleared one
  render before `draft`, and the JSX read `showing.venue` on that render. White screen at
  the worst possible moment.

### 9.4 Dedupe against Wanderlist

"In Wanderlist" started as a flag Marquee wrote to localStorage after a save it had made
itself. That was wrong in three directions at once:

- a row added from Wanderlist, or from another device, never showed here;
- a row deleted there stayed flagged here forever;
- nothing stopped the same night being kept twice.

**Findings is now the source of truth.** `src/marquee/findings.js` reads the database on
load and indexes it twice — by `title::date` for "is this night kept?", and by title for
"is this show kept at all?" — with the venue checked at lookup time by containment, because
a Findings `Place` is one string holding venue AND street AND city.

Consequences that are each a test:

- **Per-date, not per-production.** Keeping one night of a three-date run shows *"1 of 3
  dates kept"* and ticks that date, rather than implying the whole run was saved.
- **Containment is one-directional.** A `Place` of just "București" must not match every
  venue in the city — which would flag the entire programme as already kept.
- **A duplicate is refused once, then allowed deliberately.** The sheet swaps its save
  button for *"Keep a second copy"*; submitting the form directly does nothing until that
  is pressed.
- **A different date, or the same title at another venue, is not a duplicate.** Both save
  normally; the first says a sibling exists.
- **A Findings read failure is not fatal.** No access, wrong database id — the programme
  still works, with one quiet line saying "already kept" is unknown.
- **`triage` now only stores `ignored`.** Stale `saved` entries from the old scheme are
  dropped on read rather than migrated.

### 9.5 Decisions worth keeping

- **The diff is the product, and the first scan is not news.** With no snapshot every event
  is "new"; reporting a hundred of them says nothing. The baseline is established silently.
- **`cancelled` is only claimed for a venue that actually answered.** A throttled venue
  contributes no events, and treating that absence as cancellation would empty the app on
  every hiccup and refill it next time as if everything were brand new. Its last-known
  programme is carried forward instead.
- **Throttled ≠ broken.** Filarmonica's feed refuses bursts with a 403 seconds after
  answering happily. Calling that "parser broken" would send someone hunting a markup change
  that never happened.
- **Silence is loud.** A page that loads and parses to nothing is reported as *"the markup
  has probably changed"*, never as an empty programme. Three assertions per scan: a real
  body, the adapter's declared floor, and at least one parseable date — that last one is
  what catches a date-format change, which is otherwise invisible.
- **"Nothing upcoming" is a claim.** Filtering to a venue that could not be read says so,
  rather than implying its programme is empty.
- **The URL leads.** Paste a programme URL; the adapter resolves from it and the name fills
  itself in. Which of six readers can read a site is the one thing a person cannot know.
- **Pause is not a soft delete**, and **remove archives** — Notion's trash is the undo.
- **Nothing is ever kept as "Going".** Marquee never claims you have committed to anything.

### 9.6 Verified

`npm test` (3634 tests — 79 Marquee's client, 49 the adapters'), `npm run typecheck`,
`npx eslint`, and `npm run build` all pass. Beyond the fixtures, the endpoint was run
against all seven live venues: 24 events from Excelsior, 16 from Expirat with prices, 78
from Elvira Popescu across 8 paginated pages, 1 from Cinema Union. The full loop — check,
diff, keep, ignore, pause — was driven in the running app, including a doctored snapshot to
force each of the four change kinds.

## Open

- **No scheduled checking.** Marquee checks when you press the button; nothing runs while
  the app is closed. §7's deferred half — KV venue mirror, one `vercel.json` cron line, the
  same `diff()` server-side, handed to the existing `wanderlist-remind` email path — is
  written to be a small change, but it is not built.
- **Filarmonica's feed blocks this development machine.** After the research burst that
  discovered it, `fgestrapi.filarmonicaenescu.ro` returns 403 to every non-browser client
  from this IP, regardless of User-Agent — so it is an IP-level block with a long cooldown,
  not something the adapter can be written around. The app classifies it correctly
  (`throttled`, not broken) and the other six venues are unaffected. **Whether Vercel's
  egress IPs are blocked too is unknown until this deploys** — that is the first thing to
  check in production.
- Addresses and areas are filled only where a source stated them (Filarmonica, Expirat,
  Cinema Union). The other four are blank rather than guessed.
- `cancelled` still cannot distinguish *removed* from *page reorganised*. The health gate
  makes the false positive unlikely, not impossible; the guide says so out loud.
