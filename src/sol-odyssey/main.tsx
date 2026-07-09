import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { SettingsProvider } from './lib/settingsContext'
import { SyncProvider } from './lib/syncContext'
import { ThemeProvider } from './lib/themeContext'
import { loadSettings } from './lib/settings'
import { registerPeriodicSync } from './lib/reminders'
import { watchInstalled } from '../shared/installFlag'
import './styles/index.css'

watchInstalled('sol-odysseys-react.html')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

// Register the app's own service worker (scoped to this page, distinct filename so it
// never collides with the other apps' workers). Best-effort; failure is non-fatal.
// Production only (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sol-odyssey-sw.js', { scope: '/sol-odysseys-react.html' })
      // If reminders were opted into before, let the browser resume periodic wakes after a reload.
      .then(() => {
        if (loadSettings().remindersEnabled) void registerPeriodicSync()
      })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          <SyncProvider>
            <App />
          </SyncProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
