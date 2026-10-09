# The Long Listen — roadmap

What comes after release one. First written 2026-10-09; rewritten the same day
after reading what listeners, programme-note writers and recommender research
say about the problems this app tries to solve (sources at the end).

**Order of work.** Release one is tested in daily use first. Bugs found in that
test are fixed before anything here starts, and the test may re-rank this list:
an item that answers something that kept getting in the way goes up, one nobody
would reach goes down. Release two is the section of that name below.

**What release two is for**, in the owner's words: smooth out the experience,
never be cumbersome, be more varied and creative, and make good use of AI. Every
item below serves at least one of those, and each says which.

The product rules in `LONG_LISTEN.md` §1 hold for every item: no counts, no
streaks, no scores, taste in prose, choice without judgement. When an item is
done, strike it here and describe it in `LONG_LISTEN.md`.

Effort: **S** is a day or less, **M** a few days, **L** a week or more.

## What the research says, and what it changes

- **An introduction makes unfamiliar music land.** In a 2026 study, 38% of
  listeners said a song outside their taste broadened it when it was played
  cold; with a short *informative* introduction (context, what inspired it)
  that rose to 56%, with a story-like one to 49%. Dull introductions hurt. The
  authors suggest LLM-written introductions and warn that an AI *voice*
  undermined credibility. → The app's written notes are the right instinct;
  carry them into the listening itself (item 6), keep them written, not spoken.
- **Liking grows with hearing, even for complex music.** Over four weeks of
  repeated listening, liking rose for simple and complex pieces alike, and the
  strongest predictor of liking was familiarity with *similar* music. → Bring a
  difficult work back on purpose (item 8), and know what the listener already
  knows so new music can be reached from it (item 12).
- **Listeners want reasons, control, and to be read correctly.** Interviewed
  streaming users wanted to know *why* something was recommended, felt
  ownership of "their algorithm", and were put off by wrong guesses about who
  they are or how they feel right now. → Reasons that point to a specific
  moment in the listener's own history, never a label (item 9); a way to
  answer the curator's questions (item 4); this-week tuning for mood (item 5).
- **Conversation helps people find what they want.** A three-week diary study
  of LLM music recommendation found it helped people put implicit wishes into
  words and explore in their own direction. → Ask about the music while it
  plays (item 7); answer the curator (item 4).
- **Programming is a creative act.** Programme-note and concert-programming
  guides treat the order of works as an argument — juxtaposition sets up a
  dialogue — and a note's two jobs as history and what to listen for. → Vary
  the *form* of a week, not only its contents (item 2).
- **What people dislike in AI music features**: Spotify's AI DJ is criticised
  for loops of the same songs and for a synthetic voice talking over music;
  "algorithmic" listening is criticised for narrowing taste. → No spoken host,
  no endless feed (see *Decided against*).
- **Classical metadata is hard and models invent things.** Streaming catalogues
  split works into loose tracks and mix up performers; an offline study of LLM
  recommenders found up to ~15% of suggested tracks were not in the catalogue.
  → The app's rule that only a confirmed Spotify match counts stays central;
  better recording facts are in *Later* (item 15).

## Before release two: finish release one

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 0 | Fix what the release-one test turns up | Nothing below is worth more than a programme that works every week | — |
| 0a | Call it release one | About line, changelog in the Notion spec and handover, the guide | S |

## Release 2

Ranked. Items 1–9 are the release; 10–12 go in if the first nine land well.

