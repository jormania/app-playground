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

## The two views are one dataset

There is a single array of threads (the app's source of truth). The two views are
just different groupings of it — toggling never moves data between silos:

- **Skeins** (List view) — threads grouped by skein (project/category). Each skein
  is its own ordered, heat-dyed stack. A skein-and-thread composer up top starts
  new work; each skein has its own inline adder.
- **The Week** (Weekly view) — the same threads warped across the seven days of the
  current week (Mon→Sun, with prev/next/"this week"), plus **the distaff** — a
  backlog rail of unspun (day-less) threads to pull onto a day.

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

Settings ("The Guild") is reachable from the header **⚙** gear and the verb bar;
it holds the Notion connection *and* the Appearance picker.

- **Type:** Cinzel for the ceremonial Guild lettering (the wordmark, section
  titles, the verbs); Alegreya for thread text (a literary, hand-woven feel);
  Inter for small UI/meta so numbers and inputs stay crisp.
- **The verb bar** ([`components/VerbBar.jsx`](src/loom/components/VerbBar.jsx))
  is a nod to the SCUMM verb interface — a "sentence line" of status above a row
  of chunky verbs (the view toggle, Woven, the Guild) pinned to the foot of the
  screen. It's functional chrome, so the tribute earns its place.
- **Language:** threads · skeins · the warp · the distaff · spin · weave · unravel
  · the Guild.

## Conventions checklist (all done)

- `kind: "react-vite"` + `manifest` in [`src/apps-registry.js`](src/apps-registry.js)
  (drives both `index.html`'s card grid and the Cabinet).
- `watchInstalled('loom-react.html')` in `main.jsx`; scoped SW registered PROD-only.
- `public/loom.webmanifest` + `public/loom-sw.js` + PWA icon set
  (`npm run gen:loom-icons` from `public/loom-icon.svg` / `loom-logo.svg`).
- `public/loom.webmanifest`'s absolute URL added to `related_applications` in
  `public/cabinet.webmanifest`.
- `loom-react.html` added to `vite.config.js`'s build inputs.
- Pure logic covered by `model.test.js`, `notion.test.js`, `notionClient.test.js`.
