import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/alegreya'
import '@fontsource-variable/jetbrains-mono'
import '../ds/tokens.css'
import './radar-b.css'
import { watchInstalled } from '../shared/installFlag'
import { fullscreenOnTap } from '../shared/fullscreen'
import App from './App.jsx'

watchInstalled('radar-b-react.html')
// Run from a Chrome shortcut, the first tap takes the screen back (src/shared/fullscreen.ts).
fullscreenOnTap()

// Scoped service worker, registered ourselves so it stays confined to this page.
// Production only — a cache-first worker under `vite dev` serves back the first
// unhashed copy of every asset forever (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/radar-b-sw.js', { scope: '/radar-b-react.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
