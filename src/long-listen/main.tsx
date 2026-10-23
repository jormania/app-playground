import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../ds/tokens.css'
import './styles/fonts.css'
import './styles/palette.css'
import App from './App'
import { watchInstalled } from '../shared/installFlag'
import { askToKeepData } from './app/backup'

watchInstalled('long-listen-react.html')
// The journey lives only here: ask the browser to keep it rather than clear it when space runs short.
void askToKeepData()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/long-listen-sw.js', { scope: '/long-listen-react.html' })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
