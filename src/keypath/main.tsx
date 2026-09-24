import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../ds/tokens.css'
import { Shell } from './app/Shell'
import { systemPrefersDark } from '../shared/theme'

// No service worker, no manifest, no install flag yet — deliberately: the
// tutor is a taster still changing daily, and a cached copy answering from
// yesterday's build helps nobody. On the roadmap (KEYPATH_TUTOR.md §10).
const applyTheme = () => document.documentElement.setAttribute('data-theme', systemPrefersDark() ? 'dark' : 'light')
applyTheme()
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
