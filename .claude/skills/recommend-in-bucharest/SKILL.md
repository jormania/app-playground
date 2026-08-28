---
name: recommend-in-bucharest
description: "Trigger when user says \"/recommend in Bucharest\". Refreshes Notion event data if needed, fetches and parses all sources, and produces a curated day-by-day digest filtered to Gabriel's cultural preferences."
---

# /recommend in Bucharest

Produces a curated digest of Bucharest events filtered to Gabriel's taste. The trigger is always `/recommend in Bucharest`. What happens next depends on the day of the week.

**This skill is also the ingest layer for Radar-B**, Gabriel's Bucharest event-radar app (`radar-b-react.html`). Radar-B does not scrape anything — it reads the **📡 Radar** Notion database that Step 4 below writes. So a run of this skill does two things now: it writes normalized, deduplicated event rows the app can browse all week, and only then prints the digest for this conversation.

**That order is deliberate and load-bearing.** The Radar write used to come *after* the digest, worded as a followup step — and in practice it got skipped: the digest satisfied the visible request, the run "felt done," and the write never happened, silently leaving Radar empty run after run. Step 4 now happens *before* the digest is produced, and the digest's own closing line (Step 5) reports how many rows were written or updated. There is no such number to report if Step 4 didn't run, which is the point — do not fabricate one. If Radar isn't reachable for some reason, say so in that line instead of silently omitting it; never print the digest as if the run were complete when it isn't.

**This skill and Marquee (`src/marquee/`, same repo) are meant to be two circles that
never overlap.** Marquee reads a fixed set of venues' own programme pages directly, far
more completely and far more often than any roundup or search here ever could — so this
skill has no business re-discovering events at a venue Marquee already watches; doing so
just means the same night reaches Wanderlist twice, from two different directions. Step
1c reads Marquee's own venue list fresh, every run, and excludes those venues before Step
3's filtering even starts. There is nothing to hand-sync: adding, pausing, or removing a
venue in Marquee changes what this skill excludes on its very next run.

**Batch independent tool calls instead of running them one at a time.** Almost
every fetch and search in this skill — the sources in Step 1a's table, the
venue/gallery searches in Step 2, one event's `Link` search against another's in
Step 3b — has no dependency on any other call in the same batch. Issuing them
together cuts the run's wall-clock duration substantially without changing what
gets read; only chain calls sequentially when a later one genuinely needs an
earlier result (e.g. reading a Key lookup before deciding whether to enrich a row).

---

## Step 1 — Determine mode based on current day

### Friday, Saturday, Sunday (weekend mode)
Notion is the source of truth.

1. Fetch the **Suggested events** Notion page (ID: `377d3e6d-60db-81a6-88e1-c81e0604a9a0`)
2. Check if content contains a dated section (`## DD luna YYYY`) that covers the **current weekend**
3. **If stale or empty:** run Step 1a (source refresh) before proceeding
4. **If current:** on Friday or Saturday, run Step 1b (placeholder re-check) before proceeding to Step 2. On Sunday, skip straight to Step 2 — by Sunday, a source that hasn't posted yet almost certainly won't before the weekend is over, so re-querying it isn't worth the round trip.

#### Step 1a — Source refresh (replaces Notion content)
Search and fetch all 8 sources for the current week. Verify each is current before including.

