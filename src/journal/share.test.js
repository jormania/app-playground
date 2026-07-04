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

// share.js re-encodes every photo to PNG before writing it to the clipboard
// (the Async Clipboard API only accepts image/png for an image write; our
// own photos are always JPEG). That re-encoding runs through
// createImageBitmap + <canvas> — real browser APIs Node doesn't have — so
// tests that exercise a clipboard photo write need fakes for both.
function stubImageConversion() {
  vi.stubGlobal('createImageBitmap', async () => ({ width: 10, height: 10, close: () => {} }))
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (cb) => cb(new Blob(['fake-png-bytes'], { type: 'image/png' })),
    }),
  })
}

// A real navigator.clipboard.write() has to read each ClipboardItem value —
// including a pending promise, like the photo's — to actually write it, so
// it awaits them (and rejects if one rejects) before resolving. A mock that
// just resolves without ever touching `parts` doesn't exercise that, and
// leaves a rejected photo-blob promise unobserved (a real "unhandled
// rejection", not a product bug, but a hole in the test).
function realisticWrite(onWritten) {
  return async (items) => {
    const item = items[0]
    onWritten?.(item)
    await Promise.all(Object.values(item.parts))
  }
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
  it('copies title + text via a rich ClipboardItem, including the photo (re-encoded to PNG) when fetchable', async () => {
    stubFetchOk()
    stubImageConversion()
    class FakeClipboardItem {
      constructor(parts) { this.parts = parts }
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    let written
    vi.stubGlobal('navigator', {
      clipboard: { write: realisticWrite((item) => { written = item }) },
    })
    const result = await shareEntry(entryWithPhoto)
    expect(result).toEqual({ ok: true, copied: true, withPhoto: true })
    expect(written.parts['text/plain']).toBeInstanceOf(Blob)
    expect(await written.parts['image/png']).toBeInstanceOf(Blob)
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

describe('shareByEmail', () => {
  // shareByEmail() is deliberately synchronous (not `async`) so that when
  // there's a photo, navigator.clipboard.write() is called in the same
  // tick as the click — before any `await` has a chance to spend the
  // click's transient user activation, which a clipboard write silently
  // needs. `mailto` is available immediately either way; `ready` is a
  // promise the caller awaits to learn whether the photo copy landed.

  it('is synchronous: mailto is available without awaiting anything', () => {
    vi.stubGlobal('navigator', {})
    const result = shareByEmail(entry)
    expect(typeof result.mailto).toBe('string')
    expect(result.ready).toBeInstanceOf(Promise)
  })

  it('builds a mailto: with the date + title in the subject and only the entry text in the body', () => {
    vi.stubGlobal('navigator', {})
    const { mailto } = shareByEmail(entry)
    const params = new URL(mailto.replace('mailto:', 'https://x/')).searchParams
    expect(params.get('subject')).toBe('A Delight from 24 Jun 2026: A quiet find')
    expect(params.get('body')).toBe(entry.entry)
  })

  it('never includes the title in the body — only the entry text', () => {
    vi.stubGlobal('navigator', {})
    const { mailto } = shareByEmail(entry)
    const params = new URL(mailto.replace('mailto:', 'https://x/')).searchParams
    expect(params.get('body')).not.toContain(entry.title)
  })

  it('falls back to the entry title when untitled', () => {
    vi.stubGlobal('navigator', {})
    const { mailto } = shareByEmail({ date: '2026-06-24', entry: 'no title here' })
    const params = new URL(mailto.replace('mailto:', 'https://x/')).searchParams
    expect(params.get('subject')).toBe('A Delight from 24 Jun 2026: A delight')
  })

  it('drops the "from <date>" clause when the date is missing or invalid', () => {
    vi.stubGlobal('navigator', {})
    const { mailto } = shareByEmail({ title: 'No date here' })
    const params = new URL(mailto.replace('mailto:', 'https://x/')).searchParams
    expect(params.get('subject')).toBe('A Delight: No date here')
  })

  it('never touches navigator.share — Gmail was found to silently drop the body when a file rides along on a real device', async () => {
    let shareCalled = false
    vi.stubGlobal('navigator', { share: async () => { shareCalled = true } })
    await shareByEmail(entryWithPhoto).ready
    expect(shareCalled).toBe(false)
  })

  it('ready resolves false when the entry has no photo', async () => {
    vi.stubGlobal('navigator', {})
    const { ready } = shareByEmail(entry)
    expect(await ready).toBe(false)
  })

  it('calls navigator.clipboard.write() synchronously, before the photo fetch resolves', () => {
    stubImageConversion()
    let writeCalledSync = false
    let fetchResolved = false
    vi.stubGlobal('fetch', () => new Promise((resolve) => {
      queueMicrotask(() => { fetchResolved = true; resolve({ ok: true, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }) })
    }))
    vi.stubGlobal('ClipboardItem', class FakeClipboardItem { constructor(parts) { this.parts = parts } })
    vi.stubGlobal('navigator', {
      clipboard: {
        write: realisticWrite(() => {
          writeCalledSync = !fetchResolved // true only if write() ran before the fetch settled
        }),
      },
    })
    shareByEmail(entryWithPhoto)
    expect(writeCalledSync).toBe(true)
  })

  it('copies the photo to the clipboard as a PNG (the only image type Async Clipboard write supports) when present and supported', async () => {
    stubFetchOk()
    stubImageConversion()
    let written
    vi.stubGlobal('ClipboardItem', class FakeClipboardItem {
      constructor(parts) { this.parts = parts }
    })
    vi.stubGlobal('navigator', { clipboard: { write: realisticWrite((item) => { written = item }) } })
    const { ready } = shareByEmail(entryWithPhoto)
    expect(await ready).toBe(true)
    expect(await written.parts['image/png']).toBeInstanceOf(Blob)
  })

  it('resolves ready: false without erroring when the clipboard write fails', async () => {
    stubFetchOk()
    stubImageConversion()
    vi.stubGlobal('ClipboardItem', class FakeClipboardItem {
      constructor(parts) { this.parts = parts }
    })
    vi.stubGlobal('navigator', { clipboard: { write: async () => { throw new Error('nope') } } })
    const { mailto, ready } = shareByEmail(entryWithPhoto)
    expect(await ready).toBe(false)
    // the mailto: link is still valid even though the photo couldn't be copied
    expect(mailto).toContain('mailto:')
  })

  it('resolves ready: false when the photo fetch itself fails, without erroring', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline') })
    vi.stubGlobal('ClipboardItem', class FakeClipboardItem { constructor(parts) { this.parts = parts } })
    vi.stubGlobal('navigator', { clipboard: { write: realisticWrite() } })
    const { ready } = shareByEmail(entryWithPhoto)
    expect(await ready).toBe(false)
  })

  it('resolves ready: false if the copy takes too long (safety timeout)', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', () => new Promise(() => {})) // never resolves
    vi.stubGlobal('ClipboardItem', class FakeClipboardItem { constructor(parts) { this.parts = parts } })
    vi.stubGlobal('navigator', { clipboard: { write: () => new Promise(() => {}) } })
    const { ready } = shareByEmail(entryWithPhoto)
    let result
    ready.then((v) => { result = v })
    await vi.advanceTimersByTimeAsync(5000)
    expect(result).toBe(false)
    vi.useRealTimers()
  })
})
