import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Lexi5 must reach web storage only through src/shared/storage, whose helpers can't
 * throw. An unguarded localStorage.setItem inside a React effect is an uncaught render
 * error — in Safari private mode, or at quota, it unmounted the app to a blank page.
 * That shipped once; this keeps the fix from silently eroding.
 *
 * Same technique as src/ds/boundary.test.js, which enforces the design-system boundary.
 */

// `new URL(...).pathname` yields "/C:/Users/..." on Windows -- a leading
// slash before the drive letter -- so `join` built a doubled "C:\C:\Users"
// path and the whole suite failed to collect here. `fileURLToPath` is what
// turns a file URL into a real path on every platform; src/ds/boundary.test.js,
// which this file says it copies, already did it that way.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// getCustomList reads a raw string purely to use as a cache key, inside its own
// try/catch — it can't throw and has no equivalent in the shared helpers.
const ALLOWED = new Set(['lib/dictionaries.js'])

function walk(dir, base = '') {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = base ? `${base}/${entry}` : entry
    if (statSync(full).isDirectory()) out.push(...walk(full, rel))
    else if (/\.(js|jsx)$/.test(entry) && !/\.test\.(js|jsx)$/.test(entry)) out.push([rel, full])
  }
  return out
}

describe('Lexi5 storage boundary', () => {
  const files = walk(ROOT)

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('never writes to localStorage directly', () => {
    const offenders = []
    for (const [rel, full] of files) {
      const src = readFileSync(full, 'utf8')
      if (/localStorage\.(setItem|removeItem|clear)\s*\(/.test(src)) offenders.push(rel)
    }
    // ErrorBoundary is the deliberate exception: its whole job is clearing damaged keys
    // when the app has already failed, and it guards every call itself.
    const unexpected = offenders.filter(f => f !== 'components/ErrorBoundary.jsx')
    expect(unexpected, `write through src/shared/storage instead: ${unexpected.join(', ')}`).toEqual([])
  })

  it('never reads from localStorage directly outside the allowed cache-key read', () => {
    const offenders = []
    for (const [rel, full] of files) {
      if (ALLOWED.has(rel)) continue
      const src = readFileSync(full, 'utf8')
      if (/localStorage\.getItem\s*\(/.test(src)) offenders.push(rel)
    }
    expect(offenders, `read through src/shared/storage instead: ${offenders.join(', ')}`).toEqual([])
  })
})
