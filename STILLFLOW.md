# Stillflow — Find your practice.

A personal yoga companion built around Yoga With Adriene, designed so other
instructors can be added later. It turns a pile of YouTube videos into a
classified, searchable library. You choose a session by time, body area and
mood, practise it in the YouTube app, then come back and record it.

Strict TypeScript on `src/ds/`. Entry: `stillflow-react.html` → `src/stillflow/main.tsx`.
Listed in `apps-registry.js` (index.html card and The Cabinet) from Release 1.
The release number shows at the foot of Settings (`app/release.ts`).

## Release 4 — 2026-11-20

An audit with the real channel loaded (773 practices), a redesigned progress panel and a
copy pass.

- **Posted on YouTube:** each video's publish date shows on its page and on cards. Explore
  sorts by Newest or Oldest on YouTube, and opens newest first. You can set the date by hand
  in the editor.
- **Progress panel:** a progress ring with the count, the start date and a pace pill. Then an
  Up next card naming the day's theme from its title ("Day 2 · Notice"), its length, and
  Start and Mark done side by side as equal-sized buttons. Complete early and Abandon sit
  in a footer.
- **Audit fixes:**
  - Series re-reading now runs on every load, so sessions imported later (from a file or a
    backup) are placed too. It skips any session whose series you set by hand
    (`series-by-hand` tag).
  - Pace no longer says you're behind on the day you start.
  - Demo records stop being suggested once ten real sessions exist.
  - Settings' session list is capped at 100 rows (type to narrow it).
- **Copy:** every screen's heading now names the screen. Jargon is gone: "Android intent",
  "Confidence: inferred", "Plain https link". The same idea now has the same name everywhere
  (Body area, Goal, Level, Length). Import problems say how to fix them, for example
  "No length: add minutes, like 22 or 22:30".

## Release 3 — 2026-11-20

- **Series days are read correctly from every real title.** The first reader expected one
  title format and capital letters. The channel has used about six formats since 2015
  ("Flow - Day 21 - Curious", "Day 8 - Rest | MOVE - A 30 Day Yoga Journey",
  "Return - 2 - Ground"…), and the reader misfiled "TRUE - Day 12 - CENTER" under CENTER.
  The rule now: the series is the name written right before the day, or, in titles that open
  with "Day N", the last segment. `channel.titles.test.ts` checks all 800 real titles
  (fixture: `lib/__fixtures__/ywa-titles.json`). Every journey day lands in place, and
  nothing else on the channel gets pulled into a series.
- **Ticking a day that has its video in your library records a practice** in My Practice
  (unticking removes it again, with an Undo option). A day without a video is still ticked
  on the series only.
- **One-off repairs on load** (`lib/migrations.ts`): channel sessions get their series re-read
  from the title, and earlier ticks of days now in the library become practice entries on
  the date they were ticked. Both are idempotent.

## Release 2 — 2026-11-20

- **Yoga With Adriene on YouTube** (Settings), only ever on request:
  - **Check for updates** reads the channel's newest uploads and stops at the first page
    of videos you already have.
  - **Import the whole channel** reads every upload (~750).

  Both end in the ordinary import review. Titles, durations and publish dates come from
  YouTube. Style, body area, a provisional intensity, and series + day (MOVE Day 8…) are
  read from the title (`lib/channel.ts`) and marked `inferred` / `low`. Videos under four
  minutes (shorts) are left out.
