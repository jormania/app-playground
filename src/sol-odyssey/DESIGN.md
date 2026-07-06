# Sol Odyssey — design system

A self-contained design system on the **Claude Design System** convention: semantic
CSS-variable tokens with **eight palette presets — four light + four dark**. **Deep Indigo**
(light + dark) is the brand anchor — between the calm of dark blue and the energy of violet:
wisdom, self-mastery, the night sky as the canvas for a long navigation. Alongside it are six
palettes ported from well-known VS Code themes (see *Presets* below).

## The one rule

Components consume **semantic tokens, never raw hex**. Tokens are defined in
[`styles/tokens.css`](styles/tokens.css) and mapped into Tailwind in
[`tailwind.config.js`](../../tailwind.config.js) (`theme.extend.colors`, `borderColor`,
`fontFamily`, `borderRadius`, `transitionDuration`), so a class like `bg-accent` resolves to
`var(--color-accent)`. `:root` holds the **structural** tokens (radius / motion / shadows) plus
the default palette; each **preset** is a full colour set under `[data-theme="<id>"]` on `<html>`
(same file). Add or rebrand a palette by editing `tokens.css` alone — components need no change.
The chosen preset lives in a shared `localStorage` key (`sol-odyssey:theme`, see
[`lib/theme.ts`](lib/theme.ts) / [`themeContext.tsx`](lib/themeContext.tsx)); a `storage` listener
keeps open pages in sync and a pre-paint inline script in the entry HTML avoids any flash.

## Presets

Eight palettes, in **cycle order** — the header button (top-right, `Sun`/`Moon`) steps through
them and each press flips light↔dark; Settings → Appearance picks one directly from a swatch grid.
Default **Deep Indigo · Light**.

| # | id | Palette | Mode |
|---|----|---------|------|
| 1 | `indigo-light` | Deep Indigo | light |
| 2 | `indigo-dark` | Deep Indigo | dark |
| 3 | `quiet-light` | Quiet Light | light |
| 4 | `octagon` | Monokai Pro · Octagon | dark |
| 5 | `filter-sun` | Monokai Pro · Sun | light |
| 6 | `ristretto` | Monokai Pro · Ristretto | dark |
| 7 | `solarized-light` | Solarized Light | light |
| 8 | `spectrum` | Monokai Pro · Spectrum | dark |

**One mapping discipline across all eight** keeps them a single system: **accent** = the palette's
violet/purple (brand continuity), **energy** = its pink/magenta (the celebration beat), **success**
= green, **caution** = orange/amber (**never red**), body text = `--color-text-primary` (never the
accent). Dark palettes flip the accent lighter with a **dark** `--color-accent-contrast`, so accent
reads as text on the dark canvas and accent-filled buttons stay legible.

The **field guide** keeps its own Deep Indigo look and only follows the active preset's **mode**
(any dark preset id → its dark palette). It always **prints light** — dark rules are `@media
screen` only.

## Anchor palette — Deep Indigo (light)

The default preset and semantic reference — the other seven follow the same token roles (the six
new palettes' exact hexes live in [`styles/tokens.css`](styles/tokens.css)).

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
| `Modal` | small pop-up; closes on backdrop / × / Esc. Used for the Tracker day note, Harvest confirm, and discard-draft confirm. |
| `Notice` | calm full-width message card with an optional action — empty / not-connected / error states. |
| `PageLink` | the **only** affordance for lateral navigation between screens (`Tracker →`, `← back`). |
| `SupportingNote` | optional companion-guidance twisty; renders nothing when guidance is off. |
| `Sparkline` | hand-rolled SVG line (temperature trend) — no charting dependency. |
| `PlannedOdyssey` | `PlannedOdysseyCard` (full draft state) + `PlannedOdysseyStrip` (compact "lined up for next"). |
| `CompanionPanel` | the optional AI reflective companion — quiet `accent-soft` card, visually distinct from buddy elements. |
| `StateCheckin` | the optional, ephemeral pre-check-in state ritual — dashed-border card, distinct from both the real check-in and the companion. |
| `CommitmentCard` | set/edit the optional forfeit-on-lapse contract (commitment device) on an Odyssey. |
| `BuddyEmailButton` | one consistent "copy this email → open Gmail" affordance (rich clipboard) used at every contact point + the welcome package. |
| `ActionPrompt` | calm-but-clear "do something elsewhere" nudge — icon in a softly-pulsing ring + CTA; `soft`/`solid`. |

**Buttons vs links:** buttons are for **actions** (Save, Begin, Harvest); **`PageLink`** (text +
arrow) is for **moving between screens**. Don't mix the two for the same job.

## Icons

Two tiers, by design:

- **Brand mark = bespoke, and palette-aware in-app.** The compass. In the header it's an inlined
  token-driven component ([`components/Logo.tsx`](components/Logo.tsx)) that **tints with the active
  preset** — structure on `--color-accent`, the north point + centre dot on `--color-energy`, the
  hub on `--color-background-primary` — so it belongs to every palette, not just Deep Indigo. The
  standalone [`public/sol-odyssey-logo.svg`](../../public/sol-odyssey-logo.svg) stays fixed Deep
  Indigo: it's the favicon + PWA-icon source (outside the themed surface). PNGs (192, 512,
  512-maskable with safe-zone padding) + the 32px favicon are generated from it by `npm run
  gen:icons` ([`scripts/generate-sol-odyssey-icons.mjs`](../../scripts/generate-sol-odyssey-icons.mjs)).
  Keep the inline component and the static file in visual step.
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
  Active; **Stats** only once an Odyssey has been **completed** (harvested → Maintenance/Completed/
  Retired); Charter + Settings are always present. No dead-end tabs. The synopsis **Export** is an
  action *on the Stats page* ("Save as a page"), not a toolbar item — toolbar glyphs only navigate.
