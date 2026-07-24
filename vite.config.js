import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import notionHandler from './api/notion.js'
import generateLawOfTheDayHandler from './api/generate-law-of-the-day.js'
import lawOfTheDayContentHandler from './api/law-of-the-day-content.js'
import placesHandler from './api/places.js'
import wanderlistRemindersHandler from './api/wanderlist-reminders.js'
import wanderlistRemindHandler from './api/wanderlist-remind.js'
import steamSearchHandler from './api/steam-search.js'
import clickDeckStudioSearchHandler from './api/clickdeck-studio-search.js'
import clickDeckHltbHandler from './api/clickdeck-hltb.js'

// Stamps the real build/deploy time into every HTML entry as a <meta> tag.
// On Vercel a fresh build runs on each deploy, so this equals the deploy date.
function deployDatePlugin() {
  const deployDate = new Date().toISOString();
  return {
    name: 'inject-deploy-date',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: { name: 'deploy-date', content: deployDate },
        injectTo: 'head',
      }];
    },
  };
}

// PWA for Sol Odyssey only. Distinct service-worker + manifest filenames keep it from
// colliding with Touch Grass's hand-written sw.js / manifest.json. We register the SW
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
// as /api/places and /api/wanderlist-reminders), the same way devNotionRelay does.
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
    deployDatePlugin(),
    solOdysseyPWA(),
    clickDeckPWA(),
    devNotionRelay(),
    devApiRelay('/api/generate-law-of-the-day', generateLawOfTheDayHandler, 'dev-generate-law-of-the-day-relay'),
    devApiRelay('/api/law-of-the-day-content', lawOfTheDayContentHandler, 'dev-law-of-the-day-content-relay'),
    devBodyRelay('/api/places', placesHandler, 'dev-places-relay'),
    devBodyRelay('/api/wanderlist-reminders', wanderlistRemindersHandler, 'dev-wanderlist-reminders-relay'),
    devApiRelay('/api/wanderlist-remind', wanderlistRemindHandler, 'dev-wanderlist-remind-relay'),
    devApiRelay('/api/steam-search', steamSearchHandler, 'dev-steam-search-relay'),
    devBodyRelay('/api/clickdeck-studio-search', clickDeckStudioSearchHandler, 'dev-clickdeck-studio-search-relay'),
    devApiRelay('/api/clickdeck-hltb', clickDeckHltbHandler, 'dev-clickdeck-hltb-relay'),
  ],
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
        dsShowcase: resolve(__dirname, 'ds-showcase.html'),
        cabinet: resolve(__dirname, 'cabinet.html'),
      }
    }
  }
})
