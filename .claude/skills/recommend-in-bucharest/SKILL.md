---
name: recommend-in-bucharest
description: "Trigger when user says \"/recommend in Bucharest\". Refreshes Notion event data if needed, fetches and parses all sources, and produces a curated day-by-day digest filtered to Gabriel's cultural preferences."
---

# /recommend in Bucharest

Produces a curated digest of Bucharest events filtered to Gabriel's taste. The trigger is always `/recommend in Bucharest`. What happens next depends on the day of the week.

**This skill is also the ingest layer for Radar-B**, Gabriel's Bucharest event-radar app (`radar-b-react.html`). Radar-B does not scrape anything — it reads the **📡 Radar** Notion database that Step 4 below writes. So a run of this skill does two things now: it writes normalized, deduplicated event rows the app can browse all week, and only then prints the digest for this conversation.

**That order is deliberate and load-bearing.** The Radar write used to come *after* the digest, worded as a followup step — and in practice it got skipped: the digest satisfied the visible request, the run "felt done," and the write never happened, silently leaving Radar empty run after run. Step 4 now happens *before* the digest is produced, and the digest's own closing line (Step 5) reports how many rows were written or updated. There is no such number to report if Step 4 didn't run, which is the point — do not fabricate one. If Radar isn't reachable for some reason, say so in that line instead of silently omitting it; never print the digest as if the run were complete when it isn't.

---

## Step 1 — Determine mode based on current day

### Friday, Saturday, Sunday (weekend mode)
Notion is the source of truth.

1. Fetch the **Suggested events** Notion page (ID: `377d3e6d-60db-81a6-88e1-c81e0604a9a0`)
2. Check if content contains a dated section (`## DD luna YYYY`) that covers the **current weekend**
3. **If stale or empty:** run Step 1a (source refresh) before proceeding
4. **If current:** on Friday or Saturday, run Step 1b (placeholder re-check) before proceeding to Step 2. On Sunday, skip straight to Step 2 — by Sunday, a source that hasn't posted yet almost certainly won't before the weekend is over, so re-querying it isn't worth the round trip.

#### Step 1a — Source refresh (replaces Notion content)
Search and fetch all 5 sources for the current week. Verify each is current before including.

| Source | Type | How to find |
|---|---|---|
| **Buletin de București** | Article, publishes Thu/Fri | Search `buletin.de/bucuresti` for *Agenda Urbană cu Cosmin* current week. URL pattern: `.../agenda-urbana-cu-cosmin-buletin-recomandari-culturale-pentru-[DD-DD-luna]/`. If not yet indexed, try fetching the URL directly using the pattern. |
| **HotNews** | Article, publishes Thu/Fri | Search `hotnews.ro` for *Weekend trending în București* current week. |
| **B365** | Article, publishes Thu or earlier | Search `b365.ro` for *București de weekend* or *Ce facem în weekend în București* current week. |
| **Curatorial** | Article, publishes Thu/Fri | Fetch directly: `curatorial.ro/arta/recomandarile-curatorial-pentru-weekendul-[DD-DD-luna]/` |
| **Zile și Nopți** | Aggregator, always current | Fetch directly: `zilesinopti.ro/evenimente-bucuresti-weekend/` — no search needed |
| **Recomandata** | Newsletter (Scena9/Fundația9), publishes Thu | Fetch `recomandata9.substack.com` to find the latest issue link, then fetch the article. Covers current week + upcoming events. Curated, editorial, highly relevant to Gabriel's taste. |
| **Harta Muzeelor / Weekend Sessions** | Aggregator, always current | Fetch directly: `hartamuzeelor.ro/recomandari.html` — stable URL, no search needed. Focus: museums, galleries, guided tours, workshops, concerts in cultural venues. |

After retrieving all available sources:
- Replace the entire content of the **Suggested events** Notion page with a `## DD luna YYYY` section containing a table of article links + a Zile și Nopți highlights block
- **Update Notion as soon as at least 1 article source is confirmed** — no need to wait for all four. Mark missing sources with ⏳ nepublicat încă as a placeholder row in the table
- Zile și Nopți is always fetched and always included regardless of article availability

#### Step 1b — Placeholder re-check (Friday/Saturday only)
A table that's "current" for the weekend can still be carrying ⏳ nepublicat încă rows from earlier in the week — Buletin and HotNews in particular tend to post late Thursday or Friday, so a page built Thursday night may still be missing them by the time Friday or Saturday's run happens. Rather than accepting stale placeholders for the rest of the weekend, re-check them:

