# Wanderlist — app notes

🗺️ A friendlier second doorway to a Notion database of city things-to-do (events,
culture, art, movies, venues, ideas). A **triaged backlog** you browse and mark **Attended**
without losing anything, **plus a month calendar** (M2) plotting Planned Dates and
Expiring deadlines — and **one email reminder the day before an item's `Date Expiring`**
closes.

Lives at `src/wanderlist/`, entry `wanderlist-react.html`, guide
`public/wanderlist-guide.html`. React + Vite + Notion.

**Notion paperwork** (per the Dev Conventions): a **Wanderlist — App Spec** lives under
Dev → App Specs (front-matter, schema, architecture, and an "AI-assisted capture" section
for deriving a new entry from a pasted link/text); a de-personalized **Starter Template**
database lives under Dev → Starter Templates → Wanderlist, linked from the guide's
Connect-Notion section. Unlike Journal of Delights/Sol Odyssey, the *live* database
(`Findings`) is not under Dev → App Databases — it's the owner's pre-existing personal
list under **My events**, predating the app; the spec links to it in place instead of
relocating it.

## Design-system note (deliberate deviation)

The repo rule is "new apps build on `src/ds/`." Wanderlist **intentionally does not** — it
is self-styled with its own token vocabulary in `src/wanderlist/wanderlist.css`, mirroring
**Journal of Delights** (`src/journal/`), because the brief was to look and feel close to
JoD (which is a legacy, self-styled app) while staying distinct. It imports only from
`src/shared/` (never `src/ds/`), so it passes `src/ds/boundary.test.js`. The registry
`ds: true` flag is set only to suppress the "Legacy" badge (it's a current-gen app, not
legacy); it does **not** mean it consumes the design system.

Identity: Wanderlist keeps its **own typography and layout** (Fraunces / Inter / JetBrains
Mono, an "atlas" masthead) but uses **JoD's full theme system** — the same six palette
presets (Solarized dark/light, Octagon, Quiet Light, Spectrum, Sun) and the header
cycle button — brought over per request "as close to the original as possible"
(`theme.js` + the palette blocks in `wanderlist.css`). Default preset: Solarized dark.

## Architecture (mirrors Journal of Delights)

- **BYO Notion token + database**, stored only in the browser, relayed through the shared
  `/api/notion` proxy (classic API version `2022-06-28`). No token ⇒ **demo mode** on
  fixtures (`src/wanderlist/fixtures.js`).
- Clients: `notionClient.js` (live) wrapped by `offlineClient.js` (localStorage read-cache
  + write-outbox, flush on reconnect); `fixtureClient.js` for demo. `store.js` picks.
- Pure logic (tested): `notion.js` (Notion⇄model mapping), `search.js` (status/search/sort
  `triage`), `dates.js` (expiry + past/planned-slipped helpers), `stats.js` (forecast
  counts + Category/Tags/Place frequency ranking), `theme.js`.
- UI: `App.jsx` shell → `MenuBar` (List/Calendar switcher · search · To-do/Attended/All
  filter · sort · Add, left-packed and right-packed respectively around a spacer · ⋯ for
  Stats/theme/guide/settings) → `ListView` / `CalendarView` / `EntryView` / `EntryEditor`
  / `SettingsModal` / `StatsModal`. `ChipInput` (Category single, Tags multi), `PlaceInput`
  (Google autocomplete — sticks on re-edit, never re-searches an already-resolved saved
  value), `MetaChips` (Category/Place/Tags chips, tap to filter, Category carries a small
  type icon via `categoryIcons.js`), `share.js` (OS share sheet / clipboard fallback,
  text-only).

