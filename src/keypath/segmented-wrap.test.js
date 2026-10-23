// Every segmented control in KeyPath wraps its words rather than scrolling
// sideways. A scrolled track hides an option without saying so, and in
// Romanian, at 320 px, several did (Settings' note names, the Songs filters).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = new URL('.', import.meta.url).pathname

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name) ? [p] : []
  })
}

describe('KeyPath segmented controls', () => {
  it('all wrap', () => {
    const missing = []
    for (const file of sources(ROOT)) {
      const text = readFileSync(file, 'utf8')
      // Written first, so the check can't be fooled by an arrow function's `>`.
      for (const m of text.matchAll(/<SegmentedControl\b(?!\s+wrap\b)/g)) missing.push(`${file.slice(ROOT.length)}:${text.slice(0, m.index).split('\n').length}`)
    }
    expect(missing).toEqual([])
  })
})
