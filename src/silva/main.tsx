import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '../ds/tokens.css'
import App from './App.tsx'

// No service worker / watchInstalled yet — PWA wiring is build-order step 10,
// not this session (Things model, forest view, understory only).

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
