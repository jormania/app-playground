import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { watchedPaths, needed, appsFor, APP_DIRS } from './live-check-needed.mjs'

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

  it('names only the apps whose request files changed', () => {
    expect(appsFor(['src/long-listen/curator/prompts.js', 'LONG_LISTEN.md'], watched)).toBe('The Long Listen')
    expect(appsFor(['src/keypath/app/ai.ts', 'src/silva/lib/ocr.ts'], watched)).toBe('KeyPath,Silva')
  })

  it('runs everything when a shared file changes', () => {
    expect(appsFor(['src/shared/models.js', 'src/keypath/app/ai.ts'], watched)).toBe('all')
    expect(appsFor(['scripts/anthropic.live.test.js'], watched)).toBe('all')
  })

  it('has a live case for every app it can name', () => {
    const live = readFileSync(new URL('./anthropic.live.test.js', import.meta.url), 'utf8')
    for (const app of Object.values(APP_DIRS)) expect(live, app).toContain(`'${app} — `)
  })

  it('knows the app of every watched file under src/<app>/', () => {
    for (const f of watched.filter((x) => x.startsWith('src/') && !x.startsWith('src/shared/'))) {
      expect(appsFor([f], watched), f).not.toBe('all')
    }
  })
})
