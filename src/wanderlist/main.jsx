import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import App from './App.jsx'
import { watchInstalled } from '../shared/installFlag'

watchInstalled('wanderlist-react.html')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register the app's own service worker (scoped to this page, distinct filename so it
// never collides with the other apps' workers). Best-effort; failure is non-fatal.
// Production only — in `vite dev` the worker would cache-first the unhashed dev modules
// and serve stale code back on every reload (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/wanderlist-sw.js', { scope: '/wanderlist-react.html' }).catch(() => {})
  })
}
