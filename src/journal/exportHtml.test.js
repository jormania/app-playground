// @vitest-environment happy-dom
import { test, expect, describe, afterEach, vi } from 'vitest'
import { buildExportHtml, withEmbeddedPhotos } from './exportHtml.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const entries = [
  { id: '1', date: '2026-06-22', title: 'rain on the awning', entry: 'a tiny drum', tags: ['rain'], people: [], wordCount: 3 },
  { id: '2', date: '2026-06-24', title: 'the espresso foam', entry: 'it held its <shape>', tags: ['light'], people: ['Mara'], wordCount: 4 },
]

describe('buildExportHtml', () => {
  const html = buildExportHtml(entries, new Date(2026, 5, 24))

  test('is a complete standalone document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('Journal of <em>Delights</em>')
  })
  test('includes every entry, newest first', () => {
    expect(html.indexOf('the espresso foam')).toBeLessThan(html.indexOf('rain on the awning'))
  })
  test('escapes HTML in user content (no injection)', () => {
    expect(html).toContain('it held its &lt;shape&gt;')
    expect(html).not.toContain('it held its <shape>')
  })
  test('bakes in inline SVGs for the field labels', () => {
    expect(html).toContain('<svg')
    expect(html).toContain('people')
    expect(html).toContain('tags')
  })
  test('renders chips and word counts', () => {
    expect(html).toContain('class="chip person">Mara')
    expect(html).toContain('4 words')
  })
  test('needs no external scripts', () => {
    expect(html).not.toContain('<script')
  })
  test('renders no photo markup when an entry has none', () => {
    expect(html).not.toContain('class="photo"')
  })
  test('embeds a photo as an <img> when the entry carries a resolved data URI', () => {
    const withPhoto = buildExportHtml([{ ...entries[0], photo: { dataUrl: 'data:image/jpeg;base64,AAAA' } }])
    expect(withPhoto).toContain('<div class="photo"><img src="data:image/jpeg;base64,AAAA" alt=""/></div>')
  })
})

describe('withEmbeddedPhotos', () => {
  test('leaves entries without a photo untouched', async () => {
    const result = await withEmbeddedPhotos(entries)
    expect(result).toEqual(entries)
  })

  test("resolves an entry's photo to a data: URI via the same proxy share.js uses", async () => {
    vi.stubGlobal('fetch', async (url) => {
      expect(url).toBe(`/api/notion-photo-proxy?url=${encodeURIComponent('https://files.notion.so/delight.jpg')}`)
      return { ok: true, blob: async () => new Blob(['fake-bytes'], { type: 'image/jpeg' }) }
    })
    const [result] = await withEmbeddedPhotos([
      { ...entries[0], photo: { url: 'https://files.notion.so/delight.jpg' } },
    ])
    expect(result.photo.dataUrl).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('leaves the photo out (without throwing) when the fetch fails', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false }))
    const [result] = await withEmbeddedPhotos([
      { ...entries[0], photo: { url: 'https://files.notion.so/delight.jpg' } },
    ])
    expect(result.photo.dataUrl).toBeUndefined()
  })
})
