# Click Deck

**[coneofcold.vercel.app/click-deck-react.html](https://coneofcold.vercel.app/click-deck-react.html)**

Click Deck is a standalone web application designed for cataloguing and tracking graphic narrative and point-and-click adventure games from the 90s to the present.

## Architecture

- **Stack**: React, Vite, CSS Modules (for component scoping), and standard global CSS (for layout resets and theme).
- **Aesthetics**: A stark, industrial aesthetic heavily inspired by *Beneath a Steel Sky*. It utilizes `JetBrains Mono` terminal fonts, sharp edges with zero border radius, and a high-contrast palette of toxic cyan, warning amber, and deep greys.
- **Backend**: Live Notion Database Integration via a proxy layer.

## Notion Backend & Database Initialization

Click Deck diverges from simpler `localStorage` apps by requiring a real Notion backend to store your game entries.
- The app uses a **Bring Your Own (BYO)** token model.
- Users input their `Notion Integration Token` in the **Settings Modal**.
- The **"Initialize Database via MCP"** button hits the repository's serverless `/api/notion` proxy to dynamically create the full database schema under a target parent page.
- Once created, all database transactions (reading games, adding new games, updating status, and editing) happen live via the Notion API.
- A **"Populate Seed Data"** button allows users to instantly fill their empty Notion database with a curated batch of canonical point-and-click classics.

## PWA & Cabinet Integration

- Registered in `src/apps-registry.js` under the `react-vite` kind.
- Deployed as a full Progressive Web App (PWA) with a `.webmanifest` file.
- Correctly referenced in `cabinet.webmanifest` via `related_applications` to allow native installation checks across the Cone of Cold ecosystem.
- Fully responsive on mobile, including wrapping navigation bars and collapsing modal forms.
