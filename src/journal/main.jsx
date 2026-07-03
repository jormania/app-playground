import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { getRemindersEnabled } from './store.js'
import { registerPeriodicSync } from './reminders.js'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register the app's own service worker (scoped to this page, distinct filename so it never
// collides with Touch Grass's root-scope /sw.js). Best-effort; failure is non-fatal.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/journal-sw.js', { scope: '/journal-of-delights-react.html' })
      // If reminders were opted into before, let the browser resume periodic wakes after a reload.
      .then(() => { if (getRemindersEnabled()) void registerPeriodicSync() })
      .catch(() => {})
  })
}
