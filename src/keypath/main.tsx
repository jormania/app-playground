import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../ds/tokens.css'
import { Shell } from './app/Shell'
import { systemPrefersDark } from '../shared/theme'
import { watchInstalled } from '../shared/installFlag'
import { fullscreenOnTap } from '../shared/fullscreen'

watchInstalled('keypath-react.html')
// Run from a Chrome shortcut, the first tap takes the screen back (src/shared/fullscreen.ts).
fullscreenOnTap()

// Scoped service worker, confined to this page like every other app's.
// Production only (CLAUDE.md, "Service workers & dev"). Navigations are
// network-first, so an installed KeyPath always opens the latest deploy
// when there's a connection, and yesterday's when there isn't.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/keypath-sw.js', { scope: '/keypath-react.html' }).catch(() => {})
  })
}

const applyTheme = () => {
  const dark = systemPrefersDark()
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1a1b26' : '#eee8d5')
}
applyTheme()
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
