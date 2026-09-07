# Daily Stoic — wisdom and reflections

**[coneofcold.vercel.app/daily-stoic-react.html](https://coneofcold.vercel.app/daily-stoic-react.html)**

Daily Stoic is a daily companion app to read public domain quotes from Marcus Aurelius and Seneca, write daily reflections, and save them securely. It runs as a Progressive Web App (PWA) with offline capabilities.

Source: [`src/daily-stoic/`](src/daily-stoic/). Entry shell: `daily-stoic-react.html`. Built on `src/ds/` (tokens and barrel components). Built in **strict TypeScript** with full type coverage and unit testing.

---

## Final Feature Set

Daily Stoic combines daily stoic reflection habits, cognitive reframing, and long-term reminders:

1. **Daily Practice (M1/M2)**:
   - Dynamic Quote Rotation: Stepping through quotes mapped to the Day of Year (1-366).
   - Streak habit dashboard tracking consecutive reflection days (supporting leap-year wrap-around boundary).
   - Local morning reminders: Scheduled local push notifications scoped using PWA service worker and IndexedDB config sync.
   - Offline-first cache backing up data locally and syncing to the cloud.

2. **Re-framing (Amor Fati - M3)**:
   - Challenge acceptance inputs (*"What feels forced or heavy?"*).
   - Categorized tag tracking pills (`Situation`, `Outcome`, `People`, `Time`, `Limitation`).
   - CSS-rendered frequency chart illustrating reframed challenges over time.

3. **Long-Term Perspective (Memento Mori / Enchiridion - M4)**:
   - Memento Mori Life Grid: A visual calendar showing weeks lived vs remaining weeks based on a user-defined birthdate.
   - The Enchiridion (Handbook): A curated collection of favorited maxims for quick access during moments of stress.
   - **Semantic Keyword Search**: Keyword search bar to search quotes by content, author, source, or tag keywords.

4. **Self-Knowledge & Passion Tracking (Milestone 6)**:
   - Passions & Judgments multi-select tracking (Impatience, Anxiety, Ego, etc.).
   - Immersive Recurring Passions analytics dashboard identifying rolling window training grounds.
   - Recommended Stoic virtues and tailored practices mapped to the dominant passion.
   - Chronological analysis identifying the day of week and time of day where passions are most active.
   - Citadel empty state with interactive demo mode for previewing insights.

5. **Lite Practice (Settings toggle)**:
   - One screen instead of the four-step journey — **Memento Mori** as a lifetime bar (80 years / 4,160 weeks, with a question that rotates daily), the day's maxim with its favourite heart, **Amor Fati** reduced to one line and one optional challenge type, a single reflection box, and the mood row.
   - Amor Fati is untethered from the evening in Lite — it reads "What feels forced or heavy?" and can be filled at any hour.
   - Everything else (Premeditatio Malorum, Spheres of Choice, Passions, Seneca's three questions, the virtue picker, the mentor) is hidden, not deleted: Lite renders from the same state and saves through the same `handleSave`, so hidden fields round-trip untouched and a Lite save can never blank a day written in Full.
   - Lite days count toward the streak and the cycle exactly like Full days — the schema and every write are identical.
   - After saving, Lite surfaces one obstacle logged 30, 90 or 365 days ago (`utils/lite.ts`) — the retrospective idea from the Amor Fati dashboard, narrowed to a single card.
   - **Per-day escape hatch**: "Do the full practice today →" opens the four-step wizard for that day only (`daily-stoic:full-day-<day>`), without touching the setting; "← Back to Lite" reverses it.
   - **Settings narrows too**: the Socratic Mentor section (the app's only AI surface — `MentorPanel` is mounted in the stepper, Commitments and the Council, none of which Lite renders) is hidden, and Habit Reminders drops to an evening-only nudge. Settings writes `morningEnabled: false` and `lite: true` into the reminders IndexedDB state; [`daily-stoic-sw.js`](public/daily-stoic-sw.js) skips the morning notification on an explicit `false` and swaps the evening body to Lite's wording ("The day's maxim, one honest line, your mood.") when `lite` is set — both keys absent from an older state object keep the original behaviour, so already-installed workers are unaffected.
   - **Empty-by-construction panels step aside**: the cycle retrospective card drops *Concerns Resolved* and *Citadel Vigilance*, and Stats drops *Premeditatio Malorum* and *Promises Kept* — but only when the period or cycle genuinely holds none of that data, so history written in Full still reports it.
   - **Nav narrows with the practice**: Lite hides the dashboards it can't feed — Spheres of Choice, Passions & Judgments, Commitments and The Council (`LITE_HIDDEN_ROUTES`). A stale hash, bookmark or notification tap pointing at one redirects home. Memento Mori, the Enchiridion, Amor Fati, the Digest and Stats stay: Lite's own entries still feed them. Everything returns whole when Full comes back — including the day opened through the escape hatch, which restores the full nav for that day.

---

## Notion Database Schema

If configured, the app expects a database matching the following schema. Database verification runs automatically on app load and connection testing:

| Property Name | Notion Type | Description |
| --- | --- | --- |
| **Name** | `title` | Page title, e.g. "Day 42 Reflection" |
| **QuoteID** | `number` | The day of the year (1-366), used as the primary lookup key |
| **Reflection** | `rich_text` | The text content of the user's reflection |
| **Tags** | `multi_select` | Automatically populated with `['Stoic', 'Reflection']` |
| **Date** | `date` | Date the reflection was recorded (ISO `YYYY-MM-DD` string) |
| **AcceptanceTags** | `multi_select` | Categories of challenge reframed (*Amor Fati*) |
| **FateInput** | `rich_text` | Text describing what feels forced or heavy (*Amor Fati*) |
| **Favorite** | `checkbox` | Toggles whether the quote has been favorited (*Enchiridion*) |
| **Passions** | `multi_select` | Optional. Tracks recurring passions/judgments (*Self-Knowledge*) |
| **Mood** | `select` | Optional. Tracks the user's logged daily mood (Great, Good, Neutral, etc.) |
| **MorningIntentions** | `rich_text` | Optional. Tracks morning preparation intentions (*Premeditatio Malorum*) |
| **Dichotomy** | `rich_text` | Optional. JSON-encoded array of Spheres of Choice (worries) entries (*Step 3*) |
| **Virtue** | `rich_text` | Optional. The stoic virtue the user selects to cultivate that day (*Step 4*) |

### Notion Starter Template
To get started quickly, duplicate the official template:
🔗 **[Daily Stoic — Starter Template](https://www.notion.so/coneofcold/Daily-Stoic-Starter-Template-63a5df679efb4db8b8cb1a0283f5108b)** (Empty database with pre-configured headers matching the required schema).

---

## Project Structure & Architecture

```
src/daily-stoic/
├── components/
│   ├── AmorFatiControl.tsx   # Reframing interface
│   ├── FateGraph.tsx         # Challenge frequency bar chart
│   └── MementoMori.tsx       # 80-year life progress grid
├── data/
│   └── quotes.ts             # Maxims list tagged by category
├── services/
│   └── NotionService.ts      # Cloud-relay queries and connection checking
├── utils/
│   ├── date.ts               # UTC day calculation
│   └── streak.ts             # Leap-year safe streak math
├── App.tsx                   # Main app layout, tab router, states
├── Settings.tsx              # Settings config, PWA notification scheduler
├── App.module.css            # Stylesheet using design tokens
└── main.tsx                  # PWA entrypoint registration
```

---

## Changelog

### September 7, 2026 (The week, framed)
- **The Virtue Week Breakdown fits a phone.** It was 420px wide inside a ~300px strip, so "Avg Mood · 3 / 5" read as a bare "AVG · 3" and Favorites was off the edge entirely, with nothing to say it scrolled. The min-width is gone, Favorites steps aside below `sm` (Stats already carries an all-time tally), and the numbers stay on one line. Unclipped at 360px and 390px.
- **Rows say what they are**: `Week 1 · Wisdom`, not a bare "Wisdom" that reads like the evening virtue picker. The subtitle now states outright that these are the cycle's week themes, not the virtue you choose — the table never touches that field.
- **The average mood is a face, not a fraction.** The Avg mood column now shows the same five Lucide faces as the mood row and the MoodGraph (`Math.round` picks the nearest; the exact figure stays in the `title`/`aria-label`, so nothing is lost). The vocabulary itself is promoted to [`data/moods.ts`](src/daily-stoic/data/moods.ts) — value, score and icon in one place, read by the mood row, `MoodGraph`, `MOOD_SCORES` in `utils/stats.ts` and the breakdown, so the three copies that used to drift can't.
- **Lite anchors the week** ([`Journal.tsx`](src/daily-stoic/Journal.tsx)): under the day's maxim, three lines — the week's virtue, its framing title from [`data/curriculum.ts`](src/daily-stoic/data/curriculum.ts), and the Quote of the Week. Full spends a whole `PathCard` plus a second quote block on this; Lite gives it a thin accent rule and no card, so the week has an anchor rather than only a name in the header.

### September 7, 2026 (A favourite is not an entry)
- **One definition of a logged day**, in [`utils/logged.ts`](src/daily-stoic/utils/logged.ts): a day counts when it holds something written or chosen — reflection, Amor Fati obstacle or challenge type, mood, morning intentions, passions, virtue. `favorite` is deliberately absent.
- **Why it mattered**: every write path creates the same Notion page, so favouriting the day's maxim created a record — and the streak, Stats' *Days Journaled*, the virtue-week consistency rate, the cycle heatmap, the cycle retrospective, the digest's week counts and the evening nudge all treated "a record exists" as "the day was practised". Tapping a heart marked the day journaled and silenced that evening's reminder.
- Every one of those now reads the same predicate, so they can't disagree about what today was. The **records themselves are untouched** — favourite-only pages are still fetched and still build the Enchiridion, and the cycle heatmap shows such a day as favourited rather than logged.
- The week dots in Lite already used this rule; it has simply been promoted out of `utils/lite.ts` (which re-exports it) to where everything else can read it.

### September 6, 2026 (Lite, made daily)
Six changes aimed at one thing: making the practice easy to keep. No new features, no charts, no commentary on consistency.
- **A mood tap saves the day.** In Lite, tapping a mood commits immediately, so an evening with nothing to write still counts. `handleSave` takes an `overrides` argument because React state hasn't committed inside the click handler — without it the save writes the previous mood.
- **The week as seven dots**, in the Lite header ([`weekDots`](src/daily-stoic/utils/lite.ts)). Deliberately not a streak counter: a filled week invites you to fill the next day, where a broken 40-day streak invites you to stop. Today's dot fills from the editor's own state, so it lands on save rather than after the next fetch.
- **Yesterday, in one line** ([`previousEntry`](src/daily-stoic/utils/lite.ts)) — the thread that makes a journal feel continuous. Looks back up to a week over a gap, prefers the reflection, falls back to the obstacle, and skips the `###` headers a day written in Full carries. It sits **on the same row as the dots, as a ticker**: one line of whatever length in the space the dots leave, with a fade at the right edge (and a spacer after the text, so the fade lands on nothing once the line has run out and the last characters never read dimmed — trailing padding wouldn't do, browsers leave it out of `scrollWidth`). It **drifts on its own** — out to the end, hold, and back — because swiping a ~160px strip on a phone is fiddly; touch or hover pauses it, the strip stays swipeable, and `prefers-reduced-motion` turns the drift off and leaves only the swipe. The distance is measured in `Journal.tsx` (the line's own overflow) and fed to the CSS as `--ticker-shift`, with the duration scaled to hold ~40px/s; `min-w-0` is what lets the strip shrink inside the flex row instead of widening the page, which never scrolls horizontally.
- **Amor Fati folds away** into a single "Something heavy today?" line until tapped — it's optional, and open it was the tallest card on the screen. A day that already carries an obstacle opens it unprompted.
- **"Give me a question"** under the blank box drops in one prompt from [`REFLECTION_PROMPTS`](src/daily-stoic/utils/lite.ts) (deterministic per day; tapping again offers another). A blank rectangle at the end of a long day is where journalling goes to die.
- **Lite's header is five controls, not eight**: today's page, the Enchiridion, the overflow menu, the Pause drill and Settings. Memento Mori's full grid and the Field Guide move into the menu. At 360px the Lite header now fits with nothing past the right edge (Full still overflows there — untouched).

### September 6, 2026 (Theme: system / light / dark)
- **One light palette and one dark, chosen the way Marquee does it.** The eight-preset cycler (four light, four dark, advanced by a "Cycle Palette" button) is gone; Settings → Appearance is now a three-way `SegmentedControl` — **System · Light · Dark** — defaulting to **System**.
- **System means system.** It stores no palette and clears `data-theme` entirely, so [`tokens.css`](src/daily-stoic/styles/tokens.css)'s own `prefers-color-scheme` block takes over and the app keeps following the device when it flips at sunset. An explicit choice stamps `data-theme="light"` / `"dark"`. The `<meta name="theme-color">` tint can't come from CSS, so [`lib/theme.ts`](src/daily-stoic/lib/theme.ts) sets it and a `matchMedia` listener keeps it honest while on System.
- **Tokens cut to Deep Indigo light + dark**, the dark block written twice (media query for System, attribute for an explicit choice) — the same shape as `marquee.css`. Six palettes, the cycle order and the swatch metadata are deleted.
- **Retired ids migrate rather than reset**: a stored `octagon`/`ristretto`/`spectrum`/`indigo-dark` resolves to Dark, the four light ones to Light — in the app, in the pre-paint script, and in the Field Guide, which shares the same `daily-stoic:theme` key.
- `lib/theme.ts` drops `PRESETS`/`nextPreset`/`presetById`/`modeOf` for `ThemePref`, `resolveTheme`, `applyTheme`, `syncThemeColor`; `useTheme()` now returns `{ theme, resolved, setTheme }`.

### September 6, 2026 (Lite Practice)

The four-step journey asks for eleven inputs across two sittings, half of them in the morning. **Lite** is the same practice at a weight that gets done: one screen, any hour. It is a presentation layer over the existing journal — same state, same save path, same Notion schema — so nothing is migrated, nothing is lost, and switching back restores everything at once.

**The daily screen** ([`Journal.tsx`](src/daily-stoic/Journal.tsx), the `isLite` branch)
- **Settings → Lite Practice** (`daily-stoic:mode`, default `full`) replaces the stepper with a single page. Existing users see no change until they flip it.
- **Memento Mori (Lite)**: [`MementoMoriBar`](src/daily-stoic/components/MementoMoriBar.tsx) — the whole 80-year lifespan (4,160 weeks) as one bar with weeks lived, and a question that rotates daily. Week arithmetic and the question list live in [`utils/lifetime.ts`](src/daily-stoic/utils/lifetime.ts); the full grid agrees with it by construction.
- **The day's maxim**, read-only, with its favourite heart.
- **Amor Fati (Lite)**: `AmorFatiControl` gained a `lite` prop — present-tense prompt ("What feels forced or heavy?"), single-select challenge type, teaching hints suppressed. Untethered from the evening by design. Same `FateInput` / `AcceptanceTags` properties, so Full reads it back unchanged.
- **One reflection box and the mood row.** Nothing but opening the app is mandatory; Lite days count toward the streak and the cycle exactly like Full days.
- **Lite retrospective**: after saving, [`pickLiteRetrospective`](src/daily-stoic/utils/lite.ts) surfaces the nearest of the 30/90/365-day obstacles — the Amor Fati dashboard's idea, narrowed to one card, and hidden while there are unsaved edits so it never interrupts the writing.
- **Per-day escape hatch**: "Do the full practice today →" opens the wizard for that day alone (`daily-stoic:full-day-<day>`); "← Back to Lite" reverses it. Day-scoped, so it lapses on its own.

**Data safety — the part that needed care**
- Lite renders from the same component state and saves through the same `handleSave`, so intentions, worries, passions and virtue on a day written in Full round-trip untouched through a Lite save. Covered by [`JournalLite.test.tsx`](src/daily-stoic/JournalLite.test.tsx).
- The Seneca question-combining effect derives `reflection` from three question states that are always empty in Lite; left running it would blank the free-text box on every keystroke. It is skipped there.

**The app narrows with the practice**
- `useLiteActive(dayOfYear)` ([`lib/useJournalMode.ts`](src/daily-stoic/lib/useJournalMode.ts)) combines the setting with the per-day override and re-reads on `daily-stoic:settings-updated`, which the escape hatch dispatches — the nav and the journal read the same hook and can't disagree about the mode on screen.
- **Nav**: `LITE_HIDDEN_ROUTES` — Spheres of Choice, Passions & Judgments, Commitments, The Council — leave `dashboardOptions`, and a stale hash, bookmark or notification tap pointing at one redirects home. Memento Mori, the Enchiridion, Amor Fati, the Digest and Stats stay: Lite's own entries still feed them.
- **Settings**: the Socratic Mentor section, its key field and toggle are hidden — `MentorPanel` is mounted only in the stepper, Commitments and the Council, so no AI surface is reachable in Lite at all.
- **Reminders**: Habit Reminders drops to a single evening nudge. Settings writes `morningEnabled: false` and `lite: true` into the reminders IndexedDB state; [`daily-stoic-sw.js`](public/daily-stoic-sw.js) skips the morning notification on an explicit `false` and swaps the evening body to Lite's wording ("The day's maxim, one honest line, your mood."). Both keys are absent from an older state object, which keeps the original behaviour — already-installed workers are unaffected. `syncIdb` takes the mode explicitly, since during the toggle's own handler the hook still reports the old one.
- **Empty-by-construction panels step aside**: `CycleRetrospectiveCard` drops *Concerns Resolved* and *Citadel Vigilance* (celebration, Digest and the shared PNG alike), and `Stats` drops *Premeditatio Malorum* and *Promises Kept* — each only when the cycle or period genuinely holds none of that data, so history written in Full still reports its real numbers.
- The [Field Guide](public/daily-stoic-guide.html) documents Lite in Section II.
- **Start Over clears the escape-hatch flags too**: `resetCycleData` now removes `daily-stoic:full-day-*` along with the other per-day keys. Day numbering restarts at 1 after a reset, so a leftover flag would have silently opened a fresh day in the full journal.

### July 11, 2026 (Milestone 1)
- **Notion Sync Integration**: Implemented [`NotionService.ts`](src/daily-stoic/services/NotionService.ts) and connected `/api/notion` relay. Created Settings panel for secure local credentials management.
- **Reactive Journaling**: Refactored the journal to fetch from Notion (showing loading states) or fallback to local storage. 

### July 11, 2026 (Milestone 2)
- **Habit Streak & Dashboard**: Implemented `StreakCounter` in design system and mapped streak calculation utility (handling year wrap-around). Displays active streak counts prominently on the main screen.
- **Morning Reminders Push**: Implemented IndexedDB state sync in Settings, and periodic sync notification checks inside service worker [`daily-stoic-sw.js`](public/daily-stoic-sw.js). Added a 7-tap diagnostics easter egg.
- **JSON Data Export**: Added "Download Data" button in Journal to compile and download all user entry records.

### July 11, 2026 (Milestone 3)
- **Amor Fati practice layer**: Updated the active Notion database schema via PATCH to add `AcceptanceTags` and `FateInput` properties.
- **Amor Fati UI & Visualization**: Created `AmorFatiControl` component to frame challenges and assign tags, and `FateGraph` component to render CSS frequency charts.
- **Philosophy View Toggle**: Configured toggle on the main screen to filter quote rotation to display only maxims tagged with Fate, Acceptance, or Resistance.
- **Design System Showcase**: Showcase custom Amor Fati components in `Showcase.tsx` and validated them in `/ds-showcase.html`.

### July 11, 2026 (Milestone 4)
- **Memento Mori Dashboard**: Built `MementoMori` component displaying a visual life calendar of 4160 weeks. Configured "Birth Date" state in Settings to compute percentage lived.
- **The Enchiridion (Handbook)**: Added favorite heart toggle on quote viewer. Implemented the Enchiridion handbook tab showing favorited maxims with local cache memoization to prevent duplicate fetching.
- **Semantic Keyword Search**: Created text search bar filtering maxims by key themes (Anxiety, Gratitude, Seneca, etc.).
- **Design System Showcase**: Showcase Memento Mori life block states, heart toggles, and collections in `Showcase.tsx`.

### July 12, 2026 (Milestone 5 - Unified Journey Arc)
- **Unified Daily Journey Stepper**: Reorganized the daily journaling tab (`/`) into an interactive 4-step stepper (`Focus` ➔ `Meditate` ➔ `Prepare` ➔ `Reflect`) coordinating all modules sequentially.
- **Cross-linked Modules**:
  - **Memento Mori**: Step 1 renders a mini life grid of the current year (52 weeks) using the user's birthdate.
  - **Daily Quote & Enchiridion**: Step 2 includes the quote reader and an **Enchiridion Recall** button to draw random favorited maxims.
  - **Spheres of Control (Dichotomy)**: Step 3 embeds the worries list inline, allowing users to categorize anxieties as *Up to Me* or *Not Up to Me*.
  - **Amor Fati & Actionable Concerns**: Step 4 prompts users to reframe today's *Not Up to Me* concerns under Amor Fati, and to resolve active *Up to Me* concerns.

### July 12, 2026 (Milestone 6 - Recurring Passions)
- **Notion Schema Upgrade**: Connected to Notion via the API and successfully updated the database schema, adding the optional `Passions` (`multi_select`) property.
- **Passions & Judgments Tracker**: Embedded card-based multi-select passions tracker inside Step 4 (Reflect) of the Daily Journey.
- **Immersive Analytics Dashboard**: Added `/passions` route and tab, exposing percentage breakdowns, dominant training ground virtues/exercises, and timestamped temporal pattern highlights (e.g. Monday mornings).
- **Citadel Empty State & Demo Mode**: Created a premium empty state with a toggle to load spec mockup demo values.

### July 12, 2026 (Milestone 7 - Advanced Dashboards & Mobile Collapse)
- **Spheres of Choice Dashboard**: Refactored the Dichotomy page into a full learning dashboard. Added `30d`, `90d`, `365d`, and `All` filter ranges, control ratio charts, action resolution rates, and custom CSS-rendered Word Clouds for Up to Me (Internals) and Not Up to Me (Externals) keywords.
- **Amor Fati Retrospective**: Created the new `Amor Fati` page exposing challenge tags distribution charts and a rolling timeline of past obstacles (e.g. 30, 90, 365 days ago) with interactive retrospective rating controls and textareas. Added a high-fidelity Demo Mode to preview simulated obstacles.
- **Responsive Mobile Navigation**: Restructured the header menu to collapse the four dashboards (Spheres of Choice, Recurring Passions, Amor Fati, and Stats Screen) under a single floating dropdown menu on mobile viewports, preventing tab wrapping.
- **Memento Mori Reflections & Age Progress**: Updated the 80-year grid header to highlight total weeks lived and prompt user with active Stoic questions (*"If this week were worth remembering, what would make it so?"*). Refactored current year grid to calculate the upcoming birthday age dynamically (e.g. `to 50`) and eliminate lifetime leap-year drift.
- **Visual Design & UX Enhancements**:
  - **Inline Header Logo**: Integrated a clean Greek column SVG logo to the left of the "Daily Stoic" title, adapting to light/dark themes.
  - **Spheres of Choice Evening review**: Combined "Resolve Actionable Concerns" (green header text) and "Reframe today's Externals" sections under a single premium card titled **Spheres of Choice** (with Scale icon).
  - **Multi-External Reframe compilation**: Enabled selecting multiple external worries in Reflect, dynamically building a grammatically correct sentence (using "and", commas, and custom pluralization) for the Amor Fati input, highlighting selected buttons.
  - **Differentiated Navigation Footer**: Redesigned Back, Next, and Save buttons, placing Back (left) and Next (right) on the same line, and the Complete/Save reflection button on a standalone row below with distinctive high-contrast styling.
  - **Tappable Touch Checklist Rows**: Configured checklist rows to be fully clickable, resolving mobile dismiss bugs and ensuring undo actions are 100% accessible on mobile touchscreens.

### July 12, 2026 (Milestone 8 - 365-Day Cycle Reset & Stats Upgrades)
- **365-Day Cycle Reset**: Mapped active day and quotes tracking to a 365-day cycle based on `cycleStartDate` (defaulting to January 1st of the current year). Added a **Destructive Actions** warning panel in Settings to let users reset the cycle, which clears local journal records, archives all synced pages in Notion (keeping connection settings), sets the cycle start date to today, and triggers haptic feedback.
- **Cycle-Aware Stats Consistency**: Refactored the 365-day consistency grid to track days relative to the active cycle start date and highlighted the current cycle day block with a pulsing ring overlay.
- **Aligned Stats Filters & Total Percentages**: Upgraded the Stats insights period filter to match the Passions dashboard (`30d`, `90d`, `365d`, `All`), filtered reflection inputs accordingly, and displayed percentages of totals for each tag and mood entry.
- **Unified Mood & Acceptance Tag Icons**: Ported the Reflect mood icons (`SmilePlus`, `Smile`, `Meh`, `Frown`, `Angry`) to `MoodGraph` and mapped custom Lucide icons (`Globe`, `Award`, `Users`, `Clock`, `Lock`) to each Amor Fati acceptance tag in `AmorFatiControl` and `FateGraph` for complete visual coherence.

### July 12, 2026 (Milestone 9 - Spheres of Choice Notion Sync, Card Styling & Settings Fixes)
- **Notion Database Worries Sync**: Implemented worries JSON serialization in the `Dichotomy` rich_text property in Notion. Synchronized worries from recent reflections on load to establish Notion as the single source of truth.
- **Single Save Button & Stepper Optimization**: Removed the morning prep save button and download data button. Integrated the "Complete Reflection" save button directly into Step 4's (Reflect) navigation row (replacing Next), and added worries tracking to the "unsaved changes" warning detection.
- **Settings Concept Guide Toggle Fix**: Resolved the property binding bug in Settings, changing `onChange` to `onCheckedChange` to allow toggling concept guides and nudge notifications on and off successfully.
- **Card Separations & Drop Shadows**: Elevated card borders to `border-secondary` and shadow strength to `shadow-md` (with `hover:shadow-lg`) for all step cards. Positioned the top header as sticky-top for scrolling visibility.
- **Visual & Terminology Alignment**: Renamed "Acceptance Tags" to "Challenge Types" in both the Amor Fati wizard and the stats screen. Styled Step 4's "Resolve Actionable Concerns" worries checklist as clickable pill tags matching the externals reframe. Added a close button (✕) to the Spheres of Choice (Dichotomy) dashboard.

### July 13, 2026 (Bugfix - Blank Page on Load)
- **Circular Import TDZ Fix**: Resolved a blank-page crash (`ReferenceError: Cannot access 'M' before initialization`) caused by a circular module dependency. `PassionsAnalytics.tsx` imported `AVAILABLE_PASSIONS` directly from `Journal.tsx`, which itself imports `PassionsAnalytics` transitively via `App.tsx`, creating a circular graph that caused Rollup to produce a temporal dead zone violation at runtime. Fixed by extracting `AVAILABLE_PASSIONS` into a new shared constants file [`src/daily-stoic/data/passions.ts`](src/daily-stoic/data/passions.ts). Both `Journal.tsx` (re-export for backward compat) and `PassionsAnalytics.tsx` now import from this leaf module, breaking the cycle entirely.

### July 13, 2026 (Bugfix - Settings Page Runtime Crash & Type-safety Cleanup)
- **Settings Blank Page Fix**: Resolved a runtime crash (`ReferenceError: cn is not defined`) when loading the Settings component. Fixed by importing `cn` from `./lib/cn` in [`Settings.tsx`](src/daily-stoic/Settings.tsx).
- **TypeScript Integration**: Added `src/daily-stoic` to [`tsconfig.json`](tsconfig.json) so the app is now actively typechecked during compilation.
- **Type-safety and Cleanup**: Fixed various compilation issues including incorrect Button variant `outline` usages, incorrect `triggerHaptic` signatures, and cleaned up several unused imports and variables across [`App.tsx`](src/daily-stoic/App.tsx), [`Journal.tsx`](src/daily-stoic/Journal.tsx), [`Settings.tsx`](src/daily-stoic/Settings.tsx), [`AmorFatiDashboard.tsx`](src/daily-stoic/components/AmorFatiDashboard.tsx), [`DichotomyOfControl.tsx`](src/daily-stoic/components/DichotomyOfControl.tsx), [`PassionsAnalytics.tsx`](src/daily-stoic/components/PassionsAnalytics.tsx), and [`NotionService.test.ts`](src/daily-stoic/services/NotionService.test.ts).
- **Option Styling Harmonization**: Redesigned the "Cultivating Virtue" selector in [`Journal.tsx`](src/daily-stoic/Journal.tsx) and the "Challenge Types" selector in [`AmorFatiControl.tsx`](src/daily-stoic/components/AmorFatiControl.tsx) to strictly adhere to the Spheres of Choice design standard (outlined pill buttons with circular `○` / `✓` selectors). Implemented local storage state caching and unsaved-changes tracking for `selectedVirtue`.
- **Reflect Layout Reorganization & Descriptive Guides**: Promoted `AmorFatiControl` to a standalone card (removing the collapsed red layout/title styling and bringing it to the same visual hierarchy as other cards) and added light description guide paragraphs under the `Spheres of Choice (Dichotomy)` and `Cultivating Virtue` cards in step 4 to match the Premeditatio Malorum standard.
- **Icon Harmonization**: Standardized wizard headers and sections to use matching Lucide icons corresponding with the main navigation and dashboards (changed the raw fire emoji to `<Flame />` in `Journal.tsx` and changed leaf emoji to `<Heart />` in `AmorFatiControl.tsx`).
- **Seneca Questions Redesign & Copy Updates**: Replaced Seneca's scale emoji icon with Lucide `HelpCircle`, added a descriptive introduction, and styled the inputs inside a themed caution (amber) sub-card with `focus-visible:border-caution` borders. Applied the requested balanced, middle-ground copy rewrites for Premeditatio Malorum, Spheres of Choice, and Seneca's Evening Interrogation, while ensuring full backward-compatible Markdown regex parsing for existing entries.
- **Wizard Icon Standardization**: Replaced Step 3's `🛡️` with Lucide `Shield` and Step 4's `🎭` with Lucide `Smile` for complete visual coherence across all steps.
- **Default Wizard Screen & Fresh Checkmarks**: Configured the wizard to always initialize on the **Focus** screen (Step 1) on load and day change. Refactored the completion checkmarks for Step 1 (Focus) and Step 2 (Meditate) to start fresh (unchecked) each day and get completed only when visited and navigated away from, while clearing their cache keys during a cycle reset.
- **Amor Fati Retrospective Timeline Redesign**: Redesigned the "Trivialized Obstacles" section to be a clean, static, read-only review interface. Replaced interactive textareas and buttons with styled perspective badges, lessons learned quote blocks, and peaceful self-reflection prompts.
- **Enchiridion Redesign**: Restyled "The Enchiridion (Handbook)" screen in the premium aesthetic of Memento Mori. Added a centered header block, an accent stats card, a 2-column responsive grid layout for the principles, and clean heart icon actions for removing entries.
- **Custom Toast Notification System**: Replaced all native browser `alert()` popups with a beautiful, custom, lightweight Toast notification system that matches the active theme and fades out automatically.
- **Auto-Expanding Textareas & Draft Autosave**: Replaced all fixed-height textareas in the journal wizard with auto-sizing textareas that expand vertically as you type. Integrated a local debounced autosave mechanism that backs up drafts to `localStorage` on every keystroke, complete with a subtle "Draft saved" status indicator in the textarea's corner.
- **Keyboard Navigation Shortcuts**: Added support for `Cmd/Ctrl + Enter` inside all journal textareas to seamlessly advance to the next step or submit/save the daily reflection without using the mouse.
- **Smooth Step Transitions**: Refactored the daily stepper wizard in [`Journal.tsx`](src/daily-stoic/Journal.tsx) to mount all steps and slide/fade them smoothly using `transition-all duration-300` CSS classes, eliminating layout jumps.
- **Subtle Mobile Haptics**: Added haptic vibration triggers on mobile device interactions when cycling theme palettes, favoriting quotes, toggling onboarding steps, and updating Amor Fati tag selections.

### July 13, 2026 (Bugfix — Spheres of Choice Notion Persistence)
- **Root Cause Fixed — Silent Data Loss**: Worries (Spheres of Choice entries) were being silently discarded on every save because `upsertReflection` had write guards (`if (hasDichotomyProperty && dichotomy)` and `if (hasPassionsProperty)`) that conditionally omitted the `Dichotomy` and `Passions` fields from the Notion API payload. When the flag was `false` (e.g., schema not yet detected), all data was dropped without any error. Both fields are now written unconditionally — the same pattern already used for `MorningIntentions`. Removed `hasPassionsProperty` and `hasDichotomyProperty` parameters from `upsertReflection` entirely.
- **Auto Schema Upgrade**: `loadReflectionsAndCheckStreak` now auto-detects when optional columns (`Passions`, `Dichotomy`, `Mood`, `MorningIntentions`) are missing from the Notion database and silently runs `upgradeDatabaseSchema` to create them. This ensures the first save after initial Notion setup never fails due to missing columns.
- **Favorite Toggle Data Preservation**: Fixed `handleToggleFavorite` in App.tsx which was calling `upsertReflection` without passing `mood`, `morningIntentions`, `passions`, or `dichotomy` — causing those fields to be overwritten with empty values on every favorite toggle. Now correctly passes all existing field values from the matching `ReflectionRecord`.
- **Worries Stats from Notion**: `cycleWorriesStats` (used in Stats and Year-End Celebration card) now reads from `recentReflections` (Notion source of truth) when Notion is configured, instead of reading from `localStorage` which never had Notion data.
- **Analytics Dashboard Notion Data**: `DichotomyOfControl` analytics component now accepts a `worries` prop from App.tsx (derived from Notion `recentReflections`). When Notion is configured the analytics always reflects cloud data; offline mode continues to read from `localStorage`.
- **Dead Code Removal**: Removed unused `focusedField` / `setFocusedField` state and its associated `useEffect` from `Journal.tsx` (the setter was never called).

### July 13, 2026 (Full Notion Read/Write Audit)
- **Virtue field added to Notion**: `selectedVirtue` (the stoic virtue selected in Step 4) was only ever saved to `localStorage`. Added a new `Virtue` (`rich_text`) column to the Notion schema — written unconditionally in `upsertReflection`, read back by both `fetchReflectionForDay` and `fetchRecentReflections`, and auto-created by `upgradeDatabaseSchema`. Journal.tsx now loads virtue from `result.virtue` on Notion load and passes it to save.
- **Favorite flag no longer overwritten on save**: `handleSave` in Journal.tsx was hardcoding `favorite = false` in the `upsertReflection` call, causing every journal save to reset the Notion `Favorite` checkbox. Now correctly passes `isCurrentQuoteFavorited` to preserve the user's favorited state.
- **Favorite toggle now does a real PATCH**: `handleToggleFavorite` in App.tsx was passing `record?.date` (a date string like `"2024-01-15"`) as `existingPageId`, causing the Notion API to 404 on every toggle and silently fall back to creating a NEW duplicate record. Fixed to pass `record?.id` (the real Notion page UUID) now that `ReflectionRecord` includes the `id` field.
- **`ReflectionRecord` now carries page `id` and `virtue`**: `fetchRecentReflections` now includes `id: page.id` and `virtue` in every record it pushes to state. This enables proper PATCH operations for all subsequent writes to existing records.
- **`virtue` preserved in `handleToggleFavorite`**: App.tsx toggle call now passes `record?.virtue` to avoid clobbering the Virtue field when toggling favorites.
- **Notion `rich_text` 2000-char chunking**: Notion enforces a 2000-character limit per rich_text block. The Dichotomy field (JSON-encoded worries) now splits its content across multiple blocks when it exceeds 2000 chars, preventing silent truncation for users with large worry lists.

### July 13, 2026 (UI Polish & Reframe Persistence Fix)
- **Removed "View Full 80-Year Life Grid →" button**: Cleaned up the Memento Mori step by removing the navigation shortcut button that linked to the full grid, simplifying the card layout.
- **Simplified "Current Year progress" label**: Removed the `(to {age})` age annotation from the mini life grid heading — the label now reads simply "Current Year progress".
- **Removed "Recall your Handbook" Enchiridion widget**: Removed the entire *Recall your Handbook / Draw Maxim* UI block from Step 2 (Meditate), including both the prompt state and the empty-state card with the random draw button.
- **Fixed Record button horizontal scroll on mobile**: Added `min-w-0` to the worry input form container and `shrink-0` to the Record button, preventing the button from expanding and causing horizontal overflow on narrow screens.
- **Fixed Reframe Externals persistence bug**: Selections made in "Reframe today's Externals" (the `☁ Not Up to Me` worry items toggled for Amor Fati) were reset on every page reload. Fixed by adding an `isReframed?: boolean` field to the `Worry` interface and toggling it directly on the worry object (instead of a separate ephemeral `selectedReframeIds` array). Because the Dichotomy JSON already round-trips through Notion, the `isReframed` flag is now saved and restored correctly. On load, `selectedReframeIds` is re-derived from `worries.filter(w => w.isReframed)`.
- **Challenge Type hint on selection**: Added `TAG_HINTS` map to `AmorFatiControl.tsx` with a one-line description for each of the 5 challenge categories. When one or more tags are selected, their descriptions appear below the tag row as an italic left-bordered hint, matching the style of the virtue hints in the Cultivating Virtue card.
