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
| Curator (Claude) | `api/long-listen.js`, which holds `ANTHROPIC_API_KEY` | The brief forbids a browser-held key. **Every other app here is BYO-key in the browser; this one deliberately is not.** |
| Notion mirror | Written through the same endpoint with `LONG_LISTEN_NOTION_TOKEN` | Human-readable notebook, one way, app → Notion (§7). |
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
`user-modify-playback-state`. The PKCE callback is validated: state must
match, the verifier is single-use, and sign-ins older than 15 minutes are
refused.

**Listening detection**: on each app open, recently-played (last 50) is
matched to verified recordings' track ids. A session (plays within 3 h)
covering ≥60% of a work's tracks is `heard`, less is `partial`. Each session
is recorded once and upgraded once if finished later. Spotify can only move a
recording forward; the listener's own marks win.

## 7. Notion

A one-way mirror of what a person would reread. On first sync it creates,
under `LONG_LISTEN_NOTION_PAGE_ID`: **Journal** (one page per programme,
written once, as the curator wrote it), **Listening threads**, **Works &
recordings**, and a **Musical taste** page that is rewritten when taste
changes. Hash-skipped: an unchanged entity is never rewritten. No ids,
prompt versions or match confidences cross over. The server route only
allows these call shapes, and only under the configured page
(`refuseNotionCall`).

## 8. Setup

Vercel env (Production):

| Variable | |
|---|---|
| `LONG_LISTEN_ACCESS_KEY` | the passphrase the app asks for; without it the endpoint answers 501 |
| `ANTHROPIC_API_KEY` | already set for Law of the Day |
| `LONG_LISTEN_NOTION_TOKEN` | optional — a Notion internal integration token |
| `LONG_LISTEN_NOTION_PAGE_ID` | optional — the page to build the notebook under, shared with that integration |
| `VITE_LONG_LISTEN_SPOTIFY_CLIENT_ID` | optional default for Settings |

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
