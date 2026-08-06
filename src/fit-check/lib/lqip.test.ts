import { describe, it, expect } from 'vitest'
import {
  averageColourHex, chooseThumb, isLqip,
  LQIP_MAX_CHARS, NOTION_RICH_TEXT_CAP,
} from './lqip.ts'

const rgba = (...px: number[][]) => new Uint8ClampedArray(px.flat())

describe('averageColourHex', () => {
  it('returns the single colour of a uniform image', () => {
    expect(averageColourHex(rgba([18, 52, 86, 255], [18, 52, 86, 255]))).toBe('#123456')
  })

  it('averages across pixels', () => {
    expect(averageColourHex(rgba([0, 0, 0, 255], [255, 255, 255, 255]))).toBe('#808080')
  })

  it('skips fully transparent pixels rather than averaging them as black', () => {
    // A PNG garment cut-out is mostly transparent; counting those pixels would
    // drag every placeholder toward black and make the grid look burnt.
    const withHoles = rgba([200, 100, 50, 255], [0, 0, 0, 0], [200, 100, 50, 255])
    expect(averageColourHex(withHoles)).toBe('#c86432')
  })

  it('falls back to grey when every pixel is transparent', () => {
    expect(averageColourHex(rgba([0, 0, 0, 0]))).toBe('#cccccc')
  })

  it('always produces a well-formed six-digit hex', () => {
    expect(averageColourHex(rgba([1, 2, 3, 255]))).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('chooseThumb — the write-budget guard', () => {
  it('keeps an LQIP that fits', () => {
    // ~1290 is the worst case measured through the browser's own canvas
    // encoder at 24px/q0.4 (see lqip.ts) — a realistic photo lands under it.
    const b64 = 'a'.repeat(1290)
    expect(chooseThumb(b64, '#123456')).toBe(b64)
  })

  it('leaves headroom above the worst measured real output', () => {
    // If someone tightens the budget below what the encoder actually produces,
    // every photo silently degrades to a flat colour. This is that tripwire.
    expect(LQIP_MAX_CHARS).toBeGreaterThan(1300)
  })

  it('falls back when the LQIP would overrun the budget', () => {
    // Notion rejects the WHOLE property patch if a value exceeds its cap, so an
    // oversized placeholder must never reach the write.
    expect(chooseThumb('a'.repeat(LQIP_MAX_CHARS + 1), '#123456')).toBe('#123456')
  })

  it('accepts exactly the budget', () => {
    const b64 = 'a'.repeat(LQIP_MAX_CHARS)
    expect(chooseThumb(b64, '#123456')).toBe(b64)
  })

  it('falls back when encoding produced nothing', () => {
    expect(chooseThumb(null, '#123456')).toBe('#123456')
    expect(chooseThumb('', '#123456')).toBe('#123456')
  })

  it('never returns a value Notion would reject', () => {
    for (const candidate of [null, '', 'a'.repeat(10), 'a'.repeat(1599), 'a'.repeat(5000)]) {
      expect(chooseThumb(candidate, '#123456').length).toBeLessThanOrEqual(NOTION_RICH_TEXT_CAP)
    }
  })

  it('leaves headroom under Notion’s own cap', () => {
    expect(LQIP_MAX_CHARS).toBeLessThan(NOTION_RICH_TEXT_CAP)
  })
})

describe('isLqip', () => {
  it('recognises a base64 placeholder', () => expect(isLqip('a'.repeat(400))).toBe(true))
  it('recognises the hex fallback', () => expect(isLqip('#123456')).toBe(false))
  it('handles absence', () => expect(isLqip(null)).toBe(false))
})