| # | Item | Serves | Why it matters | Effort |
|---|------|--------|----------------|--------|
| 1 | **A curation check** — a fixed set of listener profiles (narrow and familiar; broad and obscure; a returning theme; Romanian) run against the prompts, with the validator's verdicts and a short read of the writing, before and after any prompt change | AI | Items 2, 4, 8 and 9 all change prompts. Without a check, each change is judged by living with it for a week. Runs on demand with the owner's key, never in CI | S–M |
| 2 | **Shapes of a week** — the curator chooses a form as well as a theme: a journey through one form across centuries, one work heard three ways, *then and now* (an old piece and the new one that answers it), one city in one year, a performer's week, a dialogue between two composers. The form is named on the direction card | Varied, creative | Today every week has the same shape: two to four sections of works. Varying the form is the cheapest large gain in variety, and the settings (breadth, familiarity, pairs) still bound what goes in | S–M |
| 3 | **React where you listen** — "I've heard it" in the listening view opens the five reactions and a line for a note, right there; one tap and back | Smooth | Feedback is how the curator learns, and today it means going back to the programme and finding the panel. The less it costs, the more of it there is | S |
| 4 | **Answer the curator** — the questions the curator holds about your taste (already shown in the Notebook, with no way to reply) offered one at a time at the end of a week, with a one-line answer that goes straight into taste | Smooth, AI | The curator asks good questions and never hears back. One answered question tells it more than a week of inferred reactions | S |
| 5 | **Ready when you arrive, tuned for this week** — next week's three directions are prepared when the app is opened in the last two days of a week, so Monday opens without a wait; beside them, this week's breadth, familiarity and length can be changed for this week only, and *Let the curator choose* picks one, with a line why | Smooth | Two waits and a trip to Settings stand between opening the app and listening. A wish written after the directions were prepared is offered as "ask again with this wish", never silently dropped | S–M |
| 6 | **A listening companion** — what to listen for, per movement, shown as Spotify reaches each one (the listening view already knows the movement, polling every 10 s); written once per recording from that recording's own track names | AI, creative | The research's clearest finding: a short informative note at the moment of listening is what turns unfamiliar music into music you like. Per movement, never per second — the model can't know timings, and invented ones would be wrong | M |
| 7 | **Ask about this** — a question box in the listening view and on each programme item ("why does the horn take over here?"), answered with the work, the recording and the current movement as context; answers kept with the item and in the Journal | AI | Generalises "A little more context" into whatever the listener actually wonders. Small, cheap calls; the conversation research says this is where people find what they're after | M |
| 8 | **Second hearings** — a work marked *interesting* or *too difficult* comes back weeks later, in another week's context, with a different way in (another recording, a different note), at most one a week and labelled as a return | Varied, creative | Liking grows with hearing, for complex music too. Today such a work is simply left behind; the curator only knows not to repeat it | S–M |
| 9 | **Why this, for you** — each item's reason may point to a specific moment in your own listening ("the long build you loved in the Sibelius, three weeks ago"), never to a label about you | AI | People trust a reason they can check, and resent being typecast. Mostly prompt work, guarded by item 1 | S |
| 10 | **Live in Bucharest** — when a programmed work, composer or performer is on at the Filarmonica George Enescu (Ateneu), the Radio hall or another venue Marquee reads, one quiet line on the programme | Creative | The best thing a curator can do is send you to the hall. Marquee already reads these venues (`api/_lib/marquee/`); the Long Listen asks it, doesn't scrape. No new serverless function | M |
| 11 | **A listening log that doesn't miss things** — check recently-played on a timer while the app is open, and on the installed app's periodic background sync (`src/shared/notify/`) | Smooth | Spotify shows only the last fifty tracks. A week of other music between opens hides the classical listening, so the curator thinks a heard symphony wasn't | M |
| 12 | **Bring your own repertoire** — from Spotify's saved albums and followed artists, propose works you already know, to confirm in one pass | Smooth, varied | "I knew this already" works one item at a time. The strongest predictor of liking new music is familiarity with similar music: knowing what you know lets the curator build bridges from it | M |

Also in release two, too small to rank: write the "On Spotify instead"
recordings and side-by-side pairs to Notion's Works & recordings (today the
notebook leaves out what was actually played when the named recording was
missing).

## Later

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 13 | **A sitting for tonight** — one or two hours, asked for on the day ("quiet, nothing I know"), recorded in the same threads | Some weeks there is one evening, not seven, and a mood is a moment's | M |
| 14 | **Season in review** — every twelve weeks, a page of prose: threads that grew, where taste moved, paths still open, things worth hearing again | Makes the app's memory something you read. Needs twelve weeks of history, so it can't be judged during release two | M |
| 15 | **Recording facts from MusicBrainz** — year and performers checked against an open database (free, no key) | Years and performer lists are the facts most often slightly wrong | M |
| 16 | **Towards the Enescu Festival** — the biennial festival returns in late summer 2027; once its programme is published, a few weeks that prepare for concerts you might attend | Local, and a reason to listen ahead. Depends on item 10 | S–M |
| 17 | **Romanian throughout** — the interface, not only the curator's writing | Mostly copy, but a lot of it | M |
| 18 | **A second listener** — a profile for Nora on the same device, with a younger voice in the writing | Every collection gains an owner; only worth it if she would use it | L |
| 19 | **A map of the threads** — themes and works on a timeline of centuries, with the connections the curator drew | Shows where you've been. Must stay a map, never a scorecard | L |
| 20 | **Offline programme** — check during the release-one test what already works without signal (the app is cached, the data is in IndexedDB) before building anything | Probably mostly there | S |

