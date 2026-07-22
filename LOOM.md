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
  new work; each skein has its own inline adder. Skeins sort by first appearance
  plus whatever order you've dragged them into by hand (persisted as
  `prefs.skeinOrder`) — there's no separate sort-mode picker; rows within a group
  always stay manual by hand regardless. Drag the grip (always visible, not a
  hover reveal) to reorder skeins — a real pointer drag, the same technique as
  every other drag in Loom, not native HTML5 drag-and-drop (which never worked
  on touch).
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
- **The Tapestry** — [`components/Tapestry.jsx`](src/loom/components/Tapestry.jsx).
  Two modes behind the range picker: **This week** — the no-server single-week
  snapshot (`weekReview`: N woven, M still on the loom, hottest skein), a
  purpose-built tile row rather than a one-bar slice of the history charts — and
  the **4w/8w/12w history**, aggregated purely by `tapestryStats` (model.js): a
  bar chart of threads woven by week (Recharts) plus a day-by-day heatmap
  ("**The days you've woven**" — renamed from "the cloth you've woven", with a
  one-line caption spelling out what the cells/dot mean), completion rate,
  hottest skein, busiest weekday, and "still unwoven from past weeks".
  Descriptive, **never scored or streaked** (Journal of Delights' ethos).
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
- **Rhythms (daily routines — multiple)** —
  [`lib/rhythm.js`](src/loom/lib/rhythm.js) +
  [`lib/model.js`](src/loom/lib/model.js) (`rhythmThreadsForWeek`, `splitRhythmThreads`,
  `rhythmTemplateGroups`, `currentOrFutureThreads`, `rhythmTemplateHeatRanks`,
  `rhythmHeatRankFor`).
  **Any number of skeins** may be flagged as rhythms (stored as a JSON array under
  `loom_rhythm_skeins`, zero Notion schema changes; legacy single-entry key migrated on
  first read). Each rhythm carries an optional `days` mask (`[0..6]`, 0 = Mon; `null` =
  every day). On a fresh warp a gentle banner offers to cast all rhythms at once —
  placing a copy of each thread on the allowed days, **duplicate-guarded**. Rhythm
  threads render at the **top of each day column** in a tinted block (`rhythmBlock` CSS),
  excluded from the distaff. Draft snapshots silently exclude **all** rhythm threads.
  The **Rhythm order** toolbar toggle groups the rhythm block by skein, in the
  same order the skeins sit in the Skeins view (drag-reordered there), then by
  each thread's own order within its skein — i.e. real cross-skein priority
  top-to-bottom, not alphabetical and not plain cast order (`filters.skeinOrder`
  drives the grouping; see WeekView's `view()`). A **Reset warp banners** button in the Guild re-surfaces accidentally
  dismissed rhythm/draft offers. Long-press a rhythm thread in the Warp → "Edit in
  rhythm" jumps back to Skeins with the skein flashed.

  - **A rhythm thread's heat is fixed per (skein, title), matching its rank in the
    Skeins view.** Turning "Deep work" red (hottest) in the Focus skein's own
    consolidated template list makes it red in The Warp too — on every day it's
    cast to, regardless of that day's own local thread order or how many other
    threads share the block. `rhythmTemplateHeatRanks(threads, rhythmSkeinNames,
    weekStartKey)` builds a `skein␀title → rank` map from the same consolidated
    order the Skeins view itself shows (via `rhythmTemplateGroups`, scoped through
    `currentOrFutureThreads`); `rhythmHeatRankFor` looks a thread's rank up from
    it. WeekView builds the map once per render and passes it to the rhythm
    block's `ThreadList` as `rhythmHeatRanks`; only the colour changes, never the
    array position used for reordering (nudge / drag caret keep the plain index).
    Non-rhythm threads are unaffected — they keep the single global per-day ramp.
  - **A daily rhythm thread has no day-mover.** The day-letter chip + move popover
    only make sense if there's somewhere else to move a thread *to* — a thread on
    a `days: null` (every day) rhythm is already on every day, so it's suppressed
    for those specifically. A partial-pattern rhythm (M–F, custom days) still gets
    the mover, since moving it off-pattern is a real action.
  - **The Skeins view shows one row per unique cast thread, not one row per cast
    day.** A rhythm skein cast across a week used to repeat "Deep work" once for
    every day it landed on — `rhythmTemplateGroups` consolidates same-titled
    instances (any skein, any day, regardless of done-state — a template
    deliberately doesn't distinguish "some instances are woven") into a single row
    carrying a **×N** count chip. The row has no done-toggle knot (there's no
    single done-state to show); renaming or deleting it (`actions.patchRhythmTemplate` /
    `removeRhythmTemplate` in App.jsx) acts on every instance sharing that title at
    once. Per-instance done-state stays exactly where it belongs — The Warp.
  - **The past seven days** —
    [`components/RhythmHistoryModal.jsx`](src/loom/components/RhythmHistoryModal.jsx) +
    `rhythmLast7Days` (model.js). A dedicated, read-only overlay (opened from a
    toolbar icon, shown only once a rhythm exists) listing every rhythm thread,
    grouped by rhythm skein, each as a HabitNow-style strip of the last 7 days
    (today inclusive, oldest first) — **not** the current calendar week and
    **not** a full calendar. Each day cell is woven (dyed solid), still open (a
    warning-tinted ring — the Tapestry's own "open"), not cast (a faint dashed
    ring — a rhythm day nothing was ever placed on), or off-pattern (quiet, no
    number — outside the rhythm's day mask). No percentages, no streak counts,
    no calendar view — descriptive dots only, consistent with the Tapestry's
    ethos.
  - **The ×N count is scoped to this week onward, not an all-time total.**
    `currentOrFutureThreads` filters out instances dated before the current
    week's Monday before the templates are grouped, so an abandoned cast from
    weeks ago doesn't pad the count forever — a thread that's genuinely stale
    debt is the Re-warp ritual's problem, not a reason for this number to keep
    climbing. A cast thread on a *future* week still counts (it's real, upcoming
    work), and day-less threads always count. A "Counts cover this week onward"
    hint under each rhythm skein's template list makes the scope visible instead
    of leaving ×N looking like a lifetime total.

  Design rationale: [`LOOM_RHYTHM_DESIGN.md`](LOOM_RHYTHM_DESIGN.md).

## Two voices (the terminology toggle)

Every SCUMM-flavoured word on screen is an **alias**.
[`lib/lexicon.js`](src/loom/lib/lexicon.js) holds two maps with identical keys —
the default **loom** voice (thread · skein · weave · the distaff · the warp · trace ·
the Guild) and a **plain** voice (task · project · complete · the backlog · the week ·
Search · Settings) — and [`lib/lexiconContext.jsx`](src/loom/lib/lexiconContext.jsx)
exposes `t(key)`. New keys added in this session: `warp`/`Warp`/`warpLabel` (week),
`searchPlaceholder` → "Trace…", `rhythmsBanner` (plural), `resetBanners` /
`resetBannersHint` (Settings reset), `rhythmSort` (toolbar label). Re-warp empty text
now reads: *"Nothing left hanging — the past threads are woven clean."* Nothing about
behaviour changes with the voice; it's pure wording, chosen in Settings → Vocabulary
and remembered in the `loom:lexicon` key (with a `storage`-event sync, same as the
theme). The base SCUMM flavour is the "vanilla"
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

### Notion schema (documented once, in the guide)

Five properties, names exact. This used to be duplicated in Settings too (a
`<details>` block); removed — the guide is the one place that documents it now,
linked from Settings' intro paragraph.

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

Every "selected/on" pill (a rhythm badge, a day-preset/day chip, a filter icon,
a Tapestry range tab…) fills solid with `--color-on-accent` text over `--color-accent` — on
Parchment that pairing only clears ~4.8:1 contrast, noticeably weaker than
Twilight's ~7:1 for the same pattern. Rather than darken `--color-accent`
itself (used everywhere — links, icons, borders — where it already reads
fine), a dedicated `--color-accent-strong` / `--color-accent-strong-hover` pair
exists purely for solid on-accent fills; Twilight's just aliases the ordinary
accent (no change), Parchment's is a deeper ochre (`#6b4a10`, ~7.2:1). Every
solid-fill "on" state in the app uses it now, including the DS primary Button
in Settings (scoped via an inline CSS-custom-property override, no DS change).

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

