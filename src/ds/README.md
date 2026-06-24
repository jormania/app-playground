# Design System (`src/ds/`)

The fresh, reusable design system that **new** apps build on. All existing apps
and resources (see [`LEGACY.md`](../../LEGACY.md)) are out of scope and must never
import from here.

## Layout (grows as the system matures)

```
src/ds/
  tokens.css        ← single source of truth for colour/type/space/radius
  components/        (next: Button, Card, Modal, Icon … prop-driven, app-agnostic)
  index.js           (will re-export everything consumers use)
```

## Rules

- **Tokens only, never raw values.** Components read `var(--color-*)`,
  `var(--space-*)`, etc. Rebranding = editing `tokens.css` alone.
- **App-agnostic.** A DS component knows nothing about any specific app. The test:
  could it drop into a totally different app unchanged? If not, it's an app
  screen, not a DS component.
- **One workbench later.** A Storybook over these components is what makes
  `/design-sync` able to publish them to claude.ai/design.

## Status

Bootstrapped: tokens only. Next step is extracting the first real components.
