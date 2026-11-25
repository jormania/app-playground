import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/fonts/inter.css'
import '../ds/tokens.css'
import './styles/palette.css'
import { watchInstalled } from '../shared/installFlag'
import App from './App.tsx'

watchInstalled('inflow-react.html')

// Scoped service worker, production only: under `vite dev` a cache-first worker
// serves the first copy of every unhashed dev URL forever (CLAUDE.md, "Service workers").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/inflow-sw.js', { scope: '/inflow-react.html' })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
