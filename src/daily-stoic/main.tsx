import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/fraunces'; // Added for Sol Odyssey themes
import './styles/index.css'; // Replaces ds/tokens.css
import App from './App';
import { watchInstalled } from '../shared/installFlag';
import { registerPeriodicSync } from '../shared/notify/periodicSync';
import { ThemeProvider } from './lib/themeContext';

watchInstalled('daily-stoic-react.html');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/daily-stoic-sw.js', { scope: '/daily-stoic-react.html' })
      .then(() => {
        const enabled = localStorage.getItem('daily-stoic:reminder-enabled') === 'true';
        if (enabled) {
          // Register background sync: min interval 12 hours (43200000 ms)
          void registerPeriodicSync('daily-stoic-reminders', 43200000);
        }
      })
      .catch((err) => console.error('Service worker registration failed:', err));
  });
}

// Preview notification query hook (?notify=1)
if ('serviceWorker' in navigator && new URL(window.location.href).searchParams.has('notify')) {
  navigator.serviceWorker.ready.then((reg) => {
    void reg.showNotification('Daily Stoic', {
      body: "Take a moment to reflect on today's principle.",
      tag: 'daily-stoic-nudge',
      icon: '/daily-stoic-logo.svg',
      badge: '/daily-stoic-logo.svg',
    });
  }).catch((err) => {
    console.error('Failed to trigger preview notification:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
