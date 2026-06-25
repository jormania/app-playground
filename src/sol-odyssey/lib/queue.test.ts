import { describe, it, expect } from 'vitest'
import {
  checkinItem,
  checkinKey,
  dequeue,
  enqueue,
  loadQueue,
  queueSize,
  reflectionItem,
  reflectionKey,
  type StoreLike,
} from './queue'
import { EMPTY_CHECKIN } from './checkins'
import { EMPTY_REFLECTION } from './reflections'

/** In-memory async store standing in for IndexedDB. */
function memStore(): StoreLike {
  const map = new Map<string, unknown>()
  return {
    get: async (k) => map.get(k),
    set: async (k, v) => void map.set(k, v),
  }
}

const odyssey = { id: 'o1', number: 1 }

describe('queue keys', () => {
  it('builds stable per-target keys', () => {
    expect(checkinKey('o1', '2026-07-12')).toBe('checkin:o1:2026-07-12')
    expect(reflectionKey('o1', 3)).toBe('reflection:o1:3')
  })
})

describe('enqueue / loadQueue / dequeue', () => {
  it('round-trips an item', async () => {
    const store = memStore()
    await enqueue(checkinItem(odyssey, '2026-07-12', 7, { ...EMPTY_CHECKIN, done: true }), store)
    const items = await loadQueue(store)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'checkin', odysseyId: 'o1', dateISO: '2026-07-12' })
  })

  it('collapses repeated edits to the same target (latest wins)', async () => {
    const store = memStore()
    await enqueue(checkinItem(odyssey, '2026-07-12', 7, { ...EMPTY_CHECKIN, oneLine: 'first' }), store)
    await enqueue(checkinItem(odyssey, '2026-07-12', 7, { ...EMPTY_CHECKIN, oneLine: 'second' }), store)
    const items = await loadQueue(store)
    expect(items).toHaveLength(1)
    expect((items[0] as { draft: { oneLine: string } }).draft.oneLine).toBe('second')
  })

  it('keeps distinct targets separate', async () => {
    const store = memStore()
    await enqueue(checkinItem(odyssey, '2026-07-12', 7, EMPTY_CHECKIN), store)
    await enqueue(checkinItem(odyssey, '2026-07-13', 8, EMPTY_CHECKIN), store)
    await enqueue(reflectionItem(odyssey, 1, '2026-07-13', EMPTY_REFLECTION), store)
    expect(await queueSize(store)).toBe(3)
  })

  it('dequeues by key', async () => {
    const store = memStore()
    await enqueue(checkinItem(odyssey, '2026-07-12', 7, EMPTY_CHECKIN), store)
    await dequeue(checkinKey('o1', '2026-07-12'), store)
    expect(await queueSize(store)).toBe(0)
  })

  it('returns empty when nothing is stored', async () => {
    expect(await loadQueue(memStore())).toEqual([])
  })
})
