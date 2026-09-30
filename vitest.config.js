import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // *.live.test.js call the real Anthropic API — `npm run test:live` only.
    exclude: ['node_modules', '.claude/**', 'dist', '.idea', '.git', '.cache', '**/*.live.test.js'],
  },
})
