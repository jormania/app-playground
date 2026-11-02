import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Same stub shape as store.test.js and drafts.test.js, this app's house style (R-017).
const store = {}
const localStorageStub = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
}
vi.stubGlobal('localStorage', localStorageStub)

import { createLocalClient } from './localClient.js'

const STORE_KEY = 'loom_threads'
const SEED_KEY = 'loom_seeded'

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('localStorage', localStorageStub)
})

describe('the demo client', () => {
  it('announces itself as demo mode', () => {
    expect(createLocalClient().mode).toBe('demo')
  })
})

describe('listThreads and seeding', () => {
  it('seeds the demo threads on first run, once', async () => {
    const c = createLocalClient()
    const first = await c.listThreads()
    expect(first.length).toBeGreaterThan(0)
    expect(JSON.parse(store[STORE_KEY])).toEqual(first)
    expect(store[SEED_KEY]).toBe('1')
  })

  it('returns what is stored on later runs rather than reseeding', async () => {
    const c = createLocalClient()
    await c.listThreads()
    store[STORE_KEY] = JSON.stringify([{ id: 'x', name: 'Mine' }])
    expect(await c.listThreads()).toEqual([{ id: 'x', name: 'Mine' }])
  })

  it('does not reseed after the board was cleared', async () => {
    const c = createLocalClient()
    await c.listThreads()
    await c.replaceAll([])
    expect(await c.listThreads()).toEqual([])
  })

  it('does not reseed when the thread list is gone but the seeded flag remains', async () => {
    store[SEED_KEY] = '1'
    expect(await createLocalClient().listThreads()).toEqual([])
    expect(store[STORE_KEY]).toBeUndefined()
  })

  it('reseeds over corrupt stored JSON when never seeded', async () => {
    store[STORE_KEY] = '{not json'
    const list = await createLocalClient().listThreads()
    expect(list.length).toBeGreaterThan(0)
  })
})

describe('create, update, remove', () => {
  beforeEach(() => { store[SEED_KEY] = '1' })

  it('create assigns a loom- id, ignoring any id supplied, and persists', async () => {
    const c = createLocalClient()
    const a = await c.createThread({ id: 'mine', name: 'A' })
    expect(a.id).toMatch(/^loom-/)
    expect(a.id).not.toBe('mine')
    expect(a.name).toBe('A')
    expect(JSON.parse(store[STORE_KEY])).toEqual([a])
  })

  it('create gives distinct ids and appends in order', async () => {
    const c = createLocalClient()
    const a = await c.createThread({ name: 'A' })
    const b = await c.createThread({ name: 'B' })
    expect(a.id).not.toBe(b.id)
    expect((await c.listThreads()).map(t => t.name)).toEqual(['A', 'B'])
  })

  it('update merges the patch, keeps the id, and leaves others alone', async () => {
    const c = createLocalClient()
    const a = await c.createThread({ name: 'A', note: 'n' })
    const b = await c.createThread({ name: 'B' })
    const out = await c.updateThread(a.id, { name: 'A2', id: 'hijack' })
    expect(out).toEqual({ ...a, name: 'A2' })
    const list = await c.listThreads()
    expect(list.find(t => t.id === b.id)).toEqual(b)
  })

  it('update of an unknown id returns null and changes nothing', async () => {
    const c = createLocalClient()
    const a = await c.createThread({ name: 'A' })
    expect(await c.updateThread('nope', { name: 'Z' })).toBeNull()
    expect(await c.listThreads()).toEqual([a])
  })

  it('remove drops only that thread', async () => {
    const c = createLocalClient()
    const a = await c.createThread({ name: 'A' })
    const b = await c.createThread({ name: 'B' })
    expect(await c.removeThread(a.id)).toEqual({ ok: true })
    expect(await c.listThreads()).toEqual([b])
  })
})

describe('replaceAll', () => {
  it('replaces the board and marks it seeded', async () => {
    const c = createLocalClient()
    const out = await c.replaceAll([{ id: 'q' }])
    expect(out).toEqual([{ id: 'q' }])
    expect(JSON.parse(store[STORE_KEY])).toEqual([{ id: 'q' }])
    expect(store[SEED_KEY]).toBe('1')
  })
})

describe('a throwing localStorage', () => {
  it('never throws; reads as empty and writes are dropped', async () => {
    const boom = () => { throw new Error('denied') }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom })
    const c = createLocalClient()
    const seeded = await c.listThreads()
    expect(seeded.length).toBeGreaterThan(0)
    await expect(c.createThread({ name: 'A' })).resolves.toMatchObject({ name: 'A' })
    await expect(c.removeThread('x')).resolves.toEqual({ ok: true })
    await expect(c.replaceAll([])).resolves.toEqual([])
  })
})
