import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './touch-grass.css'
import App from './App.jsx'
import { WorldProvider } from './world.jsx'
import { watchInstalled } from '../shared/installFlag'

watchInstalled('touch-grass-react.html')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WorldProvider>
      <App />
    </WorldProvider>
  </StrictMode>
)

// Production only — in `vite dev` the worker would cache-first the unhashed dev modules
// and serve stale code back on every reload (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
