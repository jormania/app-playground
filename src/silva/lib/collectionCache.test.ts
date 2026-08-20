import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Same in-memory idb-keyval stand-in as vectorCache.test.ts — happy-dom has
// no IndexedDB, and the cache's whole contract is about what survives a
// round trip through it.
const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { store.set(k, v) }),
  del: vi.fn(async (k: string) => { store.delete(k) }),
  keys: vi.fn(async () => [...store.keys()]),
}))

const {
  readCollectionCache,
  writeCollectionCache,
  needsFullSync,
  mergeById,
  fingerprintToken,
  wasPageReloaded,
  FULL_SYNC_INTERVAL_MS,
} = await import('./collectionCache')

const TOKEN = 'secret_abc123'

function collection(over: Partial<Parameters<typeof writeCollectionCache>[1]> = {}) {
  return {
    things: [{ id: 't1' }] as never,
    sources: [{ id: 's1' }] as never,
    loci: [{ id: 'l1' }] as never,
    paths: [{ id: 'p1' }] as never,
    syncedAt: '2026-08-20T10:00:00.000Z',
    fullSyncedAt: '2026-08-20T10:00:00.000Z',
    ...over,
  }
}

beforeEach(() => store.clear())

describe('collection cache — round trip', () => {
  it('reads back exactly what was written', async () => {
    await writeCollectionCache(TOKEN, collection())
    const cached = await readCollectionCache(TOKEN)
    expect(cached?.things).toEqual([{ id: 't1' }])
    expect(cached?.syncedAt).toBe('2026-08-20T10:00:00.000Z')
  })

  it('is null when nothing has ever been cached', async () => {
    expect(await readCollectionCache(TOKEN)).toBeNull()
  })

  // A cache written by one account must never render for another. Falling
  // back to a full load costs one slow open; the alternative is unforgivable.
  it('refuses a cache written under a different token', async () => {
    await writeCollectionCache(TOKEN, collection())
    expect(await readCollectionCache('secret_someone_else')).toBeNull()
  })

  it('refuses a cache from an older schema version', async () => {
    await writeCollectionCache(TOKEN, collection())
    const raw = store.get('silva:collection') as Record<string, unknown>
    store.set('silva:collection', { ...raw, version: 0 })
    expect(await readCollectionCache(TOKEN)).toBeNull()
  })

  // A half-written cache is a partial write from an interrupted session,
  // not something to render half of.
  it('refuses a cache missing any of the four lists', async () => {
    await writeCollectionCache(TOKEN, collection())
    const raw = store.get('silva:collection') as Record<string, unknown>
    store.set('silva:collection', { ...raw, paths: undefined })
    expect(await readCollectionCache(TOKEN)).toBeNull()
  })

  it('never throws when IndexedDB is unavailable', async () => {
    const idb = await import('idb-keyval')
    vi.mocked(idb.get).mockRejectedValueOnce(new Error('no IndexedDB'))
    expect(await readCollectionCache(TOKEN)).toBeNull()
    vi.mocked(idb.set).mockRejectedValueOnce(new Error('quota exceeded'))
    await expect(writeCollectionCache(TOKEN, collection())).resolves.toBeUndefined()
  })
})

describe('fingerprintToken', () => {
  it('is stable for the same token and different for another', () => {
    expect(fingerprintToken(TOKEN)).toBe(fingerprintToken(TOKEN))
    expect(fingerprintToken(TOKEN)).not.toBe(fingerprintToken('secret_other'))
  })

  // It only ever answers "same collection as last time?" — it must not be
  // the token itself sitting in a second place.
  it('does not contain the token', () => {
    expect(fingerprintToken(TOKEN)).not.toContain('secret')
  })
})

/**
 * The one thing an incremental sync cannot see: a row deleted in Notion
 * stops appearing rather than coming back marked. Only a full read notices,
 * so this is the bound on how long a deletion can linger.
 */
describe('needsFullSync', () => {
  const now = Date.parse('2026-08-20T12:00:00.000Z')

  it('is true with no cache at all', () => {
    expect(needsFullSync(null, now)).toBe(true)
  })

  it('is false when a full sync happened recently', () => {
    const cached = { fullSyncedAt: '2026-08-20T11:00:00.000Z' } as never
    expect(needsFullSync(cached, now)).toBe(false)
  })

  it('is true once the interval has elapsed', () => {
    const stale = new Date(now - FULL_SYNC_INTERVAL_MS - 1000).toISOString()
    expect(needsFullSync({ fullSyncedAt: stale } as never, now)).toBe(true)
  })

  // A corrupted date fails safe toward correctness, not toward speed.
  it('is true for an unparseable timestamp', () => {
    expect(needsFullSync({ fullSyncedAt: 'not a date' } as never, now)).toBe(true)
  })
})

describe('mergeById', () => {
  it('replaces a changed row in place, keeping order', () => {
    const cached = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }]
    const merged = mergeById(cached, [{ id: 'b', v: 2 }])
    expect(merged.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(merged[1].v).toBe(2)
  })

  it('appends rows it has never seen', () => {
    const merged = mergeById([{ id: 'a' }], [{ id: 'b' }])
    expect(merged.map((r) => r.id)).toEqual(['a', 'b'])
  })

  // The common case by far: nothing changed since yesterday.
  it('returns the cached list untouched when nothing changed', () => {
    const cached = [{ id: 'a' }]
    expect(mergeById(cached, [])).toBe(cached)
  })

  // Whole-row replacement, not a property merge: a field cleared in Notion
  // has to come back cleared, which a merge would quietly refuse to do.
  it('replaces the whole row rather than merging its fields', () => {
    const merged = mergeById([{ id: 'a', note: 'old', body: 'kept' }], [{ id: 'a', body: 'kept' } as never])
    expect(merged[0]).toEqual({ id: 'a', body: 'kept' })
  })
})

/**
 * Pulling down from the top of an installed PWA reloads the page, and that
 * gesture means "fetch everything again". It is the one moment a reader
 * asks for correctness over speed — and short of waiting out the day-long
 * interval, the only way to notice a row deleted directly in Notion.
 */
describe('wasPageReloaded', () => {
  const withNavigationType = (type: string | undefined) => {
    vi.stubGlobal('performance', {
      getEntriesByType: () => (type === undefined ? [] : [{ type }]),
    })
  }

  afterEach(() => vi.unstubAllGlobals())

  it('is true for a reload — the pull-to-refresh gesture', () => {
    withNavigationType('reload')
    expect(wasPageReloaded()).toBe(true)
  })

  // Opening the app from the homescreen must stay incremental and cheap.
  it('is false for an ordinary launch', () => {
    withNavigationType('navigate')
    expect(wasPageReloaded()).toBe(false)
  })

  it('is false for a back/forward restore', () => {
    withNavigationType('back_forward')
    expect(wasPageReloaded()).toBe(false)
  })

  // Falling back to the interval is the safe direction: at worst the
  // refresh is exactly as good as it was before this existed.
  it('is false when there is no navigation entry to read', () => {
    withNavigationType(undefined)
    expect(wasPageReloaded()).toBe(false)
  })

  it('never throws when the timing API is unavailable', () => {
    vi.stubGlobal('performance', {
      getEntriesByType: () => { throw new Error('unsupported') },
    })
    expect(wasPageReloaded()).toBe(false)
  })
})
