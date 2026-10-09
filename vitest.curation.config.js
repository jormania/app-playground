import { defineConfig } from 'vitest/config'

// The Long Listen's curation check only (src/long-listen/curator/curation.check.ts):
// four listener profiles through the real prompts, with the owner's key. Never in
// CI, never in `npm test`. See LONG_LISTEN.md, "The curation check".
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/long-listen/curator/curation.check.ts'],
    fileParallelism: false,
  },
})