| Source | Type | How to find |
|---|---|---|
| **Buletin de București** | Article, publishes Thu/Fri | Search `buletin.de/bucuresti` for *Agenda Urbană cu Cosmin* current week. URL pattern: `.../agenda-urbana-cu-cosmin-buletin-recomandari-culturale-pentru-[DD-DD-luna]/`. If not yet indexed, try fetching the URL directly using the pattern. |
| **HotNews** | Article, publishes Thu/Fri | Search `hotnews.ro` for *Weekend trending în București* current week. |
| **B365** | Article, publishes Thu or earlier | Search `b365.ro` for *București de weekend* or *Ce facem în weekend în București* current week. |
| **Curatorial** | Article, publishes Thu/Fri | Fetch directly: `curatorial.ro/arta/recomandarile-curatorial-pentru-weekendul-[DD-DD-luna]/` |
| **Zile și Nopți** | Aggregator, always current | Fetch directly: `zilesinopti.ro/evenimente-bucuresti-weekend/` — no search needed |
| **Recomandata** | Newsletter (Scena9/Fundația9), publishes Thu | Fetch `recomandata9.substack.com` to find the latest issue link, then fetch the article. Covers current week + upcoming events. Curated, editorial, highly relevant to Gabriel's taste. |
| **Harta Muzeelor / Weekend Sessions** | Aggregator, always current | Fetch directly: `hartamuzeelor.ro/recomandari.html` — stable URL, no search needed. Focus: museums, galleries, guided tours, workshops, concerts in cultural venues. |
| **Eventbook** | Box office, always current | Fetch `eventbook.ro/program/elvirepopesco` (and `eventbook.ro/program/cinema-pro` when relevant). **The authority for art-house film** — it's the actual box office for the cinemas Gabriel goes to, so it gives the real title, the real showtime and a bookable link rather than a listing someone retyped. Use it to CONFIRM or correct any film another source mentions, and as a discovery source in its own right for `movie`. Also carries concerts and theatre worth a look. |

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
3. Additionally search online for events covering the current day, rest of the week, and the approaching weekend. Use the same 8 sources plus general cultural search (gallery openings, cinema listings, club nights, etc.).
4. Merge all three streams — Notion articles + Zile și Nopți + web search — into a single event pool before filtering and producing the digest.
5. Do not update Notion in weekday mode unless it is clearly empty or stale.

---

## Step 1c — Marquee's watched venues (unconditional, read before Step 3)

Runs every time, regardless of weekday/weekend mode — this is what keeps this skill and
Marquee from ever recommending the same night twice.

Query the **Marquee — Watched Venues** database for every row where `Status` = `active`:

| Resource | ID |
|---|---|
| Marquee — Watched Venues database | `7c2ed57e41b74660868f014e9965ff19` |
| Marquee — Watched Venues data source | `ac321743-03da-4939-ab84-8ca7ef9653b3` |

A venue counts as **actually covered by Marquee** — and is excluded here — only when,
**in addition to `Status` = `active`**, its `Adapter` is set to something other than
blank or `unsupported`. Marquee's own scheduled check (`api/_lib/marquee/serverScan.js`)
applies this exact same second condition before treating a venue as read. Skipping it
here would mean a venue marked `active` with no working reader attached gets excluded
from this skill too — covered by neither system, a pure gap. Build the excluded set from
`Name`, matched case- and diacritic-insensitively (so "Cinema Union" and any stray
capitalisation/diacritic variant of it match the same entry).

**This is the whole mechanism — there is no separate list to maintain, in this file or
anywhere else.** The set is read fresh from Marquee's own Notion database every single
run, so adding a venue in Marquee, pausing one, or removing one changes what this skill
excludes on its very next run. Nothing here needs editing when Marquee's venue list
changes, which is also what makes this file safe to push once and leave alone — Step 1c
always reflects what Marquee is doing *today*, not what it was doing when this file was
last edited.

**The carve-out — don't let a venue match quietly erase coverage Marquee doesn't actually
have yet.** Marquee caps `movie`-category venues (Cinema Europa, and any other cinema
added the same way) to a **10-day scan horizon** (MARQUEE.md §9.9) — deliberately, since
advance notice on daily showtimes isn't useful there. A genuinely exceptional, far-future
booking at one of those venues — a festival strand, a retrospective, a guest season
announced weeks out — will not appear in Marquee that early. If a source names something
at an excluded venue that reads as a one-off special booking clearly outside its everyday
rotation, rather than an ordinary showing or concert night the venue runs all the time,
still include it here — note in `Summary` that it's at a Marquee-covered venue, so it's
easy to spot as a duplicate later if Marquee itself picks it up once the date comes into
range. Ordinary, everyday programme items at an excluded venue are exactly the case this
step exists to drop; leave those out.

---

## Step 2 — Fetch and parse all sources

