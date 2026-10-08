# The Long Listen

A personal curator for orchestral music, classical and contemporary. Each week
it offers three directions. The listener chooses one and receives a programme:
an introduction, a sequence of works, a named recording for each, and what to
listen for. It remembers what was heard and said, so a theme that comes back
months later continues from where it was left.

`long-listen-react.html` → `src/long-listen/` (strict TS, DS) · server:
`api/long-listen.js` + `api/_lib/longListen/`.

**Read §2 and §5 before touching anything.** They hold the two rules the whole
design serves.

---

## 1. Product rules (not preferences)

- **Curate, don't dump.** Four to seven recordings a week, in a sequence with
  a reason for each step.
- **A recording is not an attribute of a work.** Every programme item names
  performers. Listening and feedback attach to the recording.
- **Continuity, not repetition.** A returning theme must expand: new route,
  new works, new interpretations. Enforced on the server (§5).
- **Choice without judgement.** The two options not chosen become `open`
  paths. They are fed back to the curator and can be taken later. The UI
  never says "rejected".
- **No gamification, ever.** No streaks, points, badges, totals, minutes,
  percentages, progress bars or engagement numbers. Listening states exist as
  memory for the curator. `App.test.tsx` checks that the rendered page carries
  no such words. Don't add a count to a screen; describe things in words
  ("first explored six weeks ago").
- **Taste is prose.** Observations are sentences with a stance
  (drawn to / curious about / mixed / wary of) and a confidence
  (first impression / emerging / settled). Never a score.

## 2. Where things live

| Layer | Where | Why |
|---|---|---|
| Primary database | IndexedDB on the device (`idb-keyval`, its own `long-listen` db), `store/repo.ts` | Chosen with the owner, 2026-10-08: no provisioning, readable offline, server stays stateless. Same approach as KeyPath and Silva. |
| Backup | Settings → "Save a backup" (one JSON file of every record) | The journey lives on one device; this is how it survives a new phone. |
| Curator (Claude) | `api/long-listen.js` | The listener's own Anthropic key (Settings, kept on the device — the playground's BYO rule) is sent **to this server** in `x-anthropic-key`, never from the browser to Anthropic: the brief forbade browser→Anthropic calls. The server's own `ANTHROPIC_API_KEY`, unlocked by a passphrase, is the fallback. |
| Notion mirror | The listener's token through the shared `/api/notion` relay; or the server's `LONG_LISTEN_NOTION_TOKEN` through the endpoint's fenced `notion` op | Human-readable notebook, one way, app → Notion (§7). |
| Spotify | Browser only (PKCE, no secret) | The Client ID is public by design. |

The function slot came from folding Click Deck's HLTB proxy into
`api/steam-search.js` (`mode=hltb`, old URL rewritten in `vercel.json`). The
repo is back at **12/12**: the next new function has to fold something too.

## 3. Knowledge model (`domain/types.ts`)

```
Artist (composer | conductor | orchestra | ensemble | choir | soloist)
Work ── composer, title, catalogue, composed, form, context, movements
 └─ Recording ── conductor, orchestra, ensemble, soloists, character,
     │           verification (unchecked | verified | not-found), spotify ref
     └─ Album (Spotify) ── holds several recordings
Theme (a thread) ── explorations, reaction, open questions, adjacent topics, next directions
 └─ ThemeExploration ── week, stage (1st visit, 2nd…), angle, programme, closing note, setAside
WeekRecord ── three ProgrammeOptions, the chosen one, the programme, set-aside programmes
ProgrammeOption ── offered → chosen | open → taken-later; or set-aside
Programme (IMMUTABLE snapshot) ── sections → items (work, recording, proposed credit,
                                  why, why this recording, listen for), comparisons
Comparison ── one work, two perspectives (programme or on-request)
ListeningEvent ── opened | play-started | listening | heard | partial | skipped | reset
Feedback ── target: theme | programme | work | recording | album | interpretation
TasteProfile ── observations (superseded, never deleted), questions, notes to curator
Resource ── listen | read | watch, with source and purpose
NotionSyncState ── entity → page id + hash of what was written
```

Identity (`domain/identity.js`, plain JS + `.d.ts` because the server imports
it): "Symphony No. 5 in C-sharp minor" and "Symphony No. 5" are one Work. A
movement never merges with its symphony, and two Strausses never merge. The
keys are conservative on purpose: a false merge hides music.

**Programmes never change.** `Repo.addProgramme` refuses to overwrite.
Changing direction makes a new programme; the old one is kept and flagged
`setAside`, and only what was actually heard of it counts as covered.
Spotify verification annotates the Recording, never the snapshot's text.

## 4. The week

