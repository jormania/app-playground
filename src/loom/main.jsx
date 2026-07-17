import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/cinzel/500.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/cinzel/900.css'
import '@fontsource-variable/alegreya'
import '../ds/tokens.css'
import './loom.css'
import { watchInstalled } from '../shared/installFlag'
import App from './App.jsx'

watchInstalled('loom-react.html')

// Scoped service worker, registered ourselves so it stays confined to this page —
// same pattern as Law of the Day. Production only (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/loom-sw.js', { scope: '/loom-react.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
