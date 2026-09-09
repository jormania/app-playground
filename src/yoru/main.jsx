import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Yoru's type: one Japanese superfamily. Zen Old Mincho for the display face
// (the 夜 glyph and titles), Zen Kaku Gothic New for UI text — both carry the
// kanji and elegant Latin.
//
// Latin only here: the family-wide entry points ('@fontsource/zen-old-mincho/400.css')
// emit all ~120 Japanese subsets plus greek and cyrillic into the build, 17 MB that
// no visitor ever downloads. 夜 — the one non-Latin character Yoru draws — is
// declared separately in ./fonts.css. See the note at the top of that file.
import '@fontsource/zen-old-mincho/latin-400.css'
import '@fontsource/zen-old-mincho/latin-500.css'
import '@fontsource/zen-kaku-gothic-new/latin-400.css'
import '@fontsource/zen-kaku-gothic-new/latin-500.css'
import './fonts.css'
import '../ds/tokens.css'
import './yoru.css'
import { watchInstalled } from '../shared/installFlag'
import App from './App'

watchInstalled('yoru-react.html')

// Scoped service worker, registered ourselves so it stays confined to this
// page — same pattern as Tempo / Law of the Day. Production only (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
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
