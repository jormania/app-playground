import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
// Cinzel is declared by hand in ./fonts.css — woff2 only, both latin subsets,
// fontsource's own unicode-ranges. See that file's header for why the
// per-subset entry points CLAUDE.md recommends are the wrong fix here (R-016).
import './fonts.css'
import '@fontsource-variable/alegreya'
import '../ds/tokens.css'
import './loom.css'
import { watchInstalled } from '../shared/installFlag'
import { ThemeProvider } from './lib/themeContext'
import { LexiconProvider } from './lib/lexiconContext'
import { UiStyleProvider } from './lib/uiStyleContext'
import App from './App.jsx'

watchInstalled('loom-react.html')

// Scoped service worker, registered ourselves so it stays confined to this page —
// same pattern as Law of the Day. Production only (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/loom-sw.js', { scope: '/loom-react.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LexiconProvider>
        <UiStyleProvider>
          <App />
        </UiStyleProvider>
      </LexiconProvider>
    </ThemeProvider>
  </StrictMode>,
)
