# ❄ Cone of Cold

**[coneofcold.vercel.app](https://coneofcold.vercel.app)**

A personal collection of standalone web apps built with Claude. Most are React + Vite;
a few are self-contained static HTML pages. Either way they run entirely in your browser.

---

## Apps

| App | Tags | Entry file |
| --- | --- | --- |
| [Law of the Day](https://coneofcold.vercel.app/law-of-the-day-react.html) | quiz · strategy · reading · react · vite | `law-of-the-day-react.html` |
| [Tempo](https://coneofcold.vercel.app/tempo-react.html) | mindfulness · fitness · breathing · react · vite | `tempo-react.html` |
| [Sol Odyssey](https://coneofcold.vercel.app/sol-odysseys-react.html) | habits · growth · tracker · notion | `sol-odysseys-react.html` |
| [Touch Grass](https://coneofcold.vercel.app/touch-grass-react.html) | outdoor · react · vite | `touch-grass-react.html` |
| [Journal of Delights](https://coneofcold.vercel.app/journal-of-delights-react.html) | mindfulness · writing · react · notion | `journal-of-delights-react.html` |
| [Kettlebell Training](https://coneofcold.vercel.app/kettlebell-training-react.html) | fitness · svg · react · vite | `kettlebell-training-react.html` |
| [Touch Grass (v7, legacy)](https://coneofcold.vercel.app/touch-grass.html) | outdoor · ambient | `touch-grass.html` |
| [Touch Grass · Thrive (legacy)](https://coneofcold.vercel.app/touch-grass-vio.html) | outdoor · mindfulness | `touch-grass-vio.html` |
| [Touch Grass · Nora (legacy)](https://coneofcold.vercel.app/touch-grass-nora.html) | outdoor · kawaii | `touch-grass-nora.html` |
| [Codex Alchymicus — KCD2](https://coneofcold.vercel.app/kcd2-codex-v3.html) | gaming | `kcd2-codex-v3.html` |

The "legacy" rows are older, design-locked apps kept live but not actively developed —
see [`LEGACY.md`](LEGACY.md). All ten are registered in one place:
[`src/apps-registry.js`](src/apps-registry.js), which feeds both `index.html`'s card
grid and **[The Cabinet](CABINET.md)** — a dashboard at
[coneofcold.vercel.app/coneofcold-cabinet.html](https://coneofcold.vercel.app/coneofcold-cabinet.html)
that lists the six React+Vite apps (trying to hand off to each one's installed PWA) plus
the four legacy static apps behind an opt-in toggle.

---

## Structure

```
/
├── index.html                      ← landing page with search + tag filter, reads src/apps-registry.js
├── coneofcold-cabinet.html         ← The Cabinet dashboard entry (src/cabinet/)
├── ds-showcase.html                ← live design-system component workbench (src/ds/)
├── <app>-react.html                ← one Vite entry per React+Vite app (src/<app>/)
├── src/
│   ├── apps-registry.js            ← single source of truth for every app's card/tile data
│   ├── ds/                         ← shared design system (tokens + components) — new apps only
│   ├── shared/                     ← cross-app logic (e.g. notify/) any app may import
│   ├── sol-odyssey/, tempo/, law-of-the-day/, cabinet/   ← new apps, build on src/ds/
│   └── touch-grass/, journal/, kettlebell/               ← legacy apps, design-locked, own styling
├── public/
│   ├── touch-grass.html, touch-grass-vio.html, touch-grass-nora.html, kcd2-codex-v3.html
│   │                                ← hand-authored legacy static apps, served at the site root
│   └── <app>.webmanifest, <app>-sw.js, <app>-icon-*.png   ← per-app PWA assets
└── vite.config.js                  ← registers every React+Vite entry under build.rollupOptions.input
```

---

## Design system

New apps build on the design system in [`src/ds/`](src/ds/) — tokens + a growing set of
components (Button, Field, Modal, NumberStepper, Card, SegmentedControl, IconButton…).
Live workbench: **`/ds-showcase.html`**. The older apps and static resources are
**design-locked and out of scope for it** — see [`LEGACY.md`](LEGACY.md) for the boundary.
The one-way rule (legacy apps never import `src/ds/`) is enforced by
`src/ds/boundary.test.js` in `npm test`.

---

## Adding a new app

The full process — decisions to make up front, scaffolding, the design system, and the
verification checklist — lives in [`CLAUDE.md`](CLAUDE.md) (enforced, in-repo) and the
Notion page **Dev — Building an App** (human-readable narrative). In short:

1. Register the app's entry in `vite.config.js` → `build.rollupOptions.input` (React+Vite
   apps) or drop a hand-authored `.html` file in `public/` (static apps).
2. Add its entry to the `APPS` array in [`src/apps-registry.js`](src/apps-registry.js) —
   this single file feeds both `index.html`'s card grid and [The Cabinet](CABINET.md).
   See that file's own header comment for the current field shape (`kind`, `manifest`,
   `deployed`, `tags`, …) and [`CABINET.md`](CABINET.md) for the full checklist.
3. **Add the analytics tag** — every page on this site must include it (see
   [Analytics](#analytics)).
4. `npm test && npm run typecheck`, then push. Vercel deploys automatically.

---

## Analytics

Traffic is tracked with **Vercel Web Analytics** (privacy-friendly, cookieless). The
dashboard is private to the Vercel project owner — Project → Analytics on
[vercel.com](https://vercel.com). It breaks down views, visitors, referrers, and
countries **per path**, so the homepage (`/`) and each app (e.g. `/touch-grass.html`)
show up as separate rows.

**Rule: every HTML page on this site includes the analytics tag** — no exceptions, so
per-app access patterns stay complete. Add it to the `<head>` of any new page:

```html
<script defer src="/_vercel/insights/script.js"></script>
```

Vercel serves that script automatically once Web Analytics is enabled for the project;
no npm package is needed. (This is separate from Speed Insights, which measures load
performance rather than traffic.)

---

## Deploy

Hosted on [Vercel](https://vercel.com) via the `jormania/app-playground` GitHub repo. Every push to `main` triggers a new deployment.
