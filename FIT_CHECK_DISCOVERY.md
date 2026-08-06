# Fit Check — Repository Discovery Report

**Status:** awaiting approval. Nothing scaffolded yet.
**Date:** 2026-08-06 · **Product Owner:** Nora · **Technical Reviewer:** Gabriel

Charter workflow steps 1 (Repository Discovery), 7 (Technical Architecture) and
8 (Roadmap). Steps 2–6 (Product Spec, IA, Screen Flow, Notion Schema detail,
Component Hierarchy) follow approval, since several depend on product answers
only Nora can give.

Deferred scope lives in [`FIT_CHECK_ROADMAP.md`](FIT_CHECK_ROADMAP.md).

---

## 1 · Observations

The repository is more mature than "playground" suggests. Conventions are
written down (`CLAUDE.md`, the Notion **Dev — Building an App** playbook) *and*
enforced (`src/ds/boundary.test.js` fails the suite on a violation). There are
183 test files and 2117 passing tests. The right instinct here is to find the
existing answer, not invent one.

Four findings shape the whole build:

### 1.1 The serverless function budget is exhausted — 12 of 12

Vercel Hobby caps deployments at 12 serverless functions **counted across the
entire repo**, and `ls api/*.js | grep -v '^api/_'` returns exactly 12. A 13th
file fails the deploy for *every app*, not just this one. Git history shows this
has already bitten once (~2026-07-23).

**Consequence:** Fit Check ships with **zero new API functions**. Verified
achievable — see §2.

### 1.2 Notion `multi_select` is closed-vocabulary, and this collides with AI tagging

Writing an unregistered `multi_select` option returns 400 and **rejects the
entire property patch atomically** — unrelated fields in the same write fail
silently alongside it. This is recorded from a prior Click Deck incident.

This is the single most dangerous interaction in the proposed design, because
the charter's AI auto-tagging will happily invent `"dusty rose"` or
`"cottagecore-adjacent"` and take the whole garment write down with it.

**Consequence:** the AI is given a **fixed closed vocabulary** in its prompt and
its output is **validated against that vocabulary client-side before any write**.
Anything unrecognised is dropped, not passed through. Non-negotiable, and it
gets a dedicated unit test.

### 1.3 The "voice architecture" the charter cites doesn't exist

`SmartTextEntry.jsx:24` is ~40 lines of `webkitSpeechRecognition` dictating into
a textarea, whose contents are then parsed one-shot by Haiku. No session, no
context, no multi-turn. Already addressed — MVP voice is dictation only.

### 1.4 Weather lived inside a design-locked app

Resolved this session with Gabriel's approval: the objective model is now
`src/shared/weather.ts` (typed, typechecked, tested); Touch Grass keeps its prose
in a thin wrapper with an unchanged public API. Its original test file passes
untouched. Full suite green.

---

## 2 · Reusable assets

Per the charter's requirement to declare reuse / extend / new for each subsystem:

