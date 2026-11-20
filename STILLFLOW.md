# Stillflow — Find your practice.

A personal yoga companion built around Yoga With Adriene, designed so other
instructors can be added later. It turns a pile of YouTube videos into a
classified, searchable library. You choose a session by time, body area and
mood, practise it in the YouTube app, then come back and record it.

Strict TypeScript on `src/ds/`. Entry: `stillflow-react.html` → `src/stillflow/main.tsx`.
Not yet in `apps-registry.js` (CABINET.md: add once stable).

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
  screens/  Discover, Explore, SessionDetail, Surprise, Practice, Collections,
            Settings (+ ImportPanel), SessionEditor
```

Storage goes through `src/shared/kvStore.ts` (promoted from The Long Listen),
in an IndexedDB database of its own called `stillflow`. To move to Supabase,
write a `KeyValueStore` backed by it, or a second `StillflowRepo`. Nothing
above `store/` changes.

## Import format

JSON (an array, or `{ "sessions": [...] }`, which includes Stillflow's own
exports) or CSV with a header row. Required fields: `title`, `youtubeUrl` or
`youtubeVideoId`, and `durationMinutes` (`22`, `22:30` and `1:02:30` are all
accepted). In CSV, a list goes in one cell, separated by `|` or `;`.
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
  `recommend.ts`); excluding sessions from the UI (the `excluded` flag is
  honoured but has no toggle yet); bulk edit and classification; optional
  YouTube Data API (env key, never required); instructor management UI.
