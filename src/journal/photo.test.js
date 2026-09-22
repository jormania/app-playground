import { describe, it, expect } from 'vitest'
import { photoFilename, isImageFile } from './photo.js'

// photo.js re-exports the decode-and-downscale half from src/shared/photo.ts
// (R-005) but keeps photoFilename, because the shared function of that name does
// something else. These pin the difference so the next promotion pass doesn't
// "finish the job" and quietly rename every photo Journal has ever uploaded.
describe('photoFilename', () => {
  it('prefixes the date key rather than slugifying a name', () => {
    expect(photoFilename('2026-09-22')).toBe('delight-2026-09-22.jpg')
  })

  it('falls back to a bare name when there is no date key', () => {
    expect(photoFilename(null)).toBe('delight-photo.jpg')
    expect(photoFilename('')).toBe('delight-photo.jpg')
  })

  it('does not slugify — the shared version would, and these must stay apart', () => {
    // src/shared/photo.ts's photoFilename('A Nice Coat') is 'a-nice-coat.jpg'.
    // Journal never passes a name, so it passes the key through untouched.
    expect(photoFilename('A Nice Coat')).toBe('delight-A Nice Coat.jpg')
  })
})

describe('isImageFile, through the re-export', () => {
  it('accepts an image MIME type and rejects everything else', () => {
    expect(isImageFile({ type: 'image/jpeg' })).toBe(true)
    expect(isImageFile({ type: 'image/heic' })).toBe(true)
    expect(isImageFile({ type: 'application/pdf' })).toBe(false)
    expect(isImageFile({})).toBe(false)
    expect(isImageFile(null)).toBe(false)
  })
})
