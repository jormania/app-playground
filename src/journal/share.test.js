import { describe, it, expect, afterEach, vi } from 'vitest'
import { canShare, shareEntry, shareByEmail } from './share.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const entry = { date: '2026-06-24', title: 'A quiet find', entry: 'The rain smelled like the inside of a cedar box.' }
const entryWithPhoto = { ...entry, photo: { url: 'https://files.notion.so/delight.jpg', name: 'delight.jpg' } }

function stubFetchOk() {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    blob: async () => new Blob(['fake-bytes'], { type: 'image/jpeg' }),
  }))
}

describe('canShare', () => {
  it('is false when navigator.share is absent', () => {
    vi.stubGlobal('navigator', {})
    expect(canShare()).toBe(false)
  })

  it('is true when navigator.share exists', () => {
    vi.stubGlobal('navigator', { share: async () => {} })
    expect(canShare()).toBe(true)
  })
})

describe('shareEntry — native share available', () => {
  it('shares title as its own field, and folded into text too (some targets, e.g. WhatsApp, only read text)', async () => {
    let shared
    vi.stubGlobal('navigator', { share: async (data) => { shared = data } })
    const result = await shareEntry(entry)
    expect(result).toEqual({ ok: true, shared: true })
    expect(shared).toEqual({ title: 'A quiet find', text: `${entry.title}\n\n${entry.entry}` })
  })

  it('falls back to the entry title when untitled', async () => {
    let shared
    vi.stubGlobal('navigator', { share: async (data) => { shared = data } })
    await shareEntry({ entry: 'no title here' })
    expect(shared.title).toBe('A delight')
  })

  it('attaches the photo as a file when the browser can share files', async () => {
    stubFetchOk()
    let shared
    vi.stubGlobal('navigator', {
      share: async (data) => { shared = data },
      canShare: () => true,
    })
    await shareEntry(entryWithPhoto)
    expect(shared.files).toHaveLength(1)
    expect(shared.files[0].name).toBe('delight.jpg')
  })

  it("fetches the photo through /api/notion-photo-proxy, not Notion's URL directly (no CORS headers there)", async () => {
    let requestedUrl
    vi.stubGlobal('fetch', async (url) => {
      requestedUrl = url
      return { ok: true, blob: async () => new Blob(['fake-bytes'], { type: 'image/jpeg' }) }
    })
    vi.stubGlobal('navigator', { share: async () => {}, canShare: () => true })
    await shareEntry(entryWithPhoto)
    expect(requestedUrl).toBe(`/api/notion-photo-proxy?url=${encodeURIComponent(entryWithPhoto.photo.url)}`)
  })

  it('omits files when the browser reports it cannot share them', async () => {
    stubFetchOk()
    let shared
    vi.stubGlobal('navigator', {
      share: async (data) => { shared = data },
      canShare: () => false,
    })
    await shareEntry(entryWithPhoto)
    expect(shared.files).toBeUndefined()
  })

  it('omits files when the photo fetch fails, without erroring', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline') })
    let shared
    vi.stubGlobal('navigator', {
      share: async (data) => { shared = data },
      canShare: () => true,
    })
    const result = await shareEntry(entryWithPhoto)
    expect(result.ok).toBe(true)
    expect(shared.files).toBeUndefined()
  })

  it('reports a cancelled share as ok, without touching the clipboard', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    let clipboardTouched = false
    vi.stubGlobal('navigator', {
      share: async () => { throw abort },
      clipboard: { writeText: async () => { clipboardTouched = true } },
    })
    const result = await shareEntry(entry)
    expect(result).toEqual({ ok: true, cancelled: true })
    expect(clipboardTouched).toBe(false)
  })

  it('falls back to the clipboard when share() fails for a reason other than cancellation', async () => {
    let written
    vi.stubGlobal('navigator', {
      share: async () => { throw new Error('some other failure') },
      clipboard: { writeText: async (text) => { written = text } },
    })
    const result = await shareEntry(entry)
    expect(result).toEqual({ ok: true, copied: true, withPhoto: false })
    expect(written).toBe(`${entry.title}\n\n${entry.entry}`)
  })
})

