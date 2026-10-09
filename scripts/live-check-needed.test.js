import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { watchedPaths, needed } from './live-check-needed.mjs'

describe('live check gate', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ai-models.yml', import.meta.url), 'utf8')
  const watched = watchedPaths(workflow)

  it('reads the workflow’s own paths list', () => {
    expect(watched).toContain('src/shared/models.js')
    expect(watched).toContain('src/long-listen/curator/curator.js')
    expect(watched).toContain('.github/workflows/ai-models.yml')
    expect(watched.every((p) => !p.includes(' '))).toBe(true)
  })

  it('runs when a push changes a request file, and skips a docs-only push', () => {
    expect(needed(['README.md', 'src/long-listen/curator/prompts.js'], watched)).toBe(true)
    expect(needed(['LONG_LISTEN_ROADMAP.md', 'src/long-listen/screens/Week.tsx'], watched)).toBe(false)
    expect(needed([], watched)).toBe(false)
  })
})
