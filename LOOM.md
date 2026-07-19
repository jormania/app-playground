# Loom — weave your week

**[coneofcold.vercel.app/loom-react.html](https://coneofcold.vercel.app/loom-react.html)**

A tactile five-minute weekly planner, and a tribute to LucasArts' **Loom** (1990)
and the SCUMM adventures. Source: [`src/loom/`](src/loom/). Entry shell:
`loom-react.html`. A `react-vite` app that **builds on the shared design system**
(`src/ds/`) — see the [design-system rule](CLAUDE.md) — but reskins it wholesale
to one committed "twilight loom" palette, exactly the way Yoru does.

The brief lives on the Notion page **App Ideas → Loom**. The mission is the
frictionless part; the LucasArts vibe is the paint. The paint must never get in
the mission's way — so the tribute lives in the palette, the lettering, the
verbs and the language, while the core loop (type a task, swipe it, drag it,
flip the view) stays fast and modal-free.

## The idea in one line

Every task is a **thread**. Spin it, warp it across a **day** of the week, gather
it into a **skein** (a project), and rank your threads by hand — the **Ivy-Lee
heatmap** dyes the top thread ember-hot and cools the rest.

## The three views are one dataset

There is a single array of threads (the app's source of truth). The views are
just different groupings/readings of it — toggling never moves data between silos:

- **Skeins** (List view) — threads grouped by skein (project/category). Each skein
  is its own ordered, heat-dyed stack. A skein-and-thread composer up top starts
  new work; each skein has its own inline adder, and a group-level sort
  (manual/heat/size/name — rows within a group always stay manual by hand).
- **The Week** (Weekly view) — the same threads warped across the seven days of the
  current week (Mon→Sun, with prev/next/"this week"), plus **the distaff** — a
  backlog rail of unspun (day-less) threads to pull onto a day.
- **The Tapestry** (History view) — a descriptive read *across all weeks* (see
  below). It ignores the live search/focus filters by design.

## Beyond the core loop (added features)

All of these sit on the same one thread array; none needs a Notion schema change.

- **Re-warp the week (carry-over ritual)** —
  [`components/RewarpRitual.jsx`](src/loom/components/RewarpRitual.jsx). A guided,
  one-at-a-time pass over the threads still hanging from *past* weeks
  (`carryThreads` in model.js = unwoven and dated before this week's Monday). For
  each: flick it forward onto a day of the new week (its own weekday pre-lit), drop
  it to the distaff, weave it done, or leave it. Batch escapes handle "all → their
  weekday" / "all → the distaff". The toolbar's Re-warp button carries a badge of
  how many are waiting.
- **Drafts (recurring weaves)** —
  [`components/DraftsModal.jsx`](src/loom/components/DraftsModal.jsx) +
  [`lib/drafts.js`](src/loom/lib/drafts.js). Save this week's open threads as a
  named draft (each item pinned to a day-of-week or the distaff) and weave it onto
  any week in one tap (`threadsForDraftWeek` maps day-of-week → real dates). A
  draft flagged **repeat** is offered by the week view on each fresh week (an
  opt-in banner; a cast log stops it nagging). Drafts are **device-local**
  (localStorage) whether you're in demo or live — they're personal templates, not
  board data, so casting one just creates ordinary threads in whatever store is
  active. A single repeating thread is just a one-line draft — that's the app's
  "weekly on day X" recurrence, deliberately kept short of a calendar-grade RRULE.
  Draft snapshots automatically **exclude rhythm-skein threads** (see Rhythm below).
- **The Tapestry** — [`components/Tapestry.jsx`](src/loom/components/Tapestry.jsx),
  aggregated purely by `tapestryStats` (model.js). An N-week (4/8/12) heatmap over
  `Day`+`Done` — the cloth you've woven — plus completion rate, hottest skein,
  busiest weekday, and "still unwoven from past weeks". Reuses **Recharts** (already
  a dep) for the by-week bar chart; the heatmap is CSS grid. Descriptive, **never
  scored or streaked** (Journal of Delights' ethos). `weekReview` is the same idea
  for a single week (the no-server "this week — N woven, M carried" summary).
- **Find & focus** — one search field (`matchesQuery` over title+skein) plus
  toggles for *unwoven only* and *top of each group* (the hot few, `topOfGroup`),
  cross-view. Woven threads can be **folded** per group
  ([`components/WovenFold.jsx`](src/loom/components/WovenFold.jsx)) rather than just
  hidden. Row-level sort is deliberately absent — manual position is the identity;
  only skein-**group** order is sortable. The whole toolbar (search + these
  toggles + Re-warp + Drafts) is **icon-only**
  ([`components/icons.jsx`](src/loom/components/icons.jsx), small line SVGs in the
  style of Journal of Delights' `icons.jsx`) so it holds a single row on every
  screen and interface style — a tooltip (sourced from the lexicon) carries the
  label a text chip used to show.
- **Cross-column drag** —
  [`lib/dragContext.jsx`](src/loom/lib/dragContext.jsx). A single shared drag
  controller lets a thread be flung within its group **or onto another day / the
  distaff / another skein**, resolving to a single `Day`/`Skein`+`Order` write.
  Empty columns keep a real drop target (the list grows to fill its column). The
  day-mover / skein chips stay for keyboard and precision.
- **Undo on unravel (re-ravel)** — a swipe-left delete leaves a 5-second toast that
  re-weaves the thread back (App.jsx `removeWithUndo` / `reravel`).
- **The Rhythm (daily routines)** —
  [`lib/rhythm.js`](src/loom/lib/rhythm.js) +
  [`lib/model.js`](src/loom/lib/model.js) (`rhythmThreadsForWeek`,
  `splitRhythmThreads`). Flag one skein as **the rhythm** (a single `loom_rhythm_skein`
  localStorage key, zero Notion schema changes). On each fresh week, a gentle banner
  in the Week view offers to cast it — placing one copy of each thread on all seven
  days, **duplicate-guarded** so carry-overs aren't doubled. Rhythm threads render at
  the **top of each day column** in a lightly-tinted block (`rhythmBlock` CSS),
  visually separating the daily givens from one-off work below. The skein view lets
  you set/unset the rhythm with a wave-icon button on the skein header. Drafts
  exclude rhythm-skein threads from snapshots. Full design rationale:
  [`LOOM_RHYTHM_DESIGN.md`](LOOM_RHYTHM_DESIGN.md).

## Two voices (the terminology toggle)

Every SCUMM-flavoured word on screen is an **alias**.
[`lib/lexicon.js`](src/loom/lib/lexicon.js) holds two maps with identical keys —
the default **loom** voice (thread · skein · weave · the distaff · the Guild) and a
**plain** voice (task · project · complete · the backlog · Settings) — and
[`lib/lexiconContext.jsx`](src/loom/lib/lexiconContext.jsx) exposes `t(key)`.
Nothing about behaviour changes with the voice; it's pure wording, chosen in
Settings → Vocabulary and remembered in the `loom:lexicon` key (with a
`storage`-event sync, same as the theme). The base SCUMM flavour is the "vanilla"
default.

## The heatmap (Ivy-Lee, no priority tags)

Within any group threads are sorted by a manual `order`; **position alone** sets
the colour. The top thread burns ember-red and each below cools through copper,
gold and sage to slate. The ramp spans the top `HEAT_CAP + 1` threads (Ivy Lee's
"pick six"); anything past that falls to a cold, undyed grey — so an **overloaded
day grows a visible grey tail** without any hard task limit ever being enforced.
All of this is pure and unit-tested in [`src/loom/lib/model.js`](src/loom/lib/model.js)
(`heatColor`, `dyeAt`, `heatForIndex`).

Reordering only ever rewrites the moved thread's rank to the **midpoint of its new
neighbours** (fractional ranks — `rankBetween` / `orderForMove`), so a drag is one
cheap `Order` write, never a renumber of the whole group. Reorder by dragging the
grip, or focus it and use ↑/↓.

## Tactile gestures (the "Clear"-app feel)

Per thread row ([`components/ThreadRow.jsx`](src/loom/components/ThreadRow.jsx)):

- **swipe right → weave** (mark done) · **swipe left → unravel** (delete)
- tap the **knot** to weave/unweave · tap the **title** to edit inline
- the row locks to the horizontal axis only once a swipe clearly dominates, so
  vertical scrolling is never hijacked
- reassign inline, no modal: a **day mover** (fling a thread along the warp to
  another day) in the Weekly view, a **skein chip** (pick or type a skein) in the
  List view

## Data: local-first, Notion-backed

Loom is **local-first**. The thread array in React state is what the UI renders and
mutates instantly (drags, swipes and typing never wait on the network); the active
client is the backing store, written through in the background. A failed live write
reverts the optimistic change and surfaces a short toast — nothing is silently lost.
See [`lib/useLoom.js`](src/loom/lib/useLoom.js).

Which client is active is decided in [`lib/store.js`](src/loom/lib/store.js):

- **No token → the demo store** — a full offline board in `localStorage`, seeded
  once from [`lib/fixtures.js`](src/loom/lib/fixtures.js) (which generates threads
  onto the *current* week so both views are populated).
- **Token set → live Notion** — the database id defaults to the built-in
  `DEFAULT_DATABASE_ID` (the owner's live "Loom" database) when the user hasn't
  set their own, so a token alone is enough. All calls go via the same stateless
  same-origin proxy (`/api/notion`) every Notion app here uses (BYO token in the
  `x-notion-token` header; classic Notion-Version 2022-06-28). See
  [`lib/notionClient.js`](src/loom/lib/notionClient.js). A reorder patches **only**
  `Order`; a weave patches only `Done` — `patchProps` prunes the payload so a lone
  field write never clobbers the title.

### Notion paperwork (per the "Building an App" playbook)

- **Live database** — the owner's "Loom" DB under Notion's **App Databases** page
  (data-source id recorded as `DEFAULT_DATABASE_ID` in `store.js`; not a secret).
- **Starter Template** — an empty, de-personalized copy under **Starter
  Templates**, documented as "duplicate this to start" in the guide (Notion's
  own one-click Duplicate).
- **Guide** — [`public/loom-guide.html`](public/loom-guide.html), a self-contained
  page in the Loom aesthetic (theme-synced to the app) that walks the whole setup:
  duplicate the template, create an integration, share the DB, paste the token.
  Linked from Settings and from the registry `guide` field.

### Notion schema (documented in-app under "The Guild")

Five properties, names exact:

| Property | Type | App field |
|----------|------|-----------|
| `Name`   | title    | the thread's text |
| `Skein`  | select   | its project / category (List-view grouping) |
| `Day`    | date     | the day it's warped to (empty = backlog) |
| `Order`  | number   | its manual rank (drives the heat) |
| `Done`   | checkbox | woven |

The pure Notion↔app mapping lives in [`lib/notion.js`](src/loom/lib/notion.js)
(`toThread` / `toNotionProps` / `parseNotionId`), the most heavily tested piece.

## The look (two SCUMM-flavoured palettes)

Loom ships **two** committed, SCUMM-flavoured palettes — a dark **Twilight**
(deep petrol-teal dusk, aged Guild gold, candlelit-parchment ink) and a light
**Parchment** (aged daylight paper, brown ink, ochre-gold). Deliberately *not*
the six-palette Journal/Wanderlist system — just two moods for now. Both are set
as `[data-theme]` token overrides in [`loom.css`](src/loom/loom.css), loaded
after `ds/tokens.css`, so every DS component (Modal, Field, Button) adopts the
palette with no per-component special-casing. The theme lives in
[`lib/theme.js`](src/loom/lib/theme.js) + [`lib/themeContext.jsx`](src/loom/lib/themeContext.jsx)
(one `loom:theme` localStorage key shared with the guide, a `storage`-event sync,
and a pre-paint FOUC script in `loom-react.html`); the header **◐** button
cycles it and Settings → Appearance jumps straight to one. The ember→slate
dyed-thread heat scale is constant across both themes — dye is dye.

Settings ("The Guild") is reachable from the header **⚙** gear and the bottom bar;
it holds the Notion connection, the Appearance picker, the **Interface style**
picker, and the **Vocabulary** toggle (see "Two voices").

- **Type:** Cinzel for the ceremonial Guild lettering (the wordmark, section
  titles, the verbs); Alegreya for thread text (a literary, hand-woven feel);
  Inter for small UI/meta so numbers and inputs stay crisp.
- **Interface style — one coordinated pair, top and bottom.** A single choice
  ([`lib/uiStyle.js`](src/loom/lib/uiStyle.js), `loom:uistyle`, device-remembered,
  back-compat with the old `loom:barstyle`) drives BOTH the top toolbar
  ([`components/Toolbar.jsx`](src/loom/components/Toolbar.jsx)), the week nav, and
  the bottom bar ([`components/VerbBar.jsx`](src/loom/components/VerbBar.jsx)) so
  they always match:
  - **slim row** (default) — frosted, edge-to-edge; filters gather into a sunken
    segmented pill echoing the bottom's view switch.
  - **floating pill** — detached, blurred, shadowed clusters: a search pill, a
    filters pill, an actions pill, a week-nav pill, and the bottom pill.
  - **icon tabs** — one flat translucent strip of glyph+label items top and
    bottom.
  All are backdrop-blurred and translucent; the demo/Notion state rides along as a
  small dot; the old status "sentence line" was dropped when the bar was slimmed.
- **Language:** threads · skeins · the warp · the distaff · spin · weave · unravel
  · the Guild (all aliased to plain planner words by the Vocabulary toggle).

## Conventions checklist (all done)

- `kind: "react-vite"` + `manifest` in [`src/apps-registry.js`](src/apps-registry.js)
  (drives both `index.html`'s card grid and the Cabinet).
- `watchInstalled('loom-react.html')` in `main.jsx`; scoped SW registered PROD-only.
- `public/loom.webmanifest` + `public/loom-sw.js` + PWA icon set
  (`npm run gen:loom-icons` from `public/loom-icon.svg` / `loom-logo.svg`).
- `public/loom.webmanifest`'s absolute URL added to `related_applications` in
  `public/cabinet.webmanifest`.
- `loom-react.html` added to `vite.config.js`'s build inputs.
- Pure logic covered by `model.test.js`, `notion.test.js`, `notionClient.test.js`,
  `rhythm.test.js`.

