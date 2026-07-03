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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
