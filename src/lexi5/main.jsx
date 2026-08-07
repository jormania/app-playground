import React from 'react'
import { createRoot } from 'react-dom/client'
// Imported before ./App so its :root rules load first — Lexi5's own CSS (which
// remaps --color-ink/--color-surface/etc. to its own tokens) loads after and wins
// the cascade tie, instead of DS's Solarized-family ink bleeding through Modal text.
import '../ds/tokens.css'
import { App } from './App'
import { watchInstalled } from '../shared/installFlag'

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
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
