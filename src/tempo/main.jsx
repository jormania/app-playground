import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '../ds/tokens.css'
import App from './App'
import { ThemeProvider } from './lib/themeContext'
import { PreferencesProvider } from './lib/preferencesContext'
import { watchInstalled } from '../shared/installFlag'
import './tempo.css'

watchInstalled('tempo-react.html')

// Scoped service worker (VitePWA generates tempo-sw.js), registered ourselves so
// it stays confined to Tempo's page — same pattern as Sol Odyssey.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/tempo-sw.js', { scope: '/tempo-react.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </ThemeProvider>
  </StrictMode>,
)