**Reuse, don't re-fetch.** On a weekend-mode run where Step 1a or 1b already
fetched a source this run (Buletin, HotNews, B365, Curatorial, Zile și Nopți,
Harta Muzeelor), parse events out of the content already retrieved — do not fetch
the same URL a second time just because this step also mentions it. This step
only needs a fresh fetch for a source Step 1 didn't touch this run (e.g. weekday
mode, or a source Step 1 only linked without reading in full).

For each article linked in Notion (or found via search in weekday mode) that
wasn't already fetched in Step 1 this run:
- Fetch the full article
- Extract individual events: name, date, time, venue, category, price if available

Also always parse Zile și Nopți's structured event list by category — fetch it
directly only if Step 1 didn't already retrieve it this run.

**No Facebook sweep, and no Instagram sweep either.** Facebook event pages
reliably fail to fetch (login wall, even when public) and search-engine coverage
of them is thin and stale — tested 2026-08-28 across Google, Bing and DuckDuckGo,
none returned usable live results. Instagram was tested the same day as a possible
replacement and did marginally better (search snippets of individual `/p/` posts
sometimes carry real dates), but Gabriel decided not to adopt it for now — don't
add an Instagram sweep here without him asking for it again.

**Never include an event — from any source — that is online-only.**
A livestream, a webinar, a virtual screening, a Zoom talk, an Instagram Live: none of
these are something to physically go to in Bucharest, which is the entire premise of
this skill. A hybrid event (in-person **with** a stream alongside it) is fine and
should be included as normal; it's the stream-only ones that never belong in this
digest or in Radar.

Build a unified event pool. Deduplicate — same event cited by multiple sources = one entry with a richer description.

---

## Step 3 — Filter by Gabriel's preferences

### Always exclude
- **Venues Marquee already reads** — the set built in Step 1c, subject to that step's
  carve-out for exceptional far-future bookings at movie-horizon venues
- Sala Palatului
- Teatrul Nottara
- MINA
- Teatrul Bulandra
- Opera Națională
-Tur Pietonal
-FF Theatre
-The Fool
- Opereta
- **Palatul Mogoșoaia** (all galleries/courtyard programming there) — ignore permanently
- **Manasia Hub** — ignore permanently
- **Teatrul În Culise** — ignore permanently
- **Platforma Wolff** — ignore permanently
- **Ateneul Român** — ignore permanently
- Generic corporate events, trade fairs, business conferences (sales, marketing, etc.)
- Mainstream pop/commercial concerts at large arenas unless genuinely exceptional
- **Online-only events** — livestreams, webinars, virtual screenings, anything with no
  physical Bucharest venue to walk into. A hybrid event that's in-person **and**
  streamed stays included.

### Always include (high priority)
- **Contemporary and experimental art exhibitions** — this is the core
- **Arthouse cinema:** Elvire Popesco, Cinema Europa, Apollo, MȚR, Cinema Pro, open-air screenings. Also flag exceptional commercial releases worth seeing (animated, prestige, foreign-language)
- **Live music:**
  - *Primary:* jazz & improvisation, contemporary/experimental/chamber music, indie/alternative/rock, folk/singer-songwriter
  - *Secondary:* electronic/club nights at venues like Control, Guesthouse, Quantic — include if the act is noteworthy, not as filler
- **Performance in hybrid/alternative spaces:** Control, Guesthouse, Cărturești, galleries, residences, site-specific
- **Book launches, author signings, literary events**
- **Cultural and social conferences** (art, urbanism, design, philosophy, social topics — not business)
- **Street fairs and open-air markets with cultural character** (Street Delivery, Bazar Cotroceni-style)
- **Guided tours, urban exploration, heritage walks**
- **Newly opened venues — always flag with 📍 NEW VENUE**

### Also include — these were being under-collected
- **Gallery openings and vernisaje of any size**, including one-evening ones
- **Artist talks, portfolio nights, studio visits, open studios**
- **Independent theatre and dance** outside the big houses (Apollo111, CNDB, Linotip, POINT)
- **Film clubs, cinemateca screenings, embassy/institute programmes** (Institut Francais, Goethe, Cervantes, Institutul Polonez, British Council)
- **University and institute public lectures** on art, architecture, urbanism, philosophy
- **Record fairs, zine fairs, print sales, artist-book launches**
- **Neighbourhood and community events with cultural character** — courtyard concerts, garden screenings
- **Late openings / night-at-the-museum programmes**
- **Anything at a venue already on the include list**, even if the event itself sounds small

