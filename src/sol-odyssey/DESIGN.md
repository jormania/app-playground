# Sol Odyssey — design system

The **Claude Design System**: semantic CSS-variable tokens, **light mode only**, a single
**Deep Indigo** palette. Deep Indigo sits between the calm of dark blue and the energy of
violet — wisdom, self-mastery, the night sky as the canvas for a long navigation.

## The one rule

Components consume **semantic tokens, never raw hex**. Tokens are defined once on `:root`
in [`styles/tokens.css`](styles/tokens.css) and mapped into Tailwind in
[`tailwind.config.js`](../../tailwind.config.js) (`theme.extend.colors` etc.), so a class
like `bg-accent` resolves to `var(--color-accent)`. Rebrand the whole app by editing
`tokens.css` alone. There is no dark theme and no `[data-theme]` — light only, by design.

## Palette — Deep Indigo (light)

| Token | Hex | Use |
|---|---|---|
| `--color-background-primary` | `#F7F7FC` | app canvas |
| `--color-background-secondary` | `#EEEEF7` | cards / surfaces |
| `--color-background-tertiary` | `#E3E2F2` | insets / hover |
| `--color-text-primary` | `#1F1B4D` | deep-indigo ink (body, headings) |
| `--color-text-secondary` | `#5C5891` | muted indigo |
| `--color-border-primary` | `#C2BFE3` | strong dividers |
| `--color-border-secondary` | `#D6D4EE` | inputs |
| `--color-border-tertiary` | `#E8E7F5` | hairlines |
| `--color-accent` | `#4B45C6` | brand (buttons, active) |
| `--color-accent-hover` | `#3E38B0` | hover / pressed |
| `--color-accent-contrast` | `#FFFFFF` | text / icon on accent |
| `--color-accent-soft` | `#E7E5FA` | accent-tinted chips / fills |
| `--color-energy` | `#6D63F0` | violet momentum — the celebration beat |
| `--color-success` | `#2E8B73` | calm green — "done" |
| `--color-caution` | `#C2873A` | gentle amber — "missed" (**never red**) |

**Contrast rule:** body text uses `--color-text-primary`, never the accent.

## Typography (self-hosted via `@fontsource`, not a CDN)

| Role | Family | Use |
|---|---|---|
| Display | **Fraunces Variable** (serif) | titles, hero copy |
| Body | **Inter Variable** | body / UI copy |
| Mono | **JetBrains Mono Variable** | data & labels (day counts, IDs) |

Self-hosting keeps the PWA fully offline and removes third-party requests.

## Motion

Tokenized durations — `--motion-fast` 120ms, `--motion-base` 200ms, `--motion-slow` 360ms
(Tailwind `duration-fast/base/slow`). All collapse to ~0 under `prefers-reduced-motion`.
Used for the celebration beat, wizard transitions, and tracker fills (later milestones).

## Radius & elevation

`--radius-sm/md/lg/pill` and soft indigo `--shadow-sm/md/lg`. Use the tokens, not raw px.

## Logo & icons — the compass

The two-tone Deep Indigo compass mark ([`public/sol-odyssey-logo.svg`](../../public/sol-odyssey-logo.svg))
is the logo, favicon, and PWA icon. PNG sizes (192, 512, 512-maskable with safe-zone
padding) + the 32px favicon are generated from the SVG by `npm run gen:icons`
([`scripts/generate-sol-odyssey-icons.mjs`](../../scripts/generate-sol-odyssey-icons.mjs)).

## Hero visual (later)

The six-week ascent / progress profile is a hand-rolled SVG (built when the tracker lands).