- **`api/youtube-channel.js`** (the repo's 10th serverless function) reads one page per call:
  - **With `YOUTUBE_API_KEY`** set on the Vercel project: the YouTube Data API v3 uploads
    playlist, with durations. A full import costs about 32 of the free 10,000 daily units.
  - **Without it:** the channel's public RSS feed. That's the 15 newest uploads, with no
    durations, so it can tell you something is new but rarely import it.

  No scraping either way. The worker never caches `/api/`.

## Release 1 — 2026-11-20

The first release, audited the same day.

- **Library:** Discover, Explore (every filter in the brief, plus filtering by repeat interest),
  session pages, the YouTube app hand-off with browser and embedded-player fallbacks, and
  "Did you finish…?" when you come back.
- **Series:** Adriene's January journeys (30 Days of Yoga 2015 … FLOW 2024) and the shorter
  PRANA (2025, 7 days) and RETURN (2026, 4 weeks), plus series you create yourself. You can
  start, tick days, see where you are and your pace, abandon, complete (early if you
  like) and start again. Earlier runs are kept.
- **Repeat interest:** the 1–5 rating means how much you'd like to practise a session again,
  not how good it is. It's drawn as rising steps, not stars. Filter and sort by it.
  "Once was enough" is rarely proposed by Surprise Me.
- **Surprise Me, practice history, collections, import/export, backup/restore**, plus the
  quality-of-life changes from the audit: undo for a deleted entry or a removed collection item,
  adding sessions from inside a collection, hiding a session from suggestions, sharing a session,
  a CSV template, a backup reminder, a request that the browser keep the app's storage, "/" to
  search, Shuffle again, toasts kept above the bottom bar, and an editor whose Back skips the saved form.
- **Audit fixes:** a launch whose session was deleted could leave "Did you finish…?" pending
  forever; recording a practice another way didn't clear the prompt; an empty default
  instructor produced sessions with no instructor; reordering a collection silently dropped
  sessions no longer in the catalogue; sessions hidden from suggestions also vanished from Explore.

## Rules that are easy to break

- **Never invent video metadata.** Import and the editor derive only the canonical
  watch URL and YouTube's `hqdefault` thumbnail from a video id. A missing
  intensity stays `0` ("not classified"), a missing list stays empty, and
  unknown vocabulary values and extra columns are kept with a warning, never
  dropped. Inferred data is labelled in the UI (`ConfidenceNote`).
- **Demo records are not videos.** `data/demo.ts` holds 16 records marked
  `isDemo`, titled "Demo ·", and classified `inferred`/`low`. Their Start Practice opens
  a YouTube *search*. They are seeded once per device (`repo.seedOnce`); once
  deleted they stay deleted, and a reset doesn't bring them back.
- **Catalogue and personal data never share a key prefix.** `sf:v1:session:*`
  vs `user:*`, `history:*`, `collection:*`, `prefs`. A catalogue import, even
  "replace", keeps the existing id, so favourites and history stay attached.
- **Series facts are sourced.** `data/series.ts` holds only the name, year, length and a
  `sourceUrl` per series. No day titles or video ids. A day comes alive when a catalogue
  session carries `series` (matching a name in `match`) and `seriesDay` (or "Day n" in its title),
  or when you link one by hand. Until then it opens a YouTube search.
- **Series progress is derived, not double-entered.** A day is done when you ticked it, or
  when its linked session is in practice history between the run's start and end
  (`lib/series.ts`, `doneDays`). `idle` progress exists only to hold links.
- **Rating = repeat interest** (`REPEAT_LABELS`), never quality.
- **Opening a video never marks it complete.** Start Practice records a
  *pending launch* (localStorage `stillflow:pending`). After 60 s away, the shell
  offers "Did you finish…?", and only the user's confirmation writes history.

## Opening the YouTube app

`lib/youtube.ts`. Start Practice is a real `<a>`, because Android and iOS only
pass a URL to an app on a genuine user tap.

| Platform | Default href | Why |
|---|---|---|
| Android, "Hand to the YouTube app" (default) | `intent://www.youtube.com/watch?v=ID#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=<https URL>;end` | In an installed PWA, other-origin links open in a Custom Tab, and App Link hand-off from there is unreliable. The intent names the app; if the app is missing, Chrome opens the fallback URL. |
| Android, "Plain link" | `https://www.youtube.com/watch?v=ID` | Lets the OS's App Link handling decide. |
| iOS, desktop | `https://www.youtube.com/watch?v=ID` | A Universal Link on iOS; a browser tab elsewhere. |

There is never a `youtube://` scheme. Every detail page also has **Open in
browser instead** (plain https) and **Play here instead** (an embedded
`youtube-nocookie.com` player). Settings → Opening videos has a hand-off
test: paste any link and try the three forms on the device.

## Layout

```
src/stillflow/
  domain/   types.ts (Session, PracticeEntry, …), vocabulary.ts (closed lists)
  lib/      youtube, filter (search/filter/sort + intentions), importExport + csv,
            recommend (Surprise Me), practice (history maths), seeded, download
  store/    repo.ts — the only module that knows about IndexedDB
  app/      router.ts (hash routes), state.tsx (one context, write-through)
  components/  Shell, SessionCard, StartPractice, Sheets (complete / collection), ui
  screens/  Discover, Explore, SessionDetail, Surprise, Series, Practice, Collections,
            Settings (+ ImportPanel), SessionEditor
  data/     demo.ts (marked demo records), series.ts (sourced series list)
  App.test.tsx, __tests__/  use-case tests on an in-memory store; integrity and fuzz tests
```

Storage goes through `src/shared/kvStore.ts` (promoted from The Long Listen),
in an IndexedDB database of its own called `stillflow`. To move to Supabase,
write a `KeyValueStore` backed by it, or a second `StillflowRepo`. Nothing
above `store/` changes.

## Environment

| Variable | Where | Needed for |
|---|---|---|
| `YOUTUBE_API_KEY` | Vercel project env (server only, never sent to the browser) | Importing the whole channel with durations. Optional: without it, Check for updates sees the 15 newest videos. |

To get one: in Google Cloud Console, enable **YouTube Data API v3** in a project (the one
holding `GOOGLE_PLACES_KEY` will do), create an API key, restrict it to that API, add it in
Vercel → Settings → Environment Variables, then redeploy.

## Import format

JSON (an array, or `{ "sessions": [...] }`, which includes Stillflow's own
exports) or CSV with a header row. Required fields: `title`, `youtubeUrl` or
`youtubeVideoId`, and `durationMinutes` (`22`, `22:30` and `1:02:30` are all
accepted). Add `series` and `seriesDay` to place a session in a series. In CSV, a list goes in one cell, separated by `|` or `;`.
Duplicates are matched by video id, both against the library and within the
file. You choose skip, update (fill in non-empty values) or replace.

## Surprise Me

`lib/recommend.ts`, local and deterministic under test. Eight modes. Each one
filters and weights the catalogue and produces a plain-language reason from
the last 30 days of history. Shared adjustments:
- anything practised in the last 3 days is weighted ×0.15
- anything already shown in this sitting is skipped until all candidates have been shown

## Phases

- **Phase 1, done:** shell and navigation, Discover, Explore (search, every filter
  dimension, custom duration range, 9 sorts, grid/list), session detail,
  YouTube hand-off with browser and embed fallbacks, IndexedDB persistence,
  JSON/CSV import with preview and export, full backup and restore, reset,
  PWA (manifest, icons, scoped offline worker), responsive layout, branding.
- **Phase 2, done ahead of schedule** (needed by the release acceptance criteria): favourites, ratings, notes,
  completion and history editing, collections (reorder, play in sequence),
  all eight Surprise Me modes with constraints.
- **Still to do:** weekly planner; a Practice Balance chart and a
  neglected-categories summary (My Practice currently shows top styles and
  body areas only); user-adjustable recommendation weights (now constants in
  `recommend.ts`); bulk edit and classification; optional
  YouTube Data API (env key, never required); instructor management UI.
