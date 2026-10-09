# The Long Listen — roadmap

What comes after release one. First written 2026-10-09 and rewritten the same day in
three passes: what listeners, programme-note writers and recommender research
say about the problems this app addresses (sources at the end); then a check
of every item against the code, which dropped or reshaped several.

**Order of work.** Release one is tested in daily use first. Bugs found in that
test are fixed before anything here starts, and the test may re-rank this list:
an item that answers something that kept getting in the way goes up, one nobody
would reach goes down. Release two is the section of that name below; release three follows it.

**What release two is for**, in the owner's words: smooth out the experience,
never be cumbersome, be more varied and creative, and make good use of AI. Every
item below serves at least one of those; release two is grouped by which.

The product rules in `LONG_LISTEN.md` §1 hold for every item: no counts, no
streaks, no scores, taste in prose, choice without judgement. When an item is
done, strike it here and describe it in `LONG_LISTEN.md`.

Effort: **S** is a day or less, **M** a few days, **L** a week or more.

## What the research says, and what it changes

- **An introduction makes unfamiliar music land.** In a 2026 study, 38% of
  listeners said a song outside their taste broadened it when it was played
  cold; with a short *informative* introduction (context, what inspired it)
  that rose to 56%, with a story-like one to 49%. Dull introductions hurt. The
  authors suggest LLM-written introductions and found an AI *voice* cost
  credibility with some listeners. → Carry the written notes into the
  listening itself (item 8); keep them written, never spoken.
- **Liking grows with hearing, even for complex music.** Over four weeks of
  repeated listening, liking rose for simple and complex pieces alike, and the
  strongest predictor of liking was familiarity with *similar* music. → Offer
  a difficult work again, later, a different way (item 10); know what the
  listener already knows (item 16).
- **Listeners want reasons, control, and to be read correctly.** Interviewed
  streaming users wanted to know *why* something was recommended, trained
  "their algorithm" through likes and replays, and were put off by wrong
  guesses about who they are or how they feel right now. → Feedback that costs
  nothing to give (items 1, 3); reasons that point to a moment in the
  listener's own history, never a label (item 11); a mood for this week
  without a trip to Settings (item 5).
- **Conversation helps people find what they want.** A three-week diary study
  of LLM music recommendation found it helped people put implicit wishes into
  words and explore in their own direction. → Ask about the music while it
  plays (item 8); turn your own questions into directions (item 9).
- **Programming is a creative act.** Programme-note and concert-programming
  guides treat the order of works as an argument — juxtaposition sets up a
  dialogue — and a note's two jobs as history and what to listen for. → Vary
  the *form* of a week, not only its contents (item 7).
- **Too few options hurt more than too many.** A 7,000-person study across six
  countries found people felt short of options far more often than
  overwhelmed. → Keep three directions plus "three others" on request; don't
  add a "let the curator choose" shortcut that narrows it.
- **What people dislike in AI music features.** Recurring complaints about
  Spotify's AI DJ: the same songs in loops, and a synthetic voice talking over
  the music. → No spoken host, no endless feed (see *Decided against*).
- **Classical metadata is hard and models invent things.** Streaming catalogues
  split works into loose tracks and mix up performers; an offline study of LLM
  recommenders found up to ~15% of suggested tracks were not in the catalogue.
  → The rule that only a confirmed Spotify match counts stays central; better
  recording facts are in *Later*.

## Before release two: finish release one

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 0 | ~~Fix what the release-one test turns up~~ | Done over the first week's listening (PRs #138–#150) | — |
| 0a | ~~Call it release one~~ | Done 2026-10-09: a line in Settings → About, changelog in `LONG_LISTEN.md` §12. The Notion spec, handover and the guide are outside the repo and still to update | S |

## Release 2

