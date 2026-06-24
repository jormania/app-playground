# Existing apps & resources — out of scope for the new design system

Everything listed here is **kept, live, and valid**. None of it is being retired,
unlinked, or moved — it all stays in the repo and in [`index.html`](index.html)
exactly as it is today.

The single purpose of this file is to draw a **scope boundary**: these apps and
resources are *not* part of the fresh design system in [`src/ds/`](src/ds/) and
must be ignored by it. They predate the design system, ship their own design, and
should never depend on it. Only **new** apps build on `src/ds/`.

## React apps (design-locked, bugfixes only)

| App | Source | Live shell |
|-----|--------|-----------|
| Touch Grass | [`src/touch-grass/`](src/touch-grass/) | `touch-grass-react.html` |
| Journal of Delights | [`src/journal/`](src/journal/) | `journal-of-delights-react.html` |
| Kettlebell Training | [`src/kettlebell/`](src/kettlebell/) | `kettlebell-training-react.html` |

## Companion static pages (part of the current apps)

- `public/touch-grass-react-almanac.html` — Touch Grass almanac
- `public/touch-grass-react-guide.html` — Touch Grass guide
- `public/journal-of-delights-guide.html` — Journal of Delights guide

## First-generation / variant static apps

- `public/touch-grass.html` and its `-nora` / `-vio` editions
- `public/touch-grass-features.html` and its `-nora` / `-vio` editions
- `public/kcd2-codex-v3.html`

## Rules

- **No DS imports.** Everything above owns its own CSS and markup. None of it may
  import from `src/ds/`, so evolving the design system can never restyle a live
  app or page.
- **Out of scope for `/design-sync`.** These are finished apps and resources, not
  reusable components. When the design system is synced to claude.ai/design,
  scope the sync to `src/ds/**` so nothing here is ever swept in.
- **The design system flows one way.** New apps consume `src/ds/`; the existing
  apps and resources here never do.
