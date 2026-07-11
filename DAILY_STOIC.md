# Daily Stoic — wisdom and reflections

**[coneofcold.vercel.app/daily-stoic-react.html](https://coneofcold.vercel.app/daily-stoic-react.html)**

Daily Stoic is a daily companion app to read public domain quotes from Marcus Aurelius and Seneca, write daily reflections, and save them securely. It runs as a Progressive Web App (PWA) with offline capabilities.

Source: [`src/daily-stoic/`](src/daily-stoic/). Entry shell: `daily-stoic-react.html`. Built on `src/ds/` (tokens and barrel components). Built in **strict TypeScript** with full type coverage and unit testing.

---

## Architecture & Data Flow

Daily Stoic operates in two data modes:
1. **Notion-Backed (Cloud Sync)**: When a Notion token and database ID are configured in Settings. Reads and writes reflections to a private Notion database through the stateless proxy relay `/api/notion` (CORS-safe).
2. **Local Storage (Offline Fallback)**: Active when Notion is not configured. Reads and writes reflections directly to the browser's local storage under the key `daily-stoic:reflection-{dayOfYear}`.

---

## Notion Database Schema

If configured, the app expects a database matching the following schema. Database verification runs automatically in Settings via the Test Connection check:

| Property Name | Notion Type | Description |
| --- | --- | --- |
| **Name** | `title` | Page title, e.g. "Day 42 Reflection" |
| **QuoteID** | `number` | The day of the year (1-366), used as the primary lookup key |
| **Reflection** | `rich_text` | The text content of the user's reflection |
| **Tags** | `multi_select` | Automatically populated with `['Stoic', 'Reflection']` |
| **Date** | `date` | Date the reflection was recorded (ISO `YYYY-MM-DD` string) |

### Notion Starter Template
To get started quickly, duplicate the official template:
🔗 **[Daily Stoic — Starter Template](https://www.notion.so/coneofcold/Daily-Stoic-Starter-Template-63a5df679efb4db8b8cb1a0283f5108b)** (Empty database with pre-configured headers matching the required schema).

---

## Changelog

### July 11, 2026
- **Initial App Scaffold**: Created entry HTML shell `daily-stoic-react.html`, registered in Rollup config, set up app-scoped service worker and PWA manifest.
- **MVP Logic**: Created daily quotes list and day-of-year mapping. Implemented basic local storage reflection logging.
- **Design System Integration**: Styled App, Header, and Journal using components from the `src/ds/` barrel and CSS modules reading tokens.

### July 11, 2026 (Milestone 1)
- **Notion Relay Integration**: Implemented [`NotionService.ts`](src/daily-stoic/services/NotionService.ts) communicating with `/api/notion`. Handles path normalization, connection testing, schema validation, fetching, and upserting (PATCH on edit, POST on create).
- **Settings View**: Created a credentials management panel with test connection state, schema warning feedback, and disconnect capabilities. Saved credentials remain on-device.
- **Reactive Journaling**: Refactored the journal to fetch from Notion (showing loading states) or fallback to local storage. 
- **Unit Testing & Compliance**: Added vitest coverage for Notion services and day boundary calculations. Ensured boundary safety against `src/ds/` imports from legacy directories.
