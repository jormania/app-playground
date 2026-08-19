import { describe, it, expect } from 'vitest'
import { cosineSimilarity, contentHash } from './embeddings'

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    const v = new Float32Array([1, 0, 0])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('is 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([0, 1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0)
  })

  it('is -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([-1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1)
  })

  it('is scale-invariant', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([2, 4, 6])
    expect(cosineSimilarity(a, b)).toBeCloseTo(1)
  })

  it('is 0 for mismatched lengths rather than throwing', () => {
    const a = new Float32Array([1, 2])
    const b = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('is 0 for a zero vector rather than NaN', () => {
    const a = new Float32Array([0, 0])
    const b = new Float32Array([1, 1])
    expect(cosineSimilarity(a, b)).toBe(0)
  })
})

describe('contentHash', () => {
  it('is deterministic for the same input', () => {
    expect(contentHash('a passage worth keeping')).toBe(contentHash('a passage worth keeping'))
  })

  it('differs for different input', () => {
    expect(contentHash('a passage worth keeping')).not.toBe(contentHash('a different passage'))
  })

  it('is a non-empty string, safe as a cache key', () => {
    const hash = contentHash('x')
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('handles the empty string without throwing', () => {
    expect(() => contentHash('')).not.toThrow()
  })
})
