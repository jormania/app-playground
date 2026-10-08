import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../ds/tokens.css'
import './styles/fonts.css'
import './styles/palette.css'
import App from './App'
import { watchInstalled } from '../shared/installFlag'

watchInstalled('long-listen-react.html')

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
