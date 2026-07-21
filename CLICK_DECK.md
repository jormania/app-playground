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
- **Automated Pricing & Discounts**: Features a Vercel-hosted cron job (`api/clickdeck-pricing.js`) that nightly syncs real-time Steam Store prices and active discount states for all games in the collection using the Steam App ID.
- **Test Suite**: A comprehensive Vitest + React Testing Library component suite ensuring robustness across all core UI components. 

## Scripts & Automation

Located in the `scripts/` directory, these Python utilities interact directly with the Notion backend to automate and verify collection data:

- **`verify-steam-names.py`**: A diagnostic script that verifies your Notion games against the Steam API using their `Steam App ID`. It intelligently cross-references the Notion `Developer` field against both Steam Developers and Publishers (including studio aliases like LucasArts/Lucasfilm) and normalizes titles to prevent false-positive mismatches.
- **`dramatize-journal.py`**: An automated formatting script that pulls plain-text `Journal/Notes` from the Notion database and injects expressive rich-text formatting. It uses a predefined dictionary of thematic keywords (e.g., coloring "horror" red, "cyberpunk" purple) and safely skips entries that have already been manually styled.

## Core Views

Click Deck features two primary perspectives over your game collection, toggled via the main navigation:

### 1. Timeline View (Micro-Animations)
The chronologically sorted timeline is the core of the application. It leans heavily into a retro-futuristic, cyberpunk aesthetic by utilizing an `IntersectionObserver` to trigger scroll-based micro-animations.
- A persistent, glowing cyan "scan line" tracks up and down the vertical timeline track.
- As individual game nodes enter the viewport, they smoothly slide in from the side.
- Year markers and game cards ignite with a neon glow effect, creating a highly dynamic, "living" interface that reacts continuously to user scroll position.

### 2. Analytics View
A high-level dashboard providing advanced multi-dimensional filtering over your collection.
- **Advanced Querying**: Clickable toggle rows for `PRICE`, `RATING`, and `ERA` that layer perfectly with global `Status` and `Search` parameters.
- Features a **Dynamic Tag Word Cloud** (`TAG_MATRIX`) and a **Developer Word Cloud** (`STUDIO_MATRIX`) that let you visually drill down by genre or studio.
- Displays a responsive Gallery Grid featuring game metadata (Release Year, Price, Rating, and Status) that dynamically updates based on the active query.
- Supports exporting the currently filtered dataset to a clean HTML report.

### 3. Stats Screen
A pure data-crunching dashboard designed specifically for adventure game collectors, denoted by the `[S]` icon.
- Calculates your exact collection completion rate, mean average rating, and **Total Collection Value** in glowing amber.
- Plots your games on a timeline bar chart by decade.
- Profiles your top and highest-rated Developer Studios.
- Analyzes which tags and genres consistently earn the highest ratings.
- A **Financial Overview** breaks down the monetary value tied up in your Backlog vs Completed games.

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

- The app relies on the Notion database for canonical data — once a token + database ID are configured in Settings, every entry is read from and written to Notion. All entries should be added directly via the UI Editor or via the Notion MCP integration.
- Without a Notion connection the app falls back to a **local-storage demo**: the Onboarding Wizard seeds a small curated set of genre classics (`PIVOT_TITLES` in `src/click-deck/lib/seed-data.js`) so the timeline, analytics and stats views are explorable offline. This demo data is never written to Notion.
- **Cover Art System**: The Notion integration includes full support for high-resolution external image URLs mapped to the `cover` property of each Notion page. This populates the UI with rich game box art.
- **Interactive Ratings**: Users can click the stars directly on the Game Cards on the main timeline to immediately update their rating in the Notion database, minimizing friction.

### Adding a New Game Requirements

When adding a new game to the database (whether manually or via automation), ensure the following requirements are strictly met:

1.  **Core Metadata**: Always include the **Title**, **Release Year**, and **Developer/Studio**.
2.  **Cover Art**: The cover must be an external URL fetched from Steam using the format: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<APP_ID>/header.jpg`.
3.  **Tags (Strict Limits)**: Each game **MUST** have a minimum of 5 and a maximum of 7 tags to ensure the Analytics View remains rich but uncluttered. Mix broad genres (e.g., `Point & Click`, `Sci-Fi`) with specific vibes (e.g., `Atmospheric`, `Choices Matter`).
4.  **Journal/Notes (Spicy & Flavorful)**: Notes should *never* be dry factual summaries (e.g., "A game where you click on things"). They should be punchy, opinionated, and flavorful mini-reviews that capture the essence, humor, or tragedy of the game. Use the `Settings` menu (⚙ icon) to edit the raw game data if necessary.

### 🎭 Expressive Rich Text Policy (Journal/Notes)
When generating or updating the `Journal/Notes` property in the Notion database, **you must use expressive Rich Text formatting** to highlight, enforce, and create dramatic tension. 
- Use **colors** (e.g., `red`, `orange`, `green`, `purple`, `pink`) combined with **bolding** for strong emotional or thematic words (e.g., *murder*, *masterclass*, *beautiful*, *dread*).
- Use **italics** and `gray` to denote sarcasm, cynicism, or subtle mystery.
- Use **strikethrough** or **underline** for dramatic misdirection, controversy, or fourth-wall-breaking concepts.
- Be deliberate and dynamic. Do not settle for plain text—ensure the reading experience feels vibrant and dramatically punctuated.

5.  **Status & Rating**: Ensure the play status (`Backlog`, `Playing`, `Completed`, `Abandoned`) is accurate, and rate `Completed` games from 1 to 5.

### Factory Reset
- The "Factory Reset DB State" action is safeguarded behind a prompt requiring the user to type `RESET`, ensuring that destroying local state and API tokens is never accidental.

## PWA & Cabinet Integration

- Registered in `src/apps-registry.js` under the `react-vite` kind.
- Ships a `.webmanifest` so it is **installable** as a standalone-window PWA on mobile and desktop, plus a scoped service worker (`click-deck-sw.js`, generated by the `clickDeckPWA()` Vite plugin) that precaches the app shell — the timeline, analytics and stats views work offline. Live Notion data still requires a connection; offline just means the shell boots instead of a blank screen. JetBrains Mono is loaded from Google Fonts, so the worker adds a runtime cache-first rule for it rather than precaching it.
- Correctly referenced in `cabinet.webmanifest` via `related_applications` to allow native installation checks across the Cone of Cold ecosystem.
- Fully responsive on mobile, including wrapping navigation bars and collapsing modal forms.

- A comprehensive standalone HTML guide (`public/click-deck-guide.html`) provides step-by-step instructions for integrating the Notion backend and initializing the database schema.
- The guide is linked directly from the Cone of Cold app catalog (`index.html`).
