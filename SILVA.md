# Silva — a forest of things

> "I can't begin to tell you the things I discovered while I was looking for
> something else." — Shelby Foote

A private collection of things worth remembering, arranged by affinity rather
than origin.

Silva is a commonplace book for 2026. Not a second brain, not a note-taking
app, not a quotation database: a private garden of intellectual things that
have survived contact with you. Your own writing sits beside Marcus Aurelius's.
Nothing is scored, nothing is due, and the app's job is not to help you
retrieve — it is to make sure you keep bumping into what you already kept.

The name is from *silva rerum*, "a forest of things": the heterogeneous private
books Polish families kept across generations, mixing letters, speeches,
anecdotes, poems, recipes, births and gossip in one place, never meant for
publication. A forest has no filing system. You don't put an oak under
`Trees > Deciduous > European`. You walk through it and encounter things.

## The idea in one line

You keep the things that stopped you; Silva keeps putting them back in front of
you, next to each other, and says nothing more.

## The test every feature must pass

**Does this help you find something you weren't looking for?**

If a feature only helps you find what you *were* looking for, it is PKM and it
belongs in Notion, which is already underneath this app. Search exists in Silva
because you sometimes need it — not because it is the point.

## The loop

```
Encounter → Keep → Annotate → Place → Revisit → Connect → Grow
```

Not `Capture → Organise → Search`, which is every modern PKM tool. The
differences that matter:

- **Keep** is a separate, later act from **Encounter**. Highlighting something
  on a Kobo is not keeping it (see *The understory*).
- **Annotate** can happen right at the Keep tap, not only later in the forest:
  the understory's Keep carries an optional, collapsed **+ Why** beside it —
  say why this now, while it's still available, or say nothing and Keep stays
  exactly as fast as it always was. Never a required step.
- **Place** happens long after keeping, if ever, and is never required.
- **Revisit** and **Connect** are where the app does its only real work.

## The object: a *thing*

One database, one heterogeneous item type. A thing can be a quotation, an
observation, a paragraph, a piece of dialogue, an image, a link, a personal
thought, a question, a memory, a fragment, something somebody said, or
**something you don't understand yet** — an explicit, first-class kind. Most
tools want resolved knowledge; a forest is allowed unresolved matter.

Every thing carries:

| Field | Notes |
|---|---|
| `body` | the text itself — the passage, the thought, the question |
| `kind` | Passage · Observation · Dialogue · Question · Image · Link · Fragment · Mine |
| `source` | relation → Sources; **optional** — a thing may have no origin |
| `locator` | chapter, page, timestamp, "overheard on the 32 tram" |
| `encountered` | when it reached you |
| `kept` | when you decided to keep it — **the field that means something** |
| `note` | your annotation. Why this. What it rhymed with |
| `loci` | relation → Loci, many, **never set at capture** |
| `state` | Understory · Kept · Released |
| *arrival* | not a property — Notion's own `created_time`, read back as the day it reached Silva |

`encountered` and `kept` being separate is the whole ethic in two columns. A
thing that was encountered but never kept never became yours.

**The season counts from arrival, not from `encountered`.** They are the same
day for anything typed, pasted or shared. They are years apart for a Kobo
import, which back-dates `encountered` to the highlight's own date — and
counting the season from *that* meant an import of old reading was already
past its season the moment it landed, and was quietly composted on the next
load, unseen. Silva reads Notion's own `created_time` (no schema property, and
correct retroactively for every row) and counts from the later of the two, so
anything imported gets the same full season in the understory as anything
typed by hand. No special treatment in either direction.

**A thing worth protecting: `Mine` gets no special treatment.** It sits in the
same select, the same forest, the same walk, typeset on the identical plate as
a Marcus Aurelius passage — no separate tab, no distinct colour, no "your
writing" section. The forest starts full of other people's things; over time
your own begin appearing among them, undistinguished, until the line between
what you read and what you thought blurs. That is the actual promise of a
commonplace book, and it only works because Mine is never elevated. Any future
feature that would surface, badge, or segregate Mine things — however
reasonable it looks in isolation — trades away the one effect that makes this
more than a quotation database.

## The understory (and why the backlog isn't debt)

Everything arrives **unkept**, in the understory. A Kobo import of 300
highlights lands there in one go and that is fine, because the understory is not
a queue and not a chore.

Ryan Holiday's practice is the design here: he waits *weeks* after finishing a
book before transcribing highlights, because the delay pre-edits them — much of
what felt urgent while reading doesn't survive the wait. Silva makes the wait
structural.

**Unkept things expire.** After a configurable season (default 90 days) an
untouched understory item quietly fades and is dropped. No badge, no counter, no
"you have 284 items to process." Compost, not debt.

This is the design rule that lets us take the low-friction Silva intake without
inheriting the guilt that a Topoi-style unfiled pile would create — and it keeps
Silva consistent with the rest of the catalogue: Journal of Delights has "no
scoring or streaks," Sol Odyssey is "never guilt or red crosses," Loom's
Tapestry is "descriptive, never scored."

## Loci are clearings, not folders

A **locus** is a named place in the forest. The hard rule:

> **A locus can never be assigned at capture time.** The UI must not offer it.