- **Responsive (target: Samsung S24 PWA):** on phones the bar condenses to **icons** and the logo
  drops its wordmark; text labels + wordmark return at `≥sm`. Settings/Stats are icon-only at every
  width. The header is `sticky`.

## Odyssey lifecycle (Status model)

An Odyssey row's `Status` select drives the whole app. The lifecycle:

- **Planning** — a draft Charter, prepared ahead of time. Carries the charter fields but **no
  `Odyssey Number`** (assigned at activation, so an abandoned draft never burns one). At most one
  draft at a time; it can be edited/resumed in the wizard and **may coexist with an Active
  Odyssey** (you can line up the next one), but is begun only by an explicit action.
- **Active** — the one Odyssey under way. Law I: exactly one Active at a time. Drives the daily
  loop (Today/Tracker/Weekly).
- **Maintenance / Completed / Retired** — the three harvested end-states (Keep / Grow / Retire).
  `isHarvested` treats these as "completed"; they feed Stats + the Export synopsis.

Surfaces: the wizard's review step offers **Begin the Odyssey** + **Save as planned** when nothing
is Active, or **Save as planned** only when one is (with a note that it can be begun after harvest).
A draft is shown by `PlannedOdysseyCard` (full, when nothing is Active — Begin / Continue editing /
Discard) and `PlannedOdysseyStrip` (compact "lined up for next", when an Odyssey is Active). Begin
assigns the number and PATCHes the draft → Active; Discard archives it to Notion Trash. Planning is
not harvested, so drafts never leak into Stats, numbering, or the "first vs next" home copy.

## Companion guidance

Optional, unintrusive background notes live in [`content/guidance.ts`](content/guidance.ts) and
render through `SupportingNote` twisties, gated by the `showGuidance` setting (and the Landing page
by `showLanding`). Copy is generically worded — **never name any source of the method** (see
`CLAUDE.md`).

## AI companion (optional)

