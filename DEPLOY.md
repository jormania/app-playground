# Deploying — Vercel's limits and how this repo stays inside them

Moved from the root `CLAUDE.md`'s deploy guardrail on 2026-10-25. The root keeps the
rules themselves (confirm before pushing to `main`, don't poll Actions, the
12-function cap, no bare `@fontsource` imports); this file has the detail behind
them. Read it before adding an `api/*.js` file, a font import or a dependency that
ships assets.

## The 12-function cap

**Vercel Hobby caps a deployment at 12 serverless functions, counted across the
entire repo** — every top-level `api/*.js` file is one function, regardless of app
(files under `api/_*` don't count). Before adding a new `api/*.js`, run
`ls api/*.js | grep -v '^api/_'` and check the count. At 12 already, one more **will
fail the deploy** (happened before, see git history ~2026-07-23). **A `.test.js`
file placed directly in `api/` counts as a function too** — put tests for top-level
handlers in `api/_tests/` (caught once, 2026-08-26). `scripts/build-meta.test.js`
fails the suite if the count exceeds 12, so CI catches the thirteenth file before
Vercel does; the front-page footer shows the count from 10 up. Prefer folding a new
proxy into an existing same-app endpoint (extra query param/mode) over a new file
when the count is tight.

## Deployment Storage

**Deployment Storage is 10 GB on Hobby, charged per RETAINED deployment** — not per
push. `dist/` is ~10 MB; at that size the quota is a few hundred builds deep, and it
filled once already (2026-09-09). Three rules keep it there:

- **Never import a `@fontsource` family by its bare name or weight entry point**
  (`@fontsource/x`, `@fontsource/x/400.css`). Those emit every subset — greek,
  cyrillic, and for a CJK family ~120 Japanese chunks — in both `.woff2` and legacy
  `.woff`. Yoru did the latter and shipped 17 MB of Japanese fonts to draw one kanji.

  **How to fix one depends on how many subsets the app needs, and getting this wrong
  trades a build-size win for a runtime regression.** fontsource's per-subset files
  (`latin-400.css`) carry **no `unicode-range`** — only the bare and weight entry
  points declare the ranges. So:

  - **One subset needed** → import the per-subset file. Nothing else can match, so
    the missing range costs nothing.
  - **More than one** → declare the `@font-face` blocks by hand, copying fontsource's
    own ranges from its entry points, and reference
    `@fontsource/<family>/files/*.woff2` directly. Importing two per-subset files
    instead would make every browser fetch both unconditionally. `src/loom/fonts.css`
    is the worked example (Cinzel, latin + latin-ext, because Loom renders Romanian
    and `ș`/`ț`/`ă` sit in latin-ext while `â`/`î` do not); `src/yoru/fonts.css` is
    the same method for a single glyph.

  Either way, declare **`woff2` only** — the legacy `.woff` twins are half the bytes
  and every browser that can run these apps has supported woff2 for years. **Still
  outstanding:** `@fontsource-variable/inter` (four apps), `alegreya`, `fraunces` and
  `jetbrains-mono` are all imported bare — see R-027.
- **Watch for a dependency's `new URL(…, import.meta.url)`.** Rollup treats it as an
  asset reference and emits the target even when nothing fetches it — that's how a
  dead ONNX fallback put a 23 MB `.wasm` in every build. See `dropOrtWasmPlugin` in
  [`vite.config.js`](vite.config.js).
- **The front-page footer shows the built size of `dist/` from 20 MB up**, red at
  40 MB — hidden at the usual ~10 MB, since a number that is always fine is one
  nobody reads. Measured by `stampBuildSizePlugin` in `vite.config.js` (from
  `closeBundle`, not `transformIndexHtml` — the weight isn't knowable until the
  bundle is written), counted by `directorySizeBytes` in `scripts/build-meta.js`.

Preview builds on `claude/*` branches are **off** (`git.deploymentEnabled` in
[`vercel.json`](vercel.json)) — every change used to cost two deployments, one
preview and one production. `main` is unaffected.

Old deployments are swept automatically: the project's **Deployment Retention
Policy** (Vercel → Settings → Build and Deployment) is set to 1 week for all four
classes. That cleared ~11 weeks of backlog on 2026-09-10 and holds the retained set
to about a week's worth. Nothing to run by hand — a retention window only works
because the per-deployment size above stays small, so the two are one mechanism,
not two.
