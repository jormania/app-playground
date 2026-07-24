import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '../ds/tokens.css'
import './index.css'
import { watchInstalled } from '../shared/installFlag'
import App from './App'

watchInstalled('where-it-went-react.html')

// Scoped service worker, registered ourselves so it stays confined to this
// page — same pattern as Tempo. Production only (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/where-it-went-sw.js', { scope: '/where-it-went-react.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
