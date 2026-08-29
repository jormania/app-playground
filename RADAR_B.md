# Radar-B — product & UX specification

📡 **A personal cultural radar for Bucharest.** One calm place that answers *"what
interesting things are happening that I might want to go to?"* — built on top of the
event intelligence the ecosystem already produces, not beside it.

Lives at `src/radar-b/`, entry `radar-b-react.html`. React + Vite + `src/ds/` + Notion.

> This file is the spec **and** the app doc. Sections 1–8 are the specification agreed
> before implementation; sections 9+ describe what actually shipped.

---

## 1. What was inspected first

| Thing | What it actually is | What Radar-B takes from it |
|---|---|---|
| **`/recommend in Bucharest` skill** | A weekly pipeline: fetch 7 named sources → extract events → dedupe → filter to Gabriel's taste → Romanian day-by-day digest → hand off to Wanderlist. Already does fetching, parsing, dedupe and provenance (`[via Buletin, Zile și Nopți]`). | Becomes Radar-B's **ingest + intelligence layer**. Radar-B does not re-implement any of it. |
| **Wanderlist** (`src/wanderlist/`, Notion `Findings`) | A triaged personal backlog of things-to-do. Rich schema: Category (closed set), Place+Map, Cost, Tags, Attended/Going, Date Expiring, Planned Date, Photo, Tickets. | Stays the **only** home for saved things. Radar-B writes into it, never alongside it. |
| **Notion 🗓️ Suggested events** (`377d3e6d…`) | A page rebuilt weekly by the skill: a *table of article links* per source (+ ⏳ placeholders for sources that haven't published) and a Zile și Nopți highlights block. Article-level, not event-level. | Kept exactly as-is as the **research/provenance layer**. Radar-B reads it for source attribution, and gains an event-level sibling next to it. |
| **Repo conventions** | DS-based new apps, BYO-Notion-token + demo-mode fixtures, `/api/notion` stateless relay, pure-logic-plus-tests split, scoped SW gated on `import.meta.env.PROD`. | Followed throughout. |
| **Facebook, practically, in 2026** | Graph API covers almost none of public Facebook; public event pages are served to logged-out browsers only as JSON buried in script tags, behind aggressive anti-automation. Third-party unified APIs (SocialCrawl, Bright Data, Apify, ScrapeCreators) are the only reliable programmatic route, all paid. The **wanderlist skill already records** "Facebook event pages reliably fail to fetch (login wall) even when public — don't retry, ask for a screenshot." | See §5. Facebook is a *human/AI-assisted* source, never a scraper. |

---

## 2. The core product decision

**Radar-B does not scrape.**

The tempting architecture — a serverless function per source, parsing B365's and
Curatorial's HTML — is the wrong one here, for three converging reasons:

1. **It duplicates the skill.** `/recommend in Bucharest` already fetches, parses,
   dedupes and *taste-filters* all eight sources every week. A scraper farm would be a
   worse second copy of that, with none of the judgement.
2. **It is unmaintainable at this scale.** Seven Romanian publications' markup, each
   free to change any week, against one person's weekend. Every source that broke would
   break silently.
3. **Vercel Hobby caps this repo at 12 serverless functions and it is already at 12.**
   A per-source fetcher literally cannot deploy.

So the pipeline inverts. **Claude is the parser; Notion is the wire format; Radar-B is
the client.**

```
   Sources                      Event intelligence              Discovery         Decision
┌──────────────┐            ┌──────────────────────┐        ┌───────────┐    ┌────────────┐
│ B365         │            │  /recommend in       │        │           │    │            │
│ Curatorial   │            │   Bucharest          │        │  RADAR_B   │    │ WANDERLIST │
│ Buletin      │  ────────► │  (fetch · parse ·    │ ─────► │           │───►│  Findings  │
│ HotNews      │            │   dedupe · filter)   │  Notion│  browse   │save│            │
│ Zile și Nopți│            │                      │  read  │  evaluate │    │ plan · go  │
│ Harta Muz.   │            └───────────┬──────────┘        │  triage   │    │            │
│ Recomandata  │                        │ writes            └───────────┘    └────────────┘
│ Facebook     │                        ▼
│ venue sites  │            ┌──────────────────────┐
└──────────────┘            │ Notion               │
                            │  🗓️ Suggested events │ ← article-level provenance (unchanged)
                            │  📡 Radar            │ ← NEW: event-level, one row per event
                            └──────────────────────┘
```

Everything the brief asks for — heterogeneous sources, normalization, dedupe,
enrichment, provenance, editorial signals — happens *somewhere in that chain*. The
decision is only about **where**, and putting the messy half in the layer that already
has judgement (Claude) leaves Radar-B free to be what it should be: fast, quiet, and
purely about discovery.

**Consequence:** Radar-B ships with **zero new serverless functions.** It reads Notion
through the existing `/api/notion` relay with a BYO token, exactly like Wanderlist.

---

## 3. The event model

Notion database **📡 Radar** — one row per *underlying event*, not per mention.
Sits beside 🗓️ Suggested events, written by the skill, read by Radar-B.

| Property | Type | Why |
|---|---|---|
| `Name` | title | The event, without the venue (same rule as Wanderlist's `Name`). |
| `When` | date, start **+ optional end**, optional time | One property covers every shape: a fixed concert (start with time), a vague "this weekend" (start, no time), a three-day festival (start+end), a four-month exhibition (start+end). Absent = undated (a venue, a standing recommendation). |
| `Venue` | rich text | Human venue name. |
| `Address` | rich text | Full street address — carried so a save to Wanderlist geocodes on the first try. |
| `Area` | select | Neighbourhood (`centru`, `cotroceni`, `floreasca`, …). Cheap geography without a map. |
| `Category` | select | **Wanderlist's exact closed vocabulary**: `event`, `discovery`, `venue`, `idea`, `culture`, `movie`, `art`, `play`, `concert`. Deliberate — a save must be lossless. |
| `Summary` | rich text | The 2–3 editorial sentences the skill already writes. Never blank. |
| `Signals` | multi-select | `recommended`, `free`, `ticketed`, `family`, `outdoor`, `new-venue`, `recurring`, `long-run`, `sold-out`. Small, closed, meaningful. |
| `Cost` | number | Lei. Never guessed. |
| `Link` | url | The event's **own** page — venue, gallery, ticket platform. |
| `Tickets` | url | Ticket/booking URL when it differs from `Link`. |
| `Image` | url | Poster/hero. |
| `Organizer` | rich text | |
| `Sources` | rich text | **Provenance, one line per mention**: `name │ url │ YYYY-MM-DD`. This is the field that makes "also mentioned by Curatorial" possible. |
| `Confidence` | select | `confirmed` (from the event's own page) · `reported` (an editorial roundup) · `uncertain` (a title and a date in an article). Drives how precisely Radar-B is willing to speak. |
| `Checked` | date | When this row was last verified. Drives staleness. |
| `Key` | rich text | A stable dedupe slug the skill writes (`venue-slug:date:title-slug`), so re-runs update rather than duplicate. |

**The model is deliberately tolerant.** Everything except `Name` may be missing.
Radar-B's job is to render an event that has only a title and a date *honestly* —
not to pretend it is a full record.

### Four entities, one experience

- **Event** — the thing happening. A Radar row.
- **Source** — where a piece of information came from. A line in `Sources`.
- **Recommendation** — a source (or the skill) saying *this one is worth it*. The
  `recommended` signal plus the recommending source's name.
- **Venue** — derived, not stored separately: `Venue` + `Address` + `Area` are grouped
  in-app so "everything at Control" works without a venues table.

A separate venues database would be schema for its own sake. If venue-level
curation ever earns its keep, `Venue` becomes a relation — the app model doesn't change.

---

## 4. Deduplication and enrichment

Dedupe happens **twice**, on purpose.

**Upstream (the skill)** does semantic dedupe across sources within a run — it can read
two articles and *know* they mean the same exhibition. That already exists (Step 3b).
It writes one row with a merged `Sources` list.

**Downstream (Radar-B)** does structural dedupe across *runs and stores* — the same
event arriving from last week's Radar refresh, this week's, and a row Gabriel already
saved to Wanderlist. This is pure, deterministic, and unit-tested (`dedupe.js`):

1. **Exact `Key` match** → same event, always.
2. Otherwise score a pair on: normalized-title similarity (diacritics folded, Romanian
   stop-words dropped, token-set overlap), venue similarity, and date overlap.
3. Above a threshold → same event. Below → keep separate. **When in doubt, keep
   separate** — two cards is a mild annoyance, a wrong merge hides a real event.

**Merging preserves provenance rather than flattening it.** The merged event takes each
field from the highest-confidence source that has it (`confirmed` > `reported` >
`uncertain`, ties broken by `Checked` recency), and keeps the **union** of `Sources`.
So the detail view can say:

> Official venue page · Also mentioned by Curatorial, B365 · Recommended by
> *Recomandata* · In your Wanderlist

Every merged field remembers which source it came from, so a disagreement is
inspectable rather than silently resolved.

---

## 5. Facebook

Facebook stays an important source and is treated exactly as its 2026 reality demands:
**a source of events, never an experience.**

- **No scraper, no Graph API, no paid data vendor.** All three are either dead, brittle,
  or disproportionate for one person's weekend.
- **Facebook events enter through the skill**, the same way every other source does —
  Claude reads a public event (or a screenshot, per the wanderlist skill's existing
  advice) and writes a normalized Radar row. From that point on it is an ordinary event.
- **In the app**, a Facebook-origin event is rendered fully natively: title, time,
  venue, summary, poster. The Facebook URL appears once, in the Sources section of the
  detail view, as *"Facebook event ↗"* — an escape hatch, never a destination.
- Radar-B never embeds Facebook, never links to a feed, never asks for a login.

The honest tradeoff, stated plainly: Facebook coverage is only as fresh as the last
skill run. That is strictly better than a scraper that breaks quietly and pretends
otherwise — and freshness is *visible* in the app (§7) rather than assumed.

---

## 6. Relationship to Recommend in Bucharest and Wanderlist

**Recommend in Bucharest = the intelligence. Radar-B = the universe. Wanderlist = the
commitment.**

- The skill **writes** the universe Radar-B browses (Radar rows).
- The skill's judgement **arrives as data**: the `recommended` signal and a
  `Recomandat de …` line, so a recommendation appears naturally in the browser instead
  of living only in a chat transcript.
- Radar-B **feeds questions back**: any filtered view can be copied as a compact,
  paste-ready brief ("Ask about these"), so *"which of these would I enjoy with Nora?"*
  starts from the actual current event pool rather than a fresh round of searching.
- **Wanderlist is the only save.** Radar-B has no favourites, no bookmarks, no starred
  list. "Save" opens a pre-filled draft and writes one `Findings` row using the exact
  documented schema (`"__NO__"` checkboxes, `date:<Name>:start` keys, lowercase
  Category/Tags). Anything already in Findings shows in Radar-B as **In your Wanderlist**
  and is never offered for saving twice.

Discover → evaluate → **save** → do. Radar-B owns the first two and hands over cleanly.

---

## 7. Discovery experience

**Home is a stream, not a calendar.** Vertically scrollable, grouped by day, with a
temporal lens across the top:

`Tonight · Tomorrow · Weekend · Next week · Later`

Plus two non-temporal lenses that matter more than a calendar ever would:

- **Running now** — exhibitions and long runs, which a date-first view buries entirely.
  These are the events most likely to be missed and easiest to act on.
- **New to you** — events that appeared in the last refresh and haven't been opened yet.
  Directly serves *"what haven't I heard about yet?"*

**Ranking is chronological with a light editorial thumb.** Within a day, events sort by
time, except that `recommended` events float to the top of their day and events from a
trusted source outrank an uncertain mention. Never a pure algorithmic feed — the day
structure is always legible.

**Signals are quiet.** At most two badges on a card, chosen by priority
(`recommended` > `free` > `family` > `new-venue` > `outdoor` > `ticketed`), the rest
deferred to the detail view. A card with no badge is normal, not a failure.

**Filters** are a single sheet: category chips, area chips, signal toggles, price.
**Search** is secondary — a magnifier in the header covering title, venue, area,
organizer, summary and source name. Search finds what you can name; the lenses are for
what you can't.

**Freshness is shown, never assumed.** The header carries a quiet "refreshed 2 days
ago" line, an event past its `Checked` window is dimmed with *last checked …*, and an
`uncertain` event says so in words rather than rendering a guessed time as fact.

### Event detail

Answers the brief's eight questions in that order, top to bottom: hero image → name →
when (in prose: *"Saturday 21:00"*, *"runs through 14 September"*) → venue + area, with
a Maps link → summary → price → *how to go* (tickets/booking) → **Sources** (every
mention, each with its origin, date and outbound link) → **Save to Wanderlist**.

---

## 8. First release scope

**In:**

- Radar Notion DB + full event model, BYO token, demo mode on fixtures.
- Reads the **existing 🗓️ Suggested events page** too, for article-level provenance —
  so the current weekly workflow shows up in the app on day one.
- Client-side dedupe/merge with provenance retention, unit-tested.
- Temporal lenses, filters, search, detail view, signals, freshness.
- Wanderlist detection + one-tap save with a pre-filled, editable draft.
- "Ask about these" handoff to Recommend in Bucharest.
- Mobile-first installable PWA, dark/light, offline read of the last fetch.

**Deliberately out:**

- **Any scraper or per-source serverless fetcher.** §2.
- **A map view.** Area chips and a Maps link do the work; Wanderlist already learned
  this lesson the expensive way.
- **A parallel bookmark/favourites store.** Wanderlist is the home. §6.
- **A venues database.** §3.
- **Notifications.** Wanderlist already emails the evening before something expires;
  a second nagging channel is exactly the "constantly trying to engage me" the brief
  rules out.
- **Real personalization.** V1 records the raw signal (opens, dismisses, saves) locally
  and surfaces only the honest, non-inferential uses — "new to you", dismissed events
  sinking. No taste model, no scoring, no learned feed. The data is there when it earns
  its keep.
- **Ticketing, RSVP, sharing to social, comments, counts, streaks, gamification.**

**Major decisions, in one place:** Claude-as-parser over scrapers (§2) · one tolerant
Notion event model over a strict schema (§3) · dedupe twice, semantically upstream and
structurally downstream (§4) · Facebook as data, never as an experience (§5) ·
Wanderlist as the only save (§6) · a stream with lenses, not a calendar (§7) ·
zero new serverless functions (§2).

---

## 9. What shipped

Everything in §8's "In" list. `src/radar-b/`, entry `radar-b-react.html`, DS-based, PWA,
**zero new serverless functions** — reads and its one write both go through the existing
`/api/notion` relay.

### The Notion side is real

The **📡 Radar** database now exists, created as a **child of the 🗓️ Suggested events
page** so the two are visibly one workflow rather than two:

| Resource | ID |
|---|---|
| 📡 Radar database | `fbe904166c9e40fcbf723417e15a17bf` |
| 📡 Radar data source | `48cbd3d9-4f27-4792-ac03-cbe646d7aa48` |
| 🗓️ Suggested events page | `377d3e6d60db81a688e1c81e0604a9a0` (unchanged) |
| Findings (Wanderlist) | `41c42bc4dfb543f49051810b3c5880fe` (unchanged) |

Radar starts **empty**. It fills on the next `/recommend in Bucharest` run — seeding it
with invented events would have made the app look alive while lying about the city.
Until then Radar-B shows what's in Findings plus the article list off the Suggested page,
and demo mode (no token) is a full browsable week either way.

### The skill was extended, not replaced

`/recommend in Bucharest` gained **Step 4b — Write the events to 📡 Radar**, placed after
the digest and before the Wanderlist handoff. It writes the *deduplicated pool from Step
3b* — the work the skill already does — with one row per underlying event and one
`Sources` line per mention. Its Step 3b dedupe and its taste filter are untouched; what
changed is that their output now persists instead of scrolling away with the
conversation. Step 5 also notes that Gabriel may save from the app instead.

The skill lives outside this repo (`~/.claude/skills/synced/recommend-in-bucharest/`),
so the Radar property table is duplicated there and in §3 here. **Change both, or
neither.**

### Code reused and promoted, rather than copied

The brief's flow runs *through* Wanderlist, so Radar-B shares its code rather than
mirroring it:

| Module | What happened |
|---|---|
| [`src/shared/findings.js`](src/shared/findings.js) | **Promoted** out of `src/wanderlist/notion.js`: the Findings schema itself — property names, the 2000-char rich-text chunking, the Category/Tags lowercase rule, the Planned-Date offset handling, and `toFindingsProps`. Wanderlist re-exports every symbol, so its import paths are unchanged and its own `notion.test.js` (104 tests, still green) is the proof the move was behaviour-preserving. **Radar-B's save goes through this same function**, so a row saved from Radar-B and one saved from Wanderlist are identical by construction, not by careful copying. |
| [`src/shared/share.js`](src/shared/share.js) | **Promoted** out of `src/wanderlist/share.js` — OS share sheet with a clipboard fallback. Radar-B uses it for "ask Recommend in Bucharest about these". Wanderlist re-exports it; its `share.test.js` proved the move. |
| `src/wanderlist/dates.js`'s `localOffsetString` | **Promoted** into `findings.js` alongside the rest of the write mapping; re-exported in place. |
| `src/shared/storage.js`, `notionId.ts`, `installFlag.ts` | **Reused as-is.** No local copies. |
| `/api/notion` | **Reused.** Same stateless BYO-token relay Wanderlist and Journal of Delights use. |

Ten other apps still carry their own copy of the `/api/notion` fetch wrapper. That's a
worthwhile future promotion and was left alone here — converting ten shipped apps to
prove a point is not this change's job.

### Architecture

- **Pure, tested logic** — [`model.js`](src/radar-b/model.js) (the tolerant event shape),
  [`dedupe.js`](src/radar-b/dedupe.js) (fold/similarity/cluster/merge),
  [`dates.js`](src/radar-b/dates.js) (lenses, Romanian prose, staleness),
  [`signals.js`](src/radar-b/signals.js) (badges + the ranking thumb),
  [`search.js`](src/radar-b/search.js) (filters, facets, the stream, the brief),
  [`notion.js`](src/radar-b/notion.js) (Notion→model), [`wanderlist.js`](src/radar-b/wanderlist.js)
  (model→Findings draft). **125 tests**, including 10 that render the whole app in demo
  mode and assert the duplicate exhibition really does collapse to one card.
- **Clients** — `notionClient.js` (live), `fixtures.js` (demo + a deliberately messy
  fixture set), `store.js` (config, local state, offline read cache).
- **UI** — `App.jsx` → masthead + lens bar → `EventCard` → `EventDetail` → `SaveSheet` /
  `FilterSheet` / `SettingsModal`.

### Name

Shipped as **Radar-B** — *radar, for Bucharest*. The masthead sets the `-B` in the
accent colour; the Notion database it reads is the plain **📡 Radar**, one layer down.
(It was called Semnal during development; the rename touched the directory, the entry
HTML, the manifest, the icons and the `radarb_*` storage keys, so nothing carries the
old name.)

### Notes for later

- **Both dedupe passes matter.** The skill's is semantic (it can read two articles and
  know they mean one exhibition); the app's is structural (same event across refresh
  runs and across Radar/Findings). Neither replaces the other.
- **`dedupe.js`'s `TITLE_FLOOR` is load-bearing.** Title similarity is a *necessary*
  condition: venue and date can only ever confirm a match, never create one. Without it,
  two different events at one venue on one night merge — there's a test for exactly that.
- **No guide page yet.** Every other app has a `public/*-guide.html`; Radar-B doesn't
  (the reference above is where it would go). Worth adding once the Radar table has a
  real week in it and the screenshots would show something true.
- **Deliberately still out:** scrapers, a map, notifications, a favourites store, a
  venues table, a taste model. §8 has the reasoning for each.

---

## 12. Guide, and a QoL pass (2026-08-21)

**A full guide shipped**: [`public/radar-b-guide.html`](public/radar-b-guide.html), reachable
three ways — a dedicated masthead icon (open-book glyph) that opens it directly, a link inside
Settings, and the standard `guide ↗` badge on the app's card on `index.html` (via the registry's
new `guide: "radar-b-guide.html"` field — no template change needed, every app's card already
renders that field when present). It covers the whole chain end to end: what
`/recommend in Bucharest` reads and filters for, Step 4b's write into Radar, the two-pass dedupe
in plain language, the full Wanderlist field mapping, the Radar schema for hand-editing, and a
troubleshooting section.

