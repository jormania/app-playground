# app-playground — repo rules

A personal playground for standalone web apps. A few are React + Vite (under
`src/`); the rest are self-contained static HTML files at the repo root. Deploys
to Vercel on every push to `main`.

For the human-readable build playbook — how to start a new app, extend the
design system, and the full process/caveats — see the Notion page **Dev —
Building an App**. This file is its enforced, in-repo companion.

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
| Tempo | `src/tempo/` | plain JSX, builds on `src/ds/` |
| Journal of Delights | `src/journal/` | plain JSX, no type checking |
| Kettlebell Training | `src/kettlebell/` | plain JSX, no type checking |
| Touch Grass | `src/touch-grass/` | plain JSX, no type checking |
| Static HTML apps | repo root (`*.html`) | design-locked, hand-authored — edit in place |

`tsconfig.json` covers the TypeScript code — **`src/sol-odyssey` and
`src/ds`**; `npm run typecheck` type-checks both. The other React apps are plain
JS/JSX by design and intentionally left out.

## Deploy guardrail

Pushing to `main` **auto-deploys via Vercel** — an unreviewed edit can reach
production. Never push with failing tests or type errors. **Stop and confirm with
me before any push to `main`.**
