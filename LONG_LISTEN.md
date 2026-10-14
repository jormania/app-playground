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
listener's "I've heard it". On the listening view it opens the same
panel as "I've heard it". Works in movements are left to Spotify's history,
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
  never "heard" from it, a session counted once as it scrolls out of the fifty);
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
- *Keep listening* (`screens/ListenMode.tsx`). "I've heard it" asks how it
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
- *Questions as directions*: the Notebook's questions each have *Follow this*
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
  and is told what the thread has covered; with none, it becomes the week's
  programme and starts a thread named for the evening. It never pays for the
  week's three directions. Sized by the hours (at most four works for an hour,
  six for two, never fewer than two). Offered on This week and under "Where
  next" on the programme.
- **Season in review** (`domain/season.ts`, `curation/season.ts`,
  `screens/Season.tsx`, prompt `season`). Twelve listening weeks, counted from
  the first week with anything in it. When a season ends the curator writes one
  page: the threads, where taste moved, what is still open, and up to four
  works worth hearing again — only works actually met, enforced by the
  validator. Before then, once two weeks are behind it, a provisional "so far"
  (two works at most), rewritten at most once a week. Asked for by a button,
  never on its own; cached in `marks` (`season:<n>`, or
  `season:<n>:sofar:<week>`). Linked from the Journal.
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
week, Where next, Threads). `components/common.tsx` holds `NeedsKey`,
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
  "listen for" points and the controls, a size larger. "Show everything" brings
  the rest back.
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
