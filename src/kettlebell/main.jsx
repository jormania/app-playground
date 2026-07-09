import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { watchInstalled } from '../shared/installFlag';

watchInstalled('kettlebell-training-react.html');

// Scoped service worker, registered ourselves so it stays confined to this
// page — same pattern as Law of the Day. Production only (see CLAUDE.md "Service workers & dev").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/kettlebell-training-sw.js', { scope: '/kettlebell-training-react.html' }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
