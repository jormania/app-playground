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
   - Semantic Maxim Search: Keyword search bar to search quotes by content, author, source, or tag keywords.

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
