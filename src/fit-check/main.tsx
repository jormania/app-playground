import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '../ds/tokens.css'
import './index.css'
import { watchInstalled } from '../shared/installFlag'
import App from './App.tsx'

watchInstalled('fit-check-react.html')

// Scoped service worker, registered here so it stays confined to this page.
// Production only — under `vite dev` a cache-first worker serves back the first
// copy of every unhashed dev URL forever (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/fit-check-sw.js', { scope: '/fit-check-react.html' })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