ISO weeks, Monday to Sunday, **in the listener's time zone** (Settings,
default `Europe/Bucharest`), computed from an instant with `Intl`
(`domain/week.ts`). Never the server's or device's zone. Tested across the
autumn clock change and the ISO year boundary.

`Journey.ensureWeek()` runs once per week, the first time the app is opened:

1. closes every ended exploration (**continuity planner**: how the thread
   landed, open questions, next directions),
2. reads unread feedback into taste (**taste interpreter**),
3. asks for three directions (**theme generator**), with every thread's
   digest, the open paths, the last eight weeks and recent listening.

Steps 1 and 2 failing never blocks step 3; they retry next time. Concurrent
calls share one in-flight promise, so StrictMode and a double tap don't pay
twice.

## 5. The curator (`api/_lib/longListen/`)

Seven prompts in `prompts.js`, each **versioned** (`programme@2026-10-08.1`).
The version is stored in every programme snapshot. Bump it when a prompt's
meaning changes.

| Job | Effort | When it runs |
|---|---|---|
| `themes` | medium | once a week |
| `programme` | high | once per choice |
| `continuity` | low | once per exploration, after its week ends |
| `taste` | low | after feedback with something in it; at week start |
| `explain` | low | on request, cached per item |
| `compare` | medium | on request, cached per item |
| `resources` | medium + web search | once for this week's programme, then on request |

Every job also receives the listener's **preferences** (Settings → How you
listen: time per week, adventure, depth, recording era, voices, concertos,
curator language). They outrank inferred taste; the programme's size follows
the time setting. A one-off **wish for next week** is read once and cleared
only after it reached the curator. **Three others** (before choosing) keeps
the first three as open paths and tells the curator what not to repeat. The
context also carries every work programmed in the last twelve weeks across all
themes, and how often each recording was heard again.

Model: `MODEL_SONNET` from `src/shared/models.js`, adaptive thinking,
`output_config.format` json_schema, and the server-side refusal fallback
(`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`).

**Facts vs curation.** Claude is the curatorial layer: choice, order,
explanation, what to listen for, and a *proposed* recording by name.
Nothing it says is stored as metadata:

- **Recordings** are matched on Spotify (`spotify/match.ts`) on the work
  *and* the performers. The right work by the wrong conductor is `none`. Only
  Spotify's own data is stored: album, release date, ℗ line, credited
  artists, the work's tracks. A miss is `not-found`, and the UI offers a
  search, never another interpretation.
- **Resource URLs** survive only if they appeared in a `web_search_result`
  in the same response (`validateResources`), and only if a HEAD request
  doesn't return 404 or 410.

**Validation (`validate.js`)** covers what a schema can't express: exactly
three options in three distinct moods; a returning id must be one the client
sent; every item names performers; a work doesn't appear twice; a comparison
needs two different performances. **A returning theme that repeats covered
works without a `revisitReason` gets one retry with the problems listed. Any
repeat that survives the retry is stripped.** Retries are fresh single-turn
requests carrying the previous answer as data; history is never edited.

Errors reach the browser as short fixed messages. Nothing upstream comes
through except Notion's own error text, which names the problem, never the
token.

## 6. Spotify

Dev-mode Spotify app owned by the listener (Premium required since Feb 2026,
fine for one user). As of Feb 2026: search pages hold max 10 results, albums
have no `label` (the ℗ line stands in), batch lookups are gone. Redirect URIs
must be HTTPS or `http://127.0.0.1:<port>`, not `localhost`. Register:

- `https://coneofcold.vercel.app/long-listen-react.html`
- `http://127.0.0.1:5173/long-listen-react.html`

Scopes: `user-read-recently-played`, `user-read-playback-state`,
`user-modify-playback-state`, `user-read-currently-playing`,
`playlist-modify-private`. A sign-in that predates the last two is asked to
reconnect before a playlist is written.

