# Sol Odyssey — design system

A self-contained design system on the **Claude Design System** convention: semantic
CSS-variable tokens, **light mode only**, a single **Deep Indigo** palette. Deep Indigo sits
between the calm of dark blue and the energy of violet — wisdom, self-mastery, the night sky as
the canvas for a long navigation.

## The one rule

Components consume **semantic tokens, never raw hex**. Tokens are defined once on `:root` in
[`styles/tokens.css`](styles/tokens.css) and mapped into Tailwind in
[`tailwind.config.js`](../../tailwind.config.js) (`theme.extend.colors`, `borderColor`,
`fontFamily`, `borderRadius`, `transitionDuration`), so a class like `bg-accent` resolves to
`var(--color-accent)`. Rebrand the whole app by editing `tokens.css` alone. There is no dark
theme and no `[data-theme]` — light only, by design.

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
| Mono | **JetBrains Mono Variable** | data, labels, eyebrow captions (day counts, IDs) |

Self-hosting keeps the PWA fully offline and removes third-party requests.

## Motion

Tokenized durations — `--motion-fast` 120ms, `--motion-base` 200ms, `--motion-slow` 360ms
(Tailwind `duration-fast/base/slow`). All collapse to ~0 under `prefers-reduced-motion`. Used by
the celebration beat (`.sol-celebrate` keyframe in `styles/index.css`), wizard/page transitions,
and tracker fills.

## Radius & elevation

`--radius-sm/md/lg/pill` and soft indigo `--shadow-sm/md/lg`. Use the tokens, not raw px.

## Components ([`components/`](components/))

The reusable primitives. Each is token-styled, accessible, and app-agnostic — compose screens
from these rather than hand-rolling markup.

| Component | Role |
|---|---|
| `Button` | cva variants `primary` / `secondary` / `ghost`, sizes `sm` / `md`. The action affordance. |
| `Field` | labelled text input (+ `required`, `hint`). Inputs stay ≥16px so mobile Safari never zooms. |
| `Textarea` | labelled multi-line input (+ `required`, `hint`) for rich-text fields. |
| `Select` | token-styled native `<select>` (+ chevron) — accessible, no extra dep. |
| `Switch` | `role="switch"` toggle (Done, sent-to-buddy, Settings guidance toggles). |
| `Modal` | small pop-up; closes on backdrop / × / Esc. Used for the Tracker day note + Harvest confirm. |
| `Notice` | calm full-width message card with an optional action — empty / not-connected / error states. |
| `PageLink` | the **only** affordance for lateral navigation between screens (`Tracker →`, `← back`). |
| `SupportingNote` | optional companion-guidance twisty; renders nothing when guidance is off. |
| `Sparkline` | hand-rolled SVG line (temperature trend) — no charting dependency. |

**Buttons vs links:** buttons are for **actions** (Save, Begin, Harvest); **`PageLink`** (text +
arrow) is for **moving between screens**. Don't mix the two for the same job.

## Icons

Two tiers, by design:

- **Brand mark = bespoke.** The two-tone Deep Indigo compass
  ([`public/sol-odyssey-logo.svg`](../../public/sol-odyssey-logo.svg)) is the logo, favicon, and
  PWA icon. PNGs (192, 512, 512-maskable with safe-zone padding) + the 32px favicon are generated
  from the SVG by `npm run gen:icons`
  ([`scripts/generate-sol-odyssey-icons.mjs`](../../scripts/generate-sol-odyssey-icons.mjs)).
- **UI glyphs = lucide line icons** (`lucide-react`). This is the system's icon set — clean,
  consistent, timeless. Any new utility/section glyph is a lucide icon, given an `aria-label`.
  Nav map: Charter = `ScrollText`, Today = `Sun`, Tracker = `LayoutGrid`, Weekly = `NotebookPen`,
  Stats = `LineChart`, Settings = `Settings`.

## Required-field convention

We build a **robust but flexible** system that never runs the records empty — required **where the
entry IS the practice**, optional **where it's genuinely conditional**.

- Mark a required field with the `required` prop on `Field`/`Textarea` → a small accent `*`.
- Gate the submit button (`disabled`) on a pure validator (`canSaveCheckin`, `canSubmit`,
  `canActivate`) and show an inline `text-caution` message when empty.
- **Required:** the daily *One line*; the Weekly five questions; the Harvest verdict; all Charter
  fields (+ shrink gate). **Conditional:** Weekly *Break Points* (required only if a day was
  missed). **Optional:** *Friction*, *Pairing*, *Risk + Plan*.

## Navigation

- **Order:** Charter · Today · Tracker · Weekly · Stats · Settings. Buttons highlight the active
  route with `bg-accent-soft text-accent`.
- **Context-aware:** the daily-loop tabs (Today/Tracker/Weekly) appear only when an Odyssey is
  Active; Stats only once prior Odysseys exist; Charter + Settings are always present. No dead-end
  tabs.
- **Responsive (target: Samsung S24 PWA):** on phones the bar condenses to **icons** and the logo
  drops its wordmark; text labels + wordmark return at `≥sm`. Settings/Stats are icon-only at every
  width. The header is `sticky`.

## Companion guidance

Optional, unintrusive background notes live in [`content/guidance.ts`](content/guidance.ts) and
render through `SupportingNote` twisties, gated by the `showGuidance` setting (and the Landing page
by `showLanding`). Copy is generically worded — **never name any source of the method** (see
`CLAUDE.md`).

## Hand-rolled visuals

Charts/progress visuals are hand-rolled SVG (no charting dependency) — currently the temperature
`Sparkline`. The six-week ascent/progress profile can follow the same approach when added.
