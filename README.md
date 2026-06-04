# ❄ Cone of Cold

**[coneofcold.vercel.app](https://coneofcold.vercel.app)**

A personal collection of standalone web apps built with Claude. No frameworks, no dependencies, no build step. Open the file, it works.

---

## Apps

| App | Tags | File |
| --- | --- | --- |
| [Touch Grass](https://coneofcold.vercel.app/touch-grass.html) | outdoor · ambient | `touch-grass.html` |
| [Codex Alchymicus — KCD2](https://coneofcold.vercel.app/kcd2-codex-v3.html) | gaming | `kcd2-codex-v3.html` |
| [Kettlebell Training](https://coneofcold.vercel.app/kettlebell-claude.html) — Claude Sonnet | fitness · svg | `kettlebell-claude.html` |
| [Kettlebell Training](https://coneofcold.vercel.app/kettlebell-gemini.html) — Gemini Pro | fitness · svg | `kettlebell-gemini.html` |

---

## Structure

```
/
├── index.html              ← landing page with search + tag filter
├── touch-grass.html        ← go outside, come back, see what you found
├── kcd2-codex-v3.html
├── kettlebell-claude.html
├── kettlebell-gemini.html
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
