import React from 'react'
import { createRoot } from 'react-dom/client'
// Imported before ./App so its :root rules load first — Lexi5's own CSS (which
// remaps --color-ink/--color-surface/etc. to its own tokens) loads after and wins
// the cascade tie, instead of DS's Solarized-family ink bleeding through Modal text.
import '../ds/tokens.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { watchInstalled } from '../shared/installFlag'
import { loadDictionary, loadGuesses } from './lib/gameState'
import { readJson } from '../shared/storage'

// Register Cabinet install detection flag
watchInstalled('lexi5-react.html')

// Register the PWA service worker
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/lexi5-sw.js').catch((err) => {
      console.error('Lexi5 SW registration failed:', err)
    })
  })
}

const root = createRoot(document.getElementById('root'))

// Which dictionary is active decides which word today serves, so the first render has to
// wait for that list rather than rendering against whatever happens to be in memory. Only
// the selected list is fetched — the other three stay out of the bundle entirely.
const active = readJson('lexi5_config', null)?.dictionary || 'standard'

Promise.all([
  loadDictionary(active === 'custom' ? 'standard' : active),
  // Custom lists are validated against the built-in guess list, and any game needs it on
  // the first Enter, so it loads alongside rather than on demand.
  loadGuesses(),
])
  .catch(() => {
    // A failed chunk fetch (offline before the SW has them) still needs *a* dictionary.
    return loadDictionary('standard').catch(() => {})
  })
  .finally(() => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    )
  })
