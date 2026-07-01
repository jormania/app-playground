# app-playground — repo rules

A personal playground for standalone web apps. A few are React + Vite (under
`src/`); the rest are self-contained static HTML files at the repo root. Deploys
to Vercel on every push to `main`.

## Before declaring any task done

Run **`npm test`** and **`npm run typecheck`** and make sure both pass. Don't
call a change complete on green-looking code alone.

## Design-system boundary (one-way, enforced)

- **New apps** build on the shared design system in [`src/ds/`](src/ds/).
- **Legacy apps** — `src/touch-grass/`, `src/journal/`, `src/kettlebell/` — are
  design-locked and own their own styling. They **never import from `src/ds/`**.
- The rule flows one way: DS → new apps only. It's enforced by
  [`src/ds/boundary.test.js`](src/ds/boundary.test.js) in `npm test` — a legacy
  import fails the suite. See [`LEGACY.md`](LEGACY.md) for the full scope.

## Per-app map

| App | Location | Type |
|-----|----------|------|
| Sol Odyssey | `src/sol-odyssey/` | **strict TypeScript** — has its own [`CLAUDE.md`](src/sol-odyssey/CLAUDE.md) + `DESIGN.md`; **defer to those** inside that dir |
| Journal of Delights | `src/journal/` | plain JSX, no type checking |
| Kettlebell Training | `src/kettlebell/` | plain JSX, no type checking |
| Touch Grass | `src/touch-grass/` | plain JSX, no type checking |
| Static HTML apps | repo root (`*.html`) | design-locked, hand-authored — edit in place |

`tsconfig.json` intentionally covers **only `src/sol-odyssey`**; `npm run
typecheck` type-checks that app alone. The other React apps are plain JS/JSX by
design.

## Deploy guardrail

Pushing to `main` **auto-deploys via Vercel** — an unreviewed edit can reach
production. Never push with failing tests or type errors. **Stop and confirm with
me before any push to `main`.**
