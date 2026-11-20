import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/fonts/inter.css'
import '../shared/fonts/alegreya.css'
import '../ds/tokens.css'
import './styles/palette.css'
import './styles/app.css'
import App from './App.tsx'
import { watchInstalled } from '../shared/installFlag'

watchInstalled('stillflow-react.html')

// Light/dark is applied by app/theme.ts (Settings → Appearance); the page sets it before first paint.

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/stillflow-sw.js', { scope: '/stillflow-react.html' })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
