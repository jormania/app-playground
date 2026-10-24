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
week), *Left open* (earlier weeks), *How it landed*, and
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
only after it reached the curator. **Three others** (before choosing) means one of two
things, decided by what moved since the three were offered. If nothing did,
none of them appeal: the first three stay as open paths and the curator is told
what not to repeat. If a setting or the week's tuning changed (each week keeps
`madeWith`, the settings and mood its three were made with;
`domain/directionChanges.ts` names what moved), the listener is adjusting, not
leaving: the same three go back as `rework`, with what changed, and come back
reworked for it — same mood slot, same subject, same thread, scope and
familiarity reshaped — and the earlier versions are kept in the Journal as
"reworked for new settings", not as open paths. A request written with it
still outranks a direction's ground, so "somewhere new" is one sentence away.
Weeks offered before `madeWith` existed take the settings as they stand at
their next opening as their own (themes@2026-10-14.1). The
context also carries every work programmed in the last twelve weeks across all
themes, and how often each recording was heard again.

**Cost.** Curating — directions, programmes, a second perspective — is on
`MODEL_SONNET`; the jobs that read and summarise — taste, a thread's week
(continuity), *More context* (explain) and further reading (resources,
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
replaces them), what's **playing now** (below), and a **Settings test**
(who's signed in, which devices). **Play on your device** turns shuffle off
and starts at the first movement (a device left on shuffle started a symphony
at its third).

**Playing now.** One `PlayerWatch` (`spotify/watch.ts`) reads `me/player` for
the whole app — however many Play buttons are on screen, one request at a
time — only while something watches and the page is visible, at once when the
page comes back from the Spotify app, and just after the current track should
end (else every 15 s), so the next movement is marked within seconds. Every
listen bar (`components/ListenBar.tsx`, on the programme and the listening
view) turns Play into **Pause** while its recording plays and **Resume** while
it's paused, with a line beneath: "Playing on Galaxy S24 · movement 2 of 4".
A work Spotify has finished is at rest, not paused (`positionOf` in
`app/playback.ts`): stopped on its last movement at the close or the start,
or — a list played to its end — back on the first movement at 0:00, paused.
There it offers Play, and the running order tags nothing (until 2026-10-10 it
read "Resume · paused, movement 1 of 6" after a whole serenade).
The listening view marks the movement (now / paused) and a tap on a movement
plays from it; the running order tags the work that's on. A track Spotify
relinked for the market is known by `linked_from`. A 403 says to reconnect.
The listening view is dusk-toned whatever the theme (`:root[data-listening]`):
one of four dark shades at random on each visit, never the last one shown.
There is no setting for it and no count of shades shown or liked (both removed
2026-10-10 at the owner's request). Its screen is kept awake with the shared
`useWakeLock`.

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
thirty seconds and forty minutes look identical. **The app itself can,
though (2026-10-10, at the owner's request), however the work was started**
— Play in the app, "Open in Spotify", the week's playlist, or Spotify on its
own. `app/HeardWitness.tsx`, mounted once at the root, keeps the player read
every few seconds on every screen while Spotify is connected and the app is
in front, and `spotify/witness.ts` turns those readings into what it saw
sounding. A tap on Play or a Spotify link for a single-track work is noted as
an *assumed* start, so a listening begun in Spotify counts from the top once
the app is back in front and a reading shows the track itself under way, no
further on than the clock allows; opened and never played counts for
nothing. Each heard-through track marks every confirmed single-track
recording of it. A
single-track work becomes `heard` (source `app`) when the readings show ≥90%
of it played at the pace of the music — progress that ran ahead of the clock
is a jump and isn't credited — *and* its end reached: a reading at the close,
or, when the page was away for the ending, the track gone from the player no
sooner than it had left to play (and, unless Spotify still holds it at its
close or rewound to the start, no more than ten minutes after). Begun partway,
jumped to the end, or left early never counts; once per session; only real
readings, never the guess the screen shows when Play is pressed (an assumed
start is credited only by what a later reading proves); kept in memory, so a
reload mid-work forgets. What can't be seen: a work started and finished
entirely while the app was closed or in the background is left to the
listener's "Heard". On the listening view it opens the same
panel as tapping "Heard" there. Works in movements are left to Spotify's history,
so a hearing is never counted twice — but the history is read the moment one
stops, not only on the next open: when a reading shows a confirmed work in
movements no longer sounding (paused, stopped, rewound at the list's end, or
left for something else), `HeardWitness` reads it 5 s later and again at a
minute, for the last movement to reach Spotify's list. Before 2026-10-10 a
work heard with the app open stayed "Started" until the app was next opened. A session is recorded once: a later poll that sees
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
  "heard" from it only when the timing shows they ran through (§29), a session counted once as it scrolls out of the fifty);
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
(composers → works → recordings, searchable; *Everything · Heard · Recent*),
with a page per composer (`#/composer/<name>`) and per performer
(`#/performer/<name>`). Threads. Notebook (taste in words, how it moved,
preferences, a wish for next week, a note). Concerts (heard live, You're going,
From your listening) under the Journal; a season in review (`#/season/<n>`).
Settings (gear) and the guide (book) sit in the masthead, with the listening
mark beside them when there's a work to go back to (§28). With no key, This
week is a welcome (§30).

**How the screens are told apart (2026-10-09 visual pass).** One typographic
system, one accent, no cards — but each section has a shape of its own, drawn
from what it holds:

- **Programme:** a *running order* right under the title (numbered works, each
  with its role or where you stand with it), so the music is findable before
  the essay; the same numbers sit beside each work below. From 1200px it moves
  into the left margin as a fixed contents rail. Each line gives the work's
  date and, once a recording is confirmed, its length; the heading gives the
  total. Each work ends on one quiet line — *Your listening* folded to its
  state word (only "Heard" in the accent), then "More context" and "Another
  perspective" as links. The way into the listening view, *Listen along →*,
  sits under the Play row as its own outlined pill, Play's shape and height
  (14 October: it is where most listening happens, so not one link among three) — and the music closes on
  "That's the week: N works, about X." One hairline between works; inside a
  work, space. Without Spotify, "Connect Spotify…" is said once, under the
  running order.
- **Journal:** a timeline — each week's number large in a margin column, a rule
  running down the week.
- **Library:** a card catalogue — a guide letter where the surnames move on.
- **Threads:** each theme's visits strung on one vertical line, a bead a visit.
- **Notebook:** what you've told the curator as a two-column ledger.
- **Listening view:** the section nav steps away; one quiet screen.

Buttons: text links by default; a filled `primaryButton` for the single
decision a screen exists for (I've heard it, keep this feedback) and an
`outlineButton` where several sit together (the week's three directions, the
curator requests in Where next). `--color-faint` carries small text, so it is
held at 4.5:1 or better on the paper. `.main`'s fade fills `backwards` only:
a transform left on it would capture the fixed rail.

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

## 12. Releases

The app names its release once, in Settings → About (`app/release.ts`), and
nowhere else. What comes next is `LONG_LISTEN_ROADMAP.md`.

- **Release one — 9 October 2026.** Weekly directions and programmes from a
  BYO-key curator; Spotify verification, stand-ins, the weekly playlist (kept
  current on its own), Play/Pause/Resume that follows Spotify and a dusk
  listening view; Journal, Library, Threads, Notebook; the Notion mirror.
  Tested in daily use on the first week, *Northern Light*.
- **Release two — 9 October 2026.** Every item of the roadmap's release two
  (see §13), plus: skipped works hidden everywhere (a setting, on by default),
  brighter small headings, and each work opening on an accent-edged card with
  a slim line pinned on top while you read inside it.
- **Release three — 14 October 2026** (first stamped 10 October). Roadmap
  items 14, 15 and 22 (see §14), plus soloists placed per work at a concert and
  reactions moved to the stand-in that actually played; then the edge-case audit
  (§15), the consistency audit (§16), folding what is read once or optional
  (§17), and the programme set as a brochure: one quiet line under each work, the
  running order with years and lengths, a closing line, fewer rules, descriptive
  words as labelled tags, and a quieter Library and concert page.

## 13. Release two

**Smoother.**
- *Keep listening* (`screens/ListenMode.tsx`). "Heard" (under *Your listening*, §24) asks how it
  landed in place and offers *Next: …* — the next confirmed, unskipped work (a
  stand-in counts), opened when the listener chooses. Nothing plays on by
  itself: a *carry on* setting that chimed and started the next work was built
  in release two and removed on 9 October 2026 at the owner's word — a work is
  heard whole, then a pause, then the next by choice. Its `continuation.ts`
  went with it, and Tempo's chime went back to `src/tempo/lib/sound.js`.
- *Notice listening when you come back*: recent Spotify plays are re-read on
  returning to the foreground, at most every two minutes (`app/services.tsx`).
- *How did it land?* (`domain/landed.ts`, `components/LandedPrompt.tsx`): the
  latest work Spotify marked heard with nothing said about it is asked about
  once, above the page; marked asked as soon as it shows.
- *Fewer waits*: recordings are confirmed three at a time from the moment a
  direction is chosen (`verifyProgramme`); ended threads close in parallel,
  beside the taste reading.
- *Tune this week* (first called *This week, differently*): *shorter · quieter · wider · more familiar*, on the
  week record, sent to every job about the week and applied one step to the
  standing preferences for the checks (`weekAdjusted`).

**Curation.**
- *The curation check* (`curator/curationCheck.ts`): four profiles — narrow and
  familiar, broad and obscure, a returning theme, Romanian — through directions
  and a programme; attempts per job, the programme's shape, and the writing.
  `ANTHROPIC_API_KEY=… npm run check:curation` writes `long-listen-curation.md`.
  Never in CI or `npm test`. Run it before and after a prompt change.
- *Shapes of a week*: each direction has a form (a theme; a form across the
  centuries; then and now; one city, one year; a performer's week; two composers
  in dialogue; one work, several ways — pairs only), named on its card. A
  dialogue lifts the two-per-composer cap; several ways allows three pairs.
- *Listening companion*: the `companion` job (Haiku) writes one note per track
  for every confirmed recording, once, after verification (marks
  `companion:<recordingId>`); the listening view shows the note under the
  movement Spotify has reached, *Ask about this* (answered with the movement
  sounding; answers now read back by `Journey.answers`), and *A little more
  context*. Stand-ins open in the listening view.
- *Questions as directions*: the Notebook's questions each have *Ask for three directions from it* (*Follow this* until 24 October 2026)
  and *next week*.
- *Second hearings*: works called interesting or too difficult three weeks or
  more ago are offered to the programme curator; one may return, as a question
  in its revisitReason; once offered, never again (marks `again:<workId>`).
- *Why this, for you*: recentListening carries `weeksAgo`; a reason may point to
  a moment in the listener's own listening, never a label.

**Live.**
- *Live in Bucharest* (`live/live.ts`): the Ateneu and Sala Radio, read through
  Marquee's endpoint once a day, matched to the programme by work, performer or
  composer; one quiet line under the programme's tools.
- *Concerts* (`screens/Concerts.tsx`): venue, hall, date, performers, the works
  in order and a line on how it was. Shared from the phone's share sheet (the
  manifest's POST `share_target`; the worker keeps the picture under
  `/long-listen-shared-image` and opens `#/concerts/new`) or chosen in the form;
  the `concert` job (Sonnet since concert@2026-10-10.2 — Haiku left soloists'
  instruments blank and knew less repertoire; image in, one attempt, a few
  cents) reads it into the form to check. It may take an instrument from the
  programme itself (a cello concerto, a concerto "for violin and cello") and
  add a number the page doesn't print only when the composer wrote one such
  work (Vieru wrote two cello concertos: it stays "Cello Concerto"). In the Journal in its week with a hall mark; *All concerts* by venue and
  date; each work in the Library *heard live*; known to the curator, and recent
  concerts in the directions' context; the line on how it was is feedback on the
  concert. *Hear it again* lists Spotify's recordings of each work, the same
  performers' first only when Spotify has them. A recording counts by its title
  or by the same catalogue number (DG's "Concerto for Violin, Cello and
  Orchestra, Op. 102" is the Double Concerto), never by a different one, and
  "violoncello" is "cello" (matcher 4); each line says which work Spotify has
  when that says more than the programme did ("Cello Concerto No. 1, Op. 29"). Notion gets a Concerts database.
- Notion's Works & recordings now also holds what played *On Spotify instead*
  and the second recording of a pair.

Prompts at the end of release two: themes@2026-10-10.3, programme@2026-10-10.5,
explain@2026-10-10.1, companion@2026-10-10.1, concert@2026-10-10.2.

## 14. Release three

- **A sitting for tonight** (`components/SittingCard.tsx`, `Journey.sitting`).
  One or two hours asked for on the day, in words ("quiet, nothing I know").
  With a programme this week it joins that thread, like "more of this theme",
  and is told what the thread has covered (since §32 only when made beside the
  theme; otherwise it is an evening of its own, outside the thread); with none, it becomes the week's
  programme and starts a thread named for the evening. It never pays for the
  week's three directions. Sized by the hours (at most four works for an hour,
  six for two, never fewer than two). Offered on This week and under "Where
  next" on the programme.
- **Season in review** (`domain/season.ts`, `curation/season.ts`,
  `screens/Season.tsx`, prompt `season`). Twelve listening weeks, counted from
  the first week with anything in it. When a season ends the curator writes one
  page: the threads, where taste moved, what is still open, and up to four
  works worth hearing again — only works actually met, enforced by the
  validator. Only a finished season with music in it is written (the
  provisional "so far" review was removed on 15 October 2026, §23). Asked for
  by a button, never on its own; cached in `marks` (`season:<n>`). Linked from
  the Journal.
- **Offline.** Checked against a production build with the network cut: every
  screen and an already-made programme open and read; curator calls say they're
  offline; Spotify verification never marks a recording missing for want of a
  connection, and an offline token refresh doesn't sign you out. Fixed: a line
  under the sections says when the app is offline; Notion's mirror and the
  Spotify listening check wait for the connection instead of failing (and run
  when it returns); the "Live in Bucharest" line keeps its last reading
  however old rather than vanishing.
- **Soloists per work at a concert** (`domain/concertSoloists.ts`). A
  programme lists its soloists once, but they seldom play the whole evening.
  Each concert work now keeps who played in it: the reader is told never to
  give every soloist to every work, the form has a chip per soloist under each
  work, and older concerts are judged from the titles (no solo part → none; a
  concerto naming an instrument → its players; any other concerto → all). The
  concert page, the list, the Library's "heard live", the Notion row, the
  curator's context and the Spotify search all use it — so the cellist is no
  longer a clue to the symphony's recordings.
- **Reactions on the recording that played.** Where Spotify lacked the
  curator's recording and a stand-in played, the programme page now files
  reactions under the stand-in; a one-time repair
  (`Journey.repairStandInFeedback`) moved earlier ones.

Prompts at the end of release three: themes@2026-10-10.3, programme@2026-10-10.6,
explain@2026-10-10.1, companion@2026-10-10.1, concert@2026-10-10.3, season@2026-10-10.1.

## 15. The edge-case audit (10 October 2026)

Four scenario hunts after release three — the week's lifecycle, Spotify, concerts
and identity, and the screens in a browser — each wrote failing tests first; they
are kept in `src/long-listen/__audit__/` as regression tests. What changed:

- **One week, one job at a time.** Choosing, changing direction, taking an open
  path, a sitting, "three others" and more directions run in a per-week queue
  (`Journey.weekJob`), and every curator result re-reads what it writes over.
  A fresh start bumps a generation (`repo.generation`) so an in-flight answer
  never writes the old journey back.
- **A stand-in is the item.** Continuity, the season, thread digests, the
  curator's recent listening and second hearings, the playlist's skip filter and
  "how did it land?" all read the curator's recording and its stand-in as one.
- **Spotify matching (matcher 5).** Another opus on the album no longer rules out
  the track; `BWV1048`/`KV` spellings and catalogue-identified works match; a
  movement number can't pass for a work number; one failed album doesn't stop the
  pass; a play counts for every recording on its tracks, relinked ones included.
- **Work identity.** Quoted and bracketed nicknames and a catalogue written at the
  end of a title no longer split one work into two; a shared opus with different
  "No." numbers no longer merges two; "Strauss II" files under S
  (`displaySurname`).
- **Concerts.** Soloists per work keep their judgement in a recital; plural and
  "English horn" instruments; the form keys soloists by row, not name.
- **Notion.** A row, page or database deleted in Notion is recreated rather than
  stopping every later sync.
- **Screens.** Not-found links say so with a way back (`NotFound`); the season
  page can't be paid for before two weeks; Library search finds concert
  performers and catalogue numbers; the Journal names a sitting and a path taken
  from an earlier week; double taps record once; curator text inputs are capped
  at 500 characters.

## 16. The consistency audit (13 October 2026)

Two read-only audits listed every repeated pattern — on screen and in the
logic — and every place it appears, then flagged the outliers; the fixes were
applied to every sibling, not only the one first reported. Tests:
`__audit__/consistency-*.audit.test.ts`.

**Shared now, not hand-rolled.** `domain/standIns.ts` (`standInsOf`, `heardAs`,
`itemFeedback`, `playedProposed`) is how anything reads a stand-in as its item —
Notion's Journal rows, Threads' counts, the programme's length and playlist
button, Library's hide-skipped, "how did it land?", the season and the curator's
context. `domain/composerGroups.ts` groups a composer however the name is
written. `components/OpenPaths.tsx` is the one list of paths left open (This
week and Where next). `components/common.tsx` holds `NeedsKey`,
`CharCount`, `MAX_ASK`/`MAX_NOTE`, `SpotifyCheckButton` and `dateWords`.
`verifyOne` (spotify/verify.ts) is the one way to check a recording, so a
background pass and a tap never overwrite each other.

**Rules the screens now follow.** Taking a direction is a small outline button
in `.actions`; a commit is primary ("I've heard it" included); every curator
request is gated on a key with the same line; busy labels: "Asking…" for an
inline question, "The curator is finding three…" for directions, "The curator is
building it…" for a programme; section intros use `.sectionGuide`; dates are
en-GB in the listener's zone; free text sent to the curator is capped, with a
count near the cap; single-line curator fields submit on Enter.

**Logic.** Writes after a curator or Spotify call re-read what they overwrite
(themes, the week via `updateWeek`, the wish for next week, recordings); every
curator job checks for a fresh start; second hearings match by work, not title
text; "weeks ago" and the season's dates are counted in the listener's zone; a
throttled hall keeps its last concerts; a failed Notion sync retries when the
connection returns.

## 17. Folding (14 October 2026)

The programme reads as a brochure, so little folds — only what is redundant
after a first read, and what is highly optional. One component does it
(`components/Twisty.tsx`): a line that says what is inside, a chevron, opened
when wanted. `readOnce` opens a piece the first time it is shown and folds it on
every visit after (remembered per device under `long-listen:read:*`).

- Read once: a programme's background (why now, where it sits, how they
  connect), each work's "Why this recording", a requested "A little more
  context" (on the programme and in the listening view alike), and the links
  under "Further listening and reading" (open again when new ones are found).
- Optional: every way on in Where next (one line each); This week's "This week,
  differently" and "Made with your settings"; the Notebook's "How it has moved"
  and "In Notion" (open by itself on a sync error); earlier answers in the
  listening view's "Ask about this" (the newest stays open).
- Never folded: the introduction, the running order, each work, "Listen for".
- Folded to a word (14 October, the brochure pass): each work's listening
  controls — "Your listening · Not started ›" opens the states, "I knew this
  one already" and how it landed; open by itself while a hearing waits for
  that word.

## 18. The visual rules (14 October 2026)

A stabilisation pass over every screen at 360, 412 and 1280px, day and night
and the dusk shades. Polish, not a redesign; these are the rules it left, so
the next change follows them rather than re-deciding them.

- **Space has a scale, and a page ends.** Inside a work: space. Between works:
  `--space-xl` either side of one hairline. A part of a page (`.sectionHead`,
  `.settingsPart`) opens `--space-xl + --space-sm` below what came before —
  more than between works, never a screen's worth. The page ends one
  `--space-2xl` after its last line (plus the gesture bar). An empty state
  (`Empty`) sits a `--space-lg` step from the page above it. A row that holds
  nothing on a phone (the tools line with only Print) takes no space.
- **The masthead dates the week; the eyebrow names the section.** This week's
  eyebrow is "This week", like "Journal" or "Library"; a programme's carries a
  date only when it is from another week.
- **One end to the music.** The programme's close ("That's the week: …") is
  centred under the ⁂, in the accent; the back matter after it (further
  reading, Where next) has no ornament of its own.
- **Numbers in the accent, set in the display face, in the margin** — a
  direction on This week (large, like a Journal week), a work in the running
  order and on its card, a work at a concert. Lists of works in order are
  numbered this way, never with the browser's `1.`; loose lists keep bullets,
  coloured in the accent.
- **An order of performance looks like one.** The running order and a
  concert's programme share a shape: an ink rule, a small-caps head ("The
  music", "The programme"), composer in small caps over the title, a hairline
  between rows, no rule after the last.
- **One accent edge, one weight.** Secondary blocks that belong together sit
  on a 2px accent rule — a Library work, a concert in the Journal, a thread's
  facts, a card in Where next, a returning thread. Only a programme work's
  head is a filled card (5px edge): it is the one thing the page is for.
  Don't bring back filled cards for lists.
- **Every fold opens on the same chevron.** `Twisty` for anything with a
  label; a text link that opens more in place (`summary.textButton`, Settings'
  how-tos) gets the same › after its words, turning in place. Never the
  browser's triangle. A twisty whose value is the first words of its body
  passes `preview`, so the words aren't read twice once open.
- **A direction says what kind of week it is legibly.** The mood and shape
  line (`.mood`) is small caps at `--text-sm` in the muted ink, not a
  whisper.
- **Desktop reads wider, not emptier.** From 1024px `--measure` is 40rem and
  `--text-read` 1.25rem, so a line still holds about seventy characters. The
  contents rail sizes itself from the margin it sits in (and keeps its
  section headings on the titles' edge), so neither a wider column nor larger
  text runs it into the page.

## 19. The programme as a printed programme (14 October 2026)

The week's programme and a concert's page borrow the conventions of a hall's
printed programme — small flourishes at the turning points, nothing more. The
words for them live in `domain/programmeStyle.ts`; the styles sit together at
the end of `editorial.module.css`.

- **Parts are numbered like movements.** A Roman numeral before each part's
  title, in the running order too; its guide line says "The second part, of
  three". Between parts, one drawn fleuron (a diamond between two fine rules,
  CSS only, so no font has to carry the glyph) — the page's one pause.
- **A work's heading reads as a programme entry.** The duration across from the
  composer, as programmes print it (`c. 24′`, `primeMinutes`); the movements
  under the title with numerals and italic titles, from the confirmed
  recording's own track names (`movementTitles` drops the work's title Spotify
  puts in front of each, and numbers any that lack one). Both appear only once
  Spotify has confirmed the recording that plays — never guessed.
