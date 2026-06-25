# Sol Odyssey — build rules

Sol Odyssey is an online client + engine for a six-week behaviour-change method ("an
**Odyssey**"), with **Notion as the system of record**. Source of truth is the Notion spec
*"Sol Odyssey — App Spec & Architecture Review"* (it wins over the PDF field manual on any
conflict). These rules are non-negotiable — apply them to every change here.

## Hard rules

1. **No attribution, ever.** Never name any source of the method — no people, books,
   organizations, programs, or materials — in code, UI, comments, docs, or data. Describe
   techniques generically only.
2. **Single-user MVP.** One owner. The human buddy is **name + email only** — no messages,
   emails, templates, or comms screens. No in-app guide. **No dark mode** (light only). Build only
   what the current milestone scopes; deferred features live in the spec's Roadmap. *(Post-MVP, both
   opt-in: an **AI reflective companion** — not an AI buddy; it never messages, coaches, or replaces
   the human buddy — and **local reminders** — see below. Reminders are local, best-effort
   notifications only: no server, no push service, nothing sent on the user's behalf or to the
   buddy.)*
3. **No hardcoded credentials.** The app ships with **no Notion token and no database/data-
   source IDs**. The user enters them in **Settings**, stored on-device
   (`localStorage`, see `lib/settings.ts`). Nothing secret goes in the repo, the build, or
   env vars.
4. **Notion only via the relay.** The browser can't call Notion directly (CORS). All calls
   go through the stateless [`/api/notion`](../../api/notion.js) relay, which holds no
   secret and stores nothing — it forwards the per-request `x-notion-token`. The relay is
   **shared** with another app and pins Notion-Version `2022-06-28` (the classic, stable
   API). We use `databases/{id}/query` to read and `parent.database_id` to write, so the
   user only needs a **database link** — Settings accepts a pasted URL or a bare ID and
   `normalizeNotionId()` (in `lib/notion.ts`) reads the ID out of it.
5. **Design = Claude Design System, light only.** Every colour/radius/duration is a
   semantic `--color-*` / `--radius-*` / `--motion-*` token (`styles/tokens.css`); components
   read the mapped Tailwind names, **never raw hex**. Body text is `--color-text-primary`,
   never the accent. See `DESIGN.md`.

## Design-system boundary (repo convention)

This app's tokens follow the spec's **Claude Design System** convention
(`--color-background-primary`, …) and are **self-contained** under `src/sol-odyssey/`. It
does **not** import the repo's generic `src/ds/` tokens (a different convention), so the
`LEGACY.md` one-way boundary is untouched. As a new design-system app, its index card is
flagged `ds: true` (no "Legacy" chip).

## File map

```
sol-odysseys-react.html          ← entry (repo root; Vite multi-entry input)
api/notion.js                    ← shared stateless relay (reused, version-override added)
public/sol-odyssey-logo.svg      ← compass mark (logo + favicon source)
public/sol-odyssey-icon-*.png    ← generated PWA icons (npm run gen:icons)
scripts/generate-sol-odyssey-icons.mjs
src/sol-odyssey/
  main.tsx                       ← React root + QueryClient + SW registration
  App.tsx                        ← M1 shell (header + Settings)
  pages/Settings.tsx             ← token + 3 data-source IDs + buddy; "Test connection"
  lib/settings.ts                ← on-device settings (pure; tested)
  lib/notion.ts                  ← relay request builders + listActiveOdysseys (pure core; tested)
  lib/cn.ts                      ← clsx + tailwind-merge helper
  components/{Button,Field}.tsx  ← token-styled primitives
  styles/{tokens,fonts,index}.css
  *.test.ts                      ← Vitest (node env)
```

## Milestones

The spec defines 6 milestones; **M1 (this one)** = scaffold + design system + relay +
Settings/"Test connection" + docs + tests. **Stop after each milestone for review.** Do
not build ahead (charter wizard, Today/tracker, weekly reflection, offline queue, harvest).

**Post-MVP shipped:**
- **Planning (draft) Odyssey** lifecycle stage (moved from the spec's Roadmap). A Charter can be
  saved as a `Status='Planning'` draft (no `Odyssey Number` until activation), edited/resumed, and
  may coexist with an Active Odyssey; "Begin" PATCHes it → Active. See the lifecycle section in
  `DESIGN.md`.
- **Optional AI reflective companion** (`lib/companion.ts`, `components/CompanionPanel.tsx`). A
  **bring-your-own Anthropic key** (Settings, on-device) + opt-in toggle; the call goes **directly
  from the browser** to Anthropic (the same pattern as Touch Grass — no server, no relay, no stored
  secret). It's a brief **reflective witness** across the reflective moments (daily check-in, weekly
  reflection, safety line, Harvest): mirrors back your words, asks at most one gentle question,
  **ephemeral** (never written to Notion). The `system` prompt is the safety surface —
  attribution-free, never prescriptive, never poses as or replaces the human buddy.
- **Commitment device — forfeit-on-lapse contract** (`components/CommitmentCard.tsx`,
  `lib/useCommitment.ts`; `writeCommitment`/`forfeitDue`). An **optional** pledge (one consequence
  for missing two days running), set pre-Day-1, surfaced on Today at the wobble/lapse. Stored in an
  optional **`Commitment` rich-text column** the user adds to the Odysseys DB (the only schema
  addition; written defensively so its absence never breaks anything). The app **witnesses; it never
  enforces, handles money, or notifies.** The companion may reflect in-role on the forfeit/at the lapse.
- **Opt-in local reminders** (`lib/reminders.ts`, `lib/useReminderSync.ts`,
  `public/sol-odyssey-notify.js`; `remindersEnabled`). Four nudges — daily/weekly/start/harvest — via
  **Periodic Background Sync** reading a shared IndexedDB snapshot (the same pattern as Touch Grass's
  `public/sw.js`). **No server, no push service.** Background delivery is Chromium + installed-PWA
  only and best-effort; degrades to the in-app surfaces elsewhere. Reuses `dailyTime`/`weeklySlot`.