1. For each row still marked ⏳ nepublicat încă, search that source directly using its "How to find" recipe from the table above (same URL patterns and search terms as Step 1a — just for that one source, not all five).
2. If a matching article for the current weekend now exists, patch only that row with the confirmed link and title. Leave every already-confirmed row and the Zile și Nopți block untouched.
3. If it's still not published, leave the ⏳ placeholder as-is — don't keep retrying within the same run.
4. Update Notion only if at least one previously-missing source is now confirmed. If every ⏳ row is still unpublished, don't touch the page — no need to write a no-op update.

This is a small targeted patch (one or two table cells), not a rebuild of the page — it should never rewrite rows that already have a link.

### Monday–Thursday (weekday mode)
Use **both** Notion and web search — always combine them:

1. Fetch the **Suggested events** Notion page. If it contains article links (even just one), fetch each article and extract events from it — this is primary source material, not optional. **Important:** articles like Buletin's *Agenda Urbană cu Cosmin* cover the full week (Monday–Sunday), not just the weekend. A Friday-published article is still relevant on Tuesday or Wednesday of the following week — always parse it for weekday events, not just the weekend ones.
2. Also fetch Zile și Nopți directly (`zilesinopti.ro/evenimente-bucuresti-weekend/`) — always.
3. Additionally search online for events covering the current day, rest of the week, and the approaching weekend. Use the same 5 sources plus general cultural search (gallery openings, cinema listings, club nights, etc.).
4. Merge all three streams — Notion articles + Zile și Nopți + web search — into a single event pool before filtering and producing the digest.
5. Do not update Notion in weekday mode unless it is clearly empty or stale.

---

## Step 2 — Fetch and parse all sources

For each article linked in Notion (or found via search in weekday mode):
- Fetch the full article
- Extract individual events: name, date, time, venue, category, price if available

Also always fetch Zile și Nopți directly and extract its structured event list by category.

### Facebook

Facebook is a real source, not an optional extra — plenty of Bucharest events (club
nights, gallery openings, one-off pop-ups) surface there and nowhere else, and never
get picked up by the 7 named article sources at all. Treat it as its own search step,
every run — don't wait for an article to happen to mention one:

