import { defineConfig } from 'vitest/config'

// The live API check only (scripts/anthropic.live.test.js) — see AI_MODELS.md.
// Serial, so a run stays well inside any rate limit.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.live.test.js'],
    exclude: ['node_modules', '.claude/**', 'dist'],
    fileParallelism: false,
  },
})
