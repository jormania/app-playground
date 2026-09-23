import { describe, expect, it } from 'vitest'
import { pushSample, summarise } from './timing'

describe('summarise', () => {
  it('returns null for no samples', () => {
    expect(summarise([])).toBeNull()
  })

  it('computes nearest-rank median and p95', () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(summarise(xs)).toEqual({ n: 100, min: 1, median: 50, p95: 95, max: 100 })
  })
})

describe('pushSample', () => {
  it('keeps only the newest samples', () => {
    expect(pushSample([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  })
})
