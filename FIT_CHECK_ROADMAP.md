# Fit Check — Roadmap

Companion to `FIT_CHECK.md` (as-built) and the Notion **Fit Check — App Spec**
page. This file holds everything deliberately **out** of the MVP, and why.

Named by Nora (Product Owner), 2026-08-06.

---

## The MVP, stated as one loop

Everything in the MVP exists to serve a single loop:

> **photograph a garment → it tags itself → pick a mood → get three outfits → wear or skip**

If that loop isn't fun, no additional feature rescues it. If it is fun, the
roadmap below is what to build next, in roughly this order.

### In scope for MVP

- Any number of wardrobes — add, rename, delete, switch on/off (built early;
  see §3 for why)
- Clothing catalogue + photography
- **One-shot** AI tagging (colour, category, warmth, style) at photo time
- Mood selection
- Weather-aware suggestions (`src/shared/weather.ts`, Bucharest fallback)
- Three outfit recommendations — **deterministic scoring, no AI in this path**
- Favourites
- Outfit history (a plain log; "what did I wear")
- Voice: **dictation only** (reuse WhereItWent's `webkitSpeechRecognition`)
- Light/dark themes, responsive, installable PWA
- Demo Mode (no token → local fixtures, WhereItWent's `_demoOr` pattern)

### Explicitly out of MVP

Everything in the numbered sections below.

---

## Hard constraints these plans must respect

1. **`api/*.js` is at 12/12** — the Vercel Hobby cap, counted across the whole
   repo. A 13th top-level function **fails the entire deploy**. Every roadmap
   item below must ship with **zero new serverless functions**, or fold into an
   existing endpoint via an extra query param. This is not negotiable without
   removing another app's endpoint first.
2. **Notion file URLs are short-lived signed S3 links.** See §5 — the caching
   strategy is load-bearing for the whole app, not an optimisation.
3. **AI is one-shot, at the edges.** Photo → tags. Speech → text. Never in the
   recommendation path, which stays deterministic and unit-tested.

---

## 1 · Personalised recommendations

**Deferred because:** it needs history that does not exist yet. With one user and
a handful of outfits a week, there is no statistical signal — anything built now
would be a guess wearing the costume of intelligence, and it would be
untestable.

**Unblocked when:** ~4 weeks of real wear/skip history exists.

**Build as:** transparent deterministic weights, not a model. A garment's score
is nudged by wear count, favourite status, and accept/reject ratio, with each
nudge inspectable. The charter's word is *predictable* — hold to it. Nora should
always be able to ask "why this outfit?" and get a real answer.

**Explicitly not:** embeddings, a learned ranker, or an LLM re-ranking step.

---

## 2 · Conversational voice

**Deferred because:** the "WhereItWent voice architecture" the charter points at
is ~40 lines of `webkitSpeechRecognition` that dictate into a text box, plus a
one-shot LLM parse. There is no session, no context, no multi-turn. Building
that is a **new subsystem**, and it is the highest-risk item in the original
MVP.

**Also:** Web Speech API is Chrome-only, dictation-only, and unreliable in
installed-PWA standalone mode on some Android builds. Both target phones
(Galaxy S24, Poco F3) are Android, so it will work — but it is fragile ground
for a "first-class interaction model."

**MVP ships instead:** a mic button that dictates into the same text field a
keyboard would fill. One shot, no context, no follow-up turns.

**Later, in order:**
1. Voice add — "a blue denim jacket" creates a garment, one shot.
2. Voice correction of the *immediately preceding* action only (a one-item
   context window, not a conversation).
3. Multi-turn refinement of recommendations — only if 1 and 2 prove used.

---

## 3 · Wardrobe management depth

**Now in the MVP** (built early, on purpose — see below): wardrobes are their
own Notion database, any number of them, each add/rename/delete-with-confirm and
switchable on and off, syncing between devices. A garment belongs to as many
wardrobes as it lives in.

Building this before M3 rather than after was the right call: the Garments table
had zero rows, so replacing the old `Home` select with a relation cost nothing.
The same change after real data would have been a migration.

**Still deferred:** bulk reorganise (move twenty things at once). Duplicate is
probably never needed — a garment simply belongs to two wardrobes.

### 3a · Wardrobe ideas worth considering later

Deliberately *not* built, to keep the feature light. In rough order of how much
they'd earn their place:

- ~~**Outfits → Wardrobe relation.**~~ **Done, M5 (2026-08-07).** Added while
  the table was still effectively empty, so no backfill was needed. Populated
  from whichever wardrobe is currently filtered to when a verdict is recorded
  (empty under "All"). "What did I wear at Dad's?" now has a real answer —
  see `FIT_CHECK.md`'s M5 entry.
- **Wardrobes as contexts, not just places.** The data model already allows it
  (a garment in N wardrobes), so nothing blocks "school week", "summer storage"
  or "suitcase for Greece". Resist ever hard-coding *a wardrobe is a house*.
  Costs nothing to keep possible; would cost a lot to retrofit.
- **Reordering by drag.** `order` is a plain number, fine for a handful. Real
  reordering wants fractional ordering (insert at the midpoint between
  neighbours) so a move rewrites one row instead of all of them. Isolated in
  `nextOrder()` for exactly this reason — it's a one-function change.
- **Syncing which wardrobe is selected.** Currently device-local on purpose: the
  filter is a *view* preference, and syncing it makes a phone jump around while
  a tablet is in use. But if "I'm at Dad's this week" becomes a *state* rather
  than a filter, it belongs in Notion. Product question, not a technical one —
  wait for Nora to want it.
- **Icons or colours per wardrobe.** Cheap and tempting. Skipped because every
  wardrobe feature makes this more of a wardrobe database and less of a friend
  that says what to wear. Ten minutes if she asks.

**Known limit, watch rather than fix:** deleting a wardrobe unfiles its garments
one write at a time, paced at Notion's ~3/s. Forty garments is roughly fourteen
seconds, with progress shown. Notion has no bulk relation update, so the honest
options are a background queue or accepting the wait. Accept it until it hurts.

---

## 4 · Outfit history depth

**MVP ships:** a flat log of what was worn, with the date.

**Later:** calendar view, "you haven't worn this in 3 months" nudges, per-garment
wear counts surfaced in the catalogue, packing lists for trips.

---

## 5 · Photo pipeline — the Notion workaround

**The problem:** Notion serves uploaded files as short-lived signed S3 URLs. A
wardrobe is 50–100 garments rendered as a photo grid on *every* screen. Naively
this means re-querying pages to refresh URLs, a slow cold start, and no offline.
WhereItWent stores no images; Journal and Wanderlist store one per entry — so
this repo has never hit the problem at this scale.

**MVP strategy (three layers, no new serverless functions):**

1. **LQIP in a Notion text property.** At upload time, also generate a ~24px-wide
   JPEG, base64 it, and write it to a plain rich-text property on the garment
   row. The grid then paints *instantly* from data the page query already
   returned — zero extra requests, works before any image loads, works offline
   from the first sync.
   > ⚠️ **Needs a spike:** Notion caps a rich-text value at 2000 characters. A
   > 24px JPEG lands roughly 700–1200 base64 chars. Tight but plausible —
   > confirm empirically before committing, and fall back to a solid average
   > colour (a ~20-char hex string, trivially safe) if it doesn't fit.
2. **Full image cached as a Blob in IndexedDB**, keyed by garment id + content
   hash, fetched exactly once through the **existing** `api/notion-photo-proxy.js`.
   Every later render reads from IndexedDB. No signed URL involved, fully
   offline, instant.
3. **Signed-URL refresh only on cache miss** — a re-query of that one page, not
   the whole database.

Net effect: first paint is instant and offline-capable, the expiry problem
touches exactly one code path, and the function count stays at 12.

**Later:** background removal / plain-background normalisation to make the grid
visually consistent. This is genuinely nice and genuinely not MVP.

---

## 6 · Onboarding

**Known wall:** repo convention is bring-your-own-key — no secrets ship in the
repo, the user pastes a Notion integration token and an Anthropic API key into
Settings, stored on-device. That is not a teenager-friendly first run.

**MVP assumption:** Gabriel configures both once on Nora's device; Nora never
opens Settings. Demo Mode is what she sees if that hasn't happened.

**Later:** a QR-based handoff so a configured device can pass its settings to a
second one (`src/shared/qrCode.ts` already exists). Worth revisiting if the app
ever goes to a friend.

---

## 7 · Naming — settled

**Fit Check**, chosen by Nora on 2026-08-06 from a curated five (Costume Quest,
Wearabouts, Fit Check, Layers, Rummage). Naming happened before scaffolding
because the name fixes every one of these:

| Artifact | Value |
|---|---|
| Source folder | `src/fit-check/` |
| Entry HTML | `fit-check-react.html` |
| Manifest | `public/fit-check.webmanifest` |
| Service worker | `fit-check-sw.js` (app-scoped — must not collide) |
| Guide | `public/fit-check-guide.html` |
| Vite input key | `fitCheck` |
| Repo docs | `FIT_CHECK.md`, `FIT_CHECK_ROADMAP.md` |
| Notion | `Fit Check — App Spec`, `Fit Check — Starter Template` |
| Cabinet detection | `watchInstalled('fit-check-react.html')` |

---

## Repo paperwork owed at ship (from the Notion playbook §9)

- [ ] Entry HTML registered in `vite.config.js` → `build.rollupOptions.input`
- [ ] Vercel analytics tag in the entry `<head>`
- [ ] `src/apps-registry.js` entry — **at the top of the array** (index 0 is "Latest")
- [ ] `watchInstalled('<app>-react.html')` in `main.tsx` for Cabinet install detection
- [ ] App-scoped SW + manifest filenames; SW registration gated on `import.meta.env.PROD`
- [ ] `public/<app>-guide.html` — the user guide, written for Nora
- [ ] Notion: App Spec (with front-matter), live DBs under **App Databases**,
      de-personalised **Starter Template**, **App Handover**, and a row in
      **Apps at a glance**
- [ ] `npm test`, `npm run typecheck`, `npx eslint <paths>` all green
- [ ] Push to `main` confirmed with Gabriel first — it auto-deploys to production