Also fixed, from hands-on use of the shipped app rather than from the spec:

- **System dark mode was silently broken.** `radar-b.css` defined dark tokens only under
  `:root[data-theme="dark"]` — the explicit in-app toggle — with no
  `@media (prefers-color-scheme: dark)` counterpart for `theme: 'system'` (the default). The app
  never actually followed the OS/browser preference no matter what it was set to. Added the
  missing media block, guarded with `:not([data-theme="light"])` so an explicit light choice
  can't be dragged back to dark by the OS. Also fixed the pre-paint `<meta theme-color>` script in
  `radar-b-react.html`, which had the same gap.
- **The Settings icon read as a theme toggle, not "settings".** An 8-spoke gear at 20px
  anti-aliases into something that looks exactly like a sun — the same shape a light/dark toggle
  usually uses — so it read as "this button is about the theme" and nothing else. Replaced with a
  sliders glyph (three lines, three offset thumbs), the standard fallback wherever a gear stops
  being legible at icon size, and unambiguous against the app's actual sun-free theme control
  (a `<select>` inside Settings itself).
- **The price filter didn't exist.** The event model and `matchesFilters` already supported a
  `maxCost` ceiling — the spec described it — but `FilterSheet` never rendered a control for it.
  Added one: `orice preț · gratuit · până în 50 lei · până în 100 lei`, single-select, with a
  caveat shown only when a real ceiling is active (`maxCost > 0`) — an unpriced event is *excluded*
  by a ceiling, never assumed free, and that rule is stated in the sheet rather than left to
  surprise someone later. (The category/area/signal chips were re-verified working end to end —
  demo pool 8→1 cards on a real filter tap, aria-pressed toggling correctly — so that half of
  "filters doesn't do anything" was a false read; the missing price control was the real gap.)
