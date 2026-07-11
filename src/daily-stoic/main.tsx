import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../ds/tokens.css';
import App from './App';
import { watchInstalled } from '../shared/installFlag';

watchInstalled('daily-stoic-react.html');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/daily-stoic-sw.js', { scope: '/daily-stoic-react.html' })
      .catch((err) => console.error('Service worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
