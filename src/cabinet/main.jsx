import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '../ds/tokens.css'
import { ThemeProvider } from './lib/themeContext'
import App from './App'

// Scoped service worker, registered ourselves so it stays confined to this
// page — same pattern as Law of the Day.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/coneofcold-cabinet-sw.js', { scope: '/coneofcold-cabinet.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
