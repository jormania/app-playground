import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/alegreya'
import '../ds/tokens.css'
import './marquee.css'
import { watchInstalled } from '../shared/installFlag'
import App from './App.jsx'

watchInstalled('marquee-react.html')

// Scoped service worker, registered ourselves so it stays confined to this page.
// Production only — a cache-first worker under `vite dev` serves back the first
// unhashed copy of every asset forever (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/marquee-sw.js', { scope: '/marquee-react.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
