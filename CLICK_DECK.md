# Click Deck

**[coneofcold.vercel.app/click-deck-react.html](https://coneofcold.vercel.app/click-deck-react.html)**

Click Deck is a standalone web application designed for cataloguing and tracking graphic narrative and point-and-click adventure games from the 90s to the present.

## Architecture

- **Stack**: React, Vite, CSS Modules (for component scoping), and standard global CSS (for layout resets and theme).
- **Aesthetics**: A stark, industrial aesthetic heavily inspired by *Beneath a Steel Sky*. It utilizes `JetBrains Mono` terminal fonts, sharp edges with zero border radius, and a high-contrast palette of toxic cyan, warning amber, and deep greys.
- **Backend**: Live Notion Database Integration via a proxy layer.
- **Test Suite**: A comprehensive Vitest + React Testing Library component suite ensuring robustness across all core UI components. 

## Timeline Micro-Animations

The core view of Click Deck is a chronologically sorted Timeline. This timeline leans heavily into the retro-futuristic, cyberpunk aesthetic by utilizing an `IntersectionObserver` to trigger scroll-based micro-animations. 
- A persistent, glowing cyan "scan line" tracks up and down the vertical timeline track.
- As individual game nodes enter the viewport, they smoothly slide in from the side.
- Year markers and game cards ignite with a neon glow effect, creating a highly dynamic, "living" interface that reacts continuously to user scroll position.

## Notion Backend & Database Initialization

Click Deck diverges from simpler `localStorage` apps by requiring a real Notion backend to store your game entries.
- The app uses a **Bring Your Own (BYO)** token model.
- Users input their `Notion Integration Token` in the **Settings Modal**.
- The **"Initialize New Database Schema"** button hits the repository's serverless `/api/notion` proxy to dynamically create the full database schema under a target parent page.
- **Safety Checks**: The initialization process is guarded to prevent accidental duplications. If a database ID is already present, the user must explicitly confirm before creating a new schema, preventing them from overwriting their existing connection.

### Seed Data & Cover Art

- A **"Populate Seed Data"** button allows users to instantly fill their empty Notion database with a curated batch of canonical point-and-click classics.
- **Data Protection**: Before seeding, the app checks the current Notion database. If games are already present, it throws a strict warning to prevent duplicate data population, protecting the user's curated lists.
- **Cover Art System**: The Notion integration includes full support for high-resolution external image URLs mapped to the `cover` property of each Notion page. This populates the UI with rich game box art.
- **Interactive Ratings**: Users can click the stars directly on the Game Cards on the main timeline to immediately update their rating in the Notion database, minimizing friction.

### Factory Reset
- The "Factory Reset DB State" action is safeguarded behind a prompt requiring the user to type `RESET`, ensuring that destroying local state and API tokens is never accidental.

## PWA & Cabinet Integration

- Registered in `src/apps-registry.js` under the `react-vite` kind.
- Deployed as a full Progressive Web App (PWA) with a `.webmanifest` file.
- Correctly referenced in `cabinet.webmanifest` via `related_applications` to allow native installation checks across the Cone of Cold ecosystem.
- Fully responsive on mobile, including wrapping navigation bars and collapsing modal forms.