**List behaviour:** the last view, status filter, and sort persist across reloads
(`store.js`'s `loadViewPrefs`/`saveViewPrefs`). The default Expiring-first sort sinks
already-expired, unattended items below a **past** divider instead of floating them to
the top (`search.js`'s tiered `expRank`). Tickets on file mark an item **paid** — shown
in the list row's right rail (Link · Paid · Attended, top to bottom, always visible
on/off) and echoed on the calendar (see below).

## Notion database schema

App model: `{ id, name, description, link, category, place, placeUrl, tags[], attended, going,
dateAdded, dateExpiring, plannedDate, plannedTime, photo, tickets[] }`. Notion properties:

| Property | Type | Notes |
|---|---|---|
| `Name` | title | |
| `Description` | rich_text | chunked to Notion's 2000-char limit |
| `Link` | url | the event page |
| `Category` | **select** | single, extendable inline, **always lowercase** (normalized on read + write) |
| `Place` | **rich_text** | resolved place name (see below) |
| `Map` | **url** | Maps pin link for the place |
| `Tags` | multi_select | freeform, **always lowercase** (normalized + deduped on read + write) |
| `Attended` | checkbox | |
| `Going` | checkbox | added M2.1 — "have I decided to go", separate from `Attended`'s "did it happen". Only meaningful once a `Planned Date` exists; the editor only shows the toggle then, and clearing the date clears `Going` too. Lets you track a concert's date/time while still undecided about attending. |
| `Date Added` | date | app stamps on create |
| `Date Expiring` | date | the deadline to act — drives the reminder, expiry pills, and the calendar's Expiring marker |
| `Planned Date` | date (optional) | the day you plan to go — drives the calendar's Planned marker (renamed from `When` in M2). Optionally carries a **start time** too (no end time) — the app model splits it into `plannedDate`/`plannedTime`, but on the wire it's one Notion date property: a bare day when no time is set, a full ISO datetime (this browser's UTC offset) when it is. `Date Expiring` never carries a time, deadline-only. |
| `Photo` | **files** (M3) | at most one picture — a poster, a photo you took |
| `Tickets` | **files** (M3), multi | ticket PDFs/screenshots, shown separately from Photo |

**Note:** the `Tags` option `going` (a leftover from an earlier, weaker attempt at this same
distinction) was removed from the multi_select vocabulary when the `Going` checkbox was added
— it was never applied to any page, so no data migration was needed.

**Migration from the original "Findings" DB:** `Place` was Notion's native geo/`place`
type, which the classic API can't write — it was converted to **rich_text**, and **`Map`
(url)** + **`Tags` (multi_select)** were added. `When` is optional. Category and Tags select
options were renamed to lowercase in place (Notion options are identified by id, not string,
so renaming an option retroactively re-labels every page that references it — no per-page
edits needed for existing data).

### Category/Tags casing (enforced in `notion.js`)

Both are normalized to lowercase on **every read and write** (`normalizeTag`/
`normalizeCategory` — currently the same function; kept as two names in case they ever
diverge). Tags are also deduped case-insensitively on write. This is a data-layer rule, not
just UI polish — it means a value typed in mixed case anywhere (the app, or directly in
Notion) settles to one canonical casing, so `"Free"` and `"free"` can never fork into two
separate filter chips.

## Place search (Google Places, optional)

`PlaceInput` → `/api/places` proxy (holds `GOOGLE_PLACES_KEY` server-side; Places API New).
`autocomplete` as you type, `details` on pick → stores name in `Place` + Maps link in
`Map`. **Degrades to a plain text field** (stores what you type) when the key is unset,
the request errors, or you're offline — Place is never a hard dependency.

## Email reminder (Vercel Cron + Resend + KV)

Unlike the other apps' *local* notifications, this is a **server-side** email so it lands
with the app closed.

- **Cron:** `vercel.json` runs `GET /api/wanderlist-remind` daily (`0 6 * * *`, ~morning
  Bucharest). It reads prefs, queries Notion for items whose `Date Expiring` == **tomorrow
  (Europe/Bucharest)** and `Attended` == false, and sends one digest via **Resend**.
- **Pure rule** in `api/_lib/reminders.js` (`selectExpiring`, `zonedTomorrowKey`,
  `buildReminderEmail`) — unit-tested in `api/_lib/reminders.test.js`.
- **Prefs** (`{ enabled, email, name }`) live in **Upstash Redis** (`api/_lib/kv.js`, Upstash
  REST via fetch — no npm dep), written from Settings via `/api/wanderlist-reminders`,
  **gated by the Notion token** (only someone with the token can change where mail goes).
  Falls back to `REMINDER_EMAIL` / `REMINDER_NAME` env if KV is absent.

### One-time server setup (env vars)

```
WANDERLIST_NOTION_TOKEN   integration token, shared with the DB (server-side copy for the cron)
WANDERLIST_DB_ID          database id to query
RESEND_API_KEY            Resend key
REMINDER_FROM             verified sender, e.g. "Wanderlist <onboarding@resend.dev>"
CRON_SECRET               (optional) Vercel adds `Authorization: Bearer <secret>` to cron calls
GOOGLE_PLACES_KEY         (optional) enables Place autocomplete
KV_REST_API_URL / _TOKEN  auto-added when you create a Vercel KV store
```

Dry-run (no send): `GET /api/wanderlist-remind?dryRun=1` (carry `?secret=<CRON_SECRET>` if
set) returns the composed email + matched items.

**Send test reminder** (Settings, next to Save) hits the same endpoint with `?test=1`
instead — gated like `wanderlist-reminders.js`'s writes (an `x-notion-token` header must
match the server's `WANDERLIST_NOTION_TOKEN`, so only whoever holds the token can trigger
it), bypasses the `enabled` toggle, and **actually sends** rather than dry-running. If
nothing is genuinely expiring tomorrow it emails one placeholder item instead, so the
button always produces a real message to check end-to-end.

## Calendar (M2, shipped)

`CalendarView.jsx` — a Monday-start month grid. Each day box shows up to **three markers**:
a **Planned** dot (`--blue`, from `plannedDate` — **hollow** when undecided, **filled solid**
once `Going` is checked on at least one of that day's entries), an **Expiring** dot (`--red`,
from `dateExpiring`), and a **Paid** dot (`--green`, an entry with tickets on file — rides
whichever date the entry itself lands on, planned first then expiring, since tickets have
no date of their own). Selecting a day opens an **agenda panel** beneath the grid listing
that day's entries — both Planned-Date and Date-Expiring matches, each labelled with a
Planned/Going pill (green once `Going` is checked, blue otherwise), a Paid pill (green, next
to it, when tickets are on file), and/or an expiry pill — tap one to open the full entry.
The List⇄Calendar toggle lives in the menu
bar; the calendar respects the status segment + search (so markers reflect To-do/Attended
and any filter) but not the list sort. **Attended items only ever light up a dot on a day
already past** — even with the status set to "All", a done thing's planned/expiring date
no longer means anything going forward, so it's suppressed from today/future days (a day
already past keeps the dot, as a quiet record of what happened). Grid/marker/agenda
helpers are pure in `dates.js` (`monthGrid`, `stepMonth`, `entriesOnDay`, `rolesOn`) and
unit-tested; the attended-suppression rule itself lives inline in `CalendarView.jsx`'s
marker `useMemo` (component-level, not a `dates.js` helper, since it needs `today`).