describe('shareEntry — no native share (desktop fallback)', () => {
  it('copies title + text via a rich ClipboardItem, including the photo when fetchable', async () => {
    stubFetchOk()
    class FakeClipboardItem {
      constructor(parts) { this.parts = parts }
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    let written
    vi.stubGlobal('navigator', {
      clipboard: { write: async (items) => { written = items[0] } },
    })
    const result = await shareEntry(entryWithPhoto)
    expect(result).toEqual({ ok: true, copied: true, withPhoto: true })
    expect(written.parts['text/plain']).toBeInstanceOf(Blob)
    expect(written.parts['image/jpeg']).toBeDefined()
  })

  it('degrades to writeText when the rich clipboard write throws', async () => {
    class FakeClipboardItem {
      constructor(parts) { this.parts = parts }
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    let written
    vi.stubGlobal('navigator', {
      clipboard: {
        write: async () => { throw new Error('nope') },
        writeText: async (text) => { written = text },
      },
    })
    const result = await shareEntry(entry)
    expect(result).toEqual({ ok: true, copied: true, withPhoto: false })
    expect(written).toBe(`${entry.title}\n\n${entry.entry}`)
  })

  it('reports failure when neither clipboard path works', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('nope') } } })
    const result = await shareEntry(entry)
    expect(result).toEqual({ ok: false })
  })

  it('shares just the title when the entry has no body text', async () => {
    let written
    vi.stubGlobal('navigator', { clipboard: { writeText: async (text) => { written = text } } })
    await shareEntry({ title: 'Just a title' })
    expect(written).toBe('Just a title')
  })
})

describe('shareByEmail — native share available', () => {
  it('shares the subject as title and the entry text alone as text (never doubled)', async () => {
    let shared
    vi.stubGlobal('navigator', { share: async (data) => { shared = data } })
    const result = await shareByEmail(entry)
    expect(result).toEqual({ ok: true, shared: true })
    expect(shared).toEqual({ title: "Gabriel's Delight from 24 Jun 2026: A quiet find", text: entry.entry })
  })

  it('falls back to the entry title when untitled, and drops "from <date>" when the date is missing', async () => {
    let shared
    vi.stubGlobal('navigator', { share: async (data) => { shared = data } })
    await shareByEmail({ entry: 'no title here' })
    expect(shared.title).toBe("Gabriel's Delight: A delight")
  })

  it('attaches the photo as a file when the browser can share files', async () => {
    stubFetchOk()
    let shared
    vi.stubGlobal('navigator', { share: async (data) => { shared = data }, canShare: () => true })
    await shareByEmail(entryWithPhoto)
    expect(shared.files).toHaveLength(1)
    expect(shared.files[0].name).toBe('delight.jpg')
  })

  it('reports a cancelled share as ok, without falling back to mailto', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    vi.stubGlobal('navigator', { share: async () => { throw abort } })
    const result = await shareByEmail(entry)
    expect(result).toEqual({ ok: true, cancelled: true })
  })

  it('falls back to mailto when share() fails for a reason other than cancellation', async () => {
    vi.stubGlobal('navigator', { share: async () => { throw new Error('some other failure') } })
    const result = await shareByEmail(entry)
    expect(result.ok).toBe(true)
    const params = new URL(result.mailto.replace('mailto:', 'https://x/')).searchParams
    expect(params.get('subject')).toBe("Gabriel's Delight from 24 Jun 2026: A quiet find")
    expect(params.get('body')).toBe(entry.entry)
  })
})

describe('shareByEmail — no native share (mailto fallback, text only)', () => {
  it('puts the date and title in the subject, and only the entry text in the body', async () => {
    vi.stubGlobal('navigator', {})
    const result = await shareByEmail(entry)
    const params = new URL(result.mailto.replace('mailto:', 'https://x/')).searchParams
    expect(params.get('subject')).toBe("Gabriel's Delight from 24 Jun 2026: A quiet find")
    expect(params.get('body')).toBe(entry.entry)
  })

  it('drops the "from <date>" clause when the date is missing or invalid', async () => {
    vi.stubGlobal('navigator', {})
    const result = await shareByEmail({ title: 'No date here' })
    const params = new URL(result.mailto.replace('mailto:', 'https://x/')).searchParams
    expect(params.get('subject')).toBe("Gabriel's Delight: No date here")
  })

  it('never includes the title in the body — only the entry text', async () => {
    vi.stubGlobal('navigator', {})
    const result = await shareByEmail(entry)
    const params = new URL(result.mailto.replace('mailto:', 'https://x/')).searchParams
    expect(params.get('body')).not.toContain(entry.title)
  })
})
