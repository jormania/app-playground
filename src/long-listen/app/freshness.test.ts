import { describe, it, expect } from 'vitest'
import { entryScript } from './freshness'

describe('entryScript', () => {
  it('finds the hashed module script, whichever order its attributes come in', () => {
    expect(entryScript('<head><script type="module" crossorigin src="/assets/long-listen-AbC123.js"></script>')).toBe('/assets/long-listen-AbC123.js')
    expect(entryScript('<script src="/assets/x-9.js" type="module"></script>')).toBe('/assets/x-9.js')
    expect(entryScript('<script>inline()</script>')).toBeNull()
  })
})
