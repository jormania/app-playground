import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
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
