# Click Deck

**[coneofcold.vercel.app/click-deck-react.html](https://coneofcold.vercel.app/click-deck-react.html)**

Click Deck is a standalone web application designed for cataloguing and tracking graphic narrative and point-and-click adventure games from the 90s to the present. It was originally vibe-coded with Gemini Pro in AntiGravity IDE, then taken over, audited and substantially extended under Claude Code — this file tracks the app as it actually is today, not just its original brief.

For the step-by-step, end-user-facing walkthrough (Notion setup, the full database schema, every view and control explained), see [`public/click-deck-guide.html`](public/click-deck-guide.html) — linked from the app itself and from the Cone of Cold catalog. This file is the technical/architectural companion for anyone (human or Claude) working on the code.

## Architecture

- **Stack**: React, Vite, and standard global CSS (`src/click-deck/styles/theme.css`) for layout, resets and the theme-variable system. Each component keeps its styling in a `<style>` block scoped by its own `cd-*` class prefix rather than CSS Modules.
- **Aesthetics**: A stark, industrial aesthetic initially inspired by *Beneath a Steel Sky*. It utilizes `JetBrains Mono` terminal fonts (loaded from Google Fonts, not self-hosted), sharp edges with zero border radius, bracket-notation UI (`[T]`, `[E]DIT`, `[X]`), and a high-contrast palette. The header logo (`public/click-deck-logo.svg`) is a small transparent SVG built from the same bracket-and-cursor visual language, replacing an earlier opaque PWA-icon PNG that carried a visible background square in the header.
- **Theme System**: Every visual accent in the app is driven by a handful of CSS custom properties (`--cd-accent-cyan`, `--cd-accent-amber`, `--cd-bg-*`, `--cd-status-*`, etc.) redefined per `[data-theme="..."]` value on `<html>`. Six palettes exist today:
  - **Union City** (`union`, default): Cyan/Amber — classic cyberpunk.
  - **Voodoo** (`voodoo`): Toxic Green/Purple — Monkey Island inspired.
  - **Noir** (`noir`): Grayscale/Gold — Grim Fandango inspired.
  - **Sierra Nights** (`sierra`): Indigo/Gold — King's Quest-era Sierra VGA.
  - **Amber Terminal** (`amber-terminal`): Amber/Burnt Orange — classic monochrome DOS/BBS CRT, echoing the app's own terminal chrome.
  - **CGA** (`cga`): Cyan/Magenta — early-90s DOS composite CGA.
  - A separate, independent Settings toggle — **Retro CRT Mode** (`data-crt="true"` on `<html>`, `cd_crt_effect` in localStorage) — layers scanlines, a screen vignette, and viewfinder-style corner brackets (`.cd-panel::before/::after`) on top of whichever theme is active. Off by default: with dozens of `.cd-panel` cards on screen at once (every game card *is* one), it reads as clutter unless deliberately opted into.
  - Play-status colors (`--cd-status-backlog/playing/completed/abandoned`) are defined once in `:root` in terms of the theme accents, so they automatically re-derive per theme via normal CSS cascade/`var()` resolution — no per-theme duplication needed.
- **Backend**: Live Notion Database Integration (`3a3d3e6d-60db-81b2-a8d9-ca78e8100ef8`) via the repo's stateless `/api/notion` proxy (`api/notion.js`) — see [Notion Backend](#notion-backend--database-initialization) below.
- **Automated Pricing & Discounts**: A Vercel-hosted cron job (`api/clickdeck-pricing.js`, `0 2 * * *` in `vercel.json`) nightly syncs real-time Steam Store prices, initial prices and discount percentages for every game with a `Steam App ID`, writing `Price Updated At` alongside each update. It skips writes when nothing actually changed (comparing with a small floating-point tolerance) so a stable price doesn't generate a nightly no-op patch.
- **Client-side data layer**: `src/click-deck/lib/mcp-connector.js` is the single point of contact between the UI and storage — it transparently switches between the real Notion backend (when a token + database ID are configured) and a `localStorage`-only demo mode (see [Notion Backend](#notion-backend--database-initialization)). A Notion sync failure (bad token, revoked integration, rate limit) is no longer swallowed to an empty array here — it propagates to the caller, so `App.jsx` can show a distinct `SYNC FAILED` state instead of it looking identical to a genuinely empty collection.
- **Optimistic UI**: Rating changes, status changes, edits and deletes update React state immediately rather than re-fetching the entire (paginated) collection from Notion after every single mutation. If the underlying write actually fails, the optimistic change is rolled back and a toast explains what happened. This lives in `App.jsx`'s `handleSaveGame`/`handleUpdateStatus`/`handleDeleteGame`.
- **Test Suite**: A comprehensive Vitest + React Testing Library component suite (100+ tests across `src/click-deck/`) covering every component and library module, including dedicated coverage for the rich-text preservation logic, the Steam title-matching heuristic, optimistic-update rollback, and every Settings control.

## Scripts & Automation

Located in the `scripts/` directory, these Python utilities interact directly with the Notion backend to automate and verify collection data. Each expects `CLICKDECK_NOTION_TOKEN` and `CLICKDECK_DB_ID` as environment variables (or hardcoded at the top of the script for a one-off run).

- **`backfill-steam-ids.py`**: Finds every game missing a `Steam App ID` and searches Steam's storesearch API for it, writing back the best-matching App ID. Scores candidates by normalized title (see `normalize_title`, shared in spirit with `verify-steam-names.py`'s own normalization) instead of trusting Steam's first search result blindly — classics that Steam re-lists with a "Remastered" / "Special Edition" / "20th Anniversary Edition" / "The Final Cut" suffix (Grim Fandango, Day of the Tentacle, Gabriel Knight, Disco Elysium, and others) previously wouldn't match a literal title compare at all. Skips (and prints a note) rather than guessing when nothing matches confidently. This mirrors `src/click-deck/lib/steamMatch.js`, which the in-app Editor's "Fetch Steam" button uses for the exact same reason.
- **`verify-steam-names.py`**: The read-only counterpart — verifies games that *already have* a `Steam App ID` against what Steam actually reports for that ID. Cross-references the Notion `Developer` field against both Steam Developers and Publishers (including studio aliases like LucasArts/Lucasfilm) and normalizes titles to prevent false-positive mismatches, without writing anything back.
- **`force-sync-prices.py`**: An on-demand version of the nightly `api/clickdeck-pricing.js` cron, for triggering a price refresh without waiting for the scheduled run.
- **`dramatize-journal.py`**: Pulls plain-text `Journal/Notes` from the Notion database and injects expressive rich-text formatting using a predefined dictionary of thematic keywords (e.g., coloring "horror" red, "cyberpunk" purple). Safely skips entries that have already been manually styled.

Two other root-level scripts (`find-covers.cjs`, `validate-covers.cjs`) are one-off scratch utilities from early development (scraping Wikipedia infobox images as a cover-art workaround, and checking cover URLs for 404s) — not part of any regular workflow, kept for reference only.

### ⚠️ Known data gaps (as of this writing)

The live collection currently has **24 entries with no `Steam App ID`** (and therefore no cover art, no Steam link, and no pricing) — including *The Secret of Monkey Island*, *Grim Fandango*, *Day of the Tentacle*, *Disco Elysium*, *Beneath a Steel Sky*, and most of the pre-Steam-remaster LucasArts classics. Running the now-fixed `backfill-steam-ids.py` against the live database should resolve most of these. There's also a genuine **duplicate `Full Throttle` entry** (two rows with different status/rating/tags) that needs a manual merge-or-delete decision in Notion — not something to fix silently via script, since which row's data to keep is a judgment call.

## Core Views

Click Deck features three primary perspectives over your game collection, toggled via the main navigation (`[T]` / `[A]` / `[S]`):

### 1. Timeline View (Micro-Animations)
The chronologically sorted timeline is the default and core view of the application. It leans heavily into a retro-futuristic aesthetic by utilizing an `IntersectionObserver` to trigger scroll-based micro-animations.
- A persistent, glowing scan line (colored per the active theme) tracks up and down the vertical timeline track.
- As individual game nodes enter the viewport, they smoothly slide in from the side.
- Year markers and game cards ignite with a neon glow effect, creating a highly dynamic, "living" interface that reacts continuously to user scroll position.
- Sort order is user-selectable (Timeline / Recently Added / Highest Rated / Alphabetical), and stacks with the global search box, a row of status chips (`[ALL]`/`[BACKLOG]`/`[PLAYING]`/`[COMPLETED]`/`[ABANDONED]`, each with a live count), and any tag filters carried over from Analytics.
- Global search matches title, developer, tags *and* journal text — not just title/developer as in the original implementation.
- Each card's cover, when the game has a `Steam App ID`, is a real `<a href target="_blank">` to the Steam store page — not a `div` + `onClick={() => window.open(...)}`, which is unreliable across browsers/popup blockers on a real domain (and once the app is installed as a PWA) even though it worked fine on `localhost`. The same fix applies to the Analytics gallery, the Discounts modal, and the Random Game modal's cover.
- A dismissible discount banner (see [Discount Banner & Price Tracking](#discount-banner--price-tracking) below) appears above the timeline whenever any Backlog game has an active sale.

### 2. Analytics View
A high-level dashboard providing advanced multi-dimensional filtering over your collection.
- **Advanced Querying**: Clickable toggle rows for `PRICE`, `RATING`, `ERA`, and `TAGS` that layer on top of the global `Status` and `Search` parameters. The `TAGS` row (`Under 5` / `Over 7`) is a data-quality filter for spotting entries that fall outside the collection's own 5–7 tag policy — see [Adding a New Game Requirements](#adding-a-new-game-requirements) below.
- Features a **Dynamic Tag Word Cloud** (`TAG_MATRIX`) and a **Developer Word Cloud** (`STUDIO_MATRIX`) that let you visually drill down by genre or studio; clicking a chip filters the whole app (the filter is shared with the Timeline).
- Displays a responsive Gallery Grid featuring game metadata (Release Year, Price, Rating, and Status) that dynamically updates based on the active query. Each grid item's cover is a real Steam link, same as the Timeline.
- Supports exporting the currently filtered dataset as a clean HTML report (`[EXPORT HTML]`) or as portable JSON (`[EXPORT JSON]`) — the JSON export exists specifically because the BYO-Notion-token model means there's no other built-in backup path.

### 3. Stats Screen
A pure data-crunching dashboard designed specifically for adventure game collectors, denoted by the `[S]` icon. Unaffected by the global search/status filters (it always summarizes the whole collection).
- Calculates your exact collection completion rate, mean average rating, and **Total Collection Value** in glowing amber.
- Plots your games on a timeline bar chart by decade.
- Profiles your top and highest-rated Developer Studios.
- Analyzes which tags and genres consistently earn the highest ratings.
- A **Financial Overview** breaks down the monetary value tied up in Backlog vs. Completed games, and now shows **`PRICES LAST SYNCED: [date]`** — the most recent `Price Updated At` across the whole collection — computed client-side from data that was previously captured from Notion but never surfaced anywhere, leaving no way to tell whether the nightly pricing cron was actually still running.

## Discount Banner & Price Tracking

- Whenever any `Backlog`-status game has `Discount Percent > 0`, a banner (`🔥 N GAMES ON SALE! [VIEW DISCOUNTS]`) appears above the Timeline. Clicking it opens `DiscountModal`, showing every discounted game with its original and sale price and a percent-off badge.
- **Dismiss & snooze**: the banner's `[X]` snoozes it for 24 hours (`localStorage` key `cd_discount_snooze_until`, via `src/click-deck/lib/priceTracking.js`), after which it reappears automatically if anything's still discounted.
- **Persistent mode**: a Settings checkbox (`cd_discount_banner_persistent`) makes the banner permanently visible, ignoring the snooze entirely; the dismiss button hides itself in this mode since it would have nothing to do.
- **Safety net**: a "Show Sale Banner Now" button in Settings clears an active snooze immediately (independent of Save/Close), for the case of dismissing it by accident and wanting it back without waiting out the full 24 hours.
- **Price-drop toast**: on every successful `loadGames()`, the current price of each game is compared against the last price seen for it (a small cache in `localStorage`, `cd_last_prices`) via `detectPriceDrops()`. Any drop toasts `PRICE DROP: [title]` — the client-side equivalent of a push notification, since the nightly pricing cron has no way to reach an already-open browser tab. A game's very first sighting is never reported as a drop (nothing to compare against yet).

## Random Game (`[R]`)

A short slot-machine-style roll through the Backlog (`RandomGameModal`), settling on one game with `[RE-ROLL]` to try again and `[BEGIN PLAYTHROUGH]` to move it straight to `Playing` (preserving any rating it already had, rather than stamping a bogus `0`). By default every Backlog game has equal odds (`src/click-deck/lib/randomWeighting.js`, mode `uniform`). A Settings dropdown — **Random Pick Weighting** — can instead bias the roll toward the **oldest** Backlog entries (by `createdTime`) or the **cheapest** ones; weighting is rank-based (the most-favored candidate gets weight *N* for a pool of *N* games, decreasing to 1), and the active mode shows as a small badge in the roll modal.

## Game Editor

Click Deck includes a dedicated **Game Editor Modal** for manual collection management.
- Users can manually add unlisted games, edit existing ones, or completely delete/archive entries from their database.
- Includes fields for Title, Cover URL, Developer, Year, Status, Rating, Tags, and a custom Journal entry.
- Supports pasting external image URLs, or clicking **FETCH STEAM** to search Steam's store by the current title and auto-fill *both* the cover URL and the `Steam App ID` from the best-matching result (via `steamMatch.js`'s `pickBestSteamMatch`, not Steam's literal first search result — see the Scripts section above for why that distinction matters). Earlier this button only ever saved the cover URL, silently dropping the App ID — meaning a game covered this way would never get pricing or a working Steam link; that's now fixed.
- Star ratings on the Timeline cards are real, keyboard-reachable `<button>` elements with `aria-label`/`aria-pressed`, not unlabeled clickable `<span>`s.

## Notion Backend & Database Initialization

Click Deck diverges from simpler `localStorage` apps by requiring a real Notion backend to store your game entries.
- The app uses a **Bring Your Own (BYO)** token model.
- Users input their `Notion Integration Token` in the **Settings Modal**.
- The **"Initialize New Database Schema"** button hits the repository's serverless `/api/notion` proxy to dynamically create the full database schema under a target parent page. This initial schema does *not* include the pricing-related properties — a separate **"Patch Database for Pricing Schema"** button adds `Current Price`, `Discount Percent`, `Initial Price`, `Steam App ID`, and `Price Updated At` afterward. Skipping the patch step is harmless (pricing just has nowhere to write), but it's a common thing to forget.
- **Safety Checks**: The initialization process is guarded to prevent accidental duplications. If a database ID is already present, the user must explicitly confirm before creating a new schema, preventing them from overwriting their existing connection.

### Adding Data & Cover Art

- The app relies on the Notion database for canonical data — once a token + database ID are configured in Settings, every entry is read from and written to Notion. All entries should be added directly via the UI Editor or via the Notion MCP integration.
- Without a Notion connection the app falls back to a **local-storage demo**: the Onboarding Wizard seeds a curated set of ten genre classics (`PIVOT_TITLES` in `src/click-deck/lib/seed-data.js` — *Loom*, *The Curse of Monkey Island*, *Sanitarium*, *Blade Runner*, *Machinarium*, *Broken Age*, *Firewatch*, *Oxenfree*, *The Wolf Among Us*, *Pentiment*, each with a real Steam App ID and a written-in-voice journal entry) so the timeline, analytics and stats views are explorable offline. This demo data is never written to Notion.
- **Cover Art System**: The Notion integration includes full support for high-resolution external image URLs mapped to the `cover` property of each Notion page. This populates the UI with rich game box art.
- **Interactive Ratings**: Users can click the star buttons directly on the Game Cards on the main timeline to immediately update their rating in the Notion database, minimizing friction. This is an optimistic update (see Architecture above) — it reflects in the UI instantly and only reverts if the Notion write actually fails.

### Adding a New Game Requirements

When adding a new game to the database (whether manually or via automation), ensure the following requirements are strictly met:

1.  **Core Metadata**: Always include the **Title**, **Release Year**, and **Developer/Studio**.
2.  **Cover Art**: The cover must be an external URL fetched from Steam using the format: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<APP_ID>/header.jpg`.
3.  **Tags (Strict Limits)**: Each game **MUST** have a minimum of 5 and a maximum of 7 tags to ensure the Analytics View remains rich but uncluttered. Mix broad genres (e.g., `Point & Click`, `Sci-Fi`) with specific vibes (e.g., `Atmospheric`, `Choices Matter`). The in-app Editor now warns (without blocking the save) when an entry falls outside this range, including legacy entries that predate the 7-tag cap.
4.  **Journal/Notes (Spicy & Flavorful)**: Notes should *never* be dry factual summaries (e.g., "A game where you click on things"). They should be punchy, opinionated, and flavorful mini-reviews that capture the essence, humor, or tragedy of the game. Use the `Settings` menu (⚙ icon) to edit the raw game data if necessary.

### 🎭 Expressive Rich Text Policy (Journal/Notes)
When generating or updating the `Journal/Notes` property in the Notion database, **you must use expressive Rich Text formatting** to highlight, enforce, and create dramatic tension. 
- Use **colors** (e.g., `red`, `orange`, `green`, `purple`, `pink`) combined with **bolding** for strong emotional or thematic words (e.g., *murder*, *masterclass*, *beautiful*, *dread*).
- Use **italics** and `gray` to denote sarcasm, cynicism, or subtle mystery.
- Use **strikethrough** or **underline** for dramatic misdirection, controversy, or fourth-wall-breaking concepts.
- Be deliberate and dynamic. Do not settle for plain text—ensure the reading experience feels vibrant and dramatically punctuated.

5.  **Status & Rating**: Ensure the play status (`Backlog`, `Playing`, `Completed`, `Abandoned`) is accurate, and rate `Completed` games from 1 to 5.

**Editing without losing formatting**: the in-app Editor preserves a game's existing rich-text formatting *as long as the Journal/Notes text itself isn't touched* during the edit — it detects the plain text is unchanged and writes the original formatted segments straight back (`journalRich` round-trips through `mcp-connector.js`'s `mapGameToProperties`). Editing the journal text itself necessarily produces plain text (a `<textarea>` can't author colored/bold spans), and the Editor shows an inline warning in that case rather than silently flattening the formatting. This guards against what was previously a real data-loss bug: saving *any* field on a richly-formatted entry — even just a status change — used to silently strip all its Notion formatting.

### Factory Reset
- The "Factory Reset DB State" action is safeguarded behind a prompt requiring the user to type `RESET`, ensuring that destroying local state and API tokens is never accidental. Since the actual game data lives in Notion (not the browser), this only clears the *connection* (token, database ID, and any local-demo data), never the collection itself.

## Sync Failure Handling

A Notion sync failure (expired token, revoked integration, rate limit) shows a distinct `SYNC FAILED: [message]` banner with a `[RETRY]` button, rather than the app quietly falling back to "0 records found" as if the collection were simply empty — those two situations previously looked identical, which was more alarming than an actual outage needed to be. When there's no already-loaded data to fall back on, the misleading empty-collection message is suppressed entirely rather than shown underneath the error banner.

## PWA & Cabinet Integration

- Registered in `src/apps-registry.js` under the `react-vite` kind.
- Ships a `.webmanifest` so it is **installable** as a standalone-window PWA on mobile and desktop, plus a scoped service worker (`click-deck-sw.js`, generated by the `clickDeckPWA()` Vite plugin) that precaches the app shell — the timeline, analytics and stats views work offline. Live Notion data still requires a connection; offline just means the shell boots instead of a blank screen. JetBrains Mono is loaded from Google Fonts, so the worker adds a runtime cache-first rule for it rather than precaching it.
- Correctly referenced in `cabinet.webmanifest` via `related_applications` to allow native installation checks across the Cone of Cold ecosystem.
- Fully responsive on mobile, including wrapping navigation bars and collapsing modal forms.

- A comprehensive standalone HTML guide (`public/click-deck-guide.html`) provides step-by-step instructions for integrating the Notion backend, initializing (and patching) the database schema, and using every view and control in the app — including a full reference table of the Notion schema.
- The guide is linked directly from the Cone of Cold app catalog (`index.html`).
