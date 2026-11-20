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

// Follow the OS light/dark setting, live. index.html sets it before first paint.
const dark = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => {
  document.documentElement.setAttribute('data-theme', dark.matches ? 'dark' : 'light')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark.matches ? '#1b1d1a' : '#f7f3ea')
}
dark.addEventListener('change', applyTheme)

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
