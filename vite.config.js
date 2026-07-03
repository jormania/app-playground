import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import notionHandler from './api/notion.js'
import generateLawOfTheDayHandler from './api/generate-law-of-the-day.js'
import lawOfTheDayContentHandler from './api/law-of-the-day-content.js'

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
    devNotionRelay(),
    devApiRelay('/api/generate-law-of-the-day', generateLawOfTheDayHandler, 'dev-generate-law-of-the-day-relay'),
    devApiRelay('/api/law-of-the-day-content', lawOfTheDayContentHandler, 'dev-law-of-the-day-content-relay'),
  ],
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
        dsShowcase: resolve(__dirname, 'ds-showcase.html'),
        coneofcoldCabinet: resolve(__dirname, 'coneofcold-cabinet.html'),
      }
    }
  }
})
