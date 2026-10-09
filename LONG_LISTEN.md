# The Long Listen

A personal curator for orchestral music, classical and contemporary. Each week
it offers three directions. The listener chooses one and receives a programme:
an introduction, a sequence of works, a named recording for each, and what to
listen for. It remembers what was heard and said, so a theme that comes back
months later continues from where it was left.

`long-listen-react.html` → `src/long-listen/` (strict TS, DS). No server
function of its own: Claude is called from the browser (`curator/`), Notion
through the shared `/api/notion` relay.

**Read §2 and §5 before touching anything.** They hold the two rules the whole
design serves.

What comes next, ranked, is [`LONG_LISTEN_ROADMAP.md`](LONG_LISTEN_ROADMAP.md).

---

## 1. Product rules (not preferences)

- **Curate, don't dump.** However much music the listener asks for (§4: about
  three to fourteen works), it comes in a sequence with a reason for each step.
- **A recording is not an attribute of a work.** Every programme item names
  performers. Listening and feedback attach to the recording.
- **Continuity, not repetition.** A returning theme must expand: new route,
  new works, new interpretations. Enforced in `curator/validate.js` (§5).
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
| Curator (Claude) | `curator/curator.js`, in the browser | The listener's own Anthropic key, entered in Settings and kept on the device, sent straight to Anthropic through `src/shared/anthropic.ts` — exactly as Daily Stoic, Silva and KeyPath do (owner's decision, 2026-10-09; an earlier server-side version was dropped). |
| Notion mirror | The listener's token through the shared `/api/notion` relay | Human-readable notebook, one way, app → Notion (§7). |
| Spotify | Browser only (PKCE, no secret) | The Client ID is public by design. |

History worth knowing: the first build had a server endpoint
(`api/long-listen.js`), and to make room for it Click Deck's HLTB proxy was
folded into `api/steam-search.js` (`mode=hltb`, old URL rewritten in
`vercel.json`, behaviour pinned by `api/_tests/steam-search-hltb.test.js`).
The endpoint is gone; the fold stays, so the repo now sits at **11/12**.

## 3. Knowledge model (`domain/types.ts`)