### Include lightly (label clearly, max 1–2 per digest)
- Mainstream events with broad appeal — group at the bottom under **„De știut"** so Gabriel can skip easily

### No volume ceiling
There is **no cap per source and no cap per article.** If Buletin's roundup names
eighteen things worth going to, all eighteen are candidates. An earlier run returned
only ~10 events in total, which is a collection failure rather than an accurate
picture of the city — even a slow August week has more than that once galleries
and institutes are actually swept.

**Aim for 20-35 events written to Radar per run.** The digest still shows the best
12-20 (Step 5), but Radar gets everything that passed the taste filter — the app's
lenses and filters are what make a larger pool browsable, so withholding events from
Radar to keep the digest tidy is backwards.

If a run yields fewer than 15, treat that as a signal you have not finished
collecting: go back for the gallery / institute sweeps before writing.
Never pad with events you would otherwise exclude — quality is still the filter;
**breadth of search** is what changes, not the bar.

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

**Check Radar before spending any enrichment searches.** Build each entry's `Key`
now (Step 4's `venue-slug:date:title-slug` format) and run **one batch query**
against Radar for every `Key` in this run's pool, covering the whole date range at
once — not a query per event. For any match that is already `Confidence: confirmed`
and was `Checked` within the last 3 days, **skip its Link/Address/Cost/Image
searches entirely** — that row is already as good as this step would make it. Just
carry its existing values forward, append today's source to `Sources`, and refresh
`Checked` when you write it in Step 4. Everything else — no match, an `uncertain`
or `reported` match, or a `confirmed` match that's gone stale — gets the full
enrichment pass below. This is what makes a same-day or next-day re-run cheap
instead of re-searching a pool that was already nailed down.

**Enrich each surviving entry that isn't already covered above** — do this once,
here, for the whole pool. Both Step 4 (Radar) and Step 5 (the digest) read these
results rather than re-deriving them:
- **Links — MANDATORY, one web search per event, no exceptions.** For every single
  surviving entry, run a real search for that event's OWN page (e.g. `"[titlu
  eveniment]" [venue]`, or `[festival name] site oficial`) — official
  venue/museum/gallery page, festival site, ticket platform (iaBilet, Eventbook,
  Bilet.ro), or the organizer's event page. Skipping this for an event because the
  roundup "didn't mention a link" is the single most common way this step gets
  dropped: the absence of a link in the article is the REASON to search, not a
  reason not to.
  - If the Notion-linked article already names the direct link, use it — no need to
    re-search.
  - **Eventbook (`eventbook.ro`) first for film, and worth checking for concerts.**
    Gabriel knows the site and prefers it for movies. It is the box office for the
    art-house cinemas he actually goes to — Elvire Popesco, Cinema Pro, Cinemateca —
    so for anything with category `movie` search Eventbook before anything else:
    `eventbook.ro/film/bilete-[titlu-slug]`, or the venue's programme at
    `eventbook.ro/program/[venue-slug]` to find the film's own booking page. A
    hit there gives the exact showtime AND the ticket link in one go, which is
    two of Step 3b's other fields for free. Use `Tickets` for the Eventbook URL
    when `Link` already holds the film's own page; when there is no better page,
    Eventbook IS the `Link`. iaBilet and Bilet.ro remain fine for concerts and
    theatre.
  - **A roundup or section page is never an acceptable `Link`.** `b365.ro/timp-liber/`,
    `zilesinopti.ro/evenimente-bucuresti-weekend/` and the like are pages listing
    forty other things; as an event's `Link` they answer no question you would ask
    of that row six months later. They belong in `Sources`, which is exactly what
    `Sources` is for, and nowhere else.
  - **A venue's PROGRAMME page is the worst case of this and is never a `Link`.**
    `cinemagia.ro/program-cinema/elvire-popesco-bucuresti/`,
    `eventbook.ro/program/[venue]` and every "what's on at X" schedule **rewrite
    themselves daily**, so a row pointing at one is guaranteed to stop matching —
    Gabriel opens it a day later and the film simply isn't there. This has already
    happened once (`Comatogen`, 2026-08-26). Use the FILM's or event's own page
    (`cinemagia.ro/filme/[titlu]-[id]/`, the Eventbook booking page) and cite the
    programme page in `Sources` with the date you read it, which is what the
    `│ YYYY-MM-DD` field on a `Sources` line is for.
  - If a genuine search turns up nothing, **leave `Link` blank** rather than
    guessing, fabricating, or falling back to the article.
  - **Radar-B will not fill this in for you.** The app has no fetcher and does not
    scrape (RADAR_B.md §2), and as of 2026-08-26 its save-to-Wanderlist draft no
    longer backfills `Link` from the first source URL — precisely because that
    silently pushed roundup URLs into Wanderlist's `Findings`. This search is the
    ONLY place an event link can enter the system.
