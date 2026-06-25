import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { SettingsProvider } from './lib/settingsContext'
import { SyncProvider } from './lib/syncContext'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

// Register the app's own service worker (scoped to this page, distinct filename so it
// never collides with the other apps' workers). Best-effort; failure is non-fatal.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sol-odyssey-sw.js', { scope: '/sol-odysseys-react.html' })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
)
