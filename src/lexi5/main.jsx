import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { watchInstalled } from '../shared/installFlag'
import '../ds/tokens.css'

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