You coin a locus when you notice a clearing has already formed — usually because
a provocation pointed at one ("you have collected 11 things about people wanting
to be remembered"). A path exists because someone walked it. Loci are therefore:

- **few** — a forest with 200 named clearings has none
- **retrospective** — named after the things, never before them
- **optional** — most things live in no locus at all, permanently, legitimately
- **editable** — merge, split, rename, dissolve; nothing is lost when a locus is

This is the synthesis of the two names we considered. Silva is the forest;
loci are the places within it. But the structure is emergent, so we never pay
the filing tax that made Topoi-as-a-whole-app the wrong call.

## Paths and mycorrhiza

Two kinds of connection, and the distinction is the heart of the app.

**Paths** are connections *you* made. Deliberate, annotated with *why*, durable.
A path is a record of your thinking, and it is the most valuable data in Silva.
The why is not optional advice — it is a hard gate in the UI. `MakeForm` and
the edit form on an existing path both refuse to save with an empty why
(`PathsView.tsx`'s `canMake`/`disabled` checks). A path without its
reason is precisely the artefact this whole distinction exists to avoid.

**Mycorrhiza** is the latent affinity between things, computed by the embedding
layer. It is real but underground: things that grew near each other without
anyone noticing. Mycorrhiza is **never presented as fact**, never auto-applied,
never counted as a connection.

> **A mycorrhizal link becomes real only through a human act.** Accepting a
> provocation converts it into a path. Nothing else does.

That is how "the AI should not finish the thought" is enforced — in the data
model, not in a prompt. The model can propose adjacency; only you can assert
meaning. Dismissed provocations are remembered so the same pairing isn't
offered twice.

## Provocations

The app's only voice. A provocation places two or three things beside each other
and stops talking. It never summarises, never explains the connection, never
writes the insight. Two objects on a table.

**Kinds** — the first four are deterministic and need no AI, no key and no
network. Silva's serendipity engine works fully offline; the model only adds the
last three.

| Kind | Needs |
|---|---|
| **Shuffle** — the forest in random order | — |
| **A random clearing** — wander into one locus | — |
| **Long unvisited** — something you haven't looked at in six months | — |
| **Blind pairing** — two things at random, connection unasserted | — |
| **Near neighbours** — two things the mycorrhiza says are close, that you never connected | embeddings |
| **A clearing forming** — "you have 11 things circling solitude" | embeddings |
| **Tension** — two kept things that appear to contradict each other | embeddings + model |

Note what CommonBook (the closest existing product) does: a hierarchical tag
tree, plus randomisers bolted on to escape it. Their serendipity compensates for
their own structure, and it is pure randomness. Ours is native, and the
interesting kinds are *latently related but unconnected by you* — a strictly
better provocation than a coin flip.

### The anti-feed rule

> **At most one provocation is offered per session, and only when a real
> threshold is crossed. Silence is the default and a valid state.**

If Silva greets you with something every time you open it, it is a feed, and the
"and then leave you alone" principle is dead. Provocations are earned by the
collection having actually changed or aged, not by you having opened the app.

### What the AI must never do

- Summarise a thing you saved
- Auto-tag, auto-place, or auto-connect
- Explain what two things have in common
- Write the insight, name the emerging theme, or complete the thought
- Rank, score, or rate anything in the collection

The human action is the collection. The machine action is the provocation.

**The one narrow exception is OCR** (`lib/ocr.ts`) — transcribing the text
visible in a photographed page into that thing's `body`. This is mechanical,
not interpretive: it reproduces what's on the page verbatim, the same act as
if you'd typed it yourself, and never touches Kind (still never auto-assigned
— see "Suggest a kind" above). The boundary holds because the prompt is
scoped to transcription only and refuses to describe or summarise a
non-text photo (a scene, an object) — it returns nothing rather than telling
you what the picture shows. Anything that asks the model to describe,
caption, or characterise an image instead of transcribing text on it would
cross this line and does not belong here.

## Views

Five surfaces over one dataset — the pattern Loom (three views over one set of
threads) and Journal of Delights (three ways to read) already establish here.

- **The forest** — the default. One thing at a time, typeset to be read, not a
  row in a table. Scroll is a walk, not a list.

  The walk sits at its head: a short, finite stretch — `WALK_SIZE` things —
  weighted by what you have gone longest without actually looking at
  (`lib/walk.ts`), with the full scroll below it unchanged.

  It *routes* rather than ranks. Neglect chooses who is eligible — only the
  most-neglected `WALK_SIZE * WALK_POOL_FACTOR` things — and then the walk
  opens on the most neglected of those and steps each time to whichever
  remaining candidate is nearest what you just read. Ranked by neglect
  alone it was five unrelated things in a queue: systematic coverage, a
  reading schedule, with the app's actual thesis ("next to each other")
  left entirely to the provocations. Keeping neglect as the *gate* is what
  stops affinity dragging back something you read yesterday, and with the
  underground off there are no vectors, so it degrades precisely to the
  ordering it had before. It is not a feed,
  and the three properties that keep it from becoming one are structural rather
  than intentions: **it ends** (and the ending offers nothing further),
  **it holds only your own kept things**, and **it refreshes on the calendar,
  not on your attention** — the chosen ids are persisted for the day, so
  reading something cannot reshuffle what is left.
- **Clearings** — the loci you've coined, each a small collection with your note
  on what you meant by it. Empty clearings are allowed and meaningful.
- **Underground** — the connection view, *labelled* **Paths** in the app
  ("Underground" and "Understory" are near-indistinguishable as adjacent tab
  labels; "Paths" is also exactly the database it reads). The word still
  names the latent layer itself, throughout the code and the guide.
  Paths drawn solid; mycorrhiza only
  visible while you hold the view open, faint, unclickable until offered as a
  provocation. This is the graph layer, and it exists from v1 because loci give
  it a stable node set.

  The whole-forest graph is an overview and stays one. The question people
  actually have — *what is this near?* — is answered on the plate instead, by a
  per-thing neighbourhood (`lib/neighbourhood.ts`): paths you walked with their
  why, and oxblood threads that grew near this and are not yet anything, each
  with one route onward to writing why. Bounded by construction, so it needs no
  layout algorithm and does not care how large the forest gets — which the
  global ring layout very much does.
- **The understory** — unkept arrivals, *labelled* **Nursery** in the app,
  with their remaining season shown as a fade rather than a number. Sectioned
  by book once anything in it has a source (a Kobo import lands hundreds of
  rows at once); a nursery of your own typed captures stays one flat list. A
  long body previews behind **Show more** — the nursery is a decide-fast, scan-
  many screen, unlike the plate a kept thing is read on, which stays full
  length always (that's `ExpandableText`, same component Clearings, Forage and
  Paths already use for the identical reason).
- **Sources** — where a kept thing came from, *labelled* **Roots** in the
  app, given a real screen rather than only a filter in Forage. Only a
  source with something actually kept from it appears; its passages render
  in the order they sit in it, from `locator` when that reads as a page
  number, falling back to the order they were kept. Same master-detail
  grammar as Clearings — a list of places, each opening to what belongs in
  it — so this reads as the same kind of screen, not a new one. Deliberately
  not a shelf: nothing here sorts, rates, or ranks a source, and there is no
  way to browse one you haven't drawn from yet. Title, author and kind are
  all editable here, not locked at creation.

### On the labels, and why they differ from these names

Seven labels carry a different word in the interface than in this document,
and the reason is the same in each case: this document is prose, where the
ecological metaphor can breathe, while a tab bar is seven words at 9.5px that
have to be told apart at a glance.

| Here | In the app | Why |
|---|---|---|
| Understory | **Nursery** | "Understory" and "Underground" sat one tab apart: same prefix, near-identical length, indistinguishable in small caps. A forest nursery is also exactly what this is — where seedlings wait before being planted out, or not. |
| Underground | **Paths** | The other half of that collision. It is also precisely the database it reads. "Underground" still names the latent mycorrhizal layer everywhere, which is the sense this document needs it for. |
| Search | **Forage** | "Search" is the PKM word this app is defined against. Foraging is deliberate looking *within a place you already know* — which is what this surface is for, and why it isn't the point of the app. |
| Sources | **Roots** | A source is what feeds a kept thing, the same relation a root has to what grows from it — and "Sources" reads like a bibliography tab, the library move this view exists not to be. |
| The graph | **The crossing** | "Graph" is the one word in the app borrowed from the tooling rather than the forest, and it sat at the head of Paths naming the very thing paths *make*. A crossing is where paths meet, which is exactly what the drawing shows. |
| `encountered` / `kept` (as plate labels) | **sown** / **grown** | The two dates are the two ends of one life, and the nursery already casts an arrival as a seedling waiting to be planted out or not. Only the *labels* move: the properties are still `Encountered` and `Kept`, and the act is still **Keep** — a verb and a timestamp, not two names for the same thing. You keep it; from that day it grows. |
| Settings | **Hearth** | The household centre of a *silva rerum*, which was a family book before it was anything else. |

The **stored** vocabulary is untouched: `State` is still `Understory · Kept ·
Released` in Notion, and the four databases keep their names. The mapping
lives only at the labels.

Plus **Forage** (labelled that rather than "Search", which is the PKM word
this app is defined against — and the field's own placeholder is already "I
remember something about…"): one box, lexical *and* semantic matching
("I remember something about people becoming what they repeatedly do"). The
lexical side reads a thing's `link` too, not only its own words: nobody types
a URL from memory, but a publication's domain is the part people do recall —
and a kept link *loses* its URL from the body the moment the article's title
lands there, which had been leaving the piece unfindable by the only handle
its reader had.

## Opening the app

Silva mirrors the whole collection to the device (`lib/collectionCache.ts`,
IndexedDB) and renders from that mirror immediately, then reconciles with
Notion in the background. "Walking into the forest…" is now only ever the
*first* open — after that the forest is on screen in milliseconds.

The wait it replaces was not a fixed cost. `fetchAllPages` walks a database
100 rows at a time and each request needs the previous one's cursor, so the
old load grew with everything ever kept: roughly one sequential round trip per
100 things, every morning, before anything at all was painted.

**Reads are incremental.** Every list method takes an optional `since`, which
becomes a Notion `last_edited_time` filter — so a reopen asks for what changed
since yesterday (almost always nothing) rather than for the collection again.

**The one thing incremental sync cannot see is a deletion**: a row deleted in
Notion stops appearing rather than coming back marked, and nothing
incremental can tell that apart from "unchanged". So a full reconcile runs
whenever the last one is over `FULL_SYNC_INTERVAL_MS` (a day) old, which
bounds how long a row deleted *directly in Notion* can linger. Deleting from
Silva itself is immediate, because the cache is written from the same state
the UI already updated optimistically.

A failed refresh with a cache present is **not** a failed load: the forest
stays on screen and a toast says it could not reach Notion. Offline means
yesterday's forest, never a blank error page over a collection this device
is holding.

### Why the data is never paged, and the rendering is

The obvious way to make a big collection open fast — fetch twenty things and
ask for more on scroll — would break Silva outright, and it's worth naming so
nobody tries it later. Silva's features are *whole-collection* features: the
walk weights every kept thing by neglect, a neighbourhood compares one thing
against all of them, Forage searches everything, provocations look for tension
anywhere, and the crossing draws the entire graph. A thing you haven't
scrolled to must still be one the walk can offer you tomorrow.

So the collection stays whole in memory and only the **DOM** is paged
(`components/useProgressiveList.ts`): the Forest mounts a window of plates and
grows it as the scroll is walked. That is where the cost actually was — a
`SpecimenPlate` carries a neighbourhood scan, a dwell observer and a link
preview, and there is no reason to mount all of that for a passage ten
thousand pixels below the fold.

The same rule closed a scaling bug worth remembering: `computeNeighbourhood`
ran unmemoised in every plate's component body, so the scroll performed
**O(n²) cosine similarities on every render** — a million of them at a
thousand kept things — and threw the answer away, because the panel is
collapsed. It is memoised now, and only a window of plates is mounted to
begin with.

## Intake

Four lanes into the understory:

1. **Type or paste** — the everyday case. One field, no required metadata.

   The Source field offers existing sources back as you type (a native
   `<datalist>`, so it needs no styling of its own and degrades to a plain
   text field when there's nothing yet to suggest) — retyping "Meditations"
   a fourth time completes it rather than risking a slightly different
   string that reads as a new book to `resolveSource`'s similarity check.

   Whatever the body's own source, capture cleans up its whitespace before
   it's stored — `lib/textNormalize.ts`, run uniformly on a typed body, a
   share, a Kobo highlight and an OCR transcription alike. CRLF line endings,
   trailing space at a line's end, a non-breaking space, three-or-more blank
   lines squashed to one: all artifacts of the copy mechanism, none of them
   the passage. It never touches a word, a single line break, or an
   intra-line run of spaces (a poem's own shape survives exactly) — the same
   read-not-infer discipline `isBareUrl`/`intakeKind` already hold to
   elsewhere in intake. It exists alongside a second fix: a passage's own
   paragraph breaks used to render as one collapsed wall of text on both the
   plate and the nursery row, because a plain `<p>`'s default whitespace
   handling silently swallows a stored `\n` — both now render with
   `white-space: pre-wrap`, so what was actually pasted is what's actually
   shown.
2. **Kobo import** — see below.
3. **Share target** — a link or a selection shared from anywhere on the device
   opens Silva with the intake field already filled in.

   A shared URL arrives in the *locator* (the share sheet sends the page title
   as the text), and a locator that is nothing but a URL is **promoted into
   `link`** at capture — `lib/intakeFields.ts`. Left in the locator it earned
   no preview card, no `Link` kind and no article title, on the one lane most
   likely to be used at all. A locator that merely *contains* a URL is prose
   you wrote, and stays put.

   Three things the parser has to get right, because share sheets are not
   consistent and none of them is Silva's to choose (`lib/sharedIntake.ts`):

   - **A wordless share is the URL, not an empty thing.** Most messaging apps
     send a link with no title and no text at all. That used to arrive as an
     empty body with the URL in the locator — and an empty body is one Silva
     can never repair, since the article's title only ever replaces a body
     that is *nothing but* a URL. It sat in the forest as a blank headline
     over a preview card, permanently. The URL goes in the body instead,
     which is exactly the path a pasted URL already takes.
   - **A link at either end of the shared text is split off it.** Most
     Android apps send one `text` reading "Some video title / https://…" and
     leave `url` empty; left whole that is not a bare URL and earned nothing.
     The split is deliberately narrow — a whole word at the very start or the
     very end, with prose (not a second URL) left over — because a URL inside
     a sentence is a sentence. Not the same judgment as a *locator* that
     contains a URL: that is words you typed, this is a share sheet's
     boilerplate wrapped around a link. A URL read out of prose also loses
     the sentence's punctuation on the way ("Read this https://x.dev/a." is
     a link that 404s if the full stop is kept), while a URL arriving in the
     `url` parameter is a structured field an app filled in deliberately and
     passes through exactly as given.
   - **A link already in the forest is remarked on, not blocked**
     (`lib/linkDuplicate.ts`). Sharing is the one lane with no memory in it —
     tapping share on an article kept in June looks exactly like tapping it
     on one never seen before. The intake field says which state the existing
     copy is in and when it arrived, and does nothing else: a second
     encounter with the same piece is a real thing to record, and only you
     know whether this one is.
   - **A link is kept without the tracking tags it arrived wearing**
     (`lib/linkUrl.ts`, applied for every lane at `lib/intakeFields.ts`).
     A campaign tag prints on the specimen label, outlives by years the
     newsletter that set it, and makes one article look like several. Two
     lists, not one: the **stored** list is narrow and unambiguous — `utm_*`,
     `fbclid`, `gclid` and their kin — because removing a parameter a site
     routes on leaves a link that no longer resolves, which is worse than an
     untidy one that does. The **compared** list adds the ambiguous names
     (`ref`, `source`, `si`, `feature`), which are ignored when asking
     whether two links are the same page and never removed from either. A URL
     with nothing to strip comes back byte for byte — no added trailing
     slash, no re-encoding.

   Declared `method: "GET"`, so the OS launches the app at a URL with query
   parameters rather than POSTing anywhere: the whole handler is
   `lib/sharedIntake.ts` reading `location.search`, and it costs **no
   serverless function**. That also makes it not Android-only — iOS has no Web
   Share Target API, but a Shortcut in the share sheet opening
   `silva-react.html?text=…` lands in the same code.

   It opens the field rather than landing silently: the moment a note is

   The service worker treats a share as what it is — a navigation carrying a
   query string. Its offline fallback matches with `ignoreSearch`, because
   the cached copy is keyed on the bare page URL and a share that missed it
   was eaten by the browser's offline page, on the lane most likely to be
   used away from wifi. The same query check keeps a navigation with
   parameters *out* of the cache, so the cache no longer grows by a whole
   page copy per link shared (`public/silva-sw.js`).
   easiest to write is while you still remember why you shared it.
4. **Photograph a page** — a picture of a physical book's page, kept as an
   Image thing. Deliberately *not* OCR'd in v1: an image is a legitimate thing.

   Downscaled by `shared/photo.ts`, then through the existing
   `api/notion-upload` relay — no new function. Without a token the blob goes
   to IndexedDB and `Thing.image` holds a reference (`lib/photoStore.ts`),
   because a ~300 KB data URL inside the localStorage demo snapshot would take
   the whole demo forest down within a handful of photographs.

### A preview is a server fetch, so some links never ask for one

An Open Graph preview is read by `/api/notion-photo-proxy`, which means asking
for one publishes the URL — and the Nursery asks the moment a share lands,
before you have decided whether to keep the thing at all. Release it a second
later and the link has still left the device.

So `lib/linkPrivacy.ts` gates every call: a URL carrying its own credential (a
`token`, a signature, `user:password@`), or pointing somewhere only this device
can reach (`localhost`, a private range, a dotless intranet name), or speaking
anything but http, is never sent. Nothing else changes about it — it is still
kept, still a `Link`, still opens on tap, and renders as the plain host/path
line the card already falls back to whenever a preview is missing. The bias is
one-directional on purpose: a withheld preview costs a thumbnail, and a sent
one cannot be taken back.


### A kept link takes the article's title

A pasted URL is its own body, so a Link thing used to sit in the forest titled
`https://nesslabs.com/jomo` — the one thing on the plate set at reading size
being the one thing on it not worth reading. At **Keep**, a link whose body is
*nothing but* that URL takes the title from its own Open Graph preview
(`lib/linkTitle.ts`, the preview already cached for the Nursery thumbnail), so
it lands in the forest as "The joy of missing out" and the only thing left to
type is your note.

Not a violation of "never classify at capture": nothing is being inferred about
what the thing *means*. The page's `og:title` is a fact printed on the page,
read out the same way `isBareUrl` reads a URL out of a pasted body. The rules
that keep it safe:

- exactly three placeholder bodies are replaceable, and a passage you typed or
  a link you retitled by hand is never one of them, however often the preview
  refreshes: a **bare URL** (what a paste leaves behind), an **empty body**
  (what a wordless share used to leave — fixed at the source, but rows created
  before that are still in the forest), and **"Headline — Site"**, which is
  what a phone's share sheet hands over as the page title. That third one is
  the most common link capture there is and it used to keep its publisher
  suffix forever; both halves have to match what the page prints about itself
  — the `og:title` exactly, then a separator, then the site's own name — so a
  passage that merely opens with the title is untouched;
- a title that is only the URL again, or long enough to be a standfirst rather
  than a headline, is refused;
- it runs *behind* the keep and never blocks it, and a failed fetch or write
  leaves the URL standing with no toast — a cosmetic title is never worth an
  alarm.

It also fills the two fields around it, under the same rule — only where you
left nothing:

- **`locator`** takes the byline and year the page prints on itself
  ("Anne-Laure Le Cunff · 2021"). A locator *you* wrote ("sent by R.")
  outranks any meta tag. A byline that is really a Facebook profile URL, or a
  year outside the plausible range, is dropped rather than printed on a
  label.
- **`source`** takes the publication — the preview's site name — resolved
  through the same `resolveSource` the typed lane uses (threshold 0.9), so a
  forest ends up with one "Ness Labs" and not four, created with Source kind
  `Article`. A link you already filed under someone stays filed under them.

A pasted link is also the one capture that arrives with a **Kind** already set
(`intakeKind`): `Link`, read out of the pasted text the same way the `link`
field itself is. That is the only Kind Silva ever sets for you — every other
one stays a judgment made later through Edit's **Suggest**, or never made at
all.

The plate also stopped saying it twice. A link kept from a share sheet *is*
its own headline, and the preview card underneath repeated it word for word in
small grey type; the card now keeps its image, standfirst and site and drops
the line the plate has already set at reading size.


And because the URL leaves the body text once the title lands, `inferKind`
reads `Thing.link` too, so **Suggest** still proposes `Link` for a thing that
no longer looks like one.

### Kobo import

Kobo highlights are not cloud-synced anywhere reachable — they live in
`.kobo/KoboReader.sqlite` on the device, which mounts as a plain USB drive.
Silva parses it **entirely in the browser** with `sql.js` (SQLite via WASM):
drag the file onto the page, nothing is uploaded, no desktop tool, no account.

- Reads the `Bookmark` table joined against `content` for volume titles.
- Filters out position-only bookmarks with no text.
- A highlight carrying your own annotation becomes **one** thing: the passage as
  `body`, your annotation as `note`. It was one act of attention.
- Dedupes on Kobo's own `BookmarkID`, so re-importing the same file is a no-op
  and importing every few weeks is the intended rhythm.
- **Highlights arrive gathered by book.** A season's reading is hundreds of
  rows, and a flat fading list of them is not something anyone decides about.
  The nursery sections them under the book's title, author and count
  (`lib/nurseryGroups.ts`) — presentation only: no field is set, no source
  assigned, nothing reordered within a section. Your own unsourced captures
  stay unheaded and first, and a nursery with no sourced things at all renders
  the same flat list it always did.
- **`Kind` is read from the highlight, not fixed.** Every import used to be a
  `Passage`, which is already an inference — just a wrong one for a question
  the book asks or a line of dialogue. `inferKind` gives the same starting
  point Edit's **Suggest** offers, and is just as editable.
- **Covers come from the ISBN.** `Cover` was the one field in the Sources
  schema nothing ever filled. Kobo's `content` table carries the book's ISBN,
  which makes it an exact lookup rather than a fuzzy title guess — a title
  match on "Meditations" would cheerfully return the wrong edition of the
  wrong book. Open Library serves covers at a URL derived from the ISBN, so
  there is nothing to query and **no serverless function**: the URL is the
  answer, and the browser probes it with a plain `<img>` before storing it, so
  a book with no cover keeps an empty field rather than a permanently broken
  image. Only ever *fills* a cover; never replaces one you chose.
- **A highlight knows where in the book it sat.** `Bookmark.ContentID` names
  the chapter (as against `VolumeID`, the book), so the import fills `locator`
  with the chapter's own title — or, for the many EPUBs whose chapters are
  titled `index_split_014.html`, with `ChapterProgress` as "63% in". Vague but
  true, which is the whole bar for a locator. Both columns are feature-detected
  like everything else in that parser.
- **Book matching is a step, not an inference.** Kobo's EPUB metadata gives
  different strings for different editions and re-downloads, so the importer
  proposes a match against existing Sources and lets you confirm, merge or
  create — the same posture as WhereItWent's duplicate detection.

**Known risk:** Kobo's schema is not a public API and has shifted across
firmware versions. The parser must be defensive (feature-detect columns, never
assume), fail with a legible message rather than silently importing nothing, and
be covered by fixture-based tests using a checked-in miniature `.sqlite`.

**Known seam:** this lane needs a computer and a cable. The rest of Silva is
phone-first; the Kobo hop is not, and no amount of design fixes that.

## The semantic layer

Embeddings run **in the browser**, locally.

- A small quantised sentence-transformer (~25 MB, MiniLM-class, 384-dim) via
  `transformers.js`, fetched once and held in Cache Storage.
- Vectors live in IndexedDB keyed by thing id + a content hash, so an edit
  invalidates its own vector and nothing else.
- Similarity is brute-force cosine on device. At personal scale this is not a
  problem worth solving cleverly: 5 000 things is ~7.5 MB of vectors and a
  full scan is single-digit milliseconds. No ANN index, no vector database.
- The index is **derived state**. Notion holds the content; the vectors can be
  thrown away and rebuilt at any time.

Why this and not a hosted embedding API: it works offline, needs no key, sends
nothing anywhere, and — decisively — **costs zero serverless functions.**

## What you have looked at

A third piece of derived, on-device state, alongside the vectors: when each
thing was last actually read (`lib/seen.ts`, IndexedDB, never Notion).

It exists because `long-unvisited` was filtering on `daysSince(thing.kept)` —
so "long unvisited" literally meant "kept more than 180 days ago", could not
tell a thing reread weekly from one never opened since the day it was saved,
and had a candidate pool that only ever grew because nothing drained it.

"Seen" means seen: a plate half on screen for a beat and a half
(`components/useDwell.ts`), recorded from the walk and the scroll alike.
Scrolling past records nothing, which is correct — and the threshold matters
because history accumulates and a signal corrupted by scroll-past cannot be
repaired retroactively.

> **It never becomes a number.** SILVA.md forbids scoring anything in the
> collection; this measures *you*, not the things, and stays invisible — never
> a count, never a visible ordering that reads as a leaderboard of your own
> attention. It only ever chooses what to put in front of you.

## Data and architecture

**Notion-backed, BYO token, local-first**, like Loom, Wanderlist, Journal of
Delights and WhereItWent.

Silva is **local-first**: the forest in React state is what the UI renders and
mutates instantly (keeping, releasing, coining a locus, accepting a provocation
never wait on the network); the active client is the backing store, written
through in the background. A failed live write reverts the optimistic change and
surfaces a short toast — nothing is silently lost. Which client is active is
decided in `lib/store.js`:

- **No token → the demo store** — a full offline forest in `localStorage`,
  seeded once from `lib/fixtures.js` with enough things, loci and paths that
  every view and every provocation kind is populated on first run. Following
  WhereItWent, the whole app is usable before you create a single database.
- **Token set → live Notion** — via the same stateless same-origin
  `/api/notion` proxy every Notion app here uses (BYO token in the
  `x-notion-token` header, classic Notion-Version 2022-06-28). Writes prune
  their payload so a lone field write never clobbers the title.

### Notion paperwork (per the "Building an App" playbook)

- **Live databases** — the owner's four Silva databases created under Notion's
  **App Databases** page, exactly where Loom, Wanderlist and the rest live.
  Their data-source ids are recorded as `DEFAULT_*_DATABASE_ID` in
  `lib/store.js` (not secrets), so a token alone is enough to run against the
  owner's forest without pasting four ids.
- **Starter Template** — an empty, de-personalized copy of all four, grouped
  under one parent page, filed under **Starter Templates** and documented as
  "duplicate this to start" in the guide (Notion's own one-click Duplicate
  carries the whole set, and — importantly — carries the relation wiring
  between them, which hand-rebuilding would not).
- **Guide** — `public/silva-guide.html`, a self-contained page in the Silva
  herbarium aesthetic (theme-synced to the app) walking the whole setup:
  duplicate the template, create an integration, share the four databases,
  paste the token. Linked from Settings and from the registry `guide` field.

### Creation order (relations need their target to exist first)

`Sources` → `Loci` → `Things` → `Paths`. Anyone rebuilding by hand rather than
duplicating the template must follow it; the guide says so.

### Notion schema (documented once, in the guide)

Property names are exact. Four databases.

#### 1. Sources — where a thing came from

| Property | Type | App field |
|----------|------|-----------|
| `Title` | title | the work's title |
| `Author` | rich text | author, speaker, or empty |
| `Kind` | select | `Book` · `Article` · `Film` · `Conversation` · `Song` · `Self` · `Unknown` |
| `Cover` | files | cover image — filled from the book's ISBN on import (external file, no upload), or by hand |
| `Kobo Volume ID` | rich text | Kobo's `VolumeID`, the key the importer matches on |
| `Notes` | rich text | your note on the source itself |

#### 2. Loci — the clearings

| Property | Type | App field |
|----------|------|-----------|
| `Name` | title | the clearing's name |
| `Meaning` | rich text | what *you* meant by it — shown at the head of the clearing |
| `Coined` | date | when you named it (loci are always retrospective) |

#### 3. Things — the collection itself

| Property | Type | App field |
|----------|------|-----------|
| `Handle` | title | a short handle — first words of `body`, auto-filled, editable |
| `Body` | rich text | the passage, thought, question, or dialogue |
| `Kind` | select | `Passage` · `Observation` · `Dialogue` · `Question` · `Image` · `Link` · `Fragment` · `Mine` |
| `State` | select | `Understory` · `Kept` · `Released` |
| `Source` | relation → **Sources** | two-way (Sources gains `Things`); **optional** — a thing may have no origin |
| `Locator` | rich text | chapter, page, timestamp, "overheard on the 32 tram" |
| `Encountered` | date | when it reached you |
| `Kept` | date | when you chose to keep it — empty while in the understory |
| `Note` | rich text | your annotation: why this, what it rhymed with |
| `Loci` | relation → **Loci** | two-way (Loci gains `Things`), many, **never written at capture** |
| `Image` | files | for `Image` things and page photographs |
| `Link` | url | for `Link` things |
| `Kobo Bookmark ID` | rich text | Kobo's `BookmarkID` — the dedupe key; empty for anything not imported |

`Body` is rich text rather than the title because Notion titles are
single-line and a passage is not. `Handle` exists so the row is legible in
Notion itself — Silva never shows it as a heading.

#### 4. Paths — connections you made

A separate database because **a Notion relation cannot carry properties**, and a
path without its `Why` is precisely the artefact we are trying not to build.

| Property | Type | App field |
|----------|------|-----------|
| `Label` | title | short label, auto-filled from the two handles |
| `From` | relation → **Things** | one-way |
| `To` | relation → **Things** | one-way |
| `Why` | rich text | **the point of the record** — what you saw between them |
| `Made` | date | when you walked it |
| `Origin` | select | `Yours` (you drew it) · `Accepted` (you accepted a provocation) |

Both relations are **one-way** deliberately: two-way would hang two synced
properties off `Things` and clutter every row in Notion for no gain, since Silva
resolves paths by querying `Paths` directly.

`Origin` is descriptive only — never scored, never used to rank. It exists so
the Paths view can distinguish a path you drew unprompted from one the
mycorrhiza suggested and you agreed with.

The pure Notion↔app mapping lives in `lib/notion.js` (`toThing` / `toSource` /
`toLocus` / `toPath` and their inverses), reusing `shared/notionId` for pasted
database URLs — and, per the Loom precedent, it is the most heavily tested piece
in the app.

### Serverless budget — the hard constraint

`api/*.js` sat at **12 of Vercel Hobby's 12** functions when Silva was built:

```
clickdeck-hltb · clickdeck-pricing · clickdeck-studio-search
generate-law-of-the-day · law-of-the-day-content · notion-photo-proxy
notion-upload · notion · places · steam-search
wanderlist-remind · wanderlist-reminders
```

**One more file fails the deploy.** Silva therefore adds none:

> Since then `wanderlist-reminders` has been folded into `wanderlist-remind` behind a
> `?mode=prefs` param (Aug 2026), freeing one slot — but the cap and the rule below
> are unchanged: check the count before adding any `api/*.js`.

- Notion goes through the existing `api/notion.js` relay unchanged.
- Images go through the existing `api/notion-upload.js` /
  `api/notion-photo-proxy.js`.
- Embeddings are local, so there is nothing to proxy.
- Provocations call Anthropic **directly from the browser** with a
  user-supplied key, as Daily Stoic, Sol Odyssey, Fit Check, Lexi5, Touch Grass
  and WhereItWent already do. `api/generate-law-of-the-day.js` is not an option
  to extend — it holds a real `ANTHROPIC_API_KEY` and is deliberately locked to
  Vercel Cron behind `CRON_SECRET`.

The key is entered in Settings, kept on-device, and never committed. It is
optional: without it, the four deterministic provocation kinds still work.

## Prerequisite: promote a shared Anthropic client

Six apps now hand-roll a client-side Anthropic call — `fit-check/lib/tagging`,
`lexi5`, `where-it-went/lib/aiParser`, `sol-odyssey/lib/companion`,
`daily-stoic/lib/mentor`, `touch-grass/engine`. Silva would be the seventh.

Per the repo's own rule — promote to `src/shared/` once a second app needs it —
this is overdue. **Before building Silva**, extract `src/shared/anthropic.ts`
(BYO-key client, model constant, error normalisation, the
direct-browser-access header) and leave each app's original path working as a
thin re-export, so the existing tests prove the move was behaviour-preserving.

Silva also reuses without copying: `shared/notionId` (paste a database URL),
`shared/storage`, `shared/photo` (downscale before upload), `shared/installFlag`
(`watchInstalled('silva-react.html')`), `shared/haptics`.

**Promotion candidate out of Silva:** `shared/embeddings.ts` — the
transformers.js wrapper, cosine helper and IndexedDB vector cache. Per the same
rule it stays local to Silva until a second app wants it, but it is written to
be liftable.

## The look: a herbarium, not a library

Every obvious treatment for a book app is already occupied in this repo —
parchment and candlelight is Codex Alchymicus, twilight-parchment with Cinzel is
Loom, dark restraint is Yoru, painted illustration is Touch Grass, retro CRT is
Click Deck. Silva goes somewhere none of them are: **the botanical specimen
plate.**

The reference is an 18th–19th century herbarium sheet — pressed matter mounted
on rag paper with an engraved plate beside it and a small typed label in the
corner. It suits the app exactly: a herbarium is a collection of *actual things*
that were gathered, pressed, labelled and kept, arranged by affinity, consulted
by people looking for something else.

- **Ground:** unbleached rag paper, warm off-white, faint fibre texture. Dark
  mode is not black — it is deep bark/umber with aged-ivory ink, a herbarium
  at night.
- **Ink:** near-black with a green cast for body text; sepia for metadata.
- **The one accent is oxblood**, reserved exclusively for the underground layer
  — mycorrhiza, and nothing else. When you see oxblood, you are looking at
  something the app noticed and you haven't.
- **Rules and frames:** hairline, engraved-plate weight. A thing is *mounted* on
  the page inside a thin keyline, not stacked in a card.
- **Type:** a transitional serif for bodies — passages must feel *set*, like
  type on a plate, never like a text field. Metadata in small caps. The
  specimen-label motif carries `source · locator · encountered · kept`.
- **Motion:** almost none. Things do not animate in. The only motion in the app
  is the slow fade of an expiring understory item, and the drawing of a path
  when you accept a provocation.
- **Density:** one thing at a time, generous margins. Explicitly the opposite of
  CommonBook's three-pane tree-and-toolbar layout — passages are objects on a
  table, not rows in a database.

Built on `src/ds/` (tokens, theme handling, primitives), with Silva's palette
and the plate/label components layered above it. Light and dark, syncing to the
device.

## Build order

1. `src/shared/anthropic.ts` promotion + re-exports, existing tests green.
2. Create the four live databases under **App Databases** (`Sources → Loci →
   Things → Paths`); record their ids in `lib/store.js`; duplicate the
   de-personalized set into **Starter Templates**.
3. Things model, `lib/notion.js` mapping + tests, demo forest, the forest view.
4. Understory: intake, keep/release, season expiry.
5. Kobo import: `sql.js` parse, fixtures, book matching, dedupe.
6. Loci: coin, merge, dissolve. Clearings view.
7. Paths: make, annotate. The Paths view (paths only).
8. Embeddings: local model, IndexedDB cache, semantic search.
9. Provocations: deterministic kinds first, then mycorrhizal, then Tension.
10. PWA, `watchInstalled`, apps-registry entry at the top, Cabinet checklist,
    guide page.

## Conventions checklist

- [ ] Registry entry at the **top** of `src/apps-registry.js` (`ds: true`,
      `kind: "react-vite"`, `manifest: "/silva.webmanifest"`) — APPS[0] is
      "Latest" automatically
- [x] Build entry in `vite.config.js`; app at `silva-react.html`
- [ ] Service worker registration gated on `import.meta.env.PROD`
- [x] `watchInstalled('silva-react.html')` once at startup
- [ ] Imports from `src/ds/` only — no legacy-app imports
- [ ] `npm test`, `npm run typecheck`, `npx eslint <changed paths>` all green
- [ ] Guide page `silva-guide.html` documenting the Notion schema once
- [ ] No new `api/*.js` file (budget is full at 12)
- [ ] Four live databases created under Notion's **App Databases** page, in the
      order `Sources → Loci → Things → Paths`, with relations wired as specced
- [ ] Data-source ids recorded as `DEFAULT_*_DATABASE_ID` in `lib/store.js`
- [ ] Empty, de-personalized copies grouped under one parent page and filed
      under **Starter Templates**, with Duplicate verified to carry the
      relation wiring intact
