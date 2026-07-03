# Design System (`src/ds/`)

The fresh, reusable design system that **new** apps build on. All existing apps
and resources (see [`LEGACY.md`](../../LEGACY.md)) are out of scope and must never
import from here.

## Layout (grows as the system matures)

```
src/ds/
  tokens.css        ← single source of truth for colour/type/space/radius
  components/        Button, Field, Modal, NumberStepper, Card, SegmentedControl,
                      IconButton … prop-driven, app-agnostic, each with its own
                      .module.css and a render/smoke test
  showcase/           the live workbench rendered at /ds-showcase.html
  index.ts            re-exports everything consumers import
```

## Rules

- **Tokens only, never raw values.** Components read `var(--color-*)`,
  `var(--space-*)`, etc. Rebranding = editing `tokens.css` alone.
- **App-agnostic.** A DS component knows nothing about any specific app. The test:
  could it drop into a totally different app unchanged? If not, it's an app
  screen, not a DS component.
- **Add new components to the showcase.** `/ds-showcase.html` (`npm run dev`,
  then open that path) renders every component in every state with a
  light/dark toggle — it's both the live workbench and the proof a new
  component's API actually works. A future Storybook over these components is
  what would let `/design-sync` publish them to claude.ai/design.

## Status

Seven components shipped and in use by the apps built on this system (Tempo,
Law of the Day, The Cabinet): `Button`, `Field`, `Modal`, `NumberStepper`,
`Card`, `SegmentedControl`, `IconButton`. Each has a CSS Module, a render/smoke
test, and a showcase entry. Extend this list by following the workflow above.
(Sol Odyssey is a "new" app too, but keeps its own self-contained component
set on the Claude Design System convention — see its own `DESIGN.md` — rather
than importing this generic `src/ds/`.)