- **Times:** include exact times when available. Never invent one — a bare date with no
  stated time stays a bare date.
- **Date RANGES obey the same rule as times: never invent one.** A `When` end date
  means a source stated a run ("până pe 30 august", an exhibition's closing date,
  a festival's advertised span). Seeing a title on today's cinema programme tells
  you it plays TODAY and nothing whatsoever about tomorrow — do not turn it into a
  five-day run because a run seems likely. This is not cosmetic: Radar-B derives
  `long-run` from the span, and a run of eight days or more is presented as "se
  vede oricând" / "see it anytime", pulled out of the day stream and ranked down.
  An invented range therefore tells Gabriel to take his time about something that
  may be gone tomorrow. When only one date is attested, write that one date.
- **`confirmed` means you read the event's OWN page.** A cinema programme, a
  listings aggregator or a roundup is `reported` at best. If the only evidence is
  a schedule page, and especially if the venue's own box office (Eventbook for the
  art-house cinemas) does NOT list it, the row is `uncertain` — Radar-B renders
  that as a visible "verifică înainte să pleci de acasă" warning, which is exactly
  what it is for. `Comatogen` (2026-08-26) was written `confirmed` off a programme
  page that no longer listed it and that Eventbook never did.
- **Addresses:** always include the full street address — required for Wanderlist
  geocoding and for Radar-B's Maps link. If unknown, write the neighborhood or landmark
  instead and flag it as approximate. **Never leave this blank** — a bare "București"
  guess is still more useful than nothing, and Step 4's pre-write check (below) will
  catch a genuinely empty one.
- **Prices:** include in lei if stated by any source. Never guess. When the event
  carries (or will carry) the `ticketed` signal, the same page you're already
  opening for the `Link` search usually shows the price right there — read it off
  that page rather than treating `Cost` as a separate search. Only leave it blank
  when the ticket page itself doesn't state one.
- **Image:** while you're on the event's own page for the `Link` search, grab its
  poster/hero image URL if the page exposes one in the markup — no separate search
  for this. Skip it rather than guessing or using a generic venue photo.
