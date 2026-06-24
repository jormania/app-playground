import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
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