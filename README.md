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

## Adding a new app

1. Drop the `.html` file in the repo root.
2. Open `index.html` and add an entry to the `APPS` array in the `<script>` block:

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
},
```

3. Push. Vercel deploys automatically.

---

## Deploy

Hosted on [Vercel](https://vercel.com) via the `jormania/app-playground` GitHub repo. Every push to `main` triggers a new deployment.
