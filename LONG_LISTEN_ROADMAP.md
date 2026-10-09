# The Long Listen — roadmap

What comes after release one. Written 2026-10-09, at the end of the build that
added the exploration settings, *Where next* and the fresh start.

**Order of work:** release one is being tested in daily use first. Bugs found
in that test are fixed before anything here starts, and the test may re-rank
this list — an item that answers something that kept getting in the way goes
up, one nobody would reach goes down. Release two is the "Release 2" section
below; the rest is later, or an open question.

Ranked by how much each item adds to the listening itself, weighed against the
effort. The product rules in `LONG_LISTEN.md` §1 still hold for every item: no
counts, no streaks, no scores, taste in prose, choice without judgement. When
an item is done, strike it here and describe it in `LONG_LISTEN.md`.

Effort: **S** is a day or less, **M** a few days, **L** a week or more.

## Before release two: finish release one

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 0 | Fix what the release-one test turns up | The test is the point of release one; nothing below is worth more than a programme that works every week | — |
| 0a | Call it release one | Bump the About line, write the changelog entry in the Notion spec and handover, update the guide | S |

## Release 2

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 1 | **Tune this week** — the breadth, familiarity and length settings offered beside the three directions, for this week only | Settings are a standing preference; a mood is a week's. Today changing one means a trip to Settings and back, and changing it back later | S |
| 2 | **Live in Bucharest** — when a programmed work, composer or performer is on at the Filarmonica George Enescu, the Ateneu or the Radio hall, say so on the programme | The strongest thing a curator can do is send you to the hall. Marquee already reads these programmes (`api/_lib/marquee/filarmonica.js`, `salaradio.js`); the Long Listen only needs to ask, not scrape. A quiet line, not a calendar | M |
| 3 | **A listening log that doesn't miss things** — check recently-played on a timer while the app is open, and from the installed app's periodic background sync (`src/shared/notify/`) | Spotify only shows the last fifty tracks. A long week of other music between opens loses the classical listening, so the curator thinks a heard symphony was never played | M |
| 4 | **Bring your own repertoire** — from Spotify's saved albums and followed artists, propose works the listener already knows, to confirm in one pass | "I knew this already" works one item at a time, after the fact. A first week that knows you've loved Mahler 2 for twenty years starts somewhere better | M |
| 5 | **Season in review** — every twelve weeks, a page of prose: the threads that grew, where taste moved, the paths still open, a few things worth hearing again | Memory is the app's distinctive idea and it's mostly invisible. A written look back (never a count of hours) makes it something you read, and gives the curator a compact summary to work from | M |
| 6 | **Stand-ins and pairs in the notebook** — "On Spotify instead" recordings and side-by-side pairs written to Works & recordings | The notebook is the record you keep; today it leaves out the recordings you actually played when the named one was missing | S |
| 7 | **A curation check you can run** — a fixed set of listener profiles (narrow and familiar; broad and obscure; Romanian; a returning theme) run against the prompts, with the validator's verdicts and a short human read | Prompt changes are where quality moves, and today only daily use shows it. Without this, every prompt tweak in release two is a guess | M |
| 8 | **Recording facts from MusicBrainz** — year and performers checked against an open database, not only the model's memory and Spotify's ℗ line | Recording years and performer lists are the facts most often slightly wrong. MusicBrainz is free and needs no key | M |

## Later

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 9 | **An evening, not a week** — a single sitting of an hour or two, asked for on the day ("something for tonight, quiet, nothing I know") | Some weeks there's one evening, not seven. Built on the same curator, recorded in the same threads | M |
| 10 | **A second listener** — a profile of its own on the same device, for Nora, with a younger voice in the writing | Taste, threads and listening must not mix. Large because every collection gains an owner; only worth it if she'd use it | L |
| 11 | **A map of the threads** — themes and the works in them on a timeline of centuries, with the connections the curator drew | Breadth now asks for connections across periods; a picture would show where you've been and the gaps. Must stay a map, never a scorecard | L |
| 12 | **Romanian throughout** — the interface, not only the curator's writing | The curator already writes in Romanian; the buttons and Settings don't. Mostly copy, but a lot of it | M |
| 13 | **Offline programme** — this week's programme, notes and recordings list kept for reading without signal | A service worker already caches the app; the data comes from IndexedDB, so most of this is there. Worth checking during the test before building anything | S |

## Different ways to go — decisions to make, not items

These change the shape of the app. Each is worth a deliberate yes or no rather
than drifting into it.

- **Spotify as the only player.** Everything about "heard" leans on Spotify:
  verification, playlists, listening detection. Apple Music and YouTube Music
  have no equivalent of recently-played that a browser app can read cleanly;
  Idagio and Presto have better classical metadata but no open API. The
  realistic alternative is not a second service but making the app fully
  useful *without* one — listening marked by hand, recordings as links — which
  it mostly already is. Recommendation: stay with Spotify, keep the manual
  path first-class.
- **A small server.** Everything runs in the browser by design (BYO key, no
  function of our own, 11 of 12 Vercel functions used). Items 2 and 3 would
  each be easier with a scheduled server job — but the project has one slot
  left and the shared relay works. Recommendation: no new function; fold
  anything server-side into an existing endpoint, as Marquee's scan already
  is.
- **A cheaper model for the small jobs.** Further reading, the taste update
  and a single comparison could run on Haiku (`src/shared/models.js`). It
  saves money, not quality, and item 7 is what would show whether quality
  holds. Recommendation: only after item 7 exists.
- **Weekly rhythm versus on demand.** The week is the unit, and it gives the
  app its calm. Item 9 adds evenings without replacing it. Recommendation:
  keep the week as the spine.