```
Artist (composer | conductor | orchestra | ensemble | choir | soloist)
Work ── composer, title, catalogue, composed, form, context, movements
 └─ Recording ── conductor, orchestra, ensemble, soloists, character,
     │           verification (unchecked | verified | unconfirmed | not-found), spotify ref
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

Identity (`domain/identity.js`, plain JS + `.d.ts` because the plain-JS
validators import it): "Symphony No. 5 in C-sharp minor" and "Symphony No. 5" are one Work. A
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

**How a week feels is the listener's to set** (Settings → Music and
exploration, `domain/exploration.ts` is the one vocabulary for Settings, the
notebook and the prompts):

- **Music each week**: 1 h · 2–3 h · 4–5 h · 6 h + → about 3–4, 5–7, 8–10 or
  11–14 works, always in two to four sections (fewer, fuller sections — a
  week with eight thin sections was hard to follow). Default 4–5 h.
- **How widely a week ranges**, 1–5: one focus (a composer, one family of
  works) … across centuries, early music to today. Above 1, **no more than
  two works by one composer**, and the curator is asked to draw connections
  across periods.
- **How well known the music is**, 1–5: cornerstones … rarities and the
  avant-garde. (It replaced the three-step "adventure"; stored values are
  migrated by `normalisePreferences`: gentle→2, balanced→3, bold→4.)
- **Same work, two perspectives** (off by default): with it, a programme may
  hold one side-by-side pair and a direction may be about interpretation;
  without it, no comparisons and no "Hear another perspective" button.
- **One work, one hearing**, whatever the settings: arrangements,
  orchestrations and the original of a piece are one work (`baseWorkKey` —
  Mussorgsky's piano *Pictures* and Ravel's orchestration). A week held three
  *Pictures* once. The validator flags extra versions, a work twice, too many
  works by one composer, more than four sections and too many works; these are
  *mendable* — `enforceVariety` fixes them in code (first version kept, two
  works per composer, later sections folded into the fourth, the week's size
  plus two) — so they cost no retry of their own. The curator is asked again
  only for problems code can't fix (no performers, an unjustified repeat, no
  title, a missing continuity note), or when the trim would leave the week
  thin. (Every mendable problem used to buy a whole second programme.)

**Where next.** The end of the week's programme is one labelled section: *More
of this theme*, *A different direction this week* (the week's other
directions, or three new ones — `Journey.moreDirections`, which keeps the
programme until a new direction is taken and never uses up the wish for next
week), *A path left open* (earlier weeks), *Tell the curator how it went*, and
*A wish for next week*. **More of this theme** (`Journey.extendProgramme`) is
its own programme snapshot with `extends` = the week's programme, the same
exploration (`extraProgrammeIds`), told everything the thread has covered this
week included, so nothing comes back; it counts towards the thread, appears in
the Journal and Threads, and gets its further reading by button, not
automatically (each search costs a little).

**A fresh start** (Settings → The app): saves an archive (a normal backup
file) to the downloads, moves every page the app wrote in Notion to Notion's
trash and empties the taste page (`archiveNotebook`), then `Repo.freshStart()`
clears the journey and everything learned about the listener. Kept: keys and
connections (localStorage), appearance, the music & exploration settings, and
the notebook's location so its databases are reused.

## 5. The curator (`curator/`)

Seven prompts in `prompts.js`, each **versioned** (`programme@2026-10-08.1`).
The version is stored in every programme snapshot. Bump it when a prompt's
meaning changes.

| Job | Effort | When it runs |
|---|---|---|
| `themes` | medium | once a week |
| `programme` | medium | once per choice |
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

**Cost.** Curating — directions, programmes, a second perspective — is on
`MODEL_SONNET`; the jobs that read and summarise — taste, a thread's week
(continuity), *A little more context* (explain) and further reading (resources,
web search capped at three) — are on `MODEL_HAIKU` (`modelFor(op)` in
`curator.js`), at a twentieth of the price. Feedback is read into taste in
batches: `Journey.scheduleTasteReading` waits three quiet minutes after the
last save, and anything left when the page closed is read once on the next open
(also at a week's start, or at once from the Notebook). Every response's
`usage` is tallied per month and model on the device (`app/usage.ts`,
localStorage, list prices in `src/shared/models.js`) and shown in Settings →
About as an estimate; the Console has the bill.

Model: `MODEL_SONNET` (or `MODEL_HAIKU`, above) from `src/shared/models.js`, adaptive thinking and
`output_config.format` json_schema, sent with `requestAnthropic` from
`src/shared/anthropic.ts`. No beta headers: a plain browser request, like the
other apps'. `directCurator(getKey)` is the `CuratorClient` the app uses; a
missing or malformed key is refused before any request.

**Facts vs curation.** Claude is the curatorial layer: choice, order,
explanation, what to listen for, and a *proposed* recording by name.
Nothing it says is stored as metadata:

- **Recordings** are matched on Spotify (`spotify/match.ts`) on the work
  *and* the performers. The right work by the wrong conductor is `none`; so
  is a track whose composer isn't named (as an artist or in the title), one
  carrying a different catalogue number of the same scheme, and one on an
  album released before the proposed recording year. A **strong** match
  (composer, work, every performer) is `verified`. A **probable** one (the
  conductor right, an orchestra or soloist not credited — maybe the same
  recording billed differently, maybe the same conductor twenty years
  earlier) is `unconfirmed`: shown with its album and credits as a question,
  never linked, played, put in a playlist, counted as listening or mirrored
  to Notion until the listener says "Yes, this is it". "Not this one" (on
  either kind) remembers the album in `rejectedAlbumIds`, so it is never
  offered again, and looks once more. Only Spotify's own data is stored:
  album, release date, ℗ line, credited artists, the work's tracks and their
  names. A miss is `not-found`, and the curator's
  choice is never silently swapped for another interpretation. Instead a
  **stand-in** is chosen, by itself, once: `spotifyCandidates` lists the
  recordings of the work Spotify really has, the curator picks from that
  list (`validateCompare` refuses a pick that isn't on it), and the result is
  shown beneath the original as "On Spotify instead" and goes into the
  playlist. Bracketed version notes ("(original piano version)") don't count
  as title words. `MATCHER_VERSION` (now 3) is stored with each decision;
  anything an older matcher decided — not-found *or* matched — is looked at
  again, unless the listener settled it. Version 2 once passed Karajan's
  Beethoven 7 for his Sibelius 7 (same conductor, same orchestra, "Symphony
  No. 7"); when a re-check changes or withdraws a match, the listening
  Spotify reported against the old tracks is dropped with it (the
  listener's own marks stay).
- **Resource URLs** survive only if they appeared in a `web_search_result`
  in the same response (`validateResources`). (The first, server-side
  version also dropped pages answering 404 to a HEAD request; a browser can't
  make that check across origins.)

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
its movements from its own track names (on the recording, as its album
divides them — never copied onto the work, where one wrong match once renamed
the movements for every recording of it), the
week as a private **playlist** of exactly the matched tracks (re-saving
replaces them), the **listening view**'s "now" marker from currently-playing
(polled every 10 s while visible, screen kept awake with the shared
`useWakeLock`), and a **Settings test** (who's signed in, which devices).
**Play on your device** turns shuffle off and starts at the first movement
(a device left on shuffle started a symphony at its third).

**Sign-in lifecycle.** The PKCE callback is validated: state must match, the
verifier is single-use, and sign-ins older than 15 minutes are refused. The
pending state lives in localStorage — from the installed app, Spotify's page
returns in a browser tab with its own sessionStorage. Since July 2026 a
Spotify sign-in lasts **six months from authorisation**; refreshing doesn't
extend it. Only `invalid_grant` (a 400/401 from the token endpoint) ends a
sign-in; a timeout, 429 or 5xx keeps the tokens for another try. Refreshes
are single-flight (several callers, one refresh — a rotated refresh token
can't be spent twice) and read storage first, so a refresh another tab just
made is used rather than repeated. When Spotify does end the sign-in, the app
says so once and Settings offers Connect; Settings also shows when the
current sign-in runs out.

**Listening detection** is an approximation, and says so. Spotify's
recently-played gives the last 50 tracks, each with a time, and a track
appears after about thirty seconds of play — never how much was heard. On
each app open (or "Check recent listening"), plays are matched to
*confirmed* recordings' track ids. A session (plays within 3 h) covering
≥60% of a multi-movement work's tracks is `heard`, less is `partial` (shown
as "Started"; it read as "Listening" until 2026-10-09, which looked like
"playing now"). A **single-track work is never marked heard by Spotify** —
thirty seconds and forty minutes look identical — so "Heard" is the
listener's word there. A session is recorded once: a later poll that sees
the same session, even after its first plays have scrolled out of the fifty,
only upgrades a partial to heard. Polls are one at a time. Spotify's events
are placed at the time of the play, so a reset the listener made after it
holds. More than fifty tracks between opens are simply not seen. Spotify can
only move a recording forward; the listener's own marks win.

## 7. Notion

A one-way mirror of what a person would reread, under one **notebook page**
(Settings → Notion):
**Journal** (one page per programme: the curator's text written once, as it
was written; below it the further listening and reading, which usually
arrives after the page exists — its blocks are remembered (`bodyBlockIds`,
`anchorBlockId` in the sync state) and replaced in place when the list
changes; anything the listener wrote on the page is left alone; pages from
before this was tracked are found by their heading once),
**Listening threads**, **Works & recordings**, **Composers**, and a **Musical
taste** page rewritten when taste or preferences change. The mirror **finds**
these by title-ending among the page's children (so "The Long Listen — Journal"
and a duplicated Starter Template's "Journal" both count) and creates only what
is missing. **Test Notion** (`checkNotebook`) reads, never writes: it reports
databases found and missing, and any column a found database lacks.

The live notebook is **Dev → App Databases → The Long Listen**; the empty copy
is **Dev → Starter Templates → The Long Listen — Starter Template**; spec and
handover sit in App Specs and App Handovers, per *Dev — Building an App*. Hash-skipped: an unchanged entity is never rewritten. No ids,
prompt versions or match confidences cross over, and only a confirmed
recording gets a Spotify link.

## 8. Setup

**Nothing to configure on Vercel.** The listener enters an Anthropic key, a
Spotify Client ID and a Notion token + notebook page in Settings, each with a
test — the user's guide (a Claude Docs doc, linked from the masthead and
Settings: `app/links.ts`) walks through all three. `VITE_LONG_LISTEN_SPOTIFY_CLIENT_ID`,
if set at build time, pre-fills the Client ID.

**Development**: `npm run dev`, open
`http://127.0.0.1:5173/long-listen-react.html`. With no key, turn on Settings →
Development → *demo curator*. Its canned programmes exist only under
`import.meta.env.DEV`, and every screen shows a demo ribbon while it is on.