- **Organizer:** the presenting institution or promoter, when the source names one
  (ARCUB, a specific gallery, a festival's organizing body, Recomandata as curator).
  Skip if no source actually names one — don't infer the venue as the organizer.

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
| `Organizer` | rich text | The presenting institution or promoter, when a source actually names one. Leave blank rather than inferring the venue as the organizer. |
| `Sources` | rich text | **Provenance, one mention per line:** `Curatorial │ https://… │ 2026-08-21`. Prefix a line with `*` when that source *recommended* the event rather than merely mentioning it. This is the field that lets Radar-B show "also mentioned by B365" and "recommended by Recomandata" — the whole point of Step 3b's dedupe surviving into the app. |
| `Confidence` | select | `confirmed` (read off the event's own page) · `reported` (an editorial roundup) · `uncertain` (just a title and a date inside an article). Be honest here — Radar-B dims uncertain events and says so in words. |
| `Checked` | date | Today. Drives Radar-B's staleness notice. |
| `Key` | rich text | `venue-slug:date:title-slug`, e.g. `control-club:2026-08-21:trio-nocturn`. Stable across runs, diacritics folded, lowercase. |
| `Dismissed` · `Dismissed At` | checkbox · date | **Owned by the Radar-B app — never write these.** They carry Gabriel's own "hide this", synced across his devices. Writing them from here would resurrect things he deliberately hid. |

### Write rules

1. **Update and ENRICH, never skip and never duplicate.** Use the batch `Key`
   lookup already run at the start of Step 3b — don't re-query per row here, that
   lookup already told you which Keys exist.
   - **No match** → create the row.
   - **Match** → do NOT skip it. Re-read what you just gathered against the stored
     row, field by field, and **patch anything that is now better**:
     - a `When` that gained a real time, or an end date you didn't have
     - a fuller `Address` (a bare venue name upgraded to a street address)
     - a `Link` that is now the event's own page rather than a roundup article
     - a `Tickets` URL, an `Image`, an `Organizer` you didn't have
     - a longer/clearer `Summary` — replace it only if genuinely more informative
     - a `Cost` that is now stated
     - new `Signals` (it turned out to be free, or sold out)
     - **always** append the new mention to `Sources` and refresh `Checked`
   - **Upgrade `Confidence`** when you now have the event's own page
     (`reported` → `confirmed`). Never downgrade it.
   - **Never overwrite a good value with a worse one.** A stored exact time is not
     replaced by a vaguer one; a stored street address is not replaced by a bare
     venue name; a stored direct link is not replaced by an article. When the new
     value is merely *different* rather than better, keep what's there.
   - **Never touch `Dismissed` or `Dismissed At`.** Those two columns belong to the
     Radar-B app (they carry Gabriel's own "hide this", synced across his devices).
     Patching them from here would resurrect things he deliberately hid.

   A second article about an event you already know is an opportunity, not a
   no-op — it is usually where the exact time and the ticket link finally appear.
2. **One row per underlying event, not per mention.** Four sources covering one exhibition is one row with four `Sources` lines.
3. **Write the whole deduped pool**, including what will become the "Pe radar" and "De știut" sections of the digest — Radar-B's lenses and filters are what let Gabriel ignore them, so they don't need to be withheld here.
4. **Bulk writing is fine here** (unlike Wanderlist intake, which is one at a time on confirmation). Radar is a research surface Gabriel browses, not his personal list — nothing lands in his own world until he saves it in Radar-B.
5. **Never delete rows** for events that have passed. Radar-B hides past events itself, and the history is worth keeping.
6. **Keep a running count** of rows created and rows updated as you go — Step 5's closing line reports it.
7. **Before finishing Step 4, check `Link`, `Address`, and `Cost`/`Signals` across
   every row you created or updated this run** — not just `Link`. Each should
   either carry a real value or be knowingly blank after a genuine search found
   nothing; a `Link` shouldn't still hold a roundup URL (move it to `Sources`,
   put the real page in `Link` or blank it), an `Address` shouldn't be empty (see
   Step 3b — write an approximate one rather than nothing), and a row with a
   `ticketed` signal shouldn't have a blank `Cost` unless the ticket page itself
   didn't state one. A run that wrote ten rows with several blank on any of these
   hasn't finished Step 3b's enrichment — go back rather than writing the digest.

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
📡 [N] evenimente în Radar ([C] noi, [U] actualizate).
💡 Spune numărul sau titlul prescurtat și adăugăm în Wanderlist.
```

**This closing line is not decorative — it is the confirmation that Step 4 actually ran.**

- `📡` — fill `[N]`, `[C]` and `[U]` with the real counts kept during Step 4. If
  Step 4 didn't run or Radar wasn't reachable, say so plainly (`📡 Radar
  indisponibil — nu s-a scris nimic.`) rather than dropping or guessing the line.

A digest missing this line, or carrying a suspiciously round guessed number, is an
incomplete run.

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
| Marquee — Watched Venues database (Step 1c) | `7c2ed57e41b74660868f014e9965ff19` |
| Marquee — Watched Venues data source (Step 1c) | `ac321743-03da-4939-ab84-8ca7ef9653b3` |
| Quick Notes DB | `aa4d3e6d-60db-830b-b6e4-8189907a1580` |
| Quick Notes data source | `776d3e6d-60db-83c4-863c-074672829a42` |
| Wanderlist (Findings) collection | `b78c25e5-e152-4031-adf7-34950d211d7f` |