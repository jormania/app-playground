# Click Deck

**[coneofcold.vercel.app/click-deck-react.html](https://coneofcold.vercel.app/click-deck-react.html)**

Click Deck is a standalone web application designed for cataloguing and tracking graphic narrative and point-and-click adventure games from the 90s to the present.

## Architecture

- **Stack**: React, Vite, CSS Modules (for component scoping), and standard global CSS (for layout resets and theme).
- **Aesthetics**: A stark, industrial aesthetic initially inspired by *Beneath a Steel Sky*. It utilizes `JetBrains Mono` terminal fonts, sharp edges with zero border radius, and a high-contrast palette.
- **Theme System**: The app supports dynamically toggling CSS variables to shift aesthetics:
  - **Union City**: Cyan/Amber (Classic Cyberpunk).
  - **Voodoo**: Toxic Green/Purple (Monkey Island inspired).
  - **Noir**: Grayscale/Gold (Grim Fandango inspired).
- **Backend**: Live Notion Database Integration (`3a3d3e6d-60db-81b2-a8d9-ca78e8100ef8`) via a proxy layer and MCP.
- **Test Suite**: A comprehensive Vitest + React Testing Library component suite ensuring robustness across all core UI components. 

## Core Views

Click Deck features two primary perspectives over your game collection, toggled via the main navigation:

### 1. Timeline View (Micro-Animations)
The chronologically sorted timeline is the core of the application. It leans heavily into a retro-futuristic, cyberpunk aesthetic by utilizing an `IntersectionObserver` to trigger scroll-based micro-animations.
- A persistent, glowing cyan "scan line" tracks up and down the vertical timeline track.
- As individual game nodes enter the viewport, they smoothly slide in from the side.
- Year markers and game cards ignite with a neon glow effect, creating a highly dynamic, "living" interface that reacts continuously to user scroll position.

### 2. Analytics View
A high-level dashboard providing insights into your collection.
- Features a **Dynamic Tag Word Cloud** that lets you visually filter your library by genre or theme (e.g., *SCUMM*, *Comedy*, *Sci-Fi*).
- Displays detailed breakdowns of your completion status and ratings.

## Game Editor

Click Deck includes a dedicated **Game Editor Modal** for manual collection management.
- Users can manually add unlisted games, edit existing ones, or completely delete/archive entries from their database.
- Includes fields for Title, Developer, Year, Status, Rating, Tags, and a custom Journal entry.
- Supports pasting external image URLs or automatically fetching high-resolution cover art from the Steam API.

## Notion Backend & Database Initialization

Click Deck diverges from simpler `localStorage` apps by requiring a real Notion backend to store your game entries.
- The app uses a **Bring Your Own (BYO)** token model.
- Users input their `Notion Integration Token` in the **Settings Modal**.
- The **"Initialize New Database Schema"** button hits the repository's serverless `/api/notion` proxy to dynamically create the full database schema under a target parent page.
- **Safety Checks**: The initialization process is guarded to prevent accidental duplications. If a database ID is already present, the user must explicitly confirm before creating a new schema, preventing them from overwriting their existing connection.

### Adding Data & Cover Art

- The app relies strictly on the Notion database for canonical data. Hardcoded seed data is no longer utilized; all entries should be added directly via the UI Editor or via the Notion MCP integration.
- **Cover Art System**: The Notion integration includes full support for high-resolution external image URLs mapped to the `cover` property of each Notion page. This populates the UI with rich game box art.
- **Interactive Ratings**: Users can click the stars directly on the Game Cards on the main timeline to immediately update their rating in the Notion database, minimizing friction.

### Factory Reset
- The "Factory Reset DB State" action is safeguarded behind a prompt requiring the user to type `RESET`, ensuring that destroying local state and API tokens is never accidental.

## PWA & Cabinet Integration

- Registered in `src/apps-registry.js` under the `react-vite` kind.
- Deployed as a full Progressive Web App (PWA) with a `.webmanifest` file.
- Correctly referenced in `cabinet.webmanifest` via `related_applications` to allow native installation checks across the Cone of Cold ecosystem.
- Fully responsive on mobile, including wrapping navigation bars and collapsing modal forms.

- A comprehensive standalone HTML guide (`public/click-deck-guide.html`) provides step-by-step instructions for integrating the Notion backend and initializing the database schema.
- The guide is linked directly from the Cone of Cold app catalog (`index.html`).