1. **Actively search**, don't just wait for a link to surface. Run a handful of targeted
   searches for the current weekend/week — e.g. `Bucharest events this weekend
   site:facebook.com/events`, and venue-specific searches for the spots that reliably run
   things worth knowing about (Control, Guesthouse, Quantic, Platforma Wolff, Expirat,
   and any other venue already in this skill's "always include" list). Search engines
   index public Facebook event pages' metadata (title, date, venue) even where a direct
   *fetch* of the page fails — extract what the search result itself gives you.
2. **Don't fight the fetch.** Public Facebook event pages reliably fail to load directly
   (login wall) even when the event is public — this is a known quirk (see the
   `wanderlist` skill), not something to retry. Use whatever the search result or a
   linking article already gives you (title, date, venue, sometimes an image), or ask
   Gabriel for a screenshot, rather than repeatedly trying to fetch the page.
3. **Never treat a Facebook event as the primary source when the venue's own page or a
   ticket platform names the same event** — Facebook is the source for events that exist
   nowhere else, not the preferred read when a better one is available (same "direct link
   over article" ordering Step 3b's enrichment pass already applies).
4. If a genuine search for Facebook events turns up nothing usable this run, say so in
   passing rather than silently omitting the step — same principle as Step 1b's
   ⏳ placeholders: an empty result is reported, not hidden.

**Never include a Facebook event — or any event, from any source — that is online-only.**
A livestream, a webinar, a virtual screening, a Zoom talk, an Instagram Live: none of
these are something to physically go to in Bucharest, which is the entire premise of
this skill. The tell on Facebook specifically is the event's own location field reading
something like "Online Event" / "Eveniment online" instead of a real venue or address —
that is the signal to exclude it, not a location Claude has to reason about. A hybrid
event (in-person **with** a stream alongside it) is fine and should be included as
normal; it's the stream-only ones that never belong in this digest or in Radar.

Build a unified event pool. Deduplicate — same event cited by multiple sources = one entry with a richer description.

---

## Step 3 — Filter by Gabriel's preferences

### Always exclude
- Sala Palatului
- Teatrul Nottara
- MINA
- Teatrul Bulandra
- Opera Națională
-Tur Pietonal
-FF Theatre
-The Fool
- Opereta
- Generic corporate events, trade fairs, business conferences (sales, marketing, etc.)
- Mainstream pop/commercial concerts at large arenas unless genuinely exceptional
- **Online-only events** — livestreams, webinars, virtual screenings, anything with no
  physical Bucharest venue to walk into. This applies to every source, Facebook
  especially (see Step 2) since "Online Event" is a real option there. A hybrid
  event that's in-person **and** streamed stays included.

### Always include (high priority)
- **Contemporary and experimental art exhibitions** — this is the core
- **Arthouse cinema:** Elvire Popesco, Cinema Europa, Apollo, MȚR, Cinema Pro, open-air screenings. Also flag exceptional commercial releases worth seeing (animated, prestige, foreign-language)
- **Live music:**
  - *Primary:* jazz & improvisation, contemporary/experimental/chamber music, indie/alternative/rock, folk/singer-songwriter
  - *Secondary:* electronic/club nights at venues like Platforma Wolff, Control, Guesthouse, Quantic — include if the act is noteworthy, not as filler
- **Performance in hybrid/alternative spaces:** Control, Guesthouse, Cărturești, galleries, residences, site-specific
- **Book launches, author signings, literary events**
- **Cultural and social conferences** (art, urbanism, design, philosophy, social topics — not business)
- **Street fairs and open-air markets with cultural character** (Street Delivery, Bazar Cotroceni-style)
- **Guided tours, urban exploration, heritage walks**
- **Newly opened venues — always flag with 📍 NEW VENUE**
- **Atheneum:** include all programs

### Include lightly (label clearly, max 1–2 per digest)
- Mainstream events with broad appeal — group at the bottom under **„De știut"** so Gabriel can skip easily

### Price
Not a filtering criterion — never exclude an event based on price, never flag price as a reason to skip.

### Filtering philosophy
Gabriel's taste leans fringe, textural, non-obvious. When choosing between a safe mainstream pick and a smaller interesting one, go with the smaller interesting one. Specificity over completeness.

---

## Step 3b — Deduplication and enrichment

Before either output below (Radar, then the digest — both consume this same pool):

**Deduplicate:**
- Same event cited by multiple sources = **one entry only**
- Keep the richest description; merge any unique details from each source
- Note provenance briefly at the end: `[via Buletin, Zile și Nopți]`
- Match on: event name similarity + venue + date. When in doubt, keep separate.

**Enrich each surviving entry** — do this once, here, for the whole pool. Both Step 4
(Radar) and Step 5 (the digest) read these results rather than re-deriving them:
- **Links:** actively search for the event's own page for every event (e.g. `"[titlu
  eveniment]" [venue]`) — official venue/museum/gallery page, ticket platform (iaBilet,
  Eventbook, Bilet.ro), or organizer's event page. This is a real search step per event,
  not something to only try when the source article happens to name one. If the
  Notion-linked article already names that direct link, use it straight away — no need
  to re-search. A generic roundup article is a fallback, not the target — use one only
  when no direct event/venue/ticket page turns up. If genuinely nothing can be found,
  leave the link blank rather than guessing or fabricating one.
- **Times:** include exact times when available. Never invent one — a bare date with no
  stated time stays a bare date.
- **Addresses:** always include the full street address — required for Wanderlist
  geocoding and for Radar-B's Maps link. If unknown, write the neighborhood or landmark
  instead and flag it as approximate.
- **Prices:** include in lei if stated by any source. Never guess.

---

## Step 4 — Write the events to 📡 Radar

Write the deduplicated, enriched pool from Step 3b into the **📡 Radar** database. This
is what Radar-B reads, and it happens **before** the digest below — not after it. A run
of this skill is not complete until this step has actually executed; Step 5's closing
line exists specifically so that isn't silently skippable.

| Resource | ID |
|---|---|
| 📡 Radar database | `fbe904166c9e40fcbf723417e15a17bf` |
| 📡 Radar data source | `48cbd3d9-4f27-4792-ac03-cbe646d7aa48` |

It sits as a child of the **Suggested events** page, deliberately: that page stays the
*article-level* research layer (which roundup each source published this week), and
Radar is the *event-level* layer those articles resolve into. Don't replace one with
the other.

### Properties

