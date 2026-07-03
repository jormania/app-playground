import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '../ds/tokens.css'
import { ThemeProvider } from './lib/themeContext'
import { watchInstalled } from '../shared/installFlag'
import App from './App'

watchInstalled('law-of-the-day-react.html')

// Scoped service worker, registered ourselves so it stays confined to this
// page — same pattern as Tempo.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/law-of-the-day-sw.js', { scope: '/law-of-the-day-react.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