A gentle, **opt-in** reflective witness ([`lib/companion.ts`](lib/companion.ts),
[`components/CompanionPanel.tsx`](components/CompanionPanel.tsx)) shown at the app's reflective
moments — the daily check-in, the weekly reflection, the safety line, and Harvest — wherever the
user has written something to reflect on (a quiet hint appears before that so it's discoverable). It
runs only when the user has supplied an **Anthropic key** (Settings, on-device) and toggled it on. The call goes
**straight from the browser to Anthropic** under the user's key — the same direct-browser pattern as
Touch Grass; no server, no relay, nothing stored. Reflections are **ephemeral** (never written to
Notion). The `system` prompt is the safety surface: it keeps the companion attribution-free,
non-prescriptive, and clearly **not the human buddy** (which stays the heart of the process). The
panel is styled to read as a quiet aside — distinct from the buddy fields so the two never blur.

## State check-in (opt-in, ephemeral, on-device)

An **optional**, on-device-only micro-ritual (`lib/stateCheckin.ts` + `components/StateCheckin.tsx`)
shown on Today, above the daily check-in section, gated by `settings.stateCheckinEnabled` (off by
default, toggled in its own Settings section). It's a private thirty-second moment: name your
current state from a fixed word list, gauge its intensity, take a breath, then choose the state
you'd rather have — a small, deliberate act of noticing before you act. Selections are plain local
`useState` inside `StateCheckin` (keyed to remount fresh each day via `key={today}` on Today) —
**never wired into `CheckinDraft`, never sent to Notion, no network call at all**. Styled with a
dashed border (`border-dashed border-tertiary bg-background-secondary`) deliberately distinct from
both the real, Notion-persisted check-in section and the AI companion's `accent-soft` card, so it's
never confused with either.

**Renders on Today only, not Weekly** — a deliberate scope decision: the ritual pairs with the
moment right before daily action, not a once-a-week look-back, and Weekly already carries five
questions plus two optional sections. A future milestone could reconsider a lighter Weekly mention,
but it should stay a one-liner, not a duplicate of the full ritual.

## Commitment device (forfeit-on-lapse)

An **optional** pre-Day-1 pledge: one consequence you choose for yourself if you ever miss two days
running. Set/edited via `CommitmentCard` ([components/CommitmentCard.tsx](components/CommitmentCard.tsx))
on Overview + pre-start Today, stored in a `Commitment` rich-text property on the Odysseys database
(the one schema column this feature adds — written defensively by `writeCommitment` so a missing
column never breaks creating an Odyssey, and explains how to add it). It's surfaced **where it
bites**, on Today: when a single gap opens (`shouldWarnDontSkipTwice`) as a reminder, and when the
line is crossed (`forfeitDue` — two missed days after the practice was under way) as a calm "honour
it and rejoin" notice. The app **witnesses and reflects; it never enforces, handles money, or
notifies**. When the companion is enabled, it can reflect in-role on the forfeit you drafted and at
the lapse (`buildContractCompanionPrompt` / `buildLapseCompanionPrompt`).

## Reminders (opt-in, local, best-effort)

Four optional nudges — **daily** (log, at the Daily check-in time), **weekly** (reflect, at the
Weekly call slot), **start** (a planned Odyssey's start date arrived), and **harvest** (Day 42
reached) — surfaced as local notifications. **No server, no push service**; nothing is sent on the
user's behalf. Mechanism mirrors Touch Grass: `public/sol-odyssey-notify.js` is pulled into the
generated worker via `workbox.importScripts`, and on a **Periodic Background Sync** wake it reads a
shared IndexedDB snapshot ([`lib/reminders.ts`](lib/reminders.ts), written by
[`lib/useReminderSync.ts`](lib/useReminderSync.ts) on Today/Weekly) and fires whatever is due —
**suppressed** once that day/week is done, once-per-event for start/harvest. The decision logic is
pure and unit-tested; the worker reimplements the same minimal logic inline. **Honest limits:**
background delivery is Chromium + installed-PWA only and best-effort on timing; iOS can't run it
without a server, so it degrades to the in-app surfaces (Settings states this plainly). Opt-in via a
`remindersEnabled` toggle that requests notification permission.

## Buddy emails (copy rich text → Gmail)

At each buddy-contact point — **daily** (Today), **weekly** (Weekly), **kickoff** (start), and
**harvest** (Day 42), plus the one-time **welcome package** (Settings) — a single `BuddyEmailButton`
copies a formatted note to the clipboard, then opens a compose window pre-addressed; the user
**pastes** the body and sends. **The app sends nothing.** The *body* is never carried by a URL (a
compose URL can't hold formatted HTML) — only the recipient + subject are, and the rich note rides
the clipboard.

How it works:
- [`lib/buddyMail.ts`](lib/buddyMail.ts) (pure + tested) builds each email as **structured content**
  — `{ heading, greeting, intro, sections[], outro }`, each section a list of `{ emoji, label,
  value }` rows. Optional fields drop out when empty. Field-by-field *explanations for the buddy* are
  NOT in the recurring notes — they live once in `buddyWelcomeEmail`, so the daily/weekly emails stay
  short.
- `harvestBuddyMail` takes an optional trailing `passItOn?: string` (mirrors `weeklyBuddyMail`'s
  `newTinyVersion?`) — a one-line note for whoever runs their own Odyssey next, written on the
  Harvest page's post-harvest screen. Local-only (plain `useState`, never sent to Notion); it
  travels only in that one email and drops out of the row list when empty.
- `BuddyEmailButton` renders that model into an **off-screen rich template** (`RichEmail`) and writes
  two clipboard flavours via `navigator.clipboard.write([new ClipboardItem(...)])`: `text/html` from
  the template's `.innerHTML` (inline-CSS only, **no SVGs/images** — mail clients strip them; accents
  are Unicode emojis + a `border-left` rail), and `text/plain` from the **deterministic**
  `emailToPlainText(email)` (not `.innerText` — layout-independent and unit-testable). Degrades:
  `ClipboardItem` → `writeText` → `execCommand('copy')`. After copy it tells the user to paste (Ctrl/⌘+V).
- **Compose hand-off** (strategy only — same content either way) is chosen by `composeTarget(provider,
  isMobile, …)`: a `{ url, viaLocation }` pair. **Mobile** (`isMobile()`, incl. iPadOS via touch
  points) always uses `mailtoUrl` via `location.href` — the webmail *web* URLs deep-link into the app's
  inbox and drop the compose params there, whereas `mailto:` opens the native app straight in compose.
  **Desktop** follows `Settings.mailProvider`: `gmail` → `gmailComposeUrl` (new tab; a manual link is
  shown if the popup is blocked), `outlook` → `outlookComposeUrl`, `default` → `mailtoUrl` (OS client).
  The rich note is always on the clipboard first, so a non-Gmail user is never stuck — the confirmation
  says so explicitly.
- Subjects carry the Odyssey + the named action **and the runner's own name** (`Settings.userName`,
  a field beside the buddy fields) so the buddy sees who it's from. The "Sent to my buddy" /
  "Reflected with my buddy" toggles stay manual. Disabled with a Settings nudge until a valid buddy
  email is on file.

## Hand-rolled visuals

Charts/progress visuals are hand-rolled SVG (no charting dependency) — currently the temperature
`Sparkline`. The six-week ascent/progress profile can follow the same approach when added.
