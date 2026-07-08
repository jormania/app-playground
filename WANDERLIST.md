# Wanderlist — app notes

🗺️ A friendlier second doorway to a Notion database of city things-to-do (events,
culture, art, movies, venues, ideas). A **triaged backlog** you browse and mark **Attended**
without losing anything, **plus a month calendar** (M2) plotting Planned Dates and
Expiring deadlines — and **one email reminder the day before an item's `Date Expiring`**
closes.

Lives at `src/wanderlist/`, entry `wanderlist-react.html`, guide
`public/wanderlist-guide.html`. React + Vite + Notion.

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
  `triage`), `dates.js` (expiry helpers), `theme.js`.
- UI: `App.jsx` shell → `MenuBar` (status segment · search+scope · sort · Add · theme ·
  guide · settings) → `ListView` / `EntryView` / `EntryEditor` / `SettingsModal`.
  `ChipInput` (Category single, Tags multi), `PlaceInput` (Google autocomplete),
  `MetaChips` (Category/Place/Tags chips, tap to filter).

## Notion database schema

App model: `{ id, name, description, link, category, place, placeUrl, tags[], attended,
dateAdded, dateExpiring, plannedDate, photo, tickets[] }`. Notion properties:

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
| `Date Added` | date | app stamps on create |
| `Date Expiring` | date | the deadline to act — drives the reminder, expiry pills, and the calendar's Expiring marker |
| `Planned Date` | date (optional) | the day you plan to go — drives the calendar's Planned marker (renamed from `When` in M2) |
| `Photo` | **files** (M3) | at most one picture — a poster, a photo you took |
| `Tickets` | **files** (M3), multi | ticket PDFs/screenshots, shown separately from Photo |

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

## Calendar (M2, shipped)

`CalendarView.jsx` — a Monday-start month grid. Each day box shows up to **two markers**:
a **Planned** dot (`--blue`, from `plannedDate`) and an **Expiring** dot (`--red`, from
`dateExpiring`). Selecting a day opens an **agenda panel** beneath the grid listing that
day's entries — both Planned-Date and Date-Expiring matches, each labelled with a Planned
pill and/or an expiry pill — tap one to open the full entry. The List⇄Calendar toggle lives
in the menu bar; the calendar respects the status segment + search (so markers reflect
To-do/Attended and any filter) but not the list sort. Grid/marker/agenda helpers are pure in
`dates.js` (`monthGrid`, `stepMonth`, `entriesOnDay`, `rolesOn`) and unit-tested.

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
  editor session it was read in. Shown as a "tickets" section (linked, downloadable) in the
  detail view and a small paperclip-style count badge in list rows.
- Both require a live connection (same as JoD's photo) — no offline queueing for uploads.

## M4+ (parked)

- Richer reminders (configurable lead time, weekly digest); paste-a-link autofill; a map
  view of Places; a week/agenda calendar layout.
