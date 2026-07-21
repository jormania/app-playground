import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/theme.css'

// Watch installed state for Cabinet handoff
import { watchInstalled } from '../shared/installFlag'
watchInstalled('click-deck-react.html')

// Scoped service worker (VitePWA generates click-deck-sw.js), registered ourselves so
// it stays confined to Click Deck's page — same pattern as Tempo/Sol Odyssey. Production
// only (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/click-deck-sw.js', { scope: '/click-deck-react.html' }).catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