- **Performers name-first** (`<Credits programme>`): soloists, then the
  orchestra or ensemble, then the conductor, each with its role after in
  italic, one to a line. Only the two programme pages; the Library, Journal and
  listening view keep the compact role-first line.
- **The notes open in small capitals** (the first line of each work's notes).
  The drop cap stays for the introduction alone.
- ~~**A pulled line**~~ — removed 14 October 2026: on a phone the sentence it
  repeats is a scroll away, so it read as the same paragraph printed twice, not
  as a pull quote. `pullQuote` stays in `domain/programmeStyle.ts`, unused.
- **A running head**: the pinned line carries the part ("II · Where it leads")
  above the work.
- **A colophon** after the closing ⁂: "Programme notes by the curator" and the
  week, then the recordings, one to a line — each the recording that plays, a
  stand-in's where it stands in.

## 20. The listening view, following the music (14 October 2026)

The screen where most listening happens, made to follow Spotify cleanly and
say the decisive things in few words.

- **Facts and performers, one line each** under the title: "Symphonic sketches
  · 1903–05 · 3 movements · c. 24′", then "Pierre Boulez · The Cleveland
  Orchestra".
- **Movements as a programme names them** (`movementTitles`): numeral, name,
  and each movement's length across in the margin. Lengths are kept with each
  new Spotify match (`trackDurationsMs`); a recording confirmed before that
  reads its album's tracks once, on first opening, and keeps them.
- **Where in the movement it is**: under the movement sounding, a hairline and
  "4:12 of 9:30" — Spotify's reading carried forward by the clock between
  readings (`useLiveProgress`), so it moves smoothly.
- **Previous / next** either side of Pause, kept inside the work: back from
  the first movement starts it again; there is no next after the last.
- **A compact player pinned to the foot** once the Play row has scrolled away
  while the work is on: the movement, its progress, previous / pause / next.
- **The movement sounding comes into view** when a new one begins — unless the
  page was touched in the last eight seconds.
- **"Listen for" tied to its movement.** The programme prompt
  (programme@2026-10-14.1) now tags each point with the work's own numeral, or
  "" for the whole work (`listenForMovement` → `item.listenForAt`). The numeral
  takes the note mark's place in the margin; the points for the movement
  sounding stand in ink, the rest step back. Trusted only when the recording
  divides the work as the numerals expect (`listenForAt`); programmes curated
  before 14 October show as before.
- **Focus** (per device): only the music — the movement sounding, its note, its
  "listen for" points and the controls, at the same size (the larger type was
  taken out); the same *Focus* button, showing its state, brings the rest back.
  *Your listening* and *More context* stay below the music in Focus too.
- **The work ends, and it says so at once**: when the last movement plays out
  (`workEnded`), the work is marked heard (source `app`, never against the
  listener's own word) and "How did it land?" opens — not a minute later when
  Spotify's history catches up.
- **The next work, ready**: "Play next: … →" opens it and, with Spotify
  connected, starts it — one tap, never by itself.

**The audit after it (14 October 2026).** What the first cut got wrong, and the rule now:
- *One hearing, one "heard".* Spotify's history no longer adds a second "heard" for a
  listening the app or the listener already marked within the session (`playsToEvents`);
  a doubled count told the curator a work was heard twice.
- *Heard means most of it.* The end of the last movement marks the work heard only when
  at least 60% of its movements were seen playing on this visit — not for the finale alone.
- *Never mid-work.* "How did it land?" doesn't open while a movement before the last is on,
  even if Spotify's history already counts the work heard (two of three movements).
- *A refusal is said.* Spotify's 403 "Premium required" on Play or Pause is now an error
  that says so (`reason: 'premium'`), not a silent success that showed "Paused" for a moment.
- *Asked once.* Asked how it landed in the listening view, the programme page won't ask again.
- *Play next only when it can.* "Play next" only for a work Spotify can play; the wish is read
  and cleared on arrival, so it can't start a later visit by itself.
- *Movements by numeral.* Where an album splits a movement across tracks (I, I, II…), the
  count, the "listen for" ties and the margin numerals follow the work's numerals, not tracks.
  A recording without Spotify's track names still lists its tracks, numbered.
- Smaller: no "Listen for" heading over an empty list in Focus; the progress clock no longer
  jumps ahead and back at each reading; previous/next record a start like a tap on the list;
  a no-device failure is said in the pinned player where it was tapped; messages rise above
  the pinned player; the Focus button keeps one name and shows its state.

**What comes next, lightly (14 October 2026).** The full view's movement list already shows the
next movement, so it gains only "· last movement" after the clock when it applies. Focus, which
hides the list, gains one faint line under the movement sounding (`ThenLine`): "then III. Dialogue
du vent et de la mer · c. 8′", or on the last movement "the work ends in about 3′". The pinned
player gains nothing: it is for controls.

**Tagging programmes written before (14 October 2026).** A programme curated before
programme@2026-10-14.1 has "listen for" points with no movement. The first time its listening
view opens with a key set, `Journey.tagListenFor` asks the curator once — one short call on
`MODEL_HAIKU` (tags@2026-10-14.1), for every untagged work in the programme — and saves the tags
into the programme. A work the answer leaves out is kept as untagged ("" throughout), so nothing
is asked twice; nothing else in the programme is rewritten.

## 21. Release four: closer listening, and closer to the hall (14 October 2026)

Four items, chosen from six proposed (`LONG_LISTEN_ROADMAP.md`, items 23–26). The rule they
share: deeper into the listening, never wider; nothing counted.

**Your earlier hearing (23).** When a work comes back, the listening view says so in one line under
the performers: when it was last heard, in which recording (or "this same recording") or at which
concert, and what was said then — the note, or failing one the reaction. `domain/earlierHearing.ts`
decides. A recording counts only if heard *before this programme was made* (Spotify's history
carries no programme, so a hearing since then belongs to this one); a concert counts on or before
today, and wins a tie. What was said is read from feedback given before the programme was made,
on that recording or the work. Hidden in Focus.

**Words on tap (24).** Terms in the curator's notes — the programme's "why" and "listen for", the
listening view's movement notes, "listen for", answers and *More context*, the concert preparation
and the composer's portrait — carry a faint dotted underline (`components/Gloss.tsx`). The list is
closed and lives in `domain/glossary.ts`: what is underlined must be predictable, and everyday
words that are also terms (tempo, texture, development, march, grave) are left out. Each term once
per passage. A tap asks `define` (define@2026-10-14.1, Haiku) with the sentence it sits in, once per
term and language, kept as the mark `term:<lang>:<term>`; later taps read the mark. Without a key,
the notes are plain text.

**Before and after a concert (25).** Each *Live in Bucharest* line has an "I'm going" chip, which
keeps the listing as the mark `going:<key>` (`domain/going.ts`; the key is date, venue and title,
folded). In the week before the evening, a card on this week's page leads to `#/before/<key>`: on
its first opening `prepare` (prepare@2026-10-14.1, **Sonnet**, once per concert, kept as
`prepare:<key>`) reads the evening's programme from the hall's listing — the concert prompt's
rules — and writes a paragraph on the evening, a few lines per work, what to listen for *in the
hall*, and one recording to hear first (named, with a Spotify search; not verified, said as a
suggestion). Once the evening has passed (for three weeks), the card asks how it was and opens the
concert form already filled from the listing and that reading (`#/concerts/from-<key>`; read then if
it never was). Keeping it records the concert on the mark, and the card goes. All concerts lists
the ones still ahead under "Coming up".

**A composer's page (26).** A composer's name heading a work — programme, listening view, Library —
links to `#/composer/<name>`: a short portrait (portrait@2026-10-14.1, Haiku, written on the first
opening, kept per composer and language as `portrait:<lang>:<folded name>`), then what of theirs
has been met — works, recordings with where you stand and what you said, concerts — and the
threads they came up in. One composer however the name was written, by the Library's grouping.

The three new curator jobs are in the live API check (`scripts/anthropic.live.test.js`).

### Release four's audit, and the release stamped (14 October 2026)

A targeted audit of what release four and the day's playback work added, by risk:
the remembered place and Resume; "Not this recording?" with its confirm and undo;
before and after a concert; words on tap, earlier hearing and composer pages.
Fixed, each with a test where it can have one:

- **A finished work offered Resume.** The place was let go only when a reading
  showed the last movement at rest; Spotify more often rewinds to the first
  movement or runs on. `app/place.ts` (`placeFrom`) now reads the reading before
  it too and lets go when the work ended any of those ways (`workEnded`), and
  when a work is marked heard — in the app or from Spotify's history — after
  the place was kept (`forgetPlaceBefore`).
- **Places kept only while the work's page was open.** They're kept from every
  reading now, on any screen (`observe` in `app/playback.ts`), for every work
  shown with Play or started from the app this visit; and a place records the
  album's division of the work, so a re-matched recording doesn't resume the
  wrong movement.
- **"Not started" overruled.** The programme page recorded a playing work as
  begun even after the listener set it back to "Not started", and on Play wrote
  it twice. It now notes a start only from a real reading, only when nothing
  at all is recorded of the work, and never after Play has recorded it.
- **Undo, completed.** It is offered even when Spotify's look for another
  recording fails; it also removes a stand-in found while the reject stood; a
  later "Yes, this is it" retires it; the reject writes its reset before it
  forgets the listening, so a sync between the two can't bring it back. The
  message no longer claims Spotify was asked when it isn't connected.
- **A paid reading repeated.** The pre-filled concert entry asked for the
  preparation from its loader, which reruns on every refresh: a failed reading
  was paid for again each time. It's asked once per visit now, from an effect.
  Concert keys include the hall and the hour (a matinee and an evening).
- **Words on tap:** "lied" (the verb) left the list; the sentence sent with a
  term is found by whole word; accents typed decomposed and no-break spaces
  match; terms are spans acting as buttons, so a drop cap and a small-caps
  first line reach them; keys stay with their "listen for" point when Focus
  filters the list.
- **Composer pages:** a concert still to come isn't "heard live"; a failed
  portrait offers "Write the portrait" instead of nothing; a portrait kept
  under one spelling ("Debussy") is found under another ("Claude Debussy").
- **Earlier hearing:** a hearing in another programme made since this one
  counts, with what was said there.
- **Links:** an address that can't be decoded reads as no address, never a
  blank app.

Settings → About now says *Release four · 14 October 2026*.

## 22. The older features, audited by risk (15 October 2026)

An audit of what came before release four, chosen by where bugs were most
likely: anything that reads a clock or a week (summer time ends on 25 October),
the Spotify pipeline (polling, matching, history), and anything that writes or
replaces stored data (backup, fresh start, the Notion mirror). Two reports from
listening on the phone joined it. Fixed, each with a test where it can have one:

**Time and the week**

- A page left open over Sunday midnight kept last week's directions: choosing
  one wrote into a week that had ended. The week page now notices the new week
  (on coming back to the page, on focus, and every minute) and reloads; a
  choice made from a stale page says so instead of failing.
- "Since" named a week by its Monday, so 2026-W01 (Monday 29 December) read as
  "December 2025". It now takes the month of the week's Thursday, as ISO weeks do.
- A time zone typed as an offset (`+02:00`, `Etc/GMT-2`, `EET`) was accepted and
  would have ignored summer time. Only a named zone (`Europe/Bucharest`) or UTC is taken.
- "Tonight" for a matinee: on the day itself a concert before 17:00 is "today".
- A concert still to come was told to the curator as one heard; a programme
  read without a year took the current year even in December for a January
  date — it now takes the year nearest today.

**Spotify**

- **A work ran on past its last movement.** The guard that pauses Spotify when
  a work started from the app runs on (`spotify/workGuard.ts`) needed the page
  awake at the moment the finale ended. On a phone the page is usually behind
  the Spotify app, and Chrome puts such a tab to sleep, so Cantus arcticus ran
  on into the Hymnus of *A Requiem in Our Time*. The guard now works out when
  the work should end from its last reading and the lengths of the movements
  still to come, and on waking stops what began at that moment — and only
  that: music that began later, or a skip made earlier, is the listener's. The
  armed work and its last reading are kept in localStorage, so a tab the
  browser discarded still knows. What no page can do: stop it while the phone
  keeps the page asleep. It stops the moment the page is looked at again.
- Polling Spotify after a failure (offline, a 429) went on every few seconds;
  it now backs off to five minutes and honours `Retry-After`. A token refreshed
  by one request is no longer thrown away by another that failed with the old one.
- The matcher could take a neighbouring work's tracks into a coupling (Grieg
  and Schumann concertos on one disc, Op. 16 and Op. 54): a track with another
  catalogue number is never part of the work (`MATCHER_VERSION` 6).
- A long work whose first movements scrolled out of Spotify's last fifty plays
  before its last were played never counted as heard. Each partial hearing now
  keeps the tracks it saw (`tracksSeen`) and grows in place as later syncs see more.

**Stored data**

- **A restore merged two journeys.** It added the backup's records to what was
  here, keeping weeks from one, threads from the other and the taste of the
  last. It now replaces the journey, after a confirmation, and saves the one it
  replaces to the downloads first. Every Notion page is checked again on the
  next sync (a page trashed by a fresh start is written afresh), the taste page
  is rewritten, a backup from a newer app or with nothing in it is refused, and
  this device's notebook is kept when the backup has none.
- A fresh start deleted the settings with everything else and wrote them back
  after: a page closed halfway left none. What it keeps is never deleted now.
- A note to the curator saved in the Notebook while the taste reading ran was
  overwritten by it; the reading now applies to the profile as it is then.
- A programme's ingest wrote back recordings it had only read, undoing a
  Spotify match that landed meanwhile; it writes only what it made.
- A Notion sync running during a fresh start or a restore went on writing the
  journey just cleared; it now stops at its next write. Both buttons wait while
  Notion is being updated. A programme page whose further reading failed to
  write had its text written twice on the next sync. A link with a space in it
  (Notion refuses it, and the whole sync with it) is written escaped.

**The listening view (from listening)**

- "Listen for" appeared twice — inline and again in a list below — and a point
  tied to the last movement showed only in that list. For a work in movements
  each point now sits under its own movement, beside the companion's note,
  always visible; the whole work's points stand above the movements ("Listen
  for, throughout"); the list below is gone. In Focus, once the music plays,
  only the movement sounding and its own points.
- A point that names its movement ("the third movement's swans", "the finale")
  goes there whatever the curator's tag said: Cantus arcticus had the swans
  under the first movement.
- The companion sometimes wrote fewer notes than tracks, which left the last
  movement without one (and could slide the others). A short answer is asked
  for again once, and notes kept short before this are written again once
  (`companion@2026-10-15.1`).

## 23. Every other screen, audited for structure and bugs (15 October 2026)

Six independent audits — Journal (with the season review), Library (with
composer pages), Threads, Notebook, Concerts (with Live in Bucharest, "I'm
going" and Before the concert) and Settings — each read the screen against the
app's purpose: a straightforward recommendation engine with all the history,
no dilemmas. Each finding was checked against the code before it was fixed.

**Journal.** A work is listed under its own programme's week, in running order —
it used to move to the week it was last touched, so playing an old work again
took it out of its week. One line per work (composer surname linked, title,
performers, state, what was said); the listener's word on the week under the
programme. "Offered" for an unchosen week, no "offered" tag on every row,
reworked and set-aside duplicates gone, no "Chosen from N directions", no
Spotify upkeep line. Companions read "More of this theme:" or "A sitting for
tonight:", also under a set-aside programme (since §32: "a sitting beside this week's theme", and an
evening of its own stands beside the programme, not under it). A concert still to come is never
"heard live". The season review: finished seasons only, and only those with
music in them (`season@2026-10-15.1`).

**Library and composer pages.** One shared loader and row (`domain/library.ts`,
`components/LibraryEntries.tsx`): the composer page is the Library's entry for
that composer, so it shows the recording actually heard (a stand-in), what was
said about the work itself, and respects hide-skipped. One row per programme
item — a stand-in that played shows "on Spotify instead of …"; "another
perspective" for a second recording; a perspective credited to its own
programme; the curator's recording first; Rimsky-Korsakov under R; no
durations; "Open in Spotify"; never-heard items of a set-aside programme left
out; no "In your threads" (its links landed at the top of Threads).

**Threads.** A direction switched away from is no thread of its own; a set-aside
visit counts only what was heard of it and says "set aside"; no visit or
minute counts; the title opens the last visit kept; threads ordered by when
they were listened to; "Questions it left", "How it landed" labelled. Paths
still open live on This week and in Where next only.

**Notebook.** Saving one field no longer throws away what is being typed in the
other (the page reloads on every save); a followed question leaves the list
and says what it did; the "next week" shortcut that overwrote the wish is
gone; history follows an impression through every change to where it ended;
no contradictory empty state; the settings ledger and the Notion fold — both
repeats of Settings — are gone; a profile missing a part reads as empty.

**Concerts.** The same evening can't be kept twice (it opens the one kept); a
concert can be removed (its Notion row archived on the next sync); a date
after today is refused, and one kept before this check sits apart under
"Kept before the evening", "Not yet heard" on its page. On the programme page
a concert is one line however many works it plays ("Debussy's La mer and
Ravel's Daphnis et Chloé at the Ateneu"), "Prepare for it →" on that line,
no repeated card; short titles ("La mer") count as the very work. After the
evening: "I didn't go"; "How was it?" on the day itself; a kept concert links
to its entry; the date said once; a preparation is written (and paid for) only
in the week before. All concerts is one newest-first list
(`components/ConcertEntry.tsx`, shared with the Journal); the pre-filled entry
asks "How was it?" first.

**Settings.** A time zone with a trailing space blanked the whole app for good;
zones are now chosen from a list and stored by their canonical name, and a bad
stored one is repaired on load. A restore is checked before it is confirmed,
downloads a before-restore archive only when there is a journey to keep, and
both restore and fresh start write in one transaction (`KeyValueStore.replace`)
— all or nothing. A failed fresh start says what Notion refused, and the pages
it already trashed are written again. Notion reads "Not updated" when it is
failing; Spotify keeps Disconnect while asking to reconnect, and its Client ID
can't be changed while connected. One Claude card (the real month's spend, one
sentence on the two models), one card for the app's look and week, "Backup",
explained depth and language, no "Check recent listening" (sync runs on load
and on return).

## 24. One close for a work, on both screens (15 October 2026)

- **The rows a work closes on are shared** (`components/WorkRows.tsx`). The
  programme and the listening view both end a work on *Your listening · <state>*
  and *More context · <heading>*: the same twisty, the same weight. The
  listening view's old "I've heard it" button and its "More context" link are
  gone; "Heard" is one of the four states, as on the programme, and still opens
  how it landed and *Play next*. Tapping the state it is already in records
  nothing.
- **More context, not yet written, is a row too.** Opening it is the asking
  ("written when you open it"); a failed ask leaves it open with *Ask again*.
  The programme's *Go further* line keeps only *Another perspective*.
- **Listen along sits under the Play that plays.** Where Spotify lacks the
  curator's recording and a stand-in plays instead, the row moves straight under
  the stand-in's Play, ahead of its framing and *Listen for* — it had sat below
  them, so on those works it read as missing.
- **Back lands where you were** (`app/router.ts`, `stepTrail`). Every route
  change used to scroll to the top. The app now keeps a short trail of the
  pages just left, each with its scroll position (sessionStorage, for the tab's
  life). Going back to one of them, by its link ("← the programme") or by the
  phone's Back, restores the place once the screen has drawn enough to reach
  it, and gives up the moment the listener scrolls or taps. A page opened
  afresh starts at the top; going back drops the pages visited after it.
- **One way back from the listening view.** Under *Play next*, the old "Back to
  the programme" link is now the same "← <programme>" link as at the top of the
  screen (`BackToProgramme`). Both go to the address the programme was last
  read at (`programmeBackHref`): "#/" when it was opened from This week,
  "#/p/<id>" otherwise. Before this, the link always pointed to "#/p/<id>", so
  coming from This week it landed at the top of the page.
- **Remembering where you were, the rest of it** (`app/router.ts`, `app/kept.ts`, `components/Twisty.tsx`):
  - Back from the listening view lands on the card of the work last listened
    to, after *Play next*, a reload, or a link from elsewhere too
    (`landingAnchor`, `landingY`).
  - Folds opened by a tap are kept per page for the tab's life, keyed by the
    page (`data-page`, so "#/" and "#/p/<id>" are one), the card, the label and
    the place. A fold the page opens itself is never recorded, and a fold
    reopened from memory never acts as tapped. That matters for *More context*,
    which is written when opened: the not-yet-written row is not remembered.
  - The Library search is kept for the tab. Unsent text (Ask, *What stayed with
    you*, the Notebook's notes and wish) is kept on the device until sent or
    emptied. Each feedback panel keeps its own draft (`place`). Fresh start
    and Restore forget all of it (`forgetPlaces`).
  - Tapping the tab already shown scrolls to the top. Every screen names
    itself in the browser title (`app/title.ts`).
  - The trail stores one spelling per page: the bare address an installed app
    opens at is "#/", so a link back to it is a hash change, never a reload. A
    newer route change cancels a restore still under way.
- **One way back, everywhere** (`components/BackLink.tsx`). Every "← …" link
  is the same component, with the part-break's fleuron drawn out into a rule
  between it and the page: under it at the top, over it at the foot. Screens
  reached from many places (a composer, a concert, a season, a preparation) go
  back to the page you came from, by its name.
- **Consistency pass.** The listening-state word has one source
  (`STATE_WORDS`), and lists show it with `StateTag`, where skipped steps back
  as on the programme. *Open in Spotify* is one component (`OpenInSpotify`).
  The Library's copy had armed single-track timing on every work. Upcoming
  concerts say their date one way (`whenWords`). The last raw folds (paths
  left open, *Also live*, Settings' how-tos) are twisties. Setting a recording
  aside asks through `ConfirmModal`, like every other doubt. In-page busy lines
  use `Waiting inline`. The composer page's heading is a section head. The
  "who played" line is `performerLine`.


## 25. Stabilisation pass (15 October 2026)

After a week of heavy change, six independent audits (listening and Spotify; the journey and its data;
every screen in a real browser; time and concerts; the curator, offline and the PWA shell; every option in
Settings) each reported only defects they had reproduced or traced exactly. What was confirmed, and fixed:

- **Listening.** One reading that still showed the previous track right after a tap on Play no longer
  cancels the assumed start (`ASSUME_GRACE_MS`), so a one-track work heard through with the phone asleep
  counts. A run-on the work guard saw (page asleep through the end) clears the Resume place and ends the
  work in the listening view as the readings around the close would have. A work that ended at rest
  disarms the guard instead of polling for hours. A tap on *Heard* while a one-track work plays, then
  letting it finish, is one hearing, not two.
- **Journey and Notion.** A restore takes the replaced journey's notebook pages to Notion's trash first
  (`repo.notionLeaving`, `archiveNotebook(…, only)`); changing the Notion page writes every row afresh
  into the new one; the Notion Journal and the Library read *set aside* by one rule
  (`setAsideProgrammes`); a stand-in is still found for a recording Spotify lacks after an "Another
  perspective" was asked for.
- **Curator and cost.** A companion reply a note short is no longer padded (every later note sat one
  movement early, and the re-ask could never fire); a failed automatic stand-in search, week, or
  shared-screenshot reading is retried only for failures in passing (`passing`: offline, busy), not
  re-paid on every visit; *Look again* really looks again, and a search cut off is a failure, not
  "nothing found"; the worker no longer answers the new-version check from its cache.
- **Concerts.** The same evening is recognised however the hall is written ("Ateneul Român · Sala Mare"
  against "Sala Mare"); a screenshot with no year is dated on or before today.
- **Settings.** *Works with voices* and *Concertos* off are checked in the programme validator, not only
  asked for in the prompt (`needsVoices`, `needsSoloists`). A changed *Language* writes "More context" and
  the listening notes afresh (they carry the language they were written in). Settings changed in one tab
  are no longer overwritten from another, and the key is never written back blank. Text size paints with
  the theme, before the app loads. Every preference is one of its own values or its default
  (`normalisePreferences`). The hint says "usually in two to four sections": nothing forces two.

- **Screens (browser walk at 390 and 1280 px, light and dark).** A double tap on *Keep* no longer keeps a
  concert twice, and two directions chosen in one tick write one programme (a ref guard, as *Heard* has).
  A concert just kept goes back to *All concerts*, not to the empty form it was kept from; a page that
  wasn't there ("There's no such…") is never offered as a way back (`GONE`, `data-not-found`).

- **A sitting is found again (20 October 2026).** A made sitting was stored and listed in the Journal, but on
  the week's programme it sat only in the folded *More of this theme* row at the foot. This week now names
  what was made beside it right under the dek ("Also this week", `AlsoThisWeek` in `Programme.tsx`; on a
  sitting's own page, "Also from this programme" — "Also that week" since §32). The request and hours typed into *A sitting for tonight*
  are kept on the device (`useKept`, `sitting-request`/`sitting-hours`) until the sitting is made, so a
  closed app mid-build doesn't lose them; the folded line then says "not made yet".
  A sitting needn't belong to the week's theme: with a thread this week the card offers *on its own* (the
  default — the curator gets neither the week's direction nor its thread, `Sitting.own`) or *beside this
  week's theme*. (Until §32 both were still filed into the thread; now only the second is.) Every sitting says the day it was made (`madeWords`, a weekday in the Settings zone, nothing finer) on its page, in
  "Also this week", the Journal and Threads, and "Also this week" lists them oldest first.

Known and left: concert dates are Bucharest dates but "today" is judged in the Settings zone (harmless
while the zone is Bucharest); two tabs share no in-flight guard across a fresh start; a concert marked as
going whose start time changes is a new mark.

## 26. Batch one of the QoL audit (23 October 2026)

From a read of the whole app for everyday friction and trust (the audit report is in the session, not the repo).
What it changed:

- **The journey is guarded.** At start the app asks the browser to keep its storage
  (`navigator.storage.persist`, `app/backup.ts`). Each backup saved remembers its date: Settings says
  "Last saved on …" (and says so when the browser hasn't agreed to keep the data), and once a journey is
  three weeks old with no backup for four weeks, This week carries one quiet line with *Save a backup* and
  *Not now* (a fortnight) — `BackupNudge`. No count, no badge.
- **Waits are honest.** A curator request gives up after four minutes ("took too long… nothing was lost"),
  a `failed`, not `offline`, so it is never asked again by itself. A job the listener waits on (directions,
  a programme, a pair, the season, a concert) says once past half a minute that it is still with the curator,
  and says so when a first answer wouldn't do and it asks again (`onProgress` on `directCurator`,
  `curatorProgress` in `app/services.tsx`).
- **Nothing paid for is hidden.** A fold held open while something inside was on its way (`Twisty`'s `open`)
  stays open once it has come or failed; it used to close on the answer. On the programme, *A different
  direction* lists the week's earlier three as well as the latest (This week still keeps them as paths
  "for another week", as pinned).
- **The listening view is safer on an armrest.** A reaction, "want more" and what it's about are kept
  as drafts with the note, so "Loved it" then *Play next* (or closing the app) no longer loses them, and a
  panel with something half-said opens open. A work that ends by itself puts "Heard. How did it land? ↓"
  by the player. A tap on the movement already sounding does nothing (a brush used to restart it).
  *Play next* doesn't restart a work the playlist already went on into. Movement notes all show while none
  of the work is sounding, so they can be read before Play. A failed "heard" is said, not swallowed. The view
  opens at the work's heading, past the masthead and back bar (`arrivalAnchor`, `app/router.ts`).
- **A device can be chosen.** When Spotify has no active device, the player lists the ones it can see
  ("Play it on LG TV · Galaxy S24") and plays on the one tapped (`device_id`, `Playback.playOn`).
- **The Library leads back into the listening.** A work's title opens the listening view of its latest
  programme item (`LibraryRecording.itemId`), with the notes, what to listen for and the earlier hearing.

## 27. Batch two of the QoL audit: memory you can act on (23 October 2026)

- **Threads lead somewhere.** Each thread's *Questions it left* and *Where it could go next* carry
  *Ask for three directions from it*, and the thread itself *Return to this thread* — the Notebook's follow, shared as
  `useFollow` (`app/follow.ts`): before a choice this week, three directions replace the three on offer; after
  one, they wait under Where next. A request that names a thread now brings its digest even when it is older
  than the twelve latest the curator usually reads (`buildContext`), so a thread past the twelve can still return.
  A returning programme links to *The thread so far*.
- **No tallies.** A thread's facts name who it holds and how far in, in words: "Debussy, Ravel, Roussel and
  others, written between 1911 and 1977 · partly heard" (not "9 works by 6 composers · 2 heard so far"); the
  running order no longer adds "· 3 heard" (the state tags already say it). Inventory words that aren't
  progress (the week's number of works, "2 so far" on a fold) stay, as §10 allows.
- **Names lead to the Library.** Every performer's name — the programme, the listening view, the Library,
  concerts — opened the Library searched for them. *Superseded in batch three (§30): a name now opens the
  performer's own page, and `keepAhead` is gone.*
- **The season's "worth hearing again"** opens each work's latest listening view.
- **The Notebook can be corrected, and says why.** Each observation says what it rests on ("From what you
  said of Sibelius's Tapiola and Debussy's La mer", from its evidence ids). *Not quite* takes an optional line
  and keeps it as feedback on the observation (`FeedbackTarget` type `observation`); with a key it is read
  at once — the taste prompt (`taste@2026-10-23.1`) replaces that observation with what the words support —
  and until then the page says it will be reconsidered. Not yet run against the real model (`npm run check:curation`).

## 28. Back to the listening, from the masthead (23 October 2026)

A mark of the app's own (`ListeningMark`: a point sounding, three arcs going out) sits in the masthead beside
the guide and Settings, and leads to the listening view of the work that is sounding — from any screen,
whichever device it plays on and however it was started (Play, the week's playlist, Spotify itself), a
stand-in included (`listenTargetFor`, `domain/nowListening.ts`: this week's programmes first). Its states:

- **playing** — in the accent, its arcs breathing in turn (still under `prefers-reduced-motion`);
- **paused** — muted, same destination;
- **left part-way** — nothing of the app's sounding, but a work holds a place kept on this device
  (`app/place.ts`) from the last eighteen hours, however it was played — the programme's *Resume*, the
  listening view, Spotify itself (`leftPartWay`): muted, "Back to …, where you left it". (First built from the
  listening view last opened, which missed a work resumed from the programme page; fixed the same day.)
- **not shown** — nothing to go back to, music no programme holds, or already on that work's listening view.

It reads the shared player watch, so a screen with no Play button now looks at Spotify too (every 15 s while
idle and visible).

## 29. A single-track work heard through a playlist (23 October 2026)

Spotify's recently-played says a track was played, never how much of it: it appears after about thirty
seconds. A work in movements is read by how many movements were reached; a single-track work (Clyne's
*Prince of Clouds*) used to stay "Started" for good unless the app watched it end, so a playlist heard with
the app closed never marked it. Now the timing decides: plays heard back to back sit one track-length apart,
so the listener's own history shows which end of a play Spotify stamps (`playedAtMarks` — its start or its
end; Spotify doesn't document it, and three clear matches are needed before it is trusted), and a single
track whose neighbouring play is at least nine-tenths of its length away (and not more than two minutes over)
ran through (`playedThrough`): `heard`, which also brings "How did it land?". A long gap — a pause, a quiet
hour — proves nothing and stays "Started"; "Heard" by hand still works as before.

## 30. Batch three of the QoL audit (23 October 2026)

- **Where you are mid-week.** Once something is begun, the running order marks the first work not yet heard
  "next" ("pick up" when it was started), and ends on *Where next ↓*, one tap down past the essay and the
  works. On Saturday and Sunday, with music still unheard, it says the week ends tomorrow or tonight — and
  that what isn't heard stays in the Journal. No count.
- **Open paths, one rule.** `OpenPaths` shows the nine most recent and folds the rest under *Older paths*,
  the same on This week and in Where next (This week used to cut at nine, Where next to list them all). A
  direction tagged *left open* in the Journal can be taken from there (*take it now*), with the same
  confirmation when the week already has a programme.
- **The Library three ways.** *Everything* (as filed), *Heard* (only works heard, in a recording or live) and
  *Recent* (newest met first, without the guide letters) — `viewLibrary`. Search also reads what you said
  (your reaction, your words), the programme a recording came from, the work's form, and a concert's hall and
  note: "the tennis ballet", "loved".
- **A performer's page.** Every performer's name now opens `#/performer/<name>`: the works you've heard them in
  — conductor, soloist, orchestra or ensemble, matched whole — and the evenings they were heard live, read
  from the Library as the composer page is (`performerEntries`). No portrait: a performer's life is the fact
  likeliest to be wrong, and their part is in the recordings. (Batch two's Library search by name is retired.)
- **Concerts from your listening.** Concerts shows what's coming up at the Ateneu and Sala Radio with music
  heard here — the very work, a performer from its recording, its composer — loved and interesting first, five
  at most, each with *I'm going*. From the day's listing (`liveEvents`), no curator calls.
- **A first screen that says what this is.** With no key, This week is a welcome: what the curator does, and
  the three things to set up in order (key needed, Spotify recommended, Notion optional). A key that stopped
  working says so as itself, not as a first visit. The one-time explanation on the first week's directions
  holds for the visit rather than vanishing at the first reload.
- **Smaller.** The listening view keeps the screen awake only while its work is on (playing or paused in it).
  "That was the last work" says *this evening* for a sitting and *of this programme* for more of a theme.
  Choosing a device after Resume found none carries on from where it was paused, not from the top. §20's
  account of Focus corrected.

## 31. Stabilisation: the curator speaks of the music, one word for each thing (23 October 2026)

An audit of three real weeks (W41–W43), a sitting, the taste page and every screen, in three tiers. The
report lives with the session; what it changed:

**Tier 1 — what was wrong or growing worse.**
- **Prompts.** Every prompt carrying the voice moves to `@2026-10-23` (taste `.3`, resources `.2`; concert,
  which has no voice, stays). The voice: the listener's words are for understanding them, never handed back
  ("the growing and ebbing quality you enjoyed") — except in the taste reading and the season in review,
  whose subject is the listener. The programme: at most **two** items refer to the listener's listening
  (`why` and `whyThisRecording` together), no earlier work named in more than one, *Why this recording* about
  the performance; the continuity note is the only look back (the introduction opens on this week's music).
  `npm run check:curation` now reports *Items that speak to the listener* against that limit
  (`speaksToListener`), and its returning-theme profile carries loved works with notes to tempt it.
- **Taste stays a portrait.** Observed: 54 lines after three weeks, most one recording each. Now a reaction to
  one recording strengthens the observation it belongs to; `absorbs` (a new TASTE field, required in the
  schema) lets one observation retire others — their evidence and the surest confidence come with it; a
  correction (`replaces`) still takes the model's word. Past `TASTE_TIDY_ABOVE` (24) active lines a reading
  also merges down to about twenty (`tidy`); the Notebook offers *Gather it into fewer lines* when it is long
  and nothing waits to be read. The Notebook and the Notion taste page set the firmer lines first and fold
  first impressions beneath (*First impressions*); the page is rewritten once for the new layout (`v: 2`).
- **Notion.** Once a week (`notion:settled:<week>`) the Journal is asked for rows still saying *This week*
  that aren't this week's tracked pages, and those become *Earlier* — a row the app no longer tracks (week 41's
  was found so) would otherwise say *This week* for ever. An unchanged notebook still costs no calls.
- This week's *Returning* box names the thread once; the Notebook's note points at *Not quite*.

**Tier 2 — one word for each thing.**
- The weekly choice is a **direction** everywhere: *Three directions for the week*, *Take this direction*,
  *Left open from earlier weeks*, *Take it this week* (the Journal's row keeps its tag and action together on
  the right). *Path* and *way* are gone from the screens.
- *How it landed* names saying how something went; the Notebook is *What the curator has noticed*, so *Your
  listening* means only a work's state; Threads read *not started / started / all heard*.
- This week's two settings rows are one fold, *Made with your settings*, whose line reads on its own (`glance`
  words in `domain/exploration.ts`, wrapping, never cut off) with *Tune this week* inside it.
- A part's guide line no longer says "the second part, of three" (`partWords` removed); *How they connect*
  on screen and in Notion; *For you*; catalogue numbers read "L 109, in Debussy's catalogue".
- `creditLine` lists conductor, soloists, orchestra — the order of every list (`creditRows`). Notion's
  Performers columns are rewritten once by it; programme pages already written keep their order.
- Without Spotify, *Look for it on Spotify* is a small link and *Listen along* the way in. *More context*:
  "the curator writes it when you open it". The listening view's *Focus* is *Just the music*.
- *Look for it on Spotify ↗* is one small link everywhere it appears (programme card, a recording not found,
  the listening view, Concerts, Before), never an outlined button competing with Play or Listen along.
- *Just the music* changes the page the moment it's pressed: before anything plays it folds away the notes
  under each movement (leaving the movements and what to listen for) and the button then reads *Show
  everything*. Before, it only trimmed the list once music played, so on an unplayed work it seemed to do
  nothing (reported 23 October 2026).
- *Gather it into fewer lines* ran out of room on a real 54-line profile: the taste job's 6000 tokens held
  Haiku's thinking and twenty merged lines. It now has 20000 (billed as used), and a merged line cites only new
  feedback, never the absorbed lines' evidence, which the app carries over itself (`taste@2026-10-23.3`).

**Tier 3 — length and what was really heard.**
- The programme's closing list of recordings is print-only; the sign-off line stays on screen.
- Further reading spreads across the works (two at most on one) and is told each work's recording, so a
  review of another performance says so.
- A Notion programme page says what Spotify played instead (*Heard on Spotify instead*), in the part of the
  page rewritten as it changes.
- Settings: a connection that works folds its fields, buttons and how-to under *Manage*; warnings stay out.
  *Modern* recordings (and its hint) mean 1980 on, an older one only where no good modern one exists, and said.

## 32. Evenings of their own (24 October 2026)

A week has two axes: **time** (the Journal's calendar — everything heard, in order) and **theme** (a thread's
argument — only what belongs to it). A sitting for tonight is always on the first; it is on the second only when
it was made beside the theme. Before this, every sitting made beside a week's programme was filed into its
thread, however far it strayed ("Pulse, Voices, Light", American minimalism, under *Northern Light*; "Slow Light,
Many Voices" under *Orchestra and Soloist in Conversation*), so its works counted as the thread's covered music,
its composers and years joined the thread's summary, and Notion's thread row carried it.

- **Membership is the exploration's `extraProgrammeIds`** — the one record every thread reader already uses
  (`domain/evenings.ts`: `threadMembers`, `isOwnEvening`). A sitting beside a programme (`extends`) but outside it
  is an evening of its own. `Journey.sitting` now records `own` either way; an own evening is never added
  (`companion_`); `Journey.placeEvening(id, withTheme)` moves one in or out.
- **The backlog**, once per device (`Journey.settleEvenings`, mark `repair:evenings-of-their-own`, run at
  start-up beside the stand-in repair): every sitting except those made beside the theme since the choice was
  recorded (`own: false`) leaves its thread. Keyed on the flag, not only the mark, so after a fresh start a
  sitting made beside the theme is never swept out.
- **What was heard stays.** Listening, notes and reactions are on the recordings: an own evening is still in
  recent listening, already programmed and the taste; only the thread stops counting it as covered.
- **Journal:** own evenings are siblings of the week's programme, each with its day and a moon mark (*Saturday ·
  an evening of its own*); a sitting beside the theme keeps its place under the programme (*a sitting beside
  this week's theme*). Their works stay in *What you listened to*.
- **Threads:** an own evening is in no thread's visits; they gather in the fold *Evenings of their own* at the
  foot, newest first, each with **Ask for three directions from this evening** (named *Follow this evening* until 24 October) — three directions that start from it, and only then a
  thread (`eveningSeed`, through `useFollow`).
- **Programme page:** the eyebrow says *An evening of its own* (moon) or *A sitting beside this week's theme*; a
  line under it says where it stands, with **Belongs with this week's theme** / **Make it an evening of its own**,
  and for an own evening **Ask for three directions from this evening**. It is not told as a return to the thread. *Also this week*
  marks each the same way.
- **Notion:** an own evening's Journal row reads *An evening of its own* for Theme, with no Visit; thread rows
  drop it on the next sync.
- **Audited the same day.** On an evening's own page a word on it is about the evening ("How did the evening
  land?"), never "the theme itself"; *More of this theme* on the programme's page names only theme programmes,
  not sittings. An earlier week's
  labels say "the week's theme", not "this week's"; its programme page heads the list *Also that week*. The
  Journal line says what the evening was asked for. Making one says where it went. The season review tells an
  evening of its own from a sitting beside the theme, and no longer drops an own evening because its week's
  programme was set aside.
- **One way on, from the week's programme (owner's review, 24 October 2026).** Every evening that extends the
  week, a sitting or more of the theme, ends on *The end of the evening*: a link back to the week's
  programme and *How it landed*, nothing else. *Where next* (more of the theme, a sitting, another direction,
  left open, a wish) lives on the week's programme alone, so there is one place to go on from, not one per
  evening; the running order's *Where next ↓* and *The week ends tomorrow / tonight* are likewise the week's
  programme's only. *Save as a Spotify playlist* sits under the title and standfirst, above *Also this week*,
  so it reads as this evening's.
- **Read as an evening, throughout.** A sitting's section guides, reading-list prompt and colophon say
  "evening" where a week's say "week". Once every work of an evening is heard (skips allowed) and nothing
  has been said of it, *How it landed* opens by itself, marked *all heard*.

## 33. Shape next week (24 October 2026)

The owner asked for "a light-touch orchestration of the curation engine" before a week's three directions
are written, so they arrive shepherded rather than as complete surprises. Roadmap items 27–29.

- **When.** Under *Where next* on the week's programme, *Shape next week* replaces *A wish for next week*
  once two thirds of the programme is heard (a skip counts as done with), or on the week's last day with one
  work heard (`shapeOpen`, `domain/shaping.ts`). Evenings don't count; they have no *Where next*. Nothing runs
  on Sunday night: the three are still written when the app is first opened in the new week.
- **The check-in** asks nothing of the curator: where next week goes (*stay with this thread · somewhere new ·
  either*), how it should feel (the four week moods of *This week, differently*) and something to chase or
  avoid, which is the Notebook's wish for next week (`preferences.nextRequest`), one set of words wherever
  it is written. The moods become the new week's mood when it begins, so the programme follows them too.
- **Sketches** (`sketch@2026-10-24.1`, Haiku): a title, a line and what it grew from for each shaped slot.
  *Nudge* redrafts one with the listener's words (kept, and passed on); *Another* replaces it, and the one
  passed over is never sketched again for that week; *Leave to the curator* hands a slot back. One slot is
  left to the curator by default, the adventurous one — a surprise on the day; *Sketch this one too* takes it
  on. *Start again* clears it all.
- **The day.** `generateWeek` reads `shape:<week key>` from the marks at the start of a week only (never for
  *three others*, a rework or a direction to follow) and sends `shaped` with the themes call
  (`themes@2026-10-24.1`): each sketched slot is written from its sketch and names it in `shapedFrom`; the
  validator sends back a sketched slot that names none, mends a near miss to the sketch's own title, and
  clears a claim on the curator's slot. Feedback is read first as always, so the weekend's listening still
  counts. A shape for a week that has passed is never read.
- **Where it came from.** Each direction on This week says *From your sketch*, *From your sketch, nudged: "…"*
  or *The curator's own*, and *Made with your settings* adds "shaped by you: two of three"
  (`ProgrammeOption.shaped`, `WeekRecord.shaped`). A week nobody shaped looks exactly as before.
- **Audited the same day** (owner's request), and fixed:
  - *Three others* on a shaped week kept "shaped by you: two of three" while all three new directions said
    *The curator's own*. New directions now clear the note; a rework of the same three (a setting changed)
    keeps it, with each reworked direction still marked as from its sketch.
  - Sketches went stale silently when where, the feel or the wish changed after they were drawn. Each sketch
    now keeps what it was drawn from (`basis`, `shapeBasis`); one drawn before the last change is marked *out
    of date*, and *Sketch them again* redraws those only (`resketchStale`). A nudged sketch is never called
    out of date: the listener moved it themselves. Sketched again is not passed over, so a title may return.
  - A wish typed and walked away from was lost unless *Keep it* was tapped: it is now kept on leaving the
    field too.
  - The folded line said "three sketches" with one slot left to the curator: it now says what is there
    ("two sketches, one left to the curator", "not sketched yet").
  - *Start again* cleared paid-for sketches in one tap: it now asks first, and says the wish stays.
  - A direction the curator retitled said only *From your sketch*: it now names the sketch it came from.
  - The Notebook's wish says where *Shape next week* is.
  - **Cheaper.** Sketches were already on Haiku (`MODEL_FOR.sketch`, pinned by `curator.test.js`); they now
    send only what decides a direction — taste, threads, open paths and questions, recent weeks, concerts,
    the wish — not the work-by-work history (`recentListening`, `alreadyProgrammed`, `alreadyKnown`,
    `secondHearings`), which the week's own call still gets on the day.

