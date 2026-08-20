// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Same in-memory idb-keyval stand-in as vectorCache.test.ts — happy-dom has
// no real IndexedDB, and these tests are about the storage policy (ref
// shape, prefix scoping, what prune reclaims), not IndexedDB itself.
const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v) },
  del: async (k: string) => { store.delete(k) },
  keys: async () => [...store.keys()],
}))

const {
  isLocalImage,
  localImageRef,
  putLocalPhoto,
  deleteLocalPhoto,
  pruneLocalPhotos,
  LOCAL_IMAGE_PREFIX,
} = await import('./photoStore.ts')

beforeEach(() => {
  store.clear()
})

function fakeBlob(): Blob {
  return new Blob(['not really a photo'], { type: 'image/jpeg' })
}

describe('isLocalImage', () => {
  it('recognises only its own ref shape', () => {
    expect(isLocalImage(localImageRef('abc'))).toBe(true)
    expect(isLocalImage(`${LOCAL_IMAGE_PREFIX}abc`)).toBe(true)
  })

  // A live thing's image is a real Notion URL and must never be treated as
  // a local blob ref — that distinction is what keeps live and demo
  // photographs from being confused for one another.
  it('rejects a Notion URL, an empty value, and null', () => {
    expect(isLocalImage('https://files.notion.so/photo.jpg')).toBe(false)
    expect(isLocalImage('')).toBe(false)
    expect(isLocalImage(null)).toBe(false)
    expect(isLocalImage(undefined)).toBe(false)
  })
})

describe('putLocalPhoto / deleteLocalPhoto', () => {
  it('stores a blob under a ref the caller can hand back', async () => {
    const ref = await putLocalPhoto('photo-1', fakeBlob())
    expect(ref).toBe(localImageRef('photo-1'))
    expect(store.size).toBe(1)
  })

  it('deletes by ref', async () => {
    const ref = await putLocalPhoto('photo-1', fakeBlob())
    await deleteLocalPhoto(ref)
    expect(store.size).toBe(0)
  })

  it('ignores a delete for something that was never a local photo', async () => {
    await putLocalPhoto('photo-1', fakeBlob())
    await deleteLocalPhoto('https://files.notion.so/photo.jpg')
    expect(store.size).toBe(1)
  })
})

describe('pruneLocalPhotos', () => {
  // The leak this exists for: a page photograph is 200-400 KB, nothing ever
  // reclaimed one, and "Reset the demo forest" left every blob behind.
  it('reclaims blobs no live thing points at any more', async () => {
    const keptRef = await putLocalPhoto('kept', fakeBlob())
    await putLocalPhoto('gone', fakeBlob())

    const removed = await pruneLocalPhotos([keptRef])

    expect(removed).toBe(1)
    expect(store.size).toBe(1)
    expect([...store.keys()][0]).toContain('kept')
  })

  it('keeps everything still referenced', async () => {
    const a = await putLocalPhoto('a', fakeBlob())
    const b = await putLocalPhoto('b', fakeBlob())
    expect(await pruneLocalPhotos([a, b])).toBe(0)
    expect(store.size).toBe(2)
  })

  it('tolerates nulls in the live list — most things have no photo at all', async () => {
    const ref = await putLocalPhoto('kept', fakeBlob())
    expect(await pruneLocalPhotos([null, ref, null])).toBe(0)
    expect(store.size).toBe(1)
  })

  // The safety property behind App.tsx's demo-mode guard, asserted here so
  // the danger is visible from the module itself: given a live collection
  // (Notion URLs, no local refs), this reclaims EVERYTHING. That is correct
  // for the function and exactly why the caller must not run it in live
  // mode — a connected user reopening the demo would find its photographs
  // silently gone.
  it('reclaims every blob when handed a list with no local refs in it', async () => {
    await putLocalPhoto('a', fakeBlob())
    await putLocalPhoto('b', fakeBlob())

    const removed = await pruneLocalPhotos(['https://files.notion.so/photo.jpg', null])

    expect(removed).toBe(2)
    expect(store.size).toBe(0)
  })

  it('never touches keys belonging to another cache', async () => {
    store.set('silva:vector:thing-1', { hash: 'h', vector: new Float32Array([1]) })
    store.set('silva:linkpreview:https://example.com', { preview: {}, fetchedAt: 0 })
    await putLocalPhoto('gone', fakeBlob())

    expect(await pruneLocalPhotos([])).toBe(1)
    expect(store.has('silva:vector:thing-1')).toBe(true)
    expect(store.has('silva:linkpreview:https://example.com')).toBe(true)
  })
})
