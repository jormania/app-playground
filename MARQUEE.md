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
| Sources | 8 editorial publications | the venue sites you chose (10 today, 9 readers) |
| Ingest | the `/recommend in Bucharest` skill (Claude parses) | a serverless HTML parser (no AI at all) |
| Wire format | Notion 📡 Radar | none — the scan result is transient |
| Judgement | taste-filtered by the skill | none; the venue's programme is the truth |
| Cost per run | 0 (the skill already ran) | a handful of HTTP GETs |

**No LLM is involved anywhere in Marquee's pipeline.** No web search. That is the
whole point: a venue's programme page is authoritative and structured, so parsing it
is cheap, exact, and needs no judgement.

**The two circles never overlap, on purpose (2026-08-26).** Both apps eventually save
into the same Wanderlist Findings, so a venue covered by both would mean the same night
turning up from two directions. Rather than a dedupe check at save time, the boundary is
drawn at the source: the `recommend-in-bucharest` skill's **Step 1c** queries this repo's
Marquee — Watched Venues Notion database live, every run, and excludes any venue Marquee
is actively reading (`Status: active` *and* a working `Adapter` — matching exactly the
same filter `api/_lib/marquee/serverScan.js` applies before treating a venue as covered).
Nothing is hand-synced: add, pause, or remove a venue here and the skill's exclusion set
changes on its very next run, since the skill fetches its own body from this repo's
`main` at run time (`.claude/skills/README.md`). The one deliberate carve-out is
long-lead bookings at a `movie`-horizon venue (§9.8) — Marquee's 10-day window means a
festival announced weeks out won't be there yet, so the skill still allows those through
rather than dropping them into a gap neither system covers.

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

