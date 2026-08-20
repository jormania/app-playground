import { describe, it, expect, vi } from 'vitest'
import { normalizeIsbn, coverUrlForIsbn, findBookCover } from './bookCover'

describe('normalizeIsbn', () => {
  it('strips the punctuation an ISBN is printed with', () => {
    expect(normalizeIsbn('978-0-14-044933-4')).toBe('9780140449334')
    expect(normalizeIsbn(' 0 14 044933 4 ')).toBe('0140449334')
  })

  it('accepts an ISBN-10 check digit of X', () => {
    expect(normalizeIsbn('043942089X')).toBe('043942089X')
    expect(normalizeIsbn('043942089x')).toBe('043942089X')
  })

  it('refuses anything that is not an ISBN', () => {
    expect(normalizeIsbn('12345')).toBeNull()
    expect(normalizeIsbn('not an isbn')).toBeNull()
    expect(normalizeIsbn(null)).toBeNull()
    expect(normalizeIsbn(undefined)).toBeNull()
    // Kobo's own volume ids are not ISBNs, however book-ish they look.
    expect(normalizeIsbn('file:///mnt/onboard/meditations.epub')).toBeNull()
  })
})

describe('coverUrlForIsbn', () => {
  // `default=false` makes Open Library 404 rather than hand back a blank
  // placeholder — which is what makes the probe below meaningful.
  it('asks for a large cover and refuses the placeholder', () => {
    expect(coverUrlForIsbn('978-0-14-044933-4')).toBe(
      'https://covers.openlibrary.org/b/isbn/9780140449334-L.jpg?default=false',
    )
  })

  it('is null without an ISBN', () => {
    expect(coverUrlForIsbn('')).toBeNull()
  })
})

describe('findBookCover', () => {
  it('returns the URL when a cover really loads', async () => {
    const probe = vi.fn().mockResolvedValue(true)
    await expect(findBookCover('9780140449334', probe)).resolves.toBe(
      'https://covers.openlibrary.org/b/isbn/9780140449334-L.jpg?default=false',
    )
    expect(probe).toHaveBeenCalledOnce()
  })

  // Better no cover than a permanently broken image in Roots.
  it('returns null when nothing loads there', async () => {
    await expect(findBookCover('9780140449334', vi.fn().mockResolvedValue(false))).resolves.toBeNull()
  })

  it('never probes without an ISBN', async () => {
    const probe = vi.fn()
    await expect(findBookCover('not an isbn', probe)).resolves.toBeNull()
    expect(probe).not.toHaveBeenCalled()
  })

  // An import must never fail because a decoration did.
  it('swallows a probe that throws', async () => {
    await expect(findBookCover('9780140449334', vi.fn().mockRejectedValue(new Error('offline')))).resolves.toBeNull()
  })
})