**Also from Spotify**: each verified recording's length (sum of its tracks),
the work's movements from the track names (once, if the work has none), the
week as a private **playlist** of exactly the matched tracks (re-saving
replaces them), the **listening view**'s "now" marker from currently-playing
(polled every 10 s while visible, screen kept awake with the shared
`useWakeLock`), and a **Settings test** (who's signed in, which devices). The PKCE callback is validated: state must
match, the verifier is single-use, and sign-ins older than 15 minutes are
refused.

**Listening detection**: on each app open, recently-played (last 50) is
matched to verified recordings' track ids. A session (plays within 3 h)
covering ≥60% of a work's tracks is `heard`, less is `partial`. Each session
is recorded once and upgraded once if finished later. Spotify can only move a
recording forward; the listener's own marks win.

## 7. Notion

A one-way mirror of what a person would reread, under one **notebook page**
(Settings → Notion; or `LONG_LISTEN_NOTION_PAGE_ID` on the server path):
**Journal** (one page per programme, written once, as the curator wrote it),
**Listening threads**, **Works & recordings**, **Composers**, and a **Musical
taste** page rewritten when taste or preferences change. The mirror **finds**
these by title-ending among the page's children (so "The Long Listen — Journal"
and a duplicated Starter Template's "Journal" both count) and creates only what
is missing. **Test Notion** (`checkNotebook`) reads, never writes: it reports
databases found and missing, and any column a found database lacks.

The live notebook is **Dev → App Databases → The Long Listen**; the empty copy
is **Dev → Starter Templates → The Long Listen — Starter Template**; spec and
handover sit in App Specs and App Handovers, per *Dev — Building an App*. Hash-skipped: an unchanged entity is never rewritten. No ids,
prompt versions or match confidences cross over. The server route only
allows these call shapes, and only under the configured page
(`refuseNotionCall`).

## 8. Setup

**Nothing is required on the server.** The listener enters an Anthropic key,
a Spotify Client ID and a Notion token + notebook page in Settings, each with
a test — the user's guide (a Claude Docs doc, linked from the masthead and
Settings: `app/links.ts`) walks through all three.

Optional Vercel env, for the server-key path:

| Variable | |
|---|---|
| `LONG_LISTEN_ACCESS_KEY` | passphrase that unlocks the server's own keys; without it only BYO works |
| `ANTHROPIC_API_KEY` | already set for Law of the Day |
| `LONG_LISTEN_NOTION_TOKEN` | a Notion internal integration token |
| `LONG_LISTEN_NOTION_PAGE_ID` | the notebook page, shared with that integration |
| `VITE_LONG_LISTEN_SPOTIFY_CLIENT_ID` | a default for Settings |

**Development**: `npm run dev`, open
`http://127.0.0.1:5173/long-listen-react.html`. With no key, turn on Settings →
Development → *demo curator*. Its canned programmes exist only under
`import.meta.env.DEV`, and every screen shows a demo ribbon while it is on.

## 9. Tests

`npm test -- src/long-listen api/_tests/long-listen.test.js`

- `curation/journey.test.ts`: the loop. Three options generated once;
  choosing keeps the other two open; rollover closes threads and reads taste
  before new options; **a returning theme reaches stage 2 with its covered
  works and stays one thread**; changing direction keeps the first programme
  byte-for-byte; open paths can be taken later; extras are cached.
- `api/_tests/long-listen.test.js`: the passphrase gate, the validators, the
  retry-then-strip rule for repeats, resource URL verification, safe errors,
  the Notion fence.
- `spotify/*.test.ts`: matching (wrong conductor refused, No. 15 ≠ No. 5),
  PKCE (forged, replayed and stale callbacks refused), recently-played
  sessions.
- `domain/week.test.ts`, `identity.test.ts`, `listening.test.ts`,
  `curation/taste.test.ts`, `notion/mirror.test.ts`, `App.test.tsx`.
- `scripts/anthropic.live.test.js` sends each curator job's real request
  once (`npm run test:live`).

## 10. Screens

This week (three directions · three others · open paths) → Programme (tools:
length, playlist, print · sections · recordings · listen-for · marks ·
feedback · perspectives · more context · resources · change direction) →
Listening view. Journal (every week: offered, chosen, heard). Library
(composers → works → recordings, searchable). Threads. Notebook (taste in
words, how it moved, preferences, a wish for next week, a note). Settings
(gear) and the guide (book) sit in the masthead.

## 11. The second-pass audit (2026-10-09)

After the first build, the brief was reread line by line. What was missing or
thin, and what was done:

| Brief | Gap | Now |
|---|---|---|
| §5 profile: length, recording eras, tolerance, contemporary appetite | only ever inferred | Settings → How you listen, sent with every job, outranks inference |
| §19 navigation: "Explore" | not built | Library |
| §6 repeat listening, §5 "works already recommended" | within a thread only | `heardTimes` in digests and context; `alreadyProgrammed` across themes |
| §10 movements | modelled, never filled | from Spotify track names |
| §17 unavailable recordings | a search link only | "Ask for one that's on Spotify" → a playable second perspective |
| §5 "current interests/questions" | no way to state one | a wish for next week; a note to the curator |
| §14 knowledge: composers | missing | Composers database |
| — none of the three appeal | no way out | three others, on request |
| Playbook: BYO keys, Starter Template, spec, handover, glance row, guide | server key only; no Notion paperwork | all done |

Added beyond the brief: the weekly Spotify playlist, the listening view, a
recording's length, print styles, text size, and the curator writing in
Romanian when asked.