**A rung the original three didn't anticipate: framework-embedded JSON.** Some sites are
server-rendered by a JS framework that embeds its OWN full data model in the page rather
than schema.org — a mystage.ro venue page (Teatrul Unteatru) ships its whole event list,
richer than JSON-LD, inside `<script id="__NEXT_DATA__">`. Same one-request cost as rung 1,
same "read once, trust it" shape, just not schema.org — see §9.20. Not to be confused with
Filarmonica's Next.js page, which bails out to client-side rendering and has NO data in the
server response at all (§3's survey below) — the difference is whether `getServerSideProps`
actually ran, which only inspecting the raw HTML tells you.

**Rule: if a listing page is missing a field the adapter wants (a poster is the
recurring case), fetch each production's own detail page for it** — the same
`follow()` mechanism eventbook's pagination and iabilet's bundle pages already
use, one hop deeper. This is only worth doing when the field is actually THERE
in the detail page's static HTML; it is not a licence to add a headless browser.
An early investigation into Teatrul Excelsior's poster concluded this was
impossible (its listing carried `src="#"` and the custom REST route that might
expose it requires auth) — that conclusion was wrong, corrected in §9.14: the
poster IS on the detail page's static HTML, just not where that first look
checked (`og:image`, via the canonical URL, not the listing's own `src`
attribute). The real lesson isn't "Excelsior can't be done" — it's **check the
detail page's actual response before concluding a field is unreachable**, not
just the listing page's.

**Rule: a new adapter picks up every field this app already knows how to use,
not only the minimum that lists a showing.** No source left behind — poster,
price and a real description (§9.25) are as much a part of "reading a venue's
programme" as title, date and ticket state, and skipping them because the
listing alone doesn't carry them is the same mistake the Excelsior
investigation above made once already. Before shipping a new adapter, check
each of these against the venue's OWN pages (not just its listing):

| Field | Where it usually hides | Cost if the listing doesn't have it |
|---|---|---|
| `image` (poster) | The production's own detail page, or already-absolute on the listing (eventbook) | One `follow()` hop per distinct production — reuse it for `description` too, don't fetch the same page twice for two fields |
| `price` | Inline on the listing (eventbook's `price:` span), a feed's own price field (Oveit), or absent entirely (mystage's own occurrence price is routinely a genuine 0 before a date goes on sale — never report that as free) | Usually free once you look; skip only if genuinely nowhere |
| `description` | A detail page's own synopsis wrapper (Excelsior's `the-content`, TNB's `content` div — `proseParagraphs` in `shared.js` handles both), a feed's own description field (mystage, Filarmonica's Strapi blocks), or schema.org's `description` property (any JSON-LD source) | Same detail-page hop as the poster when there's already one; otherwise leave it null rather than inventing one |

Cinema Europa (iabilet) and the four Eventbook cinemas are the current, honest
exceptions — iabilet's bundle pages carry no synopsis at all short of a THIRD
hop layer (venue → bundle → per-film page), and Eventbook's own per-film page
has real content (director/cast/genre/duration) but adding it needs a NEW
`follow()` hop this adapter doesn't have yet. Both are open, not abandoned —
see MARQUEE.md's Open section — not a precedent for skipping this check on the
next venue.

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

### The ten venues, as inspected 2026-08-26

One adapter per SITE, not per venue — `eventbook` alone covers four of them, and now `tnb`
covers all 7 halls of one site under a single venue row too.

| Venue | Site | Rung | What the reader gets |
|---|---|---|---|
| **Filarmonica George Enescu** | filarmonicaenescu.ro | **2 · feed** | A public Strapi API: `fgestrapi.filarmonicaenescu.ro/api/events`. 87 upcoming events with `startDateAndTime`, `venue`, `room`, `ticketUrl`, `categories`, and — the gift — `buyLabel` (`Cumpără bilete` / `Sold Out`) plus `disableBuy`. |
| **Expirat Halele Carol** | tickets.expirat.org | **1 · JSON-LD** | 16 complete schema.org `Event` objects: name, `startDate`, image, `offers` with price in RON. An iabilet.ro whitelabel, so the same reader should serve any other iabilet venue. |
| **Cinema Union**, **Elvira Popescu**, **Muzeul Țăranului**, **Club Control** | eventbook.ro | **3 · selector** | Server-rendered, one `id="performance"` block per showing, date *with* year, title in `.event-title`. Ticket state = presence of the `add_in_cart` button. |
| **Teatrul Excelsior** | teatrul-excelsior.ro | **3 · selector** | See below. |
| **Filarmonica**, again | oveit.com | **2 · feed** | `membership-api.oveit.com/v1/vendor/<id>/events` — the platform it actually sells through. Same concerts, plus prices, from a host that does not refuse us. **This is the source the app uses**; the Strapi one is kept documented because it is richer if it ever becomes reachable. |
| **Cinema Europa** | iabilet.ro | **3 · selector, two-hop** | The venue page is a JS shell with no showings in it — only one schema.org Event per weekly themed bundle, each pointing at its own child page. That child page's HTML holds the actual showings, as an accordion of tariff rows. Added 2026-08-26; see §9.8. |
| **Teatrul Național București** | tnb.ro | **3 · selector, two-hop** | One page, 7 halls sharing this one venue row — the hall comes off each row, not off the venue. ~108 showings across ~35 days as inspected; no pagination, so this IS the whole forward calendar. A second hop per distinct production (61 of them) for its poster, same rule as Excelsior. Added 2026-08-26; see §9.20. |
| **Teatrul Unteatru** | mystage.ro | **new · embedded-json** | Every mystage.ro venue page is server-rendered Next.js embedding its full event model — title, date, hall, ticket state, poster — as JSON in `<script id="__NEXT_DATA__">`. No HTML parsing, no follow() hop. Added 2026-08-26; see §9.20. |

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
- **A Findings read failure is not fatal, but it is not cosmetic either.** The programme
  still works; keeping does not, because the database Marquee reads for dedupe is the one it
  writes saves to. The message says so — an earlier version mentioned only the dedupe, which
  would have let someone find the real problem by losing a save. Settings probes the two
  databases **separately** for the same reason, and both ids are overridable.

  This is a live setup step, not a hypothetical: an integration created for Marquee has
  access to Watched Venues and nothing else until Findings is shared with it too
  (Notion → the database → ••• → Connections).
- **`triage` now only stores `ignored`.** Stale `saved` entries from the old scheme are
  dropped on read rather than migrated.

### 9.5 Moving a venue to a different source (2026-08-26)

Filarmonica's own feed refuses non-browser clients from some IPs, so the venue was pointed
at **Oveit** — the ticketing platform it sells through — instead. That exposed two things
worth keeping written down:

- **An Oveit hub page is a 2.5KB JavaScript shell**, so the generic reader finds nothing on
  it. `api/_lib/marquee/oveit.js` reads the platform's public API instead, taking the vendor
  id out of the hub URL. It never reports `sold-out`: the feed has no such flag, and an
  absent price means "none published", not "gone".
- **Changing a venue's URL used to leave the OLD site's reader in place.** `validateVenue`
  fell back to the adapter already on the row whenever the new URL matched nothing — so the
  form said *"no built-in reader for this site"* while the row quietly kept `filarmonica`,
  and the next check went on failing against a site that was no longer being watched. A
  carried-over adapter now only stands if it could actually read the new URL (same host, or
  a generic reader claiming none). **What the form says is what gets saved.**

And one UX consequence, fixed at the same time: the programme on screen is always the LAST
check, never a live view, so a failure notice outlived the problem it described. Editing a
venue now marks the results stale and says so, and every trouble line is dated.

**Adding an adapter is a three-place change:** the module and `api/_lib/marquee/registry.js`,
the client's `src/marquee/adapters.js`, and the `Adapter` select in Notion.

That third place is the one to check by eye rather than assume, in either direction. The
closed-vocabulary rule §9.1 states is one **the app** enforces — `toVenueProps` refuses to
send an out-of-vocabulary value at all, which is what §9.29 got bitten by. Whether Notion
would also have refused it was never actually tested here: when this was finally looked at
on 2026-08-27, `tnb` and `mystage` were already present as options, so the 400 that rule
was written to prevent never had a chance to happen. Don't rely on either side catching it
for you.

> It was really a FOUR-place change until 2026-08-27, and the fourth was the one nobody
> remembered: `src/marquee/notion.js` kept its own hand-typed copy of the same vocabulary,
> and `tnb`/`mystage` never reached it — so editing either venue wrote `Adapter: null`
> back to Notion and silently stopped it being read. That copy is now DERIVED from
> `adapters.js` (`ADAPTER_VOCABULARY`) and cannot drift again; the three places above are
> the whole list once more. See §9.29.

### 9.6 Decisions worth keeping

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

### 9.7 Cinema Europa — a two-hop iabilet.ro reader (2026-08-26)

Added on request, and structurally unlike anything else Marquee reads. A venue page
(`iabilet.ro/bilete-<slug>-venue-<id>/`) never lists a single showing: it carries exactly
one schema.org `Event` block per **weekly themed bundle** ("Asian Spotlight Vol. 2", seven
films across one weekend), each pointing at a **child page of its own**. The actual
showings — one film, one date, one time — live only in that child page's HTML, as an
accordion of bookable tariff rows:

```html
<div data-is-tariff="1" data-tariff-id="346966"
     data-tariff-name="Vineri, 28 august - 18:15 — Chungking Express - Bilet preț întreg"
     data-tariff-sell-price="30" data-tariff-sell-currency="RON" …>
```

`api/_lib/marquee/iabilet.js` reads the venue page for its bundle links (`follow()`), then
reads each bundle page for the showings inside it (`parse()`) — the same two-step shape as
eventbook's pagination, just one level deeper. Three things this markup forces the reader
to get right, each now a test:

- **A showing sells at more than one price** (full / discounted), so tariff rows are
  grouped by `(date, time, title)` and the CHEAPEST tariff still on sale becomes the
  event's price — the same convention as Oveit's `minPrice`.
- **A subscription to the whole weekend ("Abonament") is its own tariff row**, with no date
  or time of its own. It is dropped by name before the date/time parser ever sees it — not
  filtered out afterward, which would have let a malformed one slip through as a dateless,
  identity-less "event".
- **A showing sells out per price tier, not per showing.** `"Stoc epuizat"` can mark the
  discounted tariff while the full-price one is still open; the showing itself only reads
  as sold out once every one of its tariffs says so — the health-gate reasoning applied one
  level down from the usual production/showing split.

The tariff text carries no year (`"28 august"`), same as Excelsior — but here `inferYear`
is anchored on the **bundle's own JSON-LD `startDate`**, not on "today", so a bundle that
happens to straddle a New Year still reads correctly regardless of when the scan runs.

`Category Default: movie` on this row is what puts it under the horizon rule below.

### 9.8 Per-category horizon — movies get 10 days, everything else 120 (2026-08-26)

A cinema lists weeks of showings nobody plans a trip to the pictures around this far out —
Cinema Elvira Popescu alone returned 78 events across 8 paginated pages the first time it
was scanned. `api/_lib/marquee/scan.js` exports `horizonFor(venue)`: `movie` gets
`MOVIE_HORIZON_DAYS` (10), everything else keeps `HORIZON_DAYS` (120). `api/marquee-scan.js`
calls it per venue in its scan loop, and the client's `scanPayload()` (`programme.js`) now
sends `category` along with each venue precisely so the endpoint has it to key on.

This is a blanket rule on the category, not a per-venue setting — add a fifth cinema next
year and it is limited automatically, without anyone remembering a checkbox. Nothing else
about a movie venue changes: it is still scanned, still diffed, still shows what changed;
only how far ahead its listing is trusted to matter.

### 9.9 "What changed": dismiss, and jump to the row it's about (2026-08-26)

Two requests from actually using it. **Dismiss** (`Changes.jsx`'s `×`) hides the strip until
the *next* check produces a fresh one — deliberately not persisted, and not a way to bring
it back for the current check: once read, the point is it gets out of the way, and a new
check makes its own un-dismissed strip regardless.

**Clicking a row scrolls to and focuses the card it's about.** `programme.js`'s `domIdFor`
turns a production id into a DOM id (folding diacritics through `findings.js`'s `fold` —
`productionId` itself only lowercases, so "speranțe" would otherwise collapse to a run of
hyphens); `App.jsx`'s `handleOpenChange` clears the venue filter (a change can point at a
production the current filter is hiding) and, after a deferred tick, scrolls, flashes and
focuses the matching card.

That deferral is a `setTimeout`, not a double `requestAnimationFrame` — rAF is paused
whenever a tab isn't actually compositing frames (a backgrounded tab, and incidentally this
project's own browser-preview pane), so a click made right before switching away would
otherwise silently never scroll. A macrotask still runs when backgrounded; browsers throttle
it, they don't stop it.

### 9.10 Bugs a first real look-over caught (2026-08-26)

- **A bare `<button>` has no text colour tied to this app's theme.** The UA default,
  `color: buttontext`, resolves against `color-scheme` — which defaults to *light*
  regardless of Marquee's own dark palette unless something says otherwise. Under
  **System** theme with the OS in dark mode, no `data-theme` attribute is ever set, so
  `.change` (a plain button with no `color` rule of its own) rendered light-mode black text
  on the dark surface — unreadable. Fixed two ways: `color-scheme: light` / `dark` added to
  all three of Marquee's own theme blocks, and — the actual fix — `button { color: inherit }`
  as a base reset, so every plain button reads the surrounding text colour unless a more
  specific rule (`.tab`, `.linkbtn`, `.change__kind`) says otherwise.
- **A venue card on a phone reserved ~288px of height it never used.** `.venue__main` /
  `.prod__main` carry `flex: 1 1 18rem` for the desktop ROW layout, where 18rem is a
  wrap-width. The phone breakpoint flips the card to a COLUMN, and that same 18rem now
  binds to the vertical axis instead — a flex item grows to at least its own basis
  regardless of how short its content is. Fixed by resetting `flex: 1 1 auto` on both
  classes inside that breakpoint, so height comes from content again.
- **The Settings button used to sit on its own row below the title on a phone**, because
  the desktop text button ("Settings") plus "Check venues" didn't fit beside "Marquee" at
  375px, and `.topbar__actions{width:100%}` forced them onto a second line. Settings is now
  an icon-only `IconButton` (lucide-react's `Settings`, matching the convention already used
  in Lexi5) and sits LAST — after Check venues — inside a `.topbar` that no longer wraps:
  `.topbar__heading`'s `min-width: 0` is what actually makes the title shrink first instead.
- **A Notion "Notes" field held developer commentary, not a note to self.** Four venue rows
  (Excelsior, Expirat, Elvira Popescu, Filarmonica) were seeded with technical explanations
  of how their adapter reads them — appropriate for this file, wrong for a field the app
  displays in the Venues list. Cleared in Notion. `Notes` is user-facing ("anything you want
  to remember about this venue") and nothing written into it from here should read like an
  implementation note.

### 9.11 §7 built: scheduled checking (2026-08-26)

The deferred half, done exactly as §7 sketched it: no new cron entry, no new serverless
function — `api/wanderlist-remind.js`'s existing evening cron (already DST-adjusted, already
gated on the reminder being enabled) now ALSO runs `api/_lib/marquee/serverScan.js`'s
`runScheduledCheck()` and appends whatever changed to that same email, rather than sending a
second one. The one new requirement is `MARQUEE_NOTION_TOKEN` — the browser's BYO token never
reaches a cron, so scheduled checking needs its own server-side credential; absent, the
section is silently skipped and the reminder behaves exactly as it did before Marquee existed.

Three things worth knowing:

- **A second, independent snapshot.** The server keeps its own KV history
  (`marquee:server-snapshot`) rather than sharing the client's localStorage one — they answer
  different questions ("what changed since the last scheduled check" vs "since I last opened
  the app"), and one shared history that either side could write to first is a race the two
  don't need to have.
- **The server's own diff is a deliberate duplicate**, not an import of
  `src/marquee/changes.js` — `api/_lib/marquee/diff.js` copies `diff`/`toSnapshot`/
  `sortChanges`/`summarize` verbatim. Reaching from a serverless function into the Vite source
  tree is a boundary nothing else in this repo crosses; the adapter registry already draws the
  same duplicate-on-purpose line for the same reason. Both sides' tests exercise the same
  cases, so a rule drifting between them shows up as a test failure, not a silent difference
  between what the app says and what the email says.
- **`?mode=cron` on `api/marquee-scan.js`** is a manual diagnostic — run the scheduled check
  right now and see what it found, gated the same two ways as wanderlist-remind's own cron
  path (`CRON_SECRET`, or a caller carrying the real Notion token). It is not where the check
  actually runs from; that's still only inside the reminder send.

Also writes back: each venue's `Last Checked`/`Last Result` gets updated on a scheduled run,
best-effort, the same as a manual "Check venues" press — so §9.13's health list stays current
even on a night nobody opens the app.

### 9.12 Posters on cards (2026-08-26)

Every reader already returned an image where its source had one — nothing was capturing it.
`ProductionCard` now renders one (a 56×80 thumbnail, `Poster` swallowing a 404 into "render
nothing" rather than a broken-image icon), and the card's left border/chip picks up the same
colour language as "what changed" when one of its showings is part of this scan's diff
(`primaryChangeKind`, ordered the same way the strip already is) — so scrolling the programme
itself shows what's new in place, not only at the top.

Fixing this surfaced two adapters that never extracted an image at all, despite the source
data being right there:

- **Eventbook** (`api/_lib/marquee/eventbook.js`) has a poster on every real showing, in its
  own `event-image-hall` block, already hosted on eventbook's own CDN — the `IMAGE` regex
  simply hadn't been written.
- **Teatrul Excelsior is different, not broken.** Its LISTING page (`/program/`) carries no
  image at all, on any row — confirmed by re-reading the real markup, not assumed. A show's
  poster only exists on that show's OWN detail page, as Yoast's `og:image` meta tag — and only
  when the post actually has a featured image set; some genuinely don't ("Marile speranțe" has
  none, at the time this was checked, and that absence is a real answer, not a parsing gap).
  Fixing this made Excelsior a two-hop adapter (§9.14) instead of one-shot.

### 9.13 Rule: fetch a production's own detail page when the listing doesn't have what's needed

Generalised from Excelsior's poster problem, and worth stating as policy for the next adapter
that hits the same shape: **if a field an adapter wants isn't on the listing page, `follow()`
each production's own detail page for it** — the same mechanism eventbook's pagination and
iabilet's bundle pages already use, one hop deeper, keyed by a self-identifying field on the
detail page (a canonical URL, an id) rather than by request order, so a handful of failed
fetches degrade to "that one field is missing" instead of misattributing data between shows.

This is a rule with a real limit, and Excelsior's own poster investigation is the proof: a
field that is genuinely absent from every static HTML response — populated only by
client-side JS after load, or gated behind an authenticated API — stays absent. The rule earns
its keep exactly once per adapter, on whatever field the listing is missing; it is not licence
to keep fetching further in search of something that was never there to find.

### 9.14 Teatrul Excelsior becomes two-hop, for its poster (2026-08-26)

`follow()` reads the listing for each DISTINCT production's own URL — one request per
production, not per showing, since a run's several dates all share one detail-page link.
`parse()` then scans EVERY page (listing and detail pages alike) for two independent things —
agenda rows, and a `<link rel="canonical">` + `<meta property="og:image">` pair — and
cross-references by that canonical URL rather than by which page arrived in which order. A
detail page that fails to fetch simply contributes nothing to the poster map; the production
it belonged to is posterless, not broken.

Verified against the live site across eight distinct productions: 7 have a working `og:image`
(Mickey Mouse, Familia Addams, Solaris, Mândrie și prejudecată, Tomcat, Metamorfoza, Două ore
cu pauză), 1 genuinely doesn't (Marile speranțe) — and the app shows exactly that, not a
guess for the eighth.

### 9.15 "New since last check" on the cards themselves (2026-08-26)

`programme.js`'s `changedKeyMap` turns `scan.changes` into a lookup by event key; each
production looks itself up (`primaryChangeKind`, same priority order as the strip) for its own
card-level badge and border, and each individual date button in a multi-date run looks itself
up too — so a run where one date just opened and another just sold out shows both, on the
exact dates they happened to, not only as one entry in the strip above.

### 9.16 A venue health list in Settings (2026-08-26)

Last checked, last result, current reader, paused or not — all of it already lived on the
Notion row, and nothing put it side by side until now. `SettingsModal`'s new "Venue health"
section is a read-only list over the SAME `venues` state the Venues tab already holds — no
new fetch, sorted alphabetically regardless of the order Notion returns them in.

### 9.17 Search across the programme (2026-08-26)

`programme.js`'s `searchProductions` folds the same diacritic-insensitive match `findings.js`
already uses for dedupe, against both title and venue. Squeezed onto the tabs row rather than
given its own — a pill-shaped box pushed to the far right by `margin-left: auto`, visible only
on the Programme tab (searching venues by name is what the Venues tab already shows, in full,
alphabetically). An empty query is a no-op filter, not "nothing", so a blank search box
behaves exactly like no search box.

### 9.18 A readability bug this write-up would have missed without a screenshot

Two client-only fixes worth recording precisely because neither would show up in a code
review — they only exist as pixels: `.tabs`'s `flex-wrap` was left over from before the search
box existed, and the combined width of the title, the tabs and the new search pill wrapped the
whole actions row onto its own line at a phone's width — fixed by `flex-wrap: nowrap` plus
`min-width: 0` on the heading, so the TITLE'S text shrinks first rather than the whole row
breaking. And `Programme`/`ProductionCard`'s new poster + change-badge props needed a default
(`changedKeys = new Map()`) so a caller that doesn't pass one — a future test, most likely —
gets an empty lookup rather than a crash on `.get()`.

### 9.19 Verified

`npm test` (3736 tests), `npm run typecheck`, `npx eslint`, and `npm run build` all pass. Beyond
the fixtures: the scheduled check was exercised end-to-end against a mocked Notion + KV
(baseline, then a tickets-opened detection across two runs, then a write-back to the venue's
own row); the wanderlist-remind splice was proven to append rather than replace, to override
the subject only when Wanderlist itself has nothing due, and to leave the reminder working
exactly as before when Marquee is unconfigured or throws. Excelsior's and Eventbook's posters
were confirmed against the LIVE sites, not only the fixtures — 7 of 8 real Excelsior
productions returned a working cover, the one that didn't genuinely has none set. Search,
the venue health list, and the new per-card change marks were all driven in the running app.

### 9.20 Teatrul Național, Teatrul Unteatru, and a filter that scales past a flat list (2026-08-26)

Adding the National Theatre exposed a real scaling problem before it exposed a parsing one:
TNB runs 7 halls (Sala "Ion Caramitru", Sala Mică, Sala Studio, Sala Atelier, Sala Pictura,
Sala Media, Amfiteatru) out of one building. Registering each as its own Marquee venue would
have taken the venue-filter chip row from 8 entries to 14+ from this one addition alone, and
every future multi-hall venue would repeat it.

**The fix is at the data model, not the UI: one Marquee venue row, one adapter, one page.**
`tnb.js` reads `tnb.ro/ro/bilete-online` — every hall's whole calendar on one page, no
pagination, sliding forward day by day (~108 showings across ~35 days as inspected; nothing
to cap, the default 120-day horizon already exceeds what the page itself shows). The hall
comes off each row's own `<td class="c2">`, into the `hall` field every adapter already
carries — nothing new to build there, just the first adapter that actually populates it with
more than one distinct value per venue. Posters follow §3's detail-page rule: one hop per
DISTINCT production (61, not per showing), each production's own page carrying
`<img class="article-image">`, matched by request URL rather than a canonical tag (TNB's
listing link and its detail page's own URL are already the same one).

**Teatrul Unteatru (mystage.ro) needed no HTML parsing at all** — see §3's new embedded-json
rung. `mystage.js` regexes out `<script id="__NEXT_DATA__">` and reads
`pageProps.initialEvents` directly: title, date, time, hall, ticket availability (mystage's
own `isAvailable`) and a poster, all in the one response. The one gap: mystage's own
`eventIds` list can be longer than what's hydrated inline (13 vs 10 seen on Unteatru's page)
— a handful of further-out occurrences load only through mystage's private API on scroll,
which this adapter does not chase. They surface on a later scan once mystage itself renders
them inline — self-healing, not a permanent blind spot, same shape as any horizon edge.

**The venue filter became three tiers, none of them new UI components** — `FilterRow` in
`Programme.jsx` is the same "All + one chip per option" shape rendered three times:

1. **Category** (`Theatre`/`Cinema`/`Concert`/…, from the venue's existing `Category Default`
   — nothing new to maintain, the field was already there) — shown only when more than one
   category is actually in use (`categoriesInUse` in `programme.js`). Picking one reveals that
   category's venues and filters the programme immediately.
2. **Venue** — in category mode, only ever the handful of venues in the picked category, never
   the full list. With one category (or too few venues to bother grouping), this falls back to
   exactly the old flat row — nothing changes for a small setup.
3. **Hall** — only for a single selected venue whose OWN productions span more than one hall
   (`hallsInUse`), so TNB gets one and every single-hall venue gets none, automatically.

Each tier gates on its own condition rather than a shared "more than one venue" guard
specifically so a first-time single-venue-but-multi-hall setup still gets its hall row — a
bug caught by the render test (`Programme.test.jsx`) before it shipped, not after.

### 9.21 Dismiss persists across a re-check that finds nothing new (2026-08-26)

"What changed" used to reset its dismissal on every successful scan, unconditionally —
including a re-check that found the exact same nothing new, which resurfaced an
already-read, already-dismissed list for no reason. `store.js` now persists dismissed
entries as `kind:key` signatures (`loadDismissedChanges`/`saveDismissedChanges`, capped at
300 — a signature is one-shot, so nothing that old is ever consulted again). `App.jsx`
filters `scan.changes` against that set on every render (`visibleChanges`) rather than
resetting a boolean on every scan; the strip only reappears once a check turns up a
signature that isn't already dismissed. Distinct from "this check found nothing" (`scan.
changes` itself empty), which still shows its own "nothing new since…" message exactly as
before — only "there WAS something and all of it is already dismissed" is now the
persistent, silent state.

### 9.22 Hide what's already in Wanderlist (2026-08-26)

A fourth Programme toggle in Settings, same shape and same "only when ALL of it" rule as
"hide sold-out": `visibleProductions`' new `hideKept` filters out a production only once
`savedAll` is true — every date of the run already kept — so a run with one night saved and
others still undecided stays visible. Reuses `findings.js`'s existing `savedAll` computation;
nothing new to derive.

### 9.23 Trimming two screens that had drifted into over-explaining (2026-08-26)

A first real look at the Keep sheet on a phone found two paragraphs that had accumulated at
the bottom — a Cost field hint ("left blank unless the venue published a price") and a
standing note that nothing saves as `Going` — sitting as permanent UI weight for something
worth saying once, not on every single keep. Both are removed from `KeepSheet.jsx`; both are
now in the guide instead (§04), which is where an explanation belongs once it stops being
something you need to read every time. The duplicate-entry warning itself stays in the sheet
— that one is contextual and only appears when it's actually true, which is a different
thing from a paragraph that was always there regardless of context.

`SettingsModal.jsx` got the same pass: the Findings-connection troubleshooting paragraph
("open the database → ••• → Connections…") shrank to a one-line pointer at the guide, which
already carried the full version in its own Connecting Notion section (§08) — a genuine
second copy, not new content.

### 9.24 Verified

`npm test` (3762 tests across 296 files), `npm run typecheck`, `npx eslint` on every changed
path all pass. Beyond the fixtures: `tnb.js` and `mystage.js` were dry-run against real
captures of both live sites (not just the trimmed test fixtures) before the fixtures were
even written, to confirm the parse logic against the actual current pages first. The
category/venue/hall filter tiers were driven in the running app at both desktop and mobile
viewport widths.

### 9.25 Real descriptions, into Wanderlist only (2026-08-26)

`toDraft`'s description used to be built ENTIRELY from computed facts (date count, hall,
price, sold-out) — never the venue's own words, because nothing read any. `makeEvent`
gained an optional `description`, carried through `toProductions` the same way `image`/
`link`/`hall` already are, and `toDraft` now leads with `production.description` ahead of
those computed facts rather than replacing them.

Five of the ten active adapters now populate it, each from whatever it already had reason
to fetch — no new requests beyond what posters already cost:

- **`tnb.js`, `excelsior.js`** — both already fetch each production's own detail page for
  its poster; the synopsis comes off that SAME page. `shared.js`'s new `proseParagraphs`
  (first `max` `<p>` tags past a length floor, not a real synopsis parser) is what both
  adapters share, since both sites mix the actual blurb with short label lines and credits
  in no fixed order — see the helper's own doc comment for why 2 paragraphs is the number
  that works for both without over-fitting to either page.
- **`mystage.js`** — already plain prose in the `__NEXT_DATA__` JSON. No extraction at all,
  one field access.
- **`jsonld.js`** (Expirat) — schema.org's own `description` property, already on every
  Event block that has one.
- **`filarmonica.js`** — the Strapi feed's `description` is a block-editor AST (headings,
  paragraphs, each an array of text runs), flattened to plain text. Not currently the ACTIVE
  reader for Filarmonica (Oveit is, per §9.7 — its feed carries no description field at
  all), but kept honest for whenever the Strapi feed becomes reachable in production.

Eventbook (4 active venues) and iabilet/Cinema Europa stay without one — both would need a
NEW `follow()` hop this session didn't add, not a missing field on an existing fetch. See
the new rule in §3 and the Open section below.

**This only ever reaches Wanderlist's `Description` field, via the Keep sheet's editable
draft.** Nothing renders it on the programme cards themselves — the listing stays exactly
as light as it was, title/venue/dates/chips, and adding a real description to what Marquee
already fetches was never a reason to add a paragraph of prose to a screen meant to be read
in ten seconds.

### 9.26 Two real Club Control bugs, caught from a phone screenshot (2026-08-26)

A "Two Wrongs" card showed "2 dates · Thu 3 Sept – 3 Sept" and one of its two date buttons
had no time at all. Both traced to eventbook.js, and both were live-verified against
`eventbook.ro/hall/club-control`, not just reasoned about:

- **`LINK` only ever matched `/film/`** — the pattern this adapter was written against, using
  the four cinemas' own listing pages. Club Control's real listings all link to `/music/`
  instead, so every one of them has been getting `link: null` since the adapter shipped. Now
  matches either.
- **Some Club Control rows have no dedicated `schedule` icon span at all** — the date line
  folds every time into itself instead: "3 septembrie 2026, Open doors: 19:30 | Concert:
  20:30 | Club night: 22:00". `fallbackTime` (new) reads the LAST time mentioned when the
  usual `schedule` span is missing — confirmed against a second, normally-formatted listing
  for the exact same night, which agrees at 22:00.

The fix to the second bug had a side effect worth naming: eventbook's own page lists this one
night as TWO separate `id="performance"` blocks (same title, same link, different price —
likely a per-room or per-tariff split on their end). Before the time fix, the two blocks had
different keys (`...T22:00...` vs `...Tnull...`) and both survived as separate showings. Once
both resolve to 22:00, they share a key and `scan.js`'s own dedupe collapses them into one —
which is what actually should have been happening the whole time this bug existed.

**`formatRun` got its own fix, independent of the above**, for defence in depth: "N dates ·
first – last" is wrong twice over for two showings on the same calendar date — it isn't a
range (nothing to span) and it isn't really "dates" (plural) either. Now reads "N showings ·
[date]" when `firstDate === lastDate`, whether or not a future case like this one dedupes away
cleanly.

### 9.27 Keep and Ignore look like buttons now (2026-08-26)

Both were `.linkbtn` — a bare underlined text link, the same treatment Settings' Pause/Edit/
Remove use. On a card full of chips and dates, "the two things you actually DO here" reading as
the quietest, most skippable text on the screen was worth fixing on its own. New `.action-keep`/
`.action-ignore` (Programme.jsx only — `.linkbtn` stays exactly as it was for Venues' three
actions, not touched here): pill-shaped, bordered, bold. Keep borrows the app's own accent (the
same colour "tickets"/"on sale" chips already use); Ignore stays quiet until hovered, then leans
toward the same danger tone Remove uses elsewhere — both are "take this away" actions, just at
different levels of permanence.

### 9.28 Search rejoins the tabs row at every width, and a doubled separator stopped being a second hall (2026-08-26)

Two more real bugs, both caught on a phone:

- **Search drifted back onto its own row.** §9.18's phone-only column stack (built to kill
  the original "Venues" width-change dance) over-corrected — it also undid the later request
  to share the row on desktop, and on a phone it just brought the drifting-away complaint
  back in a different shape. The actual fix was never "give search its own row" — it's
  **`.tabs` never shrinking or wrapping** (`flex-shrink: 0`), so its width is stable the
  instant it renders regardless of what "Venues" grows to. `.search-row` is the only thing
  that gives up width, down to a ~6.5rem pill on a phone; `.tabs-row` shares a row with
  `flex-wrap: nowrap` at every width now, phone included. Verified stable (no jump across
  three checks 300ms and 1200ms apart) at both 375px and a narrower 320px.
- **A doubled separator in a hall name read as a second hall.** Oveit's own `location` field
  is free text typed per event, not a fixed value — "Ateneul Roman / sala mare" and "Ateneul
  Roman // sala mare" are the same real hall at Filarmonica, just typed with a stray extra
  slash on some rows, and `hallsInUse` groups by exact string. `makeEvent`'s hall cleanup
  (already the place that drops a hall repeating the venue name) now also collapses any run
  of slashes to one, with consistent spacing — folding every spelling of the separator into
  one hall, for any adapter, not just Oveit's.

Also reconfirmed live: the Club Control link/time fixes from §9.26 were reported as still
broken, but re-running the adapter against the CURRENT live page (not the fixture) shows every
one of its 8 listings resolving a real link correctly. Marquee's programme is always the last
check, not a live view — a code fix doesn't retroactively repair an already-stored scan, and a
fresh **Check venues** press is what actually picks it up.

### 9.29 A full audit, and the drift it found (2026-08-27)

A pass over every path through the app — UI, client logic, endpoint, adapters,
integrations — rather than a fix for a reported symptom. Ten findings, each now
a test.

**The one that mattered.** `notion.js`'s `toVenueProps` carried the `Adapter`
select's vocabulary as a hand-typed array, and §9.20's two new readers never
reached it: `tnb` and `mystage` were not in the list. `selectOf` refuses an
out-of-vocabulary value by design (§9.1's rule 1), so **editing either of those
two venues wrote `Adapter: null` back to Notion** — the venue silently dropped
out of `scannable`, stopped being read, and, because the `recommend-in-bucharest`
skill's Step 1c exclusion keys on exactly the same "active AND has an adapter"
filter, quietly re-entered the skill's own coverage as well. Correcting a
venue's address was enough to do it. §9.5 called adding an adapter a
"three-place change"; it was really four, and the fourth was the one nobody
remembers. Fixed by **deriving** the vocabulary from `adapters.js`'s
`ADAPTER_IDS` (plus `unsupported`, which is a row state rather than a reader),
so the list cannot drift again, and pinned by a test that round-trips **every**
registered adapter.

> **Checked in Notion afterwards: nothing to do there.** The `Adapter` select
> already offers `tnb` and `mystage`, and all ten venue rows carry the right
> reader. Both options are colourless, unlike the seven seeded by hand — so they
> were created by whatever wrote those two rows last round, not through the UI.
> The failure was entirely on Marquee's side: `toVenueProps` refused to SEND a
> value Notion was perfectly willing to accept.

**The rest, in the order they'd bite:**

- **`savedAll` was unreachable for a same-day double bill.** It compared the
  count of kept DATES against the count of SHOWINGS, and Excelsior's Tomcat at
  17:00 and 20:00 is two showings on one date. "Hide what's already in
  Wanderlist" could never hide such a run, and its chip read "1 of 2 dates kept"
  for a date that was entirely kept. Counted in distinct dates now (`dateCount`)
  — the unit a keep actually works in, since a Findings row carries one Planned
  Date.
- **A JSON-LD offer priced `null` or `""` rendered as "Free"** — and tagged the
  Wanderlist row `free` — because `Number(null)` and `Number('')` are both 0.
  Both are common placeholders for "no price published". Only a real number, or
  a string that is one, counts now; a genuine `0` still reads as free.
- **Nothing bounded a single fetch.** Every request in a scan is sequential and
  a scan runs to ~80 of them (TNB's poster hop), so one site that accepts a
  connection and then goes quiet held the whole function until the platform
  killed it — taking every venue after it in the loop, and, on the scheduled
  path, **Wanderlist's evening email** with it. `REQUEST_TIMEOUT_MS` (15s) per
  request; a timeout is a value like any other, so that venue reads
  "unreachable" and the scan carries on.
- **"What changed" offered a Dismiss control that did nothing.** Dismissal
  records the *signatures* of the entries on screen (§9.21), so a strip with
  none — the baseline, or "nothing new since Tuesday" — had nothing to record
  and the × was inert. Offered only where it does something.
- **"Nothing new since…" lost its earlier end on reload.** `previousScanAt`
  lived in component state and never reached the saved scan, so after a reload
  the strip reported the gap as ending at the very check being looked at
  ("nothing new since earlier today", after a week's gap). Carried on the scan
  itself now.
- **A change row cleared the filters but not the search**, so clicking one while
  a query was active scrolled to a card that wasn't rendered — and did nothing
  at all. The search narrows the programme exactly as the filters do.
- **A matinee read "Tonight".** `formatDay` takes an optional `time` and says
  "Today" before 17:00; a whole-day heading, which has no single time behind it,
  keeps "Tonight".
- **Settings tested the credentials you had, not the ones you'd typed.** "Test
  connection" went through `getClient()`, so pasting a token and pressing Test
  reported on the OLD one — a fresh token read as broken and a revoked one as
  fine, at exactly the moment someone is trying to find out which
  (`clientFor`). And an unparseable database id was silently *dropped*
  (`idSetting.set` clears on bad input), falling back to the built-in default:
  pasting the wrong thing looked exactly like pasting the right thing. Refused
  with a message now.
- **Demo mode had drifted to two thirds of the app.** Still the original seven
  venues and a banner saying "seven", three readers after TNB, Unteatru and
  Cinema Europa shipped — so the demo exercised neither the embedded-json rung
  nor either two-hop adapter. Back in step.

**Redundancy removed:** `localParts` — the UTC-instant-to-Bucharest-wall-clock
helper — was duplicated *verbatim* in `oveit.js` and `filarmonica.js`. Promoted
to `shared.js`, where every other cross-adapter helper already lives. (The two
deliberate duplications, `api/_lib/marquee/diff.js` and the split adapter
registry, are unchanged — both are documented boundary decisions, not drift.)

**Coverage the audit added, having found none:** `src/marquee/scanClient.js`
(`runScan` — which venues count as answered, what carries forward when one
doesn't, what the saved scan remembers) and `src/marquee/App.test.jsx`, a
demo-mode smoke test over the whole app. The keep sheet crashed the app to a
white screen once already (§9.3) and nothing would have caught it.

### 9.30 Verified

`npm test` (3808 tests across 298 files), `npm run typecheck`, `npx eslint` on
every changed path, and `npm run build` all pass. The browser preview pane
refused localhost in this session, so the render-level checks were driven
through the new `App.test.jsx` instead of by hand.

### 9.31 Five QoL features, proposed and built the same session (2026-08-27)

A follow-up to §9.29's audit: five features proposed against the app's actual
scope — "does this serve the diff, or the decision to keep, without a new
data store, a new endpoint, or a second screen to read" — and built in the
order that unblocked the most for the least: undo first (small, and #5 needs
it to be safe), then the gesture, then the one genuine gap (push), then the
two visual passes.

**Undo on a keep.** The app's only write had no way back short of finding the
row in Wanderlist itself. `src/ds/` gains `ToastStack` + `useToastStack` — the
fourth toast implementation in the repo (after Daily Stoic, Fit Check, Click
Deck, Lexi5), promoted to an app-agnostic primitive so Marquee is its first
consumer rather than a fifth copy. Keeping a showing now offers **Undo** for a
few seconds; pressing it archives the just-created Findings row the same way
removing a venue already does — Notion's trash is the real undo either way.
`notionClient.js`/`fixtures.js` both gained `unsaveFromWanderlist`.

**Swipe left to Ignore.** `src/shared/useSwipeAction.ts`, generalized out of
Loom's `ThreadRow` (swipe right to weave, left to unravel) — same axis-lock,
same elastic-past-threshold feel, available to a second app instead of being
rewritten for it. `ProductionCard` wraps its content in a sliding `.prod__body`
over a `.prod__behind` reveal, the same two-layer shape `ThreadRow.module.css`
uses. Loom's own copy is untouched: no test proves a refactor there is
behavior-preserving, so this is the "extract the reusable shape" half of a
promotion — the same restraint `notionId.ts`'s header describes, leaving
Wanderlist and Journal's older copies in place rather than forcing an unproven
migration. `data-noswipe` marks the taps-not-drags exemption (Keep/Ignore
buttons, date buttons, the title link) — Loom's `[data-loom-controls]` under
another name.

**Push notifications when tickets open.** A fifth app wired into
`src/shared/notify/`'s cross-app foundation (see NOTIFICATIONS.md), and the
first whose worker does real work of its own rather than only reading a
snapshot the page already computed — `public/marquee-sw.js`'s `periodicsync`
handler POSTs to `/api/marquee-scan` **itself**, because "did tickets just
open" can only be answered by re-reading the venue pages, and a worker woken
while the app is closed has no snapshot that already knows. `notify.js`
mirrors the venue list and prefs into IndexedDB whenever either changes; the
worker diffs the fresh scan against its OWN independent snapshot — a THIRD
one, alongside the client's localStorage (§7) and the server cron's KV
(§9.11), each answering a different "changed since when" question, same
reasoning as the existing two. Defaults to `tickets-opened` only; a second
Settings toggle adds `new-event`/`sold-out` — never `cancelled`, which needs
the full before-set rather than a single forward pass, more state than a
background worker should hold onto. The notification title reuses
`marqueeOnlySubject`'s exact convention, so a ticket opening reads the same by
push or by the evening email. `notify.sw.test.js` extracts the worker's
duplicated pure functions with `new Function` and runs them against the
page's copy — the same technique `where-it-went-sw.js`'s own test already
established — so a rule drifting between the two fails a test rather than
silently disagreeing. A Settings section covers permission, the
blocked/unsupported cases, and the same seven-tap diagnostics reveal Touch
Grass/Sol Odyssey/Journal already use.

The one real cost, documented rather than solved: a busy venue list (TNB's
own ~61-request poster hop) can outrun a periodic-sync wake's execution
budget, which the browser enforces, not this code. A run cut short simply
doesn't reach `set(SNAPSHOT_KEY, ...)`, so the next wake compares against the
same old snapshot — a slow check costs a delay, never a wrong notification.

**A poster wall.** `Poster` (the fallback-aware cover component) moved out of
`Programme.jsx` into its own `Poster.jsx` so `PosterGrid.jsx` could use it
without a circular import. Same productions, same `Keep`/`Ignore` actions as
the list — a second LAYOUT, not a second feature: a `List`/`Posters` toggle
(persisted in `prefs.viewMode`, so it survives a reload — see below) swaps
`ProductionCard`'s rows for a wall of covers at a real theatre-poster
proportion (2:3, not the list's compact 56×80), a box-office diagonal
"Sold out" band across the corner instead of another chip, and the same
change-colour language on the frame's border. The toggle only appears once
there's a programme to switch between — nothing to switch when the app is
empty or unread.

**A week strip.** "Am I free Thursday, and is anything on?" — this app's own
answer to Loom's rhythm heatmap. Seven cells, today first, density-shaded
over the SAME filtered productions the day list below already shows (search,
category/venue/hall filters all apply here too — `App.jsx` now computes one
`visibleProductionsFlat` that both the day list and the strip read from, so
the two can never disagree). `programme.js` gains `densityForDays` — counting
a production on EVERY date it shows, not only its first the way `byDate`'s
own grouping does, so a three-night run lights up all three cells — and
`nextDayKeys`/`domIdForDay` for the day-anchor ids a tap scrolls to (both
`Programme.jsx`'s and `PosterGrid.jsx`'s day `<section>`s now carry one). An
empty day is shown, not hidden (a quiet Tuesday is a real answer), but isn't
clickable — nowhere to jump to.

**QoL note, from a question asked while this was being verified:** the view
toggle persisting across a reload wasn't a separate feature to build —
`viewMode` lives in the same `prefs` object every other Settings toggle
already round-trips through `localStorage` (`marquee_prefs`), so it was
already correct.

Every new pure function got its own test rather than relying on the
integration suite alone: `programme.test.js` (new — `densityForDays`,
`nextDayKeys`, `domIdForDay`), `PosterGrid.test.jsx`, `WeekStrip.test.jsx`,
`notify.test.js` + `notify.sw.test.js`, plus extensions to `Programme.test.jsx`
(the swipe gesture, the view toggle), `SettingsModal.test.jsx` (the Notify
section), `App.test.jsx` (the full keep → toast → undo round trip), and DS's
own `ToastStack.test.tsx`/`useToastStack.test.ts`/`useSwipeAction.test.tsx`.

### 9.32 Verified

`npm test` (3866 tests across 306 files), `npm run typecheck`, `npx eslint` on
every changed path, and `npm run build` all pass. The browser preview pane
again refused localhost in this session (same limitation §9.30 hit); render
and interaction checks were driven through the render/integration tests
listed above rather than by hand.

### 9.33 A real screenshot, and a round of feedback against it (2026-08-27)

The first live look at §9.31's work, from an actual phone/desktop screenshot
rather than the render tests alone — worth recording since the two caught
different things.

**Three icon actions, not a text button plus two.** `Check venues` moved off
`Button` onto `IconButton`'s own `selected` state, which already carries the
identical `--color-accent`/`--color-on-accent` pair the text button used, so
the primary action keeps its visual weight icon-only (spins via a CSS
animation while a scan runs, replacing the "Checking…" text cue it lost). The
List/Posters switch — previously its own row inside `Programme.jsx`, freed by
this move — is now the middle icon, tinted `--color-success` (already this
palette's "positive" token) specifically so three icons in a row read as
three different things rather than one cluster: accent for the primary
action, success for the toggle, plain ink for Settings. `Programme.jsx` no
longer renders the switch itself, only reads `viewMode` to decide the layout.

**Swipe right now opens Keep, mirroring swipe left's Ignore** — asked
after the one-directional version shipped, and cheap: `useSwipeAction` already
took `onSwipeRight`. Keeps the first showing, same as tapping the Keep button
(which date is genuinely ambiguous mid-swipe for a multi-date run, and the
sheet itself lets you change it). `.prod__behind` now reveals whichever hint
matches the drag direction — Keep's accent-tinted, in the gap a rightward
drag opens on the left; Ignore's danger-tinted, unchanged, on the right.

**Poster grid: 4 across on desktop, not 5.** The original `minmax(7.5rem,
1fr)` filled the app's own capped content width (`.app`'s `max-width: 46rem`)
with 5 columns, too small to read anything on. Tuned to `10rem` — computed
against that same 46rem, not guessed — which lands on exactly 4. The phone
breakpoint gets an explicit `repeat(2, 1fr)` rather than trusting auto-fill's
own threshold not to flip between 1 and 2 around an untested viewport width.

**Search, restyled to stop reading as a stray default input.** Every other
pill on this page — filter chips, week-strip cells — sits on `--color-surface`
with `shadow-card`, the same weight a `.prod`/`.venue` card has; Search was
the one piece of chrome still transparent-on-canvas. Filled to match, plus a
warm accent glow on focus in this palette's own accent rather than a generic
blue ring.

**The Venues tab count is gone.** `Venues (10)` is exactly the dynamic label
§9.18/§9.28 fought two separate wrap bugs over — a static `Venues` doesn't
just avoid a third round, it makes the whole class of bug structurally
impossible, since there's no longer a width change on load for `.tabs-row`'s
`flex-shrink: 0` to have to defend against.

**Three more Settings toggles**, each answered from "what else fits this
app's actual scope" rather than proposed unprompted:

- **Swipe to Keep or Ignore** (Programme section, on by default) — the
  gesture is convenient, not mandatory; turning it off falls back to the
  Keep/Ignore buttons only, which still work regardless (`useSwipeAction`
  already took a `disabled` flag, so this was one prop threaded through
  `App.jsx` → `Programme.jsx` → `ProductionCard`).
- **Compact list** (Programme section) — smaller poster, tighter padding, one
  size step down on the title. Scoped to `.main--compact .prod*` only — the
  poster grid keeps the sizing §9.33 just tuned above, untouched.
- **Quiet hours (11pm–8am)** (Notify section, only shown once notifications
  are already on) — `notify.js` gains `isQuietHours` (device-local clock, not
  configurable start/end: the point of the toggle is a fast decision, not a
  second pair of time pickers), duplicated into `public/marquee-sw.js` per
  the established pattern and pinned by `notify.sw.test.js`. The real design
  choice: during quiet hours the worker still scans and diffs, but **holds
  the snapshot rather than advancing it** — a ticket that opens at 2am is
  still "new" to the FIRST check after quiet hours end, turning a night's
  worth of changes into one morning digest instead of either pinging
  overnight or silently losing them once the old snapshot got overwritten
  with nothing shown for it.

### 9.34 Verified

`npm test` (3874 tests across 306 files), `npm run typecheck`, `npx eslint`,
and `npm run build` all pass. Live verification was, again, through the
render/integration suite rather than the browser preview pane, which refused
localhost in this session too.


## Open

- **Filarmonica's own Strapi feed still blocks this development machine** (403 to every
  non-browser client from this IP, regardless of User-Agent) — resolved for the app by
  reading Oveit instead (§9.7 of the earlier round), not by fixing the block. **Whether
  Vercel's egress IPs can reach either the Strapi feed or Oveit is unknown until this
  deploys** — the first thing to check in production. The same question now also applies to
  `MARQUEE_NOTION_TOKEN`'s scheduled reads, Excelsior's ~20 extra per-scan requests, and now
  TNB's ~61 extra per-scan poster requests, none of which have run from Vercel's own network
  yet.
- **TNB's own detail-page fetches at 61-per-scan are the single biggest per-check request
  count in the app** — well inside a hand-picked handful of venues checked on request, not
  something with a fixed schedule hammering it, but the first place to look if a scan starts
  timing out or TNB's site starts throttling.
- **mystage's incomplete initial-events window is unverified against a real gap.** Unteatru
  hasn't yet had more than 13 occurrences on its page at once, so whether the missing ones
  reliably surface on a later scan (rather than silently vanishing until manually checked
  again) hasn't been observed against a real case — only reasoned about.
- **Eventbook and iabilet still have no description**, per the rule in §3 — both are missing
  a `follow()` hop that doesn't exist yet, not a field that's absent from a page already
  being read. Eventbook's own film page (`/film/bilete-...`) carries real content
  (director/cast/genre/duration in an `itemprop="description"` block) and would only need
  one more hop, the same shape as its existing pagination discovery. iabilet's bundle page
  has no synopsis text at all — that one would need a THIRD hop layer (venue → bundle → the
  film's own iabilet page), which is enough added complexity that it's deliberately not done
  here; revisit only if it turns out to matter in practice.
- Addresses and areas are filled only where a source stated them (Filarmonica, Expirat,
  Cinema Union, Cinema Europa). The other three are blank rather than guessed.
- The movie-category horizon is a single blanket rule with one real cinema (Cinema Europa)
  and one near-empty one (Cinema Union) to prove it against. A theatre or hall that also
  sells through a `movie`-tagged listing page would get the same 10-day treatment — intended,
  but untested against a case like that because none exists yet.
- `cancelled` still cannot distinguish *removed* from *page reorganised*. The health gate
  makes the false positive unlikely, not impossible; the guide says so out loud.