| Subsystem | Verdict | What exactly |
|---|---|---|
| Notion relay | **Reuse** | `api/notion.js` — stateless, BYO-token, app-agnostic |
| Photo upload | **Reuse** | `api/notion-upload.js` — generic multipart relay |
| Photo read-back | **Reuse** | `api/notion-photo-proxy.js` — host-allowlisted, no token |
| Photo resize | **Extend** | `src/wanderlist/photo.js` → promote to `src/shared/photo.ts` (same move as weather; it's already been copied once from Journal, so it has earned promotion) |
| Weather | **Done** | `src/shared/weather.ts` ✅ |
| Design system | **Reuse** | `src/ds/` — 11 components + `tokens.css`. CSS Modules, **no Tailwind** |
| Demo Mode | **Reuse** | WhereItWent's `_demoOr` — no token ⇒ local fixtures. Not a user-facing toggle |
| Notion client | **Extend** | Model on `lib/notionClient.js`: retry/backoff, 350ms write spacing, `NotionError`, non-2xx throws |
| Safe storage | **Reuse** | `src/where-it-went/lib/storage.js` → promote to `src/shared/storage.ts` |
| AI call | **Extend** | `aiParser.js`'s `callClaude` — direct browser call, `claude-haiku-4-5-20251001`, AbortController timeout. **No serverless function needed** |
| Voice dictation | **Reuse** | The `webkitSpeechRecognition` block, incl. its error handling for `no-speech` / `not-allowed` |
| PWA | **Reuse** | App-scoped `fit-check-sw.js` + manifest; registration gated on `import.meta.env.PROD` |
| Install detection | **Reuse** | `watchInstalled('fit-check-react.html')` from `src/shared/installFlag.ts` |
| IndexedDB | **Reuse** | `idb-keyval` (already a dependency) for the image cache |
| Testing | **Reuse** | Vitest. `npm test` sets `--no-experimental-webstorage` — running `vitest` bare breaks every storage test |
| Navigation | **New** | WhereItWent's `Navigation.jsx` is app-specific, not a DS component |
| Recommender | **New** | Pure deterministic module, `src/fit-check/lib/recommend.ts` |
| Image cache layer | **New** | `src/fit-check/lib/imageCache.ts` — see §4.3 |

**Genuinely new: three modules.** Everything else is reuse or a small promotion.

---

## 3 · Assumptions

1. **TypeScript**, per playbook §1 ("new apps default to TypeScript"). WhereItWent
   is JSX and excluded from typecheck; Fit Check will be in `tsconfig.json`.
   Charter says study WhereItWent but never specifies a language.
2. **Gabriel configures both keys once** on Nora's device. She never opens
   Settings; Demo Mode covers the unconfigured case.
3. **Home A / Home B are two physical homes** Nora moves between, and she'll want
   to name them herself rather than live with "A" and "B".
4. **Wardrobe scale is 50–150 garments**, not thousands. Drives the caching
   design and rules out pagination complexity.
5. **English UI**, per charter — despite the Bucharest weather fallback.
6. **Two Notion databases** (Garments, Outfits) is the minimum honest schema.
7. **Android Chrome is the real target** (Galaxy S24, Poco F3); desktop stays
   excellent but is not where this gets used.

---

## 4 · Proposed architecture

### 4.1 Placement

```
src/fit-check/           main.tsx · App.tsx · index.css
  components/            screens + app-specific UI
  lib/                   recommend.ts · imageCache.ts · tagging.ts
                         notionClient.ts · vocabulary.ts
  models/                demoData.ts
fit-check-react.html     entry, registered in vite.config.js
public/fit-check.webmanifest · fit-check-sw.js · fit-check-guide.html
```

Promotions into `src/shared/`: `photo.ts`, `storage.ts` (weather already done).

### 4.2 Data flow

```
Nora ──tap/dictate──► React (src/ds components)
                        │
                        ├─► recommend.ts        pure, deterministic, unit-tested
                        │     ▲ weather (shared/weather.ts) + mood + wardrobe
                        │
                        ├─► imageCache.ts ──► IndexedDB (idb-keyval)
                        │                       └─miss─► api/notion-photo-proxy
                        │
                        ├─► notionClient.ts ──► api/notion ──► Notion
                        │                        (BYO token, on-device)
                        │
                        └─► tagging.ts ──► api.anthropic.com (direct, Haiku)
                                             └─► validated against vocabulary.ts
```

No new serverless functions. AI touches two edges only — photo→tags and
speech→text — and never the recommendation path.

### 4.3 The image strategy (the load-bearing decision)

Notion serves uploads as short-lived signed S3 URLs. A 100-garment photo grid on
every screen would mean constant URL refreshes, slow cold start, no offline.

Three layers:

1. **LQIP in a Notion rich-text property.** A ~24px JPEG, base64'd, written at
   upload time. The grid paints instantly from data the page query *already
   returned* — zero extra requests, works offline from first sync.
   ⚠️ **Spike required:** Notion caps rich text at 2000 chars; a 24px JPEG lands
   ~700–1200. Plausible, unconfirmed. Fallback: average colour as a hex string
   (~20 chars, trivially safe). **This spike is the first task of Milestone 2**
   and the fallback is fully acceptable.
2. **Full image as a Blob in IndexedDB**, keyed by garment id + content hash,
   fetched once through the existing proxy. All later renders skip Notion.
3. **Signed-URL refresh only on cache miss** — one page re-query, not the DB.

### 4.4 Notion schema (sketch — detailed in step 5 post-approval)

**Garments** — Name (title) · Photo (files) · Thumb (rich_text, LQIP) ·
Category (select) · Colours (multi_select ⚠️ closed vocab) · Warmth (select:
Light/Mid/Warm) · Style (multi_select ⚠️) · Home (select: A/B/Both) ·
Favourite (checkbox) · Wear Count (number) · Last Worn (date) · Active (checkbox)

**Outfits** — Name (title) · Date (date) · Garments (relation → Garments) ·
Mood (select) · Weather (rich_text snapshot) · Verdict (select: Worn/Skipped) ·
Favourite (checkbox)

Every `multi_select` and `select` option is **pre-registered** at database
creation from `vocabulary.ts`, which is also what constrains the AI prompt. One
source of truth, enforced by test.

### 4.5 Recommendation engine

Pure function: `(wardrobe, weather, mood, history) → Outfit[3]`. Scores garments
on warmth-vs-temperature fit, rain/wind suitability, mood match, colour
compatibility, and a mild recency penalty so the same shirt isn't suggested
daily. Fully deterministic, fully unit-testable, instant, works offline. No LLM.

---

## 5 · Open questions

**For Nora** (one at a time, in her language — not all at once):
1. What should the two homes be called?
2. What moods should the app offer? (I'll propose ~6 and let her cut/rename.)
3. When an outfit isn't right, is it "not today" or "never again"?

**For Gabriel:**
4. **Which Notion workspace parent** for the two DBs under **App Databases**? I
   have MCP access and can create them, but placement is yours.
5. **Anthropic key** — Nora's own, or yours on her device? Affects nothing
   technically; affects who sees the spend.
6. **Promotions to `src/shared/`** — `photo.ts` and `storage.ts` follow the same
   pattern you approved for weather. Confirm and I'll do them in Milestone 1.
7. **Tempo, Loom and Yoru have no PWA entries in `vite.config.js`** — only Sol
   Odyssey and Click Deck use `VitePWA`; WhereItWent hand-writes its worker.
   Which pattern do you want for Fit Check? I'd hand-write it (simpler, matches
   the most recent app).

---

## 6 · Proposed milestones

Charter rule: one milestone at a time, stop for review after each.

| # | Milestone | Delivers | Notably excludes |
|---|---|---|---|
| **1** | **Skeleton** | Scaffold, DS wiring, PWA, theme, nav, Settings, Demo Mode, Notion client + the two DBs. Wardrobe grid renders from demo fixtures | photos, AI, weather |
| **2** | **Photos** | Camera capture, resize, upload, LQIP spike, IndexedDB cache, capture guidance | AI |
| **3** | **Tagging** | One-shot Haiku photo→tags, vocabulary validation, manual correction UI | — |
| **4** | **The point** | Weather + mood + deterministic 3-outfit recommender | personalisation |
| **5** | **The loop closes** | Wear/skip, favourites, history log, dictation | conversational voice |
| **6** | **Ship** | Guide, Notion paperwork, a11y + mobile polish on both target phones | — |

**Milestone 4 is where the app becomes real.** 1–3 exist to make 4 possible.
If schedule pressure appears, cut from 5, never from 4.

---

## 7 · Definition of done (playbook §9)

- [ ] `npm test`, `npm run typecheck`, `npx eslint <paths>` green
- [ ] Entry in `vite.config.js`; Vercel analytics tag in `<head>`
- [ ] `src/apps-registry.js` entry at **index 0** (that's "Latest")
- [ ] `watchInstalled('fit-check-react.html')` in `main.tsx`
- [ ] SW registration gated on `import.meta.env.PROD`
- [ ] `public/fit-check-guide.html`, written for Nora
- [ ] Notion: App Spec, live DBs, de-personalised Starter Template, Handover,
      row in **Apps at a glance**
- [ ] `api/*.js` still ≤ 12
- [ ] Push to `main` confirmed with Gabriel — it auto-deploys to production
