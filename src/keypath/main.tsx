import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../ds/tokens.css'
import App from './App.tsx'
import { systemPrefersDark } from '../shared/theme'

// No service worker, no manifest, no install flag — deliberately. This is a
// probe, not an app yet: nothing here is worth caching offline, and a cached
// probe answering from yesterday's build is the last thing a hardware test
// needs. See KEYPATH.md, "What the probe is not".
const applyTheme = () => document.documentElement.setAttribute('data-theme', systemPrefersDark() ? 'dark' : 'light')
applyTheme()
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