## Stats (shipped)

`StatsModal.jsx` (off the ⋯ menu, `stats.js` for the pure computation) — a
**forward-looking-only** snapshot: attended items carry no weight anywhere on this screen,
same as everywhere else. Six count cards (fill two complete 3-column grid rows, so no span
card interrupts them and leaves a dangling empty cell): total active, expiring within 7
days, past due and still open, planned within 7 days, no deadline yet, already paid for —
then a full-width "next up" card (soonest still-open deadline), then two heat-chip cards:
Category + Tags merged onto one (same pairing `MetaChips` uses on an entry), and Place
("where") on its own. Every chip taps straight into a filtered search, same gesture as a
chip on an entry itself, and closes the modal.

## Sharing (shipped)

`share.js` + a single **Share…** button in `EntryView`, on the same row as Open link /
Open in Maps. Uses `navigator.share()` where available (surfaces WhatsApp, Email, and
whatever else the device offers) and falls back to a clipboard copy — deliberately just
the one button, since the OS sheet already covers the per-channel cases a WhatsApp/Email
button pair would otherwise duplicate. Text only: name, note, place, links — no
attachments, no app metadata (dates/category/tags/attended/paid aren't part of what
you're telling someone about).

## Photo + Tickets (M3, shipped)

Reuses Journal of Delights' file-upload pipeline almost verbatim (`photo.js`'s client-side
resize, `api/notion-upload.js`'s multipart relay — both already generic/shared, so no new
serverless function was needed) plus one new piece for the multi-file case:

- **Photo** (`PhotoField.jsx`) — at most one, mirrors JoD exactly: pick → resize (max 1600px
  edge, JPEG 0.82) → upload immediately → attach on Save. Shown as a poster panel in the
  detail view (tap → `Lightbox.jsx`, full size) and a small thumbnail in list rows.
- **Tickets** (`TicketsField.jsx`) — multiple files (PDF or image), kept as a **separate**
  field from Photo. Each pick uploads immediately (multi-select supported); the *whole* set
  is written to Notion in one PATCH on Save — Notion's Files & media property has no "append"
  verb, every write replaces the array. `notion.js`'s `toTickets`/`ticketWriteEntry` handle
  this: existing tickets carry a `fileUploadId` (the durable handle Notion's 2025-09-03 File
  Upload API exposes) that lets them be re-included without re-uploading bytes; anything
  without one (rare — e.g. attached outside the app) falls back to its just-fetched signed
  url as an `external` reference, safe only because the write happens within the same short
  editor session it was read in. Shown as a "tickets · paid" section (linked, downloadable)
  in the detail view; having any also flips the item to **paid** everywhere else (list rail,
  calendar dot + agenda pill — see above).
- Both require a live connection (same as JoD's photo) — no offline queueing for uploads.

## M4+ (parked)

- Richer reminders (configurable lead time, weekly digest); paste-a-link autofill; a
  week/agenda calendar layout.
- **Not** a map view — considered, then explicitly ruled out for good (a Places link +
  "Open in Maps" already cover it; the app isn't meant to become a real map product). If
  this is revisited, that's a deliberate reversal of a standing decision, not a default.
