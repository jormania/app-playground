import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Stamps the real build/deploy time into every HTML entry as a <meta> tag.
// On Vercel a fresh build runs on each deploy, so this equals the deploy date.
function deployDatePlugin() {
  const deployDate = new Date().toISOString();
  return {
    name: 'inject-deploy-date',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: { name: 'deploy-date', content: deployDate },
        injectTo: 'head',
      }];
    },
  };
}

export default defineConfig({
  plugins: [react(), deployDatePlugin()],
build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        touchGrass: resolve(__dirname, 'touch-grass-react.html'),
        journalOfDelights: resolve(__dirname, 'journal-of-delights-react.html'),
        kettlebellTraining: resolve(__dirname, 'kettlebell-training-react.html'),
      }
    }
  }
})