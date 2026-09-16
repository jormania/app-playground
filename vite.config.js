import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { cleanCommitSubject, countServerlessFunctions, directorySizeBytes, parseBacklogCounts, withBuildSizeMeta } from './scripts/build-meta.js'
import notionHandler from './api/notion.js'
import generateLawOfTheDayHandler from './api/generate-law-of-the-day.js'
import lawOfTheDayContentHandler from './api/law-of-the-day-content.js'
import placesHandler from './api/places.js'
import wanderlistRemindHandler from './api/wanderlist-remind.js'
import steamSearchHandler from './api/steam-search.js'
import clickDeckStudioSearchHandler from './api/clickdeck-studio-search.js'
import clickDeckHltbHandler from './api/clickdeck-hltb.js'
import notionPhotoProxyHandler from './api/notion-photo-proxy.js'
import marqueeScanHandler from './api/marquee-scan.js'

// Stamps build provenance into every HTML entry as <meta> tags, so the front
// page can say which build you are actually looking at without spending a
// GitHub API request on it. Two things follow from doing this at build time
// rather than at runtime: it costs nothing against the unauthenticated 60/hr
// rate limit, and it can never disagree with the page it is embedded in — a
// cached page carries its own provenance, where a live lookup would report
// whatever `main` happens to be now.
//
// On Vercel a fresh build runs per deploy, so the timestamp equals the deploy
// time and VERCEL_GIT_* describe the deployed commit. Locally those are absent
// and git fills in. Everything here is best-effort: a missing value just omits
// its meta tag, and index.html omits the corresponding half of the footer line.
function buildMetaPlugin() {
  const deployDate = new Date().toISOString();

  const git = (cmd) => {
    try {
      return execSync(cmd, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };

  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || git('git rev-parse HEAD')).slice(0, 7);
  const ref = process.env.VERCEL_GIT_COMMIT_REF || git('git rev-parse --abbrev-ref HEAD');
  // The commit subject is a footnote, not a paragraph.
  const msg = cleanCommitSubject(
    (process.env.VERCEL_GIT_COMMIT_MESSAGE || git('git log -1 --pretty=%s')).split('\n')[0],
    60,
  );

  // The serverless-function budget and the backlog depth — both counted by
  // scripts/build-meta.js, which is where the rules behind them are written
  // down and tested. A count that cannot be taken just omits its meta tag.
  let functions = '';
  try {
    functions = String(countServerlessFunctions(resolve(__dirname, 'api')));
  } catch { /* no api dir — leave it off */ }

  let backlogOpen = '', backlogProposed = '';
  try {
    const counts = parseBacklogCounts(readFileSync(resolve(__dirname, 'REFACTOR_BACKLOG.md'), 'utf8'));
    backlogOpen     = String(counts.open);
    backlogProposed = String(counts.proposed);
  } catch { /* no backlog file — leave it off */ }

  const values = {
    'deploy-date': deployDate,
    'build-commit': sha,
    'build-commit-msg': msg,
    'build-ref': ref,
    'build-functions': functions,
    'build-backlog-open': backlogOpen,
    'build-backlog-proposed': backlogProposed,
  };

  return {
    name: 'inject-build-meta',
    transformIndexHtml() {
      return Object.entries(values)
        .filter(([, content]) => content !== '')
        .map(([name, content]) => ({
          tag: 'meta',
          attrs: { name, content },
          injectTo: 'head',
        }));
    },
  };
}

// PWA for Sol Odyssey only. Distinct service-worker + manifest filenames keep it from
// colliding with Touch Grass's hand-written sw.js. We register the SW
// ourselves from the Sol Odyssey entry (injectRegister: null), scoped to its page.
function solOdysseyPWA() {
  return VitePWA({
    filename: 'sol-odyssey-sw.js',
    manifestFilename: 'sol-odyssey.webmanifest',
    injectRegister: null,
    registerType: 'autoUpdate',
    scope: '/sol-odysseys-react.html',
    includeAssets: [
      'sol-odyssey-logo.svg',
      'sol-odyssey-favicon-32.png',
      'sol-odyssey-icon-192.png',
      'sol-odyssey-icon-512.png',
    ],
    workbox: {
      // Precache Sol Odyssey's shell so it boots offline: its entry HTML, its own JS/CSS, the
      // shared React runtime chunk it needs, and its self-hosted fonts. Scoped so the other
      // apps' bundles are never swept in.
      globPatterns: [
        'sol-odysseys-react.html',
        'assets/sol*.{js,css}',
        'assets/jsx-runtime-*.js',
        'assets/*.woff2',
      ],
      navigateFallback: null,
      // Pull the reminders logic (periodic-sync + notificationclick) into the generated worker.
      importScripts: ['sol-odyssey-notify.js'],
    },
    manifest: {
      name: 'Sol Odyssey',
      short_name: 'Sol Odyssey',
      description: 'Run your own six-week behaviour-change Odyssey.',
      id: '/sol-odysseys-react.html',
      scope: '/sol-odysseys-react.html',
      start_url: '/sol-odysseys-react.html',
      display: 'standalone',
      background_color: '#F7F7FC',
      theme_color: '#4B45C6',
      icons: [
        { src: '/sol-odyssey-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/sol-odyssey-icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/sol-odyssey-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  });
}

// PWA for Click Deck only. Distinct service-worker filename keeps it from colliding
// with the other apps' workers. Click Deck already ships a hand-authored
// public/click-deck.webmanifest (linked directly from click-deck-react.html), so
// manifest generation is turned off here (manifest: false) — this plugin only emits
// the service worker. Registered ourselves from the Click Deck entry (injectRegister:
// null), scoped to its page.
function clickDeckPWA() {
  return VitePWA({
    filename: 'click-deck-sw.js',
    manifest: false,
    injectRegister: null,
    registerType: 'autoUpdate',
    scope: '/click-deck-react.html',
    includeAssets: [
      'click-deck-favicon-32.png',
      'click-deck-icon-192.png',
      'click-deck-icon-512.png',
      'click-deck-icon-512-maskable.png',
    ],
    workbox: {
      // Precache Click Deck's shell so it boots offline: its entry HTML, its own JS/CSS,
      // and the shared React runtime chunk it needs. Scoped so the other apps' bundles
      // are never swept in.
      globPatterns: [
        'click-deck-react.html',
        'assets/clickDeck*.{js,css}',
        'assets/jsx-runtime-*.js',
      ],
      navigateFallback: null,
      // Click Deck loads JetBrains Mono from Google Fonts (not self-hosted like Sol
      // Odyssey), so cache the stylesheet + woff2 responses at runtime instead of via
      // precache globs — the standard Workbox recipe for cross-origin Google Fonts.
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'click-deck-google-fonts-stylesheets' },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'click-deck-google-fonts-webfonts',
            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  });
}

// vite-plugin-pwa has no notion of "this is a multi-page build, only wire the
// manifest into one entry" — it injects Sol Odyssey's <link rel="manifest">
// into every HTML file the build produces, not just sol-odysseys-react.html.
// Harmless-looking (the manifest spec says the FIRST <link rel="manifest">
// wins, and each page's own real one is emitted first), but every other app
// still eagerly fetches sol-odyssey.webmanifest on every load for nothing —
// pure wasted startup-time bandwidth on all ~19 other pages, Cabinet
// included. `transformIndexHtml` (even with `order: 'post'`) runs *before*
// this — vite-plugin-pwa's own injection happens later, straight into the
// written files — so the only reliable point to strip it is `closeBundle`,
// once every HTML file is actually on disk. Left alone on Sol Odyssey's own
// page, the one entry the tag is meant for.
function stripStraySolOdysseyManifestPlugin() {
  let outDir = 'dist'
  return {
    name: 'strip-stray-sol-odyssey-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      for (const file of readdirSync(outDir)) {
        if (!file.endsWith('.html') || file === 'sol-odysseys-react.html') continue
        const path = resolve(outDir, file)
        const html = readFileSync(path, 'utf8')
        const stripped = html.replace(/\s*<link rel="manifest" href="\/sol-odyssey\.webmanifest">/, '')
        if (stripped !== html) writeFileSync(path, stripped)
      }
    },
  }
}

// The build line's other gauge: what this build weighs. Deployment Storage is the
// second Vercel ceiling this repo has hit (10 GB on Hobby, charged per retained
// deployment, filled once on 2026-09-09), and the one-week retention policy only
// keeps it clear while a single build stays around its usual ~10 MB. Both incidents
// were one accidental asset — 17 MB of Japanese font subsets, a dead 23 MB ONNX
// runtime — and neither was visible anywhere until the quota complained.
//
// Every other value on that line is stamped by buildMetaPlugin's transformIndexHtml.
// This one cannot be: that hook runs while the bundle is still being made, and the
// number wanted is the finished weight, service workers and all. So it is measured
// and written from `closeBundle`, after everything is on disk — the same point, and
// the same mechanism, that stripStraySolOdysseyManifestPlugin above already rewrites
// emitted HTML from. Ordered after that plugin and after both PWA plugins so what it
// measures is the tree Vercel actually receives. The one thing it cannot account for
// is itself: the twenty tags it then writes are ~0.9 kB of that tree, so the reading
// is that much light against a threshold measured in megabytes.
//
// The measuring and the stamping both live in scripts/build-meta.js with the other
// counts, where they are tested: a guardrail gauge that quietly under-reports is
// worse than no gauge at all.
function stampBuildSizePlugin() {
  let outDir = 'dist'
  return {
    name: 'stamp-build-size',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    // `order: 'post'` is load-bearing, not tidiness. vite-plugin-pwa generates its
    // service workers from a post-ordered closeBundle of its own, so a plain hook
    // here — whatever its position in the plugin array — measures the tree before
    // sol-odyssey-sw.js, click-deck-sw.js and their two workbox runtimes exist, and
    // reports ~42 kB light. Post here too puts this last among the post hooks, by
    // array position, which is after both PWA plugins.
    closeBundle: {
      sequential: true,
      order: 'post',
      handler() {
        let bytes
        try {
          bytes = directorySizeBytes(outDir)
        } catch {
          return // no output to measure — leave the gauge off, as with every other value here
        }
        for (const file of readdirSync(outDir)) {
          if (!file.endsWith('.html')) continue
          const path = resolve(outDir, file)
          const html = readFileSync(path, 'utf8')
          const stamped = withBuildSizeMeta(html, bytes)
          if (stamped !== html) writeFileSync(path, stamped)
        }
      },
    },
  }
}

// Silva's semantic layer runs onnxruntime-web through @huggingface/transformers, and
// transformers.js points ONNX at its own runtime on jsDelivr by default (see
// backends/onnx.js: it sets env.backends.onnx.wasm.wasmPaths to
// cdn.jsdelivr.net/npm/onnxruntime-web@<version>/dist/ whenever wasmPaths is unset and
// we're not inside a ServiceWorkerGlobalScope, which is every context Silva runs in).
// So the runtime is fetched from the CDN, exactly as src/silva/lib/embeddings.ts says.
//
// Rollup doesn't know that. Deep inside ORT's own bundle sits a dead fallback —
// `new URL('ort-wasm-simd-threaded.asyncify.wasm', import.meta.url)`, reached only when
// wasmPaths is unset — and a static `new URL(..., import.meta.url)` is exactly the shape
// Vite treats as an asset reference. So it resolved it and emitted the 23 MB binary into
// dist/assets on every build: never requested by anything, but charged against Vercel's
// 10 GB Deployment Storage on every push. That was 44% of a 52 MB deployment.
//
// Dropping it from the bundle leaves the live CDN path untouched. The fallback URL it
// came from stays in the chunk and now 404s if anything ever reaches it — which would
// mean transformers.js stopped setting wasmPaths, and the honest failure there is a
// missing runtime, not a silently bundled duplicate of one.
function dropOrtWasmPlugin() {
  const pattern = /^assets\/ort-wasm-.*\.wasm$/
  return {
    name: 'drop-ort-wasm',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (pattern.test(fileName)) delete bundle[fileName]
      }
    },
  }
}

// Dev-only: mount the SAME stateless relay handler at /api/notion under `vite dev`, so
// Settings → "Test connection" works on localhost without deploying. On Vercel the real
// serverless function (api/notion.js) serves this route instead; this never runs in prod.
function devNotionRelay() {
  return {
    name: 'dev-notion-relay',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/notion', async (req, res) => {
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          req.body = Buffer.concat(chunks).toString('utf8')
          // Give the Node response the Vercel-style helpers the handler expects.
          res.status = (code) => ((res.statusCode = code), res)
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
          res.send = (text) => res.end(text)
          await notionHandler(req, res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: `Dev relay error: ${err.message}` }))
        }
      })
    },
  }
}

