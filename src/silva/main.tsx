import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import '../ds/tokens.css'
import './styles/palette.css'
import App from './App.tsx'
import { watchInstalled } from '../shared/installFlag'

watchInstalled('silva-react.html')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/silva-sw.js', { scope: '/silva-react.html' })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