**Credentials, and what they are exposed to.** One listener, their own keys,
on their own phone. The Anthropic key and Notion token sit in localStorage on
`coneofcold.vercel.app`, which is **one origin shared by every app in the
playground**: any script that ever ran there could read them. That — not the
direct browser call to Anthropic, which sends the key only to
`api.anthropic.com` over TLS — is the real exposure, and it is accepted for a
personal app, proportionately:

- the app renders no HTML it didn't write; links from the curator, from web
  search or from a restored backup become links only if they are `http(s)`
  (`normaliseUrl`, `webUrl`, the Notion mirror);
- keys are never in a backup file and never sent anywhere but their owner's
  API (the Notion token through the stateless `/api/notion` relay, which
  checks origin, rate-limits, and logs nothing);
- Settings recommends a key made just for this app, in a workspace with a
  small monthly spend limit, and a Notion integration shared with the
  notebook page only — so a leak costs little and is undone in one place;
- Spotify holds no secret at all (PKCE; the Client ID is public).

A server-held key would remove the key from the shared origin but replace it
with an endpoint anyone could spend through; for one listener that is the
worse trade. Revisit if the playground ever renders untrusted HTML, or if
another person uses this app.

**What the listener already knew.** The curator learns from what it
suggested and from feedback — so on its own it would offer Beethoven 7 as a
discovery to someone who has known it for thirty years. Each work in a
programme has a quiet **"I knew this already"** (a `Feedback` with `known`,
on the work; "Undo" writes `known: false`). It is familiarity, not a
reaction: it doesn't touch listening state or the taste profile. The context
sends `alreadyKnown`; the themes and programme prompts treat those works as
familiar ground — a starting point to reach out from, never pitched as new.
Music known before the app and never programmed here goes in the Notebook's
note to the curator, which says so.