Ranked: friction first (cheap, felt every week), then the curation check that
guards every prompt change, then the creative and AI items it guards. All
thirteen are the release (the owner's call, 2026-10-09; item 13 added the same day); 12 is the one to drop
if time runs short.

### Smoother

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 1 | **Keep listening** — in the listening view, "I've heard it" shows the reaction and a note line in place, then *Next: the following work* opens that work's listening view; *Play from here* plays this recording and the confirmed ones after it, in order | Today "I've heard it" drops you at the top of a long programme page, where the feedback panel waits. Listening a programme through should be one gesture per work. (Feedback-to-taste is already batched — done 2026-10-09.) **The owner wants an audible cue between works** (going straight on is fine, but not unannounced): with *Play from here*, the app starts one work at a time, times the end of its last movement from Spotify's playback position, plays a short soft chime in the gap (with a light vibration on a phone), shows "Next: …" and starts the following work. A chime over the music would be up to 10 s late and cut into it, so it belongs in the gap. Works while the listening view is open (it already keeps the screen awake); if the app isn't open, Spotify simply plays on. Tempo's `playChime` (`src/tempo/lib/sound.js`) is the only chime in the repo — promote it to `src/shared/` rather than copying it | M |
| 2 | **Notice listening when you come back** — re-check Spotify's recently-played when the app returns to the foreground, not only on a fresh load | An installed app resumed from the background never looks again today (`app/services.tsx`), so the fifty-track window slides past unseen. Most of the value of background sync for a fraction of the cost (see *Decided against*) | S |
| 3 | **How did it land?** — when Spotify has marked a work heard, the next open asks about that one work, quietly, once; dismissing it is an answer too | Spotify detection marks works heard silently, so the works you play from Spotify — most of them — never get a reaction. The biggest gap in the feedback loop | S |
| 4 | **Fewer waits** — read this week's feedback into taste in the background as it arrives, close the week's threads in parallel rather than one after another, and verify recordings (and find stand-ins) right after a direction is chosen, not when the programme is first opened | Monday today is a chain of calls (each open thread, then taste, then directions), and the first programme view fills in recording by recording. Directions are still made on the day, so nothing goes stale | S–M |
| 5 | **This week, differently** — one quiet line by the three directions: *shorter · quieter · wider · more familiar*, for this week only, carried through directions, programme and *More of this theme* | Settings are a standing preference; a mood is a week's. One line of words, not three sliders, on the screen that should be the calmest | S |

### Better curation, more variety

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 6 | **A curation check** — about four listener profiles (narrow and familiar; broad and obscure; a returning theme; Romanian) run against the prompts on demand, with the validator's verdicts and a short read of the writing, before and after a prompt change | Items 7–11 all change prompts. Without a check, each change is judged by living with it for a week. Runs with the owner's key, never in CI; a run costs a few calls per profile | S–M |
| 7 | **Shapes of a week** — the curator chooses a form as well as a theme and names it on the direction card: a form followed across centuries; *then and now* (an old piece and the new one that answers it); one city in one year; a performer's week; two composers in dialogue; one work heard several ways (only with *Same work, two perspectives* on) | Every week today has the same shape. Varying the form is the largest gain in variety. Each form states which variety rule it relaxes — two composers in dialogue needs more than two works each, a work heard several ways needs pairs — so the validator and `enforceVariety` check the form, not a blanket cap | M |
| 8 | **A listening companion** — in the listening view: what to listen for in each movement, shown as Spotify reaches it; *Ask about this* (a question line answered with the work, recording and current movement as context); and the existing *A little more context*, together in one place | The research's clearest finding: a short informative note at the moment of listening is what turns unfamiliar music into music you like. Notes are written once per programme for all confirmed recordings, right after verification (a candidate for the cheaper model). Per movement, never per second — the model can't know timings. The question path exists (`Journey.explain(…, question)`) but has no box, and its answers are stored under ids the programme never loads; fix with it. Stand-ins need a listening route | M |
| 9 | **Your questions, as directions** — the questions the curator hears you asking of the music (shown in the Notebook, e.g. "What happens to the symphony after Mahler?") each get *Follow this*, which asks for directions from it (this week, or as next week's wish) | They're the best seeds the app has and today they're only read. One tap, no typing | S |
| 10 | **Second hearings, offered** — a work you found *interesting* or *too difficult* is offered again weeks later, in another week's context and a different way in (another recording, another angle), stated as an offer — "Try the Lutosławski again?" — never slipped in, at most one a week | Liking grows with hearing, complex music included. Today nothing asks for a return, and a work falls out of the curator's view after twelve weeks. "Too difficult" is the listener's word, so it's asked, not overruled | S–M |
| 11 | **Why this, for you** — an item's reason may point to a specific moment in your own listening ("the long build you loved in the Sibelius, three weeks ago"), never to a label about you | People trust a reason they can check and resent being typecast. Prompt work, guarded by item 6 | S |
| 12 | **Live in Bucharest** — when a programmed work, composer or performer is on at the Filarmonica George Enescu (Ateneu), the Radio hall or another venue Marquee reads, one quiet line on the programme | The best thing a curator can do is send you to the hall. Marquee already reads these venues (`api/_lib/marquee/`); the Long Listen asks it, doesn't scrape. No new serverless function | M |
| 13 | **Concerts** — a record of what you heard live: venue, date, orchestra, conductor, soloists and the works in order, plus a line on how it was. Lives in the **Journal**, in the week it happened, with a small concert-hall mark so it reads as *live* and not as the week's programme; **All concerts** at the top of the Journal lists them by venue and date. Each work joins the Library marked *heard live* (venue, date, performers), beside its recordings. **Adding one:** share the venue's programme screenshot to the app from the phone's share sheet (the way Silva takes photos); Claude reads it — Romanian programmes included ("Concertul în la minor… op. 102" → Brahms, Double Concerto, Op. 102) — into a form to check and correct; typing it in stays possible. **Hearing it again:** per work, a confirmed Spotify recording to start from, a contrasting one for *live versus recorded* (reusing *another perspective*), and the same performers' recording when Spotify really has one, never claimed otherwise. Works heard live count as known (never offered as discoveries) and what you say about the concert reaches taste and threads; concerts go to Notion with the rest | The owner goes to the Ateneu and the Radio hall and doesn't want to lose track of good music heard there. Today the app only knows what it programmed. Entry must happen in the app: the data lives on the phone, and Notion is a one-way copy, so screenshots sent anywhere else never reach it. Reading a screenshot is about a cent (Haiku, image in). Pairs with item 12, which points *to* concerts; this one remembers them | M–L |

Also in release two, too small to rank: write the "On Spotify instead"
recordings and side-by-side pairs to Notion's Works & recordings (today the
notebook leaves out what was actually played when the named one was missing).

## Release 3

The nice-to-haves, after release two has been lived with. Two exceptions:
item 22 is a check to make during the release-one test, not a build; and
item 17 moves up if that test keeps turning up wrong recording years or
performers.

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 14 | **A sitting for tonight** — one or two hours, asked for on the day ("quiet, nothing I know"), recorded in the same threads | Some weeks there is one evening, not seven, and a mood is a moment's | M |
| 15 | **Season in review** — every twelve weeks, a page of prose: threads that grew, where taste moved, paths still open, things worth hearing again | Makes the app's memory something you read. Needs twelve weeks of history, so it can't be judged during release two | M |
| 16 | **Bring your own repertoire** — from Spotify's saved albums, propose works you already know, to confirm in one pass | Familiarity with similar music predicts liking, so knowing what you know lets the curator build bridges. Large: "already known" today only covers works the app programmed, and resolving albums to works is the classical metadata problem in full | L |
| 17 | **Recording facts from MusicBrainz** — year and performers checked against an open database (free, no key) | Years and performer lists are the facts most often slightly wrong | M |
| 18 | **Towards the Enescu Festival** — the biennial festival returns in late summer 2027; once its programme is published, a few weeks that prepare for concerts you might attend | Local, and a reason to listen ahead. Builds on items 12 and 13 | S–M |
| 19 | **Romanian throughout** — the interface, not only the curator's writing | Mostly copy, but a lot of it | M |
| 20 | **A second listener** — a profile for Nora on the same device, with a younger voice in the writing | Every collection gains an owner; only worth it if she would use it | L |
| 21 | **A map of the threads** — themes and works on a timeline of centuries, with the connections the curator drew | Shows where you've been. Must stay a map, never a scorecard | L |
| 22 | **Offline programme** — check during the release-one test what already works without signal (the app is cached, the data is in IndexedDB) before building anything | Probably mostly there | S |

## Decided against

- **A spoken host.** The synthetic voice is a recurring complaint about
  Spotify's AI DJ, and in the introduction study an AI voice cost
  credibility. The curator writes; it doesn't talk over the music.
- **Mood playlists and an endless feed.** Mood wheels and infinite radio are
  what streaming services already do. The app's unit is a programme with an
  order and a reason; mood comes in through item 5 and, later, item 14.
- **Background listening sync from the service worker.** The Spotify sign-in
  lives in the page's storage, and Spotify rotates refresh tokens: a worker
  and a page refreshing independently would eventually spend one twice and end
  the sign-in. Periodic background sync is also infrequent and not
  guaranteed. Item 2 covers most of the need.
- **"Let the curator choose."** It saves one tap and removes the moment of
  choosing, which is part of the pleasure.
- **Anything counted.** Hours, streaks, a year in numbers. The product rule
  stands; item 15 is prose.

## Decisions to make, not items

- **Spotify as the only player.** Verification, playlists and listening
  detection all lean on it. Apple Music's API does have a recently-played list,
  but repeats collapse into one entry and it needs a paid Apple developer key;
  Idagio, the classical specialist, offers no public API and went through
  insolvency in 2025 (it continues under new owners). Recommendation: stay with
  Spotify, and keep the app fully usable without it (listening marked by hand,
  recordings as links), which it mostly is.
- **A small server.** Everything runs in the browser by design: your own key,
  no function of its own. Room exists if an item needs it: 9 of Vercel Hobby's
  12 functions are used (Law of the Day's two left the server, 2026-10-09), so
  three are free, and the owner is fine spending them (2026-10-09). Still
  prefer folding into an existing endpoint when it fits; a new
  `api/long-listen-*.js` is allowed when it doesn't.
- **A cheaper model for small jobs.** Decided 2026-10-09 by the owner, before
  item 6: taste, continuity, *A little more context* and further reading run on
  Haiku 5.5. Item 6's check should still cover them, and item 8's notes start
  there.
- **The week as the unit.** It gives the app its calm. Item 13 adds evenings
  without replacing it. Recommendation: keep the week.

## Sources

- Let me introduce you: taste-broadening serendipity through song introductions (2026) — https://arxiv.org/html/2604.08385
- Madison & Schiölde, Repeated listening increases the liking for music regardless of its complexity (2017) — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5374342/
- Don't mess with my algorithm: listeners and automated curation (First Monday) — https://firstmonday.org/ojs/index.php/fm/article/download/11783/10589
- Yun & Lim, User experience with LLM-powered conversational recommendation: music (CHI 2025) — https://arxiv.org/abs/2502.15229
- Choice deprivation vs overload (Behavioral Scientist) — https://behavioralscientist.org/is-having-too-many-choices-versus-too-few-really-the-greater-problem-for-consumers/
- Exploring LLM-driven intent-based music recommendations (NLP4MusA 2026) — https://aclanthology.org/2026.nlp4musa-1.7.pdf
- Leeds Conservatoire, Concert programming — https://www.leedsconservatoire.ac.uk/about-us/progression-portal/musicians-survival-guide-articles/concert-programming/
- Wayne State, A guide to writing program notes — https://music.wayne.edu/students/guide_to_writing_program_notes.pdf
- Classical music has lost a generation: blame the metadata, in part (ArtsJournal, 2024) — https://www.artsjournal.com/diacritical/2024/05/classical-music-has-lost-a-generation-blame-the-metadata-in-part.html
- Apple Music Classical's Listening Guide (The Violin Channel) — https://theviolinchannel.com/apple-music-classical-adds-new-features-including-listening-guide-personalized-recommendations-and-editorial-stations
- Criticism of Spotify's AI DJ — https://news.ycombinator.com/item?id=47385272 and https://community.spotify.com/t5/Live-Ideas/Remove-the-DJ-AI-or-at-least-give-the-option-to-tu/idi-p/7328994
- IDAGIO (Wikipedia, insolvency 2025) — https://en.wikipedia.org/wiki/IDAGIO
- George Enescu Festival 2027 (provisional dates) — https://www.carnifest.com/george-enescu-festival-2027/
