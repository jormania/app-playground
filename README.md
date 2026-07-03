# ❄ Cone of Cold

**[coneofcold.vercel.app](https://coneofcold.vercel.app)**

A personal collection of standalone web apps built with Claude. Most are single self-contained HTML files; a few are built with React + Vite. Either way they run entirely in your browser.

---

## Apps

| App | Tags | File |
| --- | --- | --- |
| [Touch Grass](https://coneofcold.vercel.app/touch-grass.html) | outdoor · ambient | `touch-grass.html` |
| [Codex Alchymicus — KCD2](https://coneofcold.vercel.app/kcd2-codex-v3.html) | gaming | `kcd2-codex-v3.html` |
| [Kettlebell Training](https://coneofcold.vercel.app/kettlebell-training-react.html) | fitness · svg · react · vite | `kettlebell-training-react.html` |

---

## Structure

```
/
├── index.html              ← landing page with search + tag filter
├── touch-grass.html        ← go outside, come back, see what you found
├── kcd2-codex-v3.html
├── kettlebell-training-react.html  ← React + Vite entry (src/kettlebell/)
├── manifest.json           ← PWA manifest (Touch Grass)
├── sw.js                   ← service worker (Touch Grass)
├── icon-192.png            ← PWA icon
├── icon-512.png            ← PWA icon
└── README.md
```

---

## Design system

New apps build on the fresh design system in [`src/ds/`](src/ds/) (tokens first;
components to follow). The existing apps and static resources are **design-locked
and out of scope for it** — see [`LEGACY.md`](LEGACY.md) for the boundary. The
one-way rule (legacy apps never import `src/ds/`) is enforced by
`src/ds/boundary.test.js` in `npm test`.

---

## Adding a new app

1. Drop the `.html` file in the repo root.
2. Add an entry to the `APPS` array in [`src/apps-registry.js`](src/apps-registry.js)
   — this single file feeds both `index.html`'s card grid and
   [The Cabinet](CABINET.md) dashboard:

```js
{
  emoji: "🗂️",
  iconBg: "rgba(124,111,255,0.12)",   // card icon background
  title: "My App",
  subtitle: "short descriptor",
  version: "v1",                       // optional
  deployed: "Jun 2026",
  size: "34 KB",
  tech: "Vanilla JS",
  tags: ["gaming"],                    // keep sparse: gaming · fitness · outdoor · svg
  description: "One paragraph.",
  features: [                          // optional bullet list
    "Feature one",
    "Feature two",
  ],
  file: "my-app.html",
  // Only for a real Vite+React build with its own PWA manifest — see CABINET.md:
  // kind: "react-vite",
  // manifest: "/my-app.webmanifest",
},
```

3. **Add the analytics tag** — every page on this site must include it (see [Analytics](#analytics)). Put this in the `<head>`:

```html
<script defer src="/_vercel/insights/script.js"></script>
```

4. Push. Vercel deploys automatically.

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
