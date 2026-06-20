import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './touch-grass.css'
import App from './App.jsx'
import { WorldProvider } from './world.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WorldProvider>
      <App />
    </WorldProvider>
  </StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
