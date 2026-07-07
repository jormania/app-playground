import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Yoru's type: one Japanese superfamily. Zen Old Mincho for the display face
// (the 夜 glyph and titles), Zen Kaku Gothic New for UI text — both carry the
// kanji and elegant Latin, and the browser lazily fetches only the subsets used.
import '@fontsource/zen-old-mincho/400.css'
import '@fontsource/zen-old-mincho/500.css'
import '@fontsource/zen-kaku-gothic-new/400.css'
import '@fontsource/zen-kaku-gothic-new/500.css'
import '../ds/tokens.css'
import './yoru.css'
import { watchInstalled } from '../shared/installFlag'
import App from './App'

watchInstalled('yoru-react.html')

// Scoped service worker, registered ourselves so it stays confined to this
// page — same pattern as Tempo / Law of the Day.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/yoru-sw.js', { scope: '/yoru-react.html' })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