## Decided against

- **A spoken host.** The synthetic DJ voice is the most criticised part of
  Spotify's AI DJ, and in the introduction study an AI voice cost credibility.
  The curator writes; it doesn't talk over the music.
- **Mood playlists and an endless feed.** Mood wheels and infinite radio are
  what streaming services already do well. The app's unit is a programme with
  an order and a reason; mood enters through this week's tuning (item 5) and a
  sitting for tonight (item 13).
- **Anything counted.** Hours, streaks, a year in numbers. The product rule
  stands; item 14 is prose.

## Decisions to make, not items

- **Spotify as the only player.** Verification, playlists and listening
  detection all lean on it. Apple Music's API does have a recently-played list,
  but without play times (repeats collapse into one entry) and only with a
  paid Apple developer key; Idagio, the classical specialist, has no public
  API and went through insolvency in 2025. Recommendation: stay with Spotify,
  and keep the app fully usable without it (listening marked by hand,
  recordings as links), which it mostly is.
- **A small server.** Everything runs in the browser by design: your own key,
  no function of its own, 11 of 12 Vercel functions used. Items 10 and 11
  would be easier with a scheduled job. Recommendation: no new function; fold
  anything server-side into an existing endpoint.
- **A cheaper model for small jobs.** Further reading, the taste update, item
  7's answers and item 6's notes could run on Haiku (`src/shared/models.js`).
  Recommendation: decide with item 1's check, not before.
- **The week as the unit.** It gives the app its calm. Item 13 adds evenings
  without replacing it. Recommendation: keep the week.

## Sources

- Let me introduce you: taste-broadening serendipity through song introductions (2026) — https://arxiv.org/html/2604.08385
- Madison & Schiölde, Repeated listening increases the liking for music regardless of its complexity (2017) — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5374342/
- Don't mess with my algorithm: listeners and automated curation (First Monday) — https://firstmonday.org/ojs/index.php/fm/article/download/11783/10589
- Yun & Lim, User experience with LLM-powered conversational recommendation: music (CHI 2025) — https://arxiv.org/abs/2502.15229
- Exploring LLM-driven intent-based music recommendations (NLP4MusA 2026) — https://aclanthology.org/2026.nlp4musa-1.7.pdf
- Leeds Conservatoire, Concert programming — https://www.leedsconservatoire.ac.uk/about-us/progression-portal/musicians-survival-guide-articles/concert-programming/
- Wayne State, A guide to writing program notes — https://music.wayne.edu/students/guide_to_writing_program_notes.pdf
- Classical music has lost a generation: blame the metadata, in part (ArtsJournal, 2024) — https://www.artsjournal.com/diacritical/2024/05/classical-music-has-lost-a-generation-blame-the-metadata-in-part.html
- Apple Music Classical's Listening Guide (The Violin Channel) — https://theviolinchannel.com/apple-music-classical-adds-new-features-including-listening-guide-personalized-recommendations-and-editorial-stations
- Criticism of Spotify's AI DJ — https://news.ycombinator.com/item?id=47385272 and https://community.spotify.com/t5/Live-Ideas/Remove-the-DJ-AI-or-at-least-give-the-option-to-tu/idi-p/7328994
- Choice deprivation vs overload (Behavioral Scientist) — https://behavioralscientist.org/is-having-too-many-choices-versus-too-few-really-the-greater-problem-for-consumers/
- IDAGIO (Wikipedia, insolvency 2025) — https://en.wikipedia.org/wiki/IDAGIO
- George Enescu Festival 2027 (provisional dates) — https://www.carnifest.com/george-enescu-festival-2027/