## 9. Tests

`npm test -- src/long-listen`

- `curation/journey.test.ts`: the loop. Three options generated once;
  choosing keeps the other two open; rollover closes threads and reads taste
  before new options; **a returning theme reaches stage 2 with its covered
  works and stays one thread**; changing direction keeps the first programme
  byte-for-byte; open paths can be taken later; extras are cached.
- `curator/curator.test.js`: the key checks, the call to Anthropic (endpoint,
  key, browser header), the validators, the retry-then-strip rule for repeats,
  resource URL verification, errors in listener's words.
- `spotify/*.test.ts`: matching (wrong conductor refused, No. 15 ≠ No. 5,
  another composer's "Symphony No. 7" refused, contradicting catalogue
  numbers and too-early releases refused); verification (a near miss held as
  unconfirmed, confirmed or refused by the listener, a refused album never
  offered again, an older matcher's match re-checked and its inferred
  listening dropped); PKCE (forged, replayed and stale callbacks refused);
  the sign-in lifecycle (an outage keeps the sign-in, `invalid_grant` ends
  it and says so, one refresh for many callers, another tab's refresh
  used); recently-played (confirmed recordings only, single-track works
  never "heard", a session counted once as it scrolls out of the fifty);
  playlists (confirmed tracks only); play (shuffle off, first movement).
- `notion/mirror.test.ts`: further reading that arrives after a page was
  written is added after the curator's text, replaced in place when it
  changes, and the listener's own blocks are left alone; legacy pages are
  found by heading.
- `domain/week.test.ts`, `identity.test.ts`, `listening.test.ts` (a reset
  after a play holds), `curation/taste.test.ts`, `App.test.tsx`.
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
| Playbook: BYO keys, Starter Template, spec, handover, glance row, guide | server key; no Notion paperwork | all done — key in Settings, called from the browser like the other apps |

Added beyond the brief: the weekly Spotify playlist, the listening view, a
recording's length, print styles, text size, and the curator writing in
Romanian when asked.