// Dev-only: mount a GET-only serverless handler at the given path under `vite dev`,
// with the same Vercel-style res.status/json/send shim as devNotionRelay above.
// No body-draining needed since both Law of the Day endpoints are GET requests.
function devApiRelay(path, handler, name) {
  return {
    name,
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(path, async (req, res) => {
        try {
          req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
          res.status = (code) => ((res.statusCode = code), res)
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
          res.send = (text) => res.end(text)
          await handler(req, res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: `Dev relay error: ${err.message}` }))
        }
      })
    },
  }
}

// Dev-only: like devApiRelay but drains the request body first (for POST endpoints such
// as /api/places and /api/wanderlist-remind), the same way devNotionRelay does.
function devBodyRelay(path, handler, name) {
  return {
    name,
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(path, async (req, res) => {
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          req.body = Buffer.concat(chunks).toString('utf8')
          req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
          res.status = (code) => ((res.statusCode = code), res)
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
          res.send = (text) => res.end(text)
          await handler(req, res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: `Dev relay error: ${err.message}` }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    buildMetaPlugin(),
    solOdysseyPWA(),
    clickDeckPWA(),
    stripStraySolOdysseyManifestPlugin(),
    // After the strip above, so the size it reports is the final tree.
    stampBuildSizePlugin(),
    dropOrtWasmPlugin(),
    devNotionRelay(),
    devApiRelay('/api/generate-law-of-the-day', generateLawOfTheDayHandler, 'dev-generate-law-of-the-day-relay'),
    devApiRelay('/api/law-of-the-day-content', lawOfTheDayContentHandler, 'dev-law-of-the-day-content-relay'),
    devBodyRelay('/api/places', placesHandler, 'dev-places-relay'),
    // Body-draining relay, not devApiRelay: this one endpoint serves both the GET
    // send path and the prefs POST (?mode=prefs).
    devBodyRelay('/api/wanderlist-remind', wanderlistRemindHandler, 'dev-wanderlist-remind-relay'),
    devApiRelay('/api/steam-search', steamSearchHandler, 'dev-steam-search-relay'),
    devBodyRelay('/api/clickdeck-studio-search', clickDeckStudioSearchHandler, 'dev-clickdeck-studio-search-relay'),
    devApiRelay('/api/clickdeck-hltb', clickDeckHltbHandler, 'dev-clickdeck-hltb-relay'),
    devBodyRelay('/api/marquee-scan', marqueeScanHandler, 'dev-marquee-scan-relay'),
    devApiRelay('/api/notion-photo-proxy', notionPhotoProxyHandler, 'dev-notion-photo-proxy-relay'),
  ],
  server: {
    proxy: {
      '/api/anthropic-proxy': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic-proxy/, '')
      }
    }
  },
  test: {
    environment: 'happy-dom'
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        touchGrass: resolve(__dirname, 'touch-grass-react.html'),
        journalOfDelights: resolve(__dirname, 'journal-of-delights-react.html'),
        kettlebellTraining: resolve(__dirname, 'kettlebell-training-react.html'),
        solOdysseys: resolve(__dirname, 'sol-odysseys-react.html'),
        tempo: resolve(__dirname, 'tempo-react.html'),
        lawOfTheDay: resolve(__dirname, 'law-of-the-day-react.html'),
        yoru: resolve(__dirname, 'yoru-react.html'),
        wanderlist: resolve(__dirname, 'wanderlist-react.html'),
        dailyStoic: resolve(__dirname, 'daily-stoic-react.html'),
        loom: resolve(__dirname, 'loom-react.html'),
        clickDeck: resolve(__dirname, 'click-deck-react.html'),
        whereItWent: resolve(__dirname, 'where-it-went-react.html'),
        fitCheck: resolve(__dirname, 'fit-check-react.html'),
        lexi5: resolve(__dirname, 'lexi5-react.html'),
        silva: resolve(__dirname, 'silva-react.html'),
        radarB: resolve(__dirname, 'radar-b-react.html'),
        marquee: resolve(__dirname, 'marquee-react.html'),
        dsShowcase: resolve(__dirname, 'ds-showcase.html'),
        cabinet: resolve(__dirname, 'cabinet.html'),
      }
    }
  }
})