- **The lens bar's horizontal scroll had no affordance.** Seven lenses plus counts don't fit a
  phone width and were never going to — the fix is signalling "there's more" rather than fighting
  the overflow. Added the standard CSS-only scroll-shadow (two `background-attachment: local`
  gradients synced to content scroll, two `scroll`-attached ones pinned to the viewport edges) so
  a fade only ever appears on the side that still has more to reveal, plus `scroll-snap-type: x
  proximity` so the swipe itself settles on a lens rather than stopping mid-label.
- **No way to force a refresh without leaving the tab.** The masthead's "actualizat …" line was
  static text; the only refresh trigger was the `visibilitychange` listener firing on tab
  return. It's now a tappable button (`disabled` while a load is in flight, so a double-tap can't
  pile up requests) — same label at rest, "se actualizează…" while working.

`/recommend in Bucharest` also gained an explicit **Facebook** subsection in Step 2 (fetch the
event's own details when a Facebook link surfaces, prefer a direct source over it when one
exists, don't fight the login-wall fetch) and an **online-only exclusion** in both Step 2 and
Step 3's exclude list: a livestream, webinar, or virtual screening is never included regardless of
source — the tell on Facebook specifically is the event's own location reading "Online Event" — a
hybrid event (in-person **and** streamed) stays included as normal.

15 new/updated render tests cover all of the above end to end in demo mode; **3410 tests total**,
typecheck and eslint clean.

---

## 13. "De știut" gets a real signal; Facebook search becomes active (2026-08-21)

Two more gaps surfaced from the first real skill run (Radar-B still at 0 rows despite a
full digest — see §12's fix, which addressed *why* the write got skipped; this addresses
two things the write itself was still missing).

- **`mainstream` signal added** — the `Signals` closed vocabulary (model.js, the skill,
  and the live Notion database) gained a tenth value. The digest's "De știut" grouping
  (safe, broad-appeal, easy-to-skip) previously had no representation in Radar at all —
  it became an ordinary row, ranked identically to everything else, which defeated the
  entire point of the grouping. `mainstream` is `recommended`'s mirror: `recommended`
  floats an event to the top of its day (`rank()`'s `-100`, roughly), `mainstream` sinks
  it toward the bottom of the *same* day (`+15` — a light push, well short of `uncertain`'s
  `+40`). It renders with the default, unstyled badge — no special treatment is exactly
  the right treatment for "not an editorial pick." The two are mutually exclusive by
  construction; the skill's Step 4 property table says so explicitly now.
- **Facebook went from passive to active.** The original wording — "pick it up the same
  way any other source's mention gets picked up" — only ever triggered if one of the 7
  named article sources happened to link a Facebook event. A live run showed exactly that:
  a full 13-event digest, built entirely from article sources, with nothing from Facebook
  at all. Step 2 now instructs a real, dedicated search pass every run (`site:facebook.com
  /events` style queries plus venue-specific searches for the venues already in Step 3's
  "always include" list), extracting from search-result metadata even where the page fetch
  itself fails — and it says so explicitly when that search turns up nothing, rather than
  silently having nothing to show.

Also confirmed directly (not assumed) that the Radar write really was at zero: `SELECT
count(*)` against the live data source returned `{"n": 0}` immediately before this fix,
despite a same-day Suggested-events refresh. That's the evidence the reordering in §12 was
solving a real, reproduced failure — not a hypothetical one.

**A live backfill attempt was not completed from this session** — every one of the seven
source domains (b365.ro, zilesinopti.ro, hartamuzeelor.ro, curatorial.ro, buletin.de,
hotnews.ro, recomandata9.substack.com) is blocked by this coding environment's egress
policy, which only allowlists Notion/GitHub/Vercel. Radar-B's own principle — never seed
invented events, an honestly empty database beats a fabricated one — ruled out working
around that with search-snippet fragments. The next real `/recommend in Bucharest` run,
in an environment with actual web access, is what populates it.

14 new/updated tests. 3414 total, typecheck and eslint clean.


---

## 14. The skill edits never applied (2026-08-21) — and where the skill now lives

Three rounds of "fixed the skill" in this session were **wrong**, and the app stayed empty
because of it. Recording the trap so it isn't repeated.

`~/.claude/skills/synced/<name>/SKILL.md` is a **read-only mirror** of an account-level
skill, synced *down* into the ephemeral session container. There is no sync *up*. Editing
it looks completely successful — the bytes are on disk, `grep` confirms them, the mtime
updates — but the skill that actually runs anywhere else is the untouched server copy.
Three separate "fixes" (Facebook rules, the online-only exclusion, the Step 4 reorder, the
`mainstream` mapping) were written into that mirror and none of them ever ran.

**Two independent signals should have caught it on the first round, not the third:**
- `manifest.json` still read `"updatedAt": "2026-07-23T09:19:28Z"` for
  `recommend-in-bucharest` — weeks before the supposed edits.
- The live run's own output was missing the mandatory `📡 N evenimente scrise/actualizate
  în Radar` line entirely. That line was added specifically so a skipped write couldn't
  hide; its *absence* meant the skill being executed didn't contain the instruction at
  all — a different failure from the one being debugged.

A third, decisive tell: the user's run successfully fetched `b365.ro`, `zilesinopti.ro`
and `hartamuzeelor.ro`, every one of which is egress-blocked inside the coding container.
The run was obviously happening on another machine, against another copy of the skill.

**The fix:** [`.claude/skills/recommend-in-bucharest/SKILL.md`](.claude/skills/recommend-in-bucharest/SKILL.md)
is now the version-controlled source of truth — a **project-level skill**, which any
Claude Code session opened in this repo loads directly. That sidesteps the mirror
entirely for the Claude Code path: it's in git, and it's what actually runs. The
claude.ai/Chat copy is a separate consumer and still needs a manual upload (Settings →
Capabilities → Skills); [`.claude/skills/README.md`](.claude/skills/README.md) documents
both, plus the two signals that should have caught the trap sooner.

### Radar backfilled from the run that already happened

Rather than making the user re-run everything, this weekend's 13 events (21–23 August)
were written into 📡 Radar directly from the digest their run had already produced —
transcription of their own verified output, not fabrication. Confidence is `reported`
throughout (these came from editorial roundups, not the events' own pages), `Checked` is
2026-08-21, and Harta Muzeelor mentions carry the `*` recommendation prefix since its page
is literally a recommendations list. Fields the digest didn't state — MARe's address, the
CNDB and Cinema Europa neighbourhoods — were left **blank rather than inferred**, which is
the same "never false precision" rule the app renders by.

`SELECT count(*)` now returns 13 where it returned 0.


---

## 15. Radar re-emptied; the Claude Code path (2026-08-21)

The manual backfill from §14 was **removed at the owner's request** — the point is for the
real flow to prove itself end to end, not for the database to look populated. `SELECT
count(*)` is back to 0.

Worth recording how, because the obvious route doesn't exist: **the Notion MCP integration
has no page-delete verb.** `notion-update-page` accepts both `in_trash: true` and
`archived: true` — returning a success payload — and silently ignores them; the row count
stayed at 13 after each. The working route was `notion-move-pages`, moving all 13 out of
the data source onto a single scratch page ("Radar cleanup — 13 manually-added rows"),
which empties the database and reduces cleanup to deleting one page by hand.

### Running the flow from Claude Code

Two things gate it, and only one of them was fixable from here:

- **The skill** — fixed. It's now a project-level skill (§14), so a Claude Code session in
  this repo loads the corrected version straight from git. No upload needed for this path.
- **Network egress** — not fixable from here, and must not be routed around. All seven
  source domains are denied at the environment's egress proxy:
  `connect_rejected — gateway answered 403 to CONNECT (policy denial)`, confirmed for
  `b365.ro`, `zilesinopti.ro`, `hartamuzeelor.ro` and `curatorial.ro`. `/root/.ccr/README.md`
  is explicit that a 403/407 from the proxy is an organization policy denial to report, not
  retry. Widening the environment's network policy to allow those hosts is an owner action
  (see the Claude Code on the web docs). Web *search* is unaffected — only direct page
  fetches are blocked, which is why earlier runs could find article titles but never read
  the articles.

---

## 16. Wanderlist two-way, synced dismissals, and a wider skill (2026-08-21)

A batch of fixes and additions from real use of the deployed app.

### Radar-B ⇄ Wanderlist is now genuinely two-way

**Wanderlist → Radar-B.** `fromFindingsPage` now reads `Going`, `Planned Date`
(split into date + time), `Date Expiring`, `Attended` and whether `Tickets` files
exist. The event page shows them as one compact **În Wanderlist** chip row plus a
link into the entry — the decisions you already made, answerable without opening
the other app. `mergeCluster` takes these *only* from the Findings row: the Radar
row has no opinion about whether you're going, and a merge must never invent one.

**Radar-B → Wanderlist.** A save appends a provenance line to the description
(`📡 Via Radar-B — recomandat de Curatorial; menționat de B365.`), naming
recommendations separately from passing mentions. Findings has no `Sources` field,
so without this the context that justified the save is dropped at the boundary.

### Dismissals sync across devices (schema change)

Dismissing was `localStorage`-only, so something hidden on the phone was still
there on the laptop — exactly what was reported. The Radar database gained
**`Dismissed` (checkbox)** and **`Dismissed At` (date)**, and the app writes them.

That is a deliberate, narrow reversal of the old "Radar-B never writes Radar"
rule, and the reasoning is worth keeping: **two writers to one table are only
dangerous when they write the same columns.** Dismissal is *user state*, not event
content. The app writes those two columns and nothing else; the skill is instructed
never to touch them (otherwise a weekly refresh would resurrect everything
deliberately hidden). The local list survives as an optimistic instant hide and as
the fallback for a Wanderlist-only event, which has no Radar row to write to.

Undo ships with it: the dismissal toast carries **Anulează**, and the Settings
toggle can bring hidden events back wholesale.

### Intake rules, as Settings toggles

Radar-B reads Findings wholesale, and Findings is broader than "what's on this
week". Four rules now gate the pool — `hideAttended`, `hideIdeas`, `hideNonEvents`
(`venue`/`idea`/`discovery`), `hideDismissed` — **all on by default, none a hard
exclusion**. Each toggle reports how many events it is currently hiding, so a thin
week is explainable rather than mysterious. `isIdea` mirrors Wanderlist's own rule
(unattended, no planned date, no expiry) — keep the two in step.

Settings itself is now four named sections (Ce intră în Radar · Conexiune Notion ·
Aspect · Ajutor) rather than one flat column of fields.

### Bugs fixed

- **Duplicated address.** `fromFindingsPage` was copying the single combined
  `Place` string into *both* `venue` and `address`, so the detail view printed it
  twice. `address` is now null for Findings rows, and the renderer additionally
  suppresses an address that merely repeats the venue (Radar rows often carry the
  full address in both columns).
- **"Săptămâna asta" reached into next week.** The lens was a rolling `today + 7`,
  which on a Friday swept in the *following* weekend. `endOfWeek()` makes it the
  calendar week, ending Sunday.
- **Toolbar clipped on mobile.** Horizontal scrolling was the wrong fix — it
  scrolled correctly but still *looked* truncated, and a clipped word at the screen
  edge reads as a bug rather than an invitation to swipe. The bar now **wraps**:
  ~580px of lenses is one row inside the 640px shell and two tidy rows on a phone.
  Verified 358/358 at 390px and 608/608 at 768px — no overflow at either.
  Labels shortened too (`Săptămâna`, `În curs`, `Noi`). *(The wrap was reverted in
  §17 — the shorter labels were the whole fix, and one scrolling row reads better
  than two static ones.)*
- **Back vs dismiss were indistinguishable** — a bare chevron beside a bare minus.
  Both now carry a word (**Înapoi** / **Ascunde**), and the minus became an
  eye-with-a-slash; the destructive one tints only on hover, since a permanently
  red control in a calm app reads as an alarm.
- **Toast wrapped to three lines** — it was shrinking as a flex item; `width:
  max-content` under the cap fixes it.

### Skill

- **Facebook is now a gated step, not advice.** It had been skipped in practice
  more than once because it sat in a wall of prose. It now mandates ≥4 concrete
  searches (including per-venue sweeps of the gallery/club list), says to extract
  from search-result metadata since the page fetch reliably login-walls, and — like
  the Radar write — **reports itself in the digest's closing block** (`📘 [F]
  evenimente de pe Facebook`). Zero is a legitimate answer; a missing line is not.
- **Existing events are enriched, not skipped.** Write rule 1 was "update, don't
  duplicate", which read as "skip if present". It now walks the stored row field by
  field and patches anything genuinely better (a real time, a fuller address, the
  event's own link over an article, tickets, image, cost, new signals), upgrades
  `Confidence` on the event's own page, and explicitly **never replaces a good
  value with a worse one**. A second article is usually where the exact time and
  ticket link finally appear.
- **Volume ceiling removed.** No cap per source or per article; target 20–35 rows
  in Radar per run (the digest still shows the best 12–20). A run yielding under 15
  is treated as incomplete collection, not an accurate picture of the city. Scope
  widened to explicitly include gallery openings of any size, artist talks, open
  studios, independent theatre/dance, institute and embassy programmes, public
  lectures, zine/record fairs and late-opening museum nights. **The bar didn't
  move — the breadth of the search did.**

38 new/updated tests (`intake.test.js` plus additions across dates/wanderlist/App).

## 17. Two languages (2026-08-25)

Radar-B is written in Romanian because the city is, and because every string it
displays from Notion arrives in Romanian. But the *chrome* — lens names, buttons,
settings, empty states — is the app's own voice, and there was no reason for it to
be monolingual. **Settings → Aspect → Limbă** switches the entire interface between
**Română** and **English**, instantly and persistently.

### What translates, and what deliberately doesn't

Every user-facing string lives in [`src/radar-b/i18n.js`](src/radar-b/i18n.js),
keyed by a dotted name, with **Romanian as the source of truth and the fallback**: a
key missing from `en` renders its Romanian text, so a half-finished translation
degrades to "some Romanian" rather than to raw `detail.sources` debris. A parity
test asserts the two tables have identical key sets *and* identical `{placeholder}`
sets per key, so a translation can't silently lose an interpolated value.

Three things stay in Romanian in both modes, on purpose:

- **Event content** — names, summaries, venues, addresses. It's Bucharest data
  written in Romanian by Romanian sources. Machine-translating it in the client
  would be inventing text nobody wrote, and it would break the visual match between
  a card and the article it came from.
- **Category and area values** (`concert`, `centru vechi`). These are a closed
  Notion vocabulary shared with Wanderlist and the skill. The words on the filter
  chips *are* the stored values; renaming them in one app would make the chips stop
  matching the database.
- **Names** — `Radar-B`, `Wanderlist`, `Notion`, `/recommend in Bucharest`.

### How it's wired

`App` owns `prefs` and wraps the tree in `LangProvider`; `useT()` yields a
translator memoised on the active language, so a switch re-renders everything at
once rather than leaving the shell in one language and a modal in the other. The
pure helpers — `dates.js`, `signals.js`, `search.js` — take the translator as an
argument instead of reaching for context, and each defaults to Romanian when handed
none, which keeps them callable from tests and from non-React code. Month and day
names are per-language arrays (they're indexed by `getMonth()`/`getDay()`, not
looked up by key). `document.documentElement.lang` follows the choice, so the
browser's own hyphenation and reading tools agree with what's on screen.

The lens bar **scrolls horizontally again** — §16 had made it wrap, but the short
labels alone turned out to be the whole fix, and one row reads better than two.
The short labels stayed.

23 new tests (`i18n.test.js` plus two App-level ones covering the toggle end to end,
including that event names stay Romanian after switching).

## 18. The handoff back into Wanderlist, and three dead controls (2026-08-25)

Three things in the detail view, all reported off one screenshot of a saved event.

### Links were invisible in dark mode

Only `.source a` had ever been given a colour, so every other link — **Open in
Maps**, **Open in Wanderlist** — fell through to the user agent's default
`-webkit-link` blue. On the warm paper palette that reads as merely wrong; on
`#16161a` it's close to unreadable, and it belongs to no palette this app defines.
There is now a base `a` rule in `radar-b.css` using `--color-accent`, with the
focus ring the rest of the app uses. Anything that deliberately isn't
link-coloured (the masthead's icon links) sets its own colour on a class, which
outranks a bare element selector. Verified in dark mode: `rgb(217, 139, 74)`.

### "Open in Wanderlist" went to Notion — now it goes to Wanderlist

It pointed at the Findings **Notion page**, which is the same URL the provenance
list already offers as the `saved` source. So it was both second-best *and* a
duplicate: a second link to a place already linked, showing a database row rather
than the entry as Wanderlist presents it.

Wanderlist now accepts a deep link — **`wanderlist-react.html#/entry/<id>`** — and
Radar-B builds one from the Findings page id. The app has no router and doesn't
want one: [`src/wanderlist/deeplink.js`](src/wanderlist/deeplink.js) is a single
read of the hash at startup, resolved once the list has loaded, then erased from
the URL with `replaceState` so a reload doesn't re-navigate forever.

- Ids are **folded** on both sides — Notion returns a dashed uuid in `page.id` and
  a bare 32-char id inside `page.url`, and the two must not produce different links
  to one entry.
- Anything that isn't a 32-hex id is ignored rather than guessed at, so a stray
  `#photos` opens nothing — and `appUrlFor` returns `null` rather than a link it
  knows is broken, in which case Radar-B falls back to the Notion page.
- A **real id that isn't in the list** — filtered out, not yet synced, or this
  browser is in demo mode — gets a notice offering Notion, which is the one place
  it certainly exists. Wanderlist reconstructs that URL from the id alone, so the
  fallback needs no extra parameters.

One demo fixture id on each side is now Notion-shaped rather than `seed-1` /
`demo-saved-1`: with the old ids, demo mode was the one place the handoff could
never be tried, and the button would silently not render. (Notion-shaped, but
**not the same id** — so the demo handoff still never landed. Fixed in §19.)

### Two dead controls in the actions row

- **"Already in Wanderlist"** was a *disabled* button restating the `IN
  WANDERLIST` section immediately above it. Deleted. What a saved event should
  offer there is the way **in** to Wanderlist, so the deep link took its place —
  promoted out of a small grey `provenanceNote` into the row's primary button.
- **"Event page"** is now suppressed when its URL is one the provenance list
  already carries. A Radar row's `Link` is often the article it was found in, so
  that was the common case, not the edge one — the button was a second, larger
  copy of a link an inch above it. A **ticket** link always keeps its button:
  that's the action the whole screen is building towards. The rule is
  `goUrlFor()`, exported and unit-tested rather than left inline.

19 new tests. Verified in a dark-mode browser: link colour, the actions row (two
buttons, neither disabled), the deep link opening the entry, and the miss note
with its Notion fallback.

## 19. The zoo, trimmed — and why two buttons did nothing on a phone (2026-08-26)

§18 fixed the *destination* of the actions row and left the mechanism alone. The
mechanism was the bug: on a phone, both of those buttons did nothing at all.

### `window.open` is swallowed in a Custom Tab

The Cabinet launches Radar-B into an **Android Chrome Custom Tab**, and a Custom
Tab silently drops a scripted `window.open(url, '_blank')` — no error, no
navigation, nothing to see. Both controls in the actions row were
`<Button onClick={() => window.open(…)}>`; every link that *worked* on that same
screen — "Deschide în Maps", every provenance row — was a plain `<a href>`. That
was the whole tell, and it was visible in the screenshot before any code was read.

Both are now anchors styled to match a `ds/Button` (`.actionBtn` in
`radar-b.css`). A navigation the reader started by tapping a link is never
blocked. The Wanderlist deep link is deliberately **in-tab** (no `target`): it's
the next step of one errand and the back button returns here. External links keep
`target="_blank" rel="noopener noreferrer"`.

`no control in the app opens a scripted popup` is a standing guard, wider than the
two buttons that were broken — nothing in the detail view may depend on
`window.open` again.

### The word "Wanderlist" appeared four times on one screen

A saved event showed: the card's `în wanderlist` badge · a provenance row reading
`Wanderlist … WANDERLIST` (source name and kind label being the same word) · an
`ÎN WANDERLIST` heading · and `Deschide în Wanderlist`. Provenance is **who told
you about this**. Your own Findings row didn't tell you anything — it's the
*outcome* of having been told — so it no longer appears there (`provenanceSources`),
which also removes the last link pointing at a raw Notion page. A Wanderlist-only
event now has no provenance section at all rather than a section containing one
tautology. The `ÎN WANDERLIST` heading went with it; the chips stand alone.

### Rows that existed to report the absence of a fact

Each of these filled a line to say nothing, and together they were most of what
the screen said:

| Was | Now |
|---|---|
| `CÂT · Preț necunoscut` | no cost row — a missing row *is* "we don't know" |
| `ora neconfirmată` on a 3-day festival | only on a single dated day with no hour; a range has no start time to be unsure of |
| `altundeva` under the address | dropped (`areaLabel`) — it's Area's "none of the above", a filter value, not a place |
| `Încă nedecis` + `fără dată planificată` | nothing — two chips agreeing that nothing had happened yet |
| `Verificat acum 3 zile.` | only when it's a *warning* (stale or never checked) |
| `Recomandat de X.` above a list labelling X `RECOMANDARE` | dropped |
| planned date repeating the `CÂND` row verbatim | shown only when it **differs** — i.e. when it's news (`wlChips`) |
| `expiră 2026-08-26` | said like every other date on screen; and hidden when it's just the event's own last day |

### Four data bugs, three of them visible in live Notion rows

- **`placeFor` wrote the venue twice.** Live Findings rows said `Parcul Tei,
  Parcul Tei, București` and `Strada Aviator Radu Beller (pietonală), Str. Aviator
  Radu Beller, București` — both written by Radar-B. A `Set` of exact strings
  never caught it because the two are not exactly *equal*. Containment handles the
  park; the street needed token overlap, since `strada` and `str` share no
  substring. Both live rows have been repaired, `Map` included.
- **The fallback description repeated itself**: `Lansare de carte la Cărturești
  Verona la Cărturești Verona. Semnalat via HotNews.` — above a provenance footer
  already reading `menționat de HotNews`. The venue is appended only when the name
  doesn't already carry it, and the source is named once, by the footer.
- **A roundup URL was written as the event's `Link`.** `toDraft` fell through to
  `sources.find(s => s.url)`, which is how the live Balkanik row got
  `b365.ro/timp-liber/` — a section page listing forty other things. It now falls
  back to nothing. This makes the draft agree with `goUrlFor`, which already
  declined to *offer* a source URL as an "event page" button; the two were
  disagreeing about the same event. Finding the real URL is the skill's
  enrichment step, which is now a mandatory per-event search with a check before
  Step 4 finishes — the app has no fetcher and does not scrape (§2), so a blank is
  the honest answer rather than a wrong one.
- **Times were read as a string slice.** Notion preserves whatever offset a value
  was written with, so one 19:00 concert comes back as `…T19:00:00+03:00` or
  `…T16:00:00Z` depending on who wrote the row — and `slice(11, 16)` turns the
  second into a 16:00 concert. `splitStart` and `toDraft` now go through
  `formatTime`, which is what the `CÂND` row already used, so the two times on
  screen agree by construction rather than by both happening to be `+03:00`.

### The demo handoff never landed

§18 said one fixture id on each side was "now Notion-shaped". Both were — but they
were **different ids**, so every demo tap landed on Wanderlist's "couldn't find
that item" path. Each app's tests passed because each only ever checked its own
id. Wanderlist's fixtures now carry the same entry Radar-B links to, and
`the demo handoff actually lands` resolves the link across both apps rather than
trusting either in isolation.

40 new tests (216 in `src/radar-b/`, 3501 in the repo). Verified end to end in a
browser at 375×812: the deep link opening the entry itself, save → draft → toast,
dismiss → undo, and every action in the detail view carrying a real `href`.

## 20. "Se vede oricând" was lying, and a row that wasn't real (2026-08-26)

### The `long-run` threshold made the label untrue

`long-run` renders as **"se vede oricând"** / "see it anytime". It is *derived*,
not stored — `signalsFor` adds it whenever an event's `When` span is long enough —
and it does three things at once, all of them saying *no hurry*: the label, being
pulled out of the day groups into the **Oricând** section, and a rank penalty that
sinks it below one-night events.

The floor was **four days**, which is not "anytime" by any reading. A film with a
five-day cinema run qualified, so Radar-B told you to take your time about
something leaving on Sunday — and buried it under the three-month exhibitions
while it did.

It is now **eight days**, which states a rule you can check: *it is still on in a
week*, so it spans another weekend and you genuinely can go some other day. A
weekend festival and a short cinema run stay in the day stream, where each of
their days is a date you might act on.

### `Comatogen` — a `confirmed` row for a screening nobody lists

Reported as an odd link; it turned out the link was the smaller half of it.

- **`Link` was a programme page.** `cinemagia.ro/program-cinema/elvire-popesco-bucuresti/`
  is a "what's on today" schedule that **rewrites itself daily**, so a row pointing
  at one is guaranteed to stop matching — open it a day later and the film simply
  isn't there, which is exactly what happened. The film's own page
  (`cinemagia.ro/filme/comatogen-3323621/`) is the stable target; the programme
  page belongs in `Sources`, where the `│ YYYY-MM-DD` field records *when* it was
  read.
- **The five-day run was invented.** Nothing stated 26–30 August. Seeing a title on
  today's programme tells you it plays today and nothing about tomorrow. And the
  fabricated span is what crossed the old four-day threshold, so the two halves of
  this section are one bug: an invented range produced a false "se vede oricând".
- **It was marked `confirmed`.** Neither Cinemagia's own Elvire Popesco programme
  nor **Eventbook** — the cinema's actual box office — lists Comatogen at all for
  those dates. The live row is now `uncertain`, so the app shows its "verifică
  înainte să pleci de acasă" warning, and its `Summary` says what could not be
  confirmed. The row was not deleted: that's Gabriel's call, not the app's.

The skill gained the matching rules — never invent a date range (with *why*: it
drives `long-run`), `confirmed` means the event's own page, and a venue programme
page is never a `Link`.

### Eventbook is now a first-class source

`eventbook.ro` is the box office for the art-house cinemas actually in play
(Elvire Popesco, Cinema Pro, Cinemateca), so for `movie` it beats every listing
site: the real title, the real showtime and a bookable link in one fetch, rather
than a schedule someone retyped. It's now a source row in Step 1, the first place
to look for film links in Step 3b, and the cross-check that decides whether a film
another source mentioned is actually playing. That check is what caught Comatogen.

## 21. Radar-Bee — the identity, and a palette out of a 1981 poster (2026-08-26)

Renaming the app to sit better beside Marquee was priced first: 284 occurrences
across 40 files, of which the mechanical half was an afternoon and the other half —
`radar-b-react.html`, the manifest `id`/`start_url`/`scope`, the service-worker
scope, `watchInstalled`, and seven `radarb_*` localStorage keys — meant an orphaned
PWA install and a lost Notion token unless every one was migrated.

**So the name didn't move. The identity did.** The `-B` is now a bee: the Eye-Bee-M
rebus, played straight. That buys the whole point of the rename — an identity that
reads as an object in the world, like a marquee does, rather than a technical
suffix — and touches nothing in the risky half. No reinstall, no redirect, no
storage migration, no WebAPK exposure.

It also survives its own metaphor test, which is the part that matters more than the
pun: **a bee forages across the whole city, works many sources, and carries things
back to the hive.** Eight publications in, Wanderlist out. Marquee stands still and
shows one venue's own sign. The two marks now carry the architecture.

### Two drawings of one bee

- `radar-b-icon.svg` — the launcher tile. Green teardrop wings, amber banded body,
  two pink knobs, on black. **The radar lives inside the wings**, where the venation
  is a set of concentric rings struck from the thorax, so the same lines read as wing
  structure and as a sweep. A meld, weighted to the bee.
- `radar-b-logo.svg` — the small mark (favicon, and the `BeeMark` component's
  geometry). Identical silhouette, **no venation**: below ~40px those rings collapse
  into mud and fray the wing edge. Two drawings, not one drawing at two sizes.

Three earlier passes are worth recording because each failed a different way. Loose
radar arcs with no wing outline read as a **spider**. Filled cream wings read as a
moth. Black ring venation on a black ground cut visible notches out of the wing edge
and the bee looked **chewed** — the rings are a darker green for that reason.

The artwork is original. The rebus is the idea being borrowed, not the drawing.

### The palette is the poster

Five flats, each doing exactly one job — which also fixed an existing problem, that
amber was carrying three unrelated meanings at once:

| Poster | Hex (dark) | Job |
|---|---|---|
| bee body | `#e8a33d` | accent · `--signal` · `recomandat` |
| wings | `#5c9668` | success · `gratuit` |
| brow | `#d2694b` | danger |
| the M | `#8290ea` | **`--color-info`, and the `în wanderlist` badge** |
| knobs | `#efa3b1` | **`--color-pink`, tickets held** — the one decorative colour |

`în wanderlist` used to be amber, so a saved recommended event carried two amber
badges meaning unrelated things. It gets the M's periwinkle now.

Dark is the poster's native register: near-black ground (`#0b0b0d`), colour doing the
speaking. Light inverts onto warm white with the same five hues darkened enough to
hold contrast. **Dark tokens are still defined twice** — the `prefers-color-scheme`
block and the `[data-theme="dark"]` block — and both were rewritten; see the comment
above them for why that duplication exists.

### `notion` is gone from the chrome

The masthead read `Radar-B  notion` whenever the app was live and the Suggested page
carried no date — a label reporting the **normal** state, which is what the detail
view's `Preț necunoscut` row was doing before §19 removed it. Dropped, along with the
`app.notion` key in both language tables. `demo` stays (abnormal, worth knowing) and a
real refresh date stays (news). With neither, the button shows a refresh glyph and
says nothing — it is the refresh affordance, so it could not simply render empty.

The same redundancy was on every card in the launcher: six app subtitles ended in
`· notion`, naming the backing store on a tile where it changes no decision. Removed
across all of them. The `notion` **tag** stays — that one drives filtering.

### What was deliberately left alone

`src/marquee/` and `public/marquee-guide.html` reference Radar-B, but only in prose
and comments, and the name has not changed — there is no visual identity of Radar-B's
rendered inside Marquee to restyle. Those files were also mid-flight in another
session (the TNB and MyStage adapters) while this landed, so they were not touched.

## 22. The pool stopped importing Wanderlist as a second source of events (2026-08-26)

§6 and §16 both say it plainly — "Wanderlist is the only save," "Radar-B does not
re-implement" discovery — but the pool itself didn't enforce it. `App.jsx` built its
`pool` from `dedupe([...data.events, ...data.saved])` with no filter afterward, so
**any** Wanderlist row that didn't cluster with a Radar row still survived dedupe as
its own standalone record and rendered on the calendar. The visible symptom: keeping
something in Marquee made it show up on Radar-B's own calendar, tagged "in
Wanderlist" — not because Radar found it, but because it was in Wanderlist at all.

The fix is one line: `.filter((e) => e.radarId)` after `dedupe(...)`. `mergeCluster`
(`dedupe.js`) already sets `radarId` from whichever member of a cluster has
`origin === 'radar'`, and `null` when none does — so this doesn't touch the merge
logic or the cross-reference itself:

- A Radar row that also matches a Wanderlist row merges into one record carrying
  both ids — still shows, still tagged "in Wanderlist". This is the entire point of
  §16's two-way merge, and it's unaffected.
- A Wanderlist row that matches nothing — kept from Marquee, or anywhere Radar
  itself never looked — merges into its own standalone record with `radarId: null`,
  and that one is now dropped before it reaches `stream`/`counts`/`facets`.

`fixtures.js` gained `MARQUEE_ONLY_SAVED`, a saved entry with no matching Radar row,
specifically to give this case a fixture — the existing "Trio Nocturn" fixture
always had a matching Radar entry, so the no-match path had never actually been
exercised in demo mode. `App.test.jsx`'s new test asserts it never renders, next to
the existing test proving "Trio Nocturn" (the genuine cross-reference) still does.

## 23. Two more Wanderlist/Radar gaps, and "Running" stopped duplicating "Later" (2026-08-29)

Three fixes from a live phone session, saving and browsing real Radar rows.

- **A saved event with no Radar dismiss control.** `EventDetail`'s hide button was
  gated on `!event.saved` — once a Radar row merged with a Wanderlist row, there was
  no way to hide it from the browse view at all. Dismissal writes to the Radar row
  (`event.radarId`), which has nothing to do with Wanderlist state: a saved,
  long-running exhibition you're not planning to revisit is exactly the case for
  hiding it while it sits untouched in Wanderlist. The pool is already filtered to
  `radarId`-bearing events (§22), so the button is now always shown.
- **A stale `Date Expiring` blocked the Wanderlist merge silently.** A Findings row
  saved a month before the event's real closing date was known (an old, vaguer
  source guessed "recurring, no confirmed end") never merged with the Radar row the
  skill later wrote from the actual article, because `dedupe.js`'s date check treats
  a confident mismatch as disqualifying no matter how well the title matches — "same
  name, non-overlapping dates is a repeat run." Not a code bug: the fix was updating
  the stale `Date Expiring` in Notion once the real date was known. Worth knowing if
  a save that should show "In your Wanderlist" doesn't: check whether an old guessed
  date is quietly vetoing an otherwise exact title+venue match.
- **`Running` and `Later` showed the identical card.** `lensesFor()` added `later`
  whenever an event's span reached past the current week — true of essentially every
  long-running exhibition, since a months-long run's end date is always beyond this
  week. Once such an exhibition actually opened (`isRunningNow`), it became a member
  of both `running` and `later` at once, and `search.js`'s standing-section logic
  rendered it identically under "Oricând" in both tabs — confirmed live: two
  exhibitions, byte-for-byte the same cards, under both tabs. `later` is
  forward-looking — things to come back to once this week is done — and an
  exhibition already open isn't later, it's now; `running` is its one dedicated
  home. So `later` now excludes anything `isRunningNow`. An exhibition that hasn't
  opened yet still reaches `later` normally, and drops out of it the day it opens,
  replaced by `running`. Deliberately narrow: this doesn't touch the
  tonight/tomorrow/weekend/week overlap, which is separately intentional and tested
  (§4's "when in doubt, keep separate" governs dedupe, not lenses; the lens
  philosophy is the opposite — "an event can legitimately answer to several," which
  is why a long run still surfaces under the day tabs via the standing section,
  `search.test.js`'s "a long run is lifted out of the day groups into its own
  section"). Only the one pairing that could show the exact same card under the
  exact same heading needed separating.

Along the way, two more demo fixtures (`demo-4`, `demo-6` in `fixtures.js`) turned
out to share `demo-5`'s §12 bug — a fixed `day(2)` offset that lands in next
calendar week whenever the suite runs on a Friday or Saturday. Switched both to the
existing `dayThisWeek()` helper.