| Property | Type | What goes in it |
|---|---|---|
| `Name` | title | The event, **without** the venue — same rule as Wanderlist's `Name`. |
| `When` | date | Start; add an **end** for a festival or an exhibition run; add a **time** only when a real one is stated (Step 3b). A bare date means the time is genuinely unknown — Radar-B renders it as "no time confirmed" rather than inventing one, so never pad it to 19:00. |
| `Venue` | rich text | Human venue name. |
| `Address` | rich text | Full street address, from Step 3b's enrichment pass — it's what makes a later save to Wanderlist geocode on the first try. |
| `Area` | select | Neighbourhood, lowercase, from the existing options (`centru`, `centru vechi`, `cotroceni`, `armeneasca`, `bucurestii noi`, …, `altundeva`). |
| `Category` | select | **Wanderlist's vocabulary, verbatim** — the same backtick label the digest will carry (`art`, `concert`, `play`, `movie`, `culture`, `event`, `venue`, `discovery`, `idea`). |
| `Summary` | rich text | 2–3 sentences: what it is, why it's worth going. **Never blank.** |
| `Signals` | multi-select | From `recommended`, `free`, `ticketed`, `family`, `outdoor`, `new-venue`, `recurring`, `long-run`, `sold-out`, `mainstream`. Map the digest's own flags: 💚 → `free`, 📋 → `ticketed`, 🔁 → `recurring`, 📍 NEW VENUE → `new-venue`. Set `recommended` for anything you'd put above "De știut", and `mainstream` for anything you'd put *in* "De știut" — the two are mutually exclusive. |
| `Cost` | number | Lei, only if stated (Step 3b). Never alongside `free`. Never guessed. |
| `Link` | url | The event's **own** page, from Step 3b's enrichment pass. The roundup article is a fallback, not the target. |
| `Tickets` | url | Only when the ticket link differs from `Link`. |
| `Image` | url | Poster, when the source page exposes one. |
| `Organizer` | rich text | |
| `Sources` | rich text | **Provenance, one mention per line:** `Curatorial │ https://… │ 2026-08-21`. Prefix a line with `*` when that source *recommended* the event rather than merely mentioning it. This is the field that lets Radar-B show "also mentioned by B365" and "recommended by Recomandata" — the whole point of Step 3b's dedupe surviving into the app. |
| `Confidence` | select | `confirmed` (read off the event's own page) · `reported` (an editorial roundup) · `uncertain` (just a title and a date inside an article). Be honest here — Radar-B dims uncertain events and says so in words. |
| `Checked` | date | Today. Drives Radar-B's staleness notice. |
| `Key` | rich text | `venue-slug:date:title-slug`, e.g. `control-club:2026-08-21:trio-nocturn`. Stable across runs, diacritics folded, lowercase. |

### Write rules

1. **Update, don't duplicate.** Before writing, query Radar for the `Key` you're about to use. If a row exists, **patch** it — merge the new mention into `Sources`, upgrade `Confidence` if you now have the event's own page, refresh `Checked` — rather than creating a second row. Radar-B deduplicates defensively on its side, but a clean table is better than a clever merge.
2. **One row per underlying event, not per mention.** Four sources covering one exhibition is one row with four `Sources` lines.
3. **Write the whole deduped pool**, including what will become the "Pe radar" and "De știut" sections of the digest — Radar-B's lenses and filters are what let Gabriel ignore them, so they don't need to be withheld here.
4. **Bulk writing is fine here** (unlike Wanderlist intake, which is one at a time on confirmation). Radar is a research surface Gabriel browses, not his personal list — nothing lands in his own world until he saves it in Radar-B.
5. **Never delete rows** for events that have passed. Radar-B hides past events itself, and the history is worth keeping.
6. **Keep a running count** of rows created and rows updated as you go — Step 5's closing line reports it.

---

## Step 5 — Produce the digest

Format: day-by-day, chronological within each day. **Number every event sequentially** across the full digest (1, 2, 3… not restarting per day) so Gabriel can reference by number for Wanderlist intake.

```
## Ce se întâmplă în București — [Joi DD – Duminică DD luna YYYY]

### Joi / Vineri / Sâmbătă / Duminică, DD luna

**N. [Titlu eveniment]** · [emoji] [💚] [📋] [🔁]
[Nume loc complet], [Adresă completă cu stradă și număr], [Ora exactă]
[2–3 propoziții: ce e, de ce merită, context relevant]
`[Categorie Wanderlist]` · [Preț în lei dacă disponibil] · [via sursă](URL)

...

---
### Pe radar 👁️
[Evenimente viitoare (săptămâna viitoare+) care merită adăugate acum în Wanderlist cu Going=false]

---
### De știut
[Max 1–2 evenimente mainstream]

---
📡 [N] evenimente scrise/actualizate în Radar.
💡 Spune numărul sau titlul prescurtat și adăugăm în Wanderlist.
```

**The `📡 …` line is not decorative — it's the confirmation that Step 4 actually ran.**
Fill `[N]` with the real count kept during Step 4 (created + updated). If Step 4 didn't
run or Radar wasn't reachable, this line must say so plainly (e.g. `📡 Radar
indisponibil — nu s-a scris nimic.`) rather than being dropped or guessed. A digest
without this line, or with a suspiciously round/guessed number, is an incomplete run.

**Flags:**
- 💚 gratuit
- 📋 rezervare/bilet necesar în avans
- 🔁 recurent (nu e one-off — Date Expiring nu se aplică)
- 📍 NEW VENUE

**"De știut" needs a Radar signal, not just a digest section.** Set `Signals: mainstream`
(Step 4's property table) on every event grouped under „De știut" — that's what lets
Radar-B actually sink it in its own ranking rather than showing it identically to
everything else. `mainstream` and `recommended` are mutually exclusive — an event never
carries both. Nothing else needs a special flag for this; it's not a digest emoji, it's a
Radar-only signal.

**Category emojis:**
🎵 concert/muzică live · 🎧 club/electronic/party · 🎨 expoziție/artă · 🎭 teatru/performance · 🎬 cinema · 📚 carte/literar · 🏙️ urban/outdoor/tur · 🎪 târg/festival stradal · 🏛️ cultural/conferință

**Wanderlist category mapping** (use in backtick label per event):
- Concert live → `concert`
- Club/electronic → `event`
- Expoziție/artă vizuală → `art`
- Teatru/performance → `play`
- Cinema → `movie`
- Lansare carte/literar → `culture`
- Tur ghidat/urban → `event`
- Târg/festival stradal → `event`
- Conferință culturală → `culture`
- Loc/spațiu în sine → `venue`

**Depth:** 12–20 events covering the current day through Sunday. Prioritise Thursday evening and Friday/Saturday. Sunday is lighter.

**Times, addresses, prices, links:** already resolved in Step 3b's enrichment pass —
reuse those results here rather than re-deriving them. The `(via sursă)` tag's URL is
the direct link Step 3b found (or the article, only if nothing direct turned up); omit
the `(URL)` portion entirely rather than guessing one.

---

## Step 6 — Wanderlist handoff

After the digest:
> Spune numărul evenimentului (ex. „3", „5 și 8") sau titlul prescurtat și adăugăm în Wanderlist.

When Gabriel selects an event, prepare a Wanderlist draft using data already present in the digest entry:

| Wanderlist field | Source in digest |
|---|---|
| **Name** | Titlul evenimentului (fără locație) |
| **Description** | Cele 2–3 propoziții din digest, condensate — obligatoriu, nu se lasă gol |
| **Category** | Backtick label din digest (`concert`, `art`, etc.) |
| **Place** (name + address) | Adresa completă din digest, + „, București" |
| **Map** | Google Maps search URL construit din adresa de mai sus |
| **Date Expiring** | Data evenimentului (doar dacă e one-off, nu 🔁); pentru expoziții, data de închidere |
| **Planned Date** | Aceeași dată dacă e fix |
| **Cost** | Prețul în lei dacă e menționat |
| **Attended** | false implicit |
| **Going** | false implicit — Gabriel confirmă explicit |
| **Tags** | `free` dacă 💚, `ticketed` dacă 📋; altele după caz |
| **Link** | Direct event URL found during Step 3b's enrichment pass — the event's own page/ticket link, falling back to the cited article only if no direct link was found |

**Link** is distinct from **Map** (the address/map-link url field) — Link is the event/source URL, Map is the location link. Never leave Link blank if any URL was surfaced during research.

**Do not fetch the Findings schema.** Exact property names, types, allowed `Category`/`Tags` values, and the `notion-create-pages` write format (including `"__YES__"`/`"__NO__"` checkboxes and `date:<Name>:start` keys) are documented in the **wanderlist** skill — read that instead of calling `notion-fetch` on the collection. Only fetch if a write actually fails with a schema error.

Show the draft, wait for confirmation, then write. Never bulk-add unless Gabriel spune explicit. One at a time.

**Gabriel may also do this himself in Radar-B** — the app builds the same draft from the same Radar row and writes it through the same shared Findings mapping, so a row saved in the app and one saved from this conversation are identical. If he says "I'll save it myself" or you can see the event is already in Findings, don't re-offer it here.

---

## Notion resources

| Resource | ID |
|---|---|
| Suggested events page | `377d3e6d-60db-81a6-88e1-c81e0604a9a0` |
| 📡 Radar database | `fbe904166c9e40fcbf723417e15a17bf` |
| 📡 Radar data source | `48cbd3d9-4f27-4792-ac03-cbe646d7aa48` |
| Quick Notes DB | `aa4d3e6d-60db-830b-b6e4-8189907a1580` |
| Quick Notes data source | `776d3e6d-60db-83c4-863c-074672829a42` |
| Wanderlist (Findings) collection | `b78c25e5-e152-4031-adf7-34950d211d7f` |