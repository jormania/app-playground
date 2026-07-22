/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function makeLocalStorage() {
  let store = {}
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} }
  }
}

describe('StudiosConnector (local-storage fallback, no Notion token)', () => {
  let StudiosConnector, SEED_STUDIOS

  beforeEach(async () => {
    vi.resetModules()
    Object.defineProperty(window, 'localStorage', { value: makeLocalStorage(), configurable: true })
    ;({ StudiosConnector, SEED_STUDIOS } = await import('./studios-connector.js'))
  })

  afterEach(() => vi.restoreAllMocks())

  it('is not initialized with an empty store', () => {
    expect(StudiosConnector.isInitialized()).toBe(false)
    expect(StudiosConnector.hasRemoteDb()).toBe(false)
  })

  it('seedIfEmpty seeds the starter list locally and is idempotent', async () => {
    const seeded = await StudiosConnector.seedIfEmpty()
    expect(seeded.map(s => s.name)).toEqual(SEED_STUDIOS)
    const second = await StudiosConnector.seedIfEmpty()
    expect(second).toHaveLength(SEED_STUDIOS.length)
  })

  it('adds and removes a studio locally', async () => {
    const added = await StudiosConnector.addStudio({ name: 'Test Studio', steamDeveloper: 'Test Dev' })
    expect(added.id).toBeTruthy()
    let list = await StudiosConnector.getStudios()
    expect(list.some(s => s.id === added.id)).toBe(true)

    await StudiosConnector.removeStudio(added.id)
    list = await StudiosConnector.getStudios()
    expect(list.some(s => s.id === added.id)).toBe(false)
  })

  it('adds and edits a studio\'s tier/notes locally', async () => {
    const added = await StudiosConnector.addStudio({ name: 'Test Studio', valueTier: 1, notes: 'first note' })
    expect(added.valueTier).toBe(1)

    const updated = await StudiosConnector.updateStudio(added.id, { ...added, valueTier: 3, notes: 'promoted' })
    expect(updated.valueTier).toBe(3)
    expect(updated.notes).toBe('promoted')

    const list = await StudiosConnector.getStudios()
    expect(list.find(s => s.id === added.id).valueTier).toBe(3)
  })
})

describe('normalizeTier', () => {
  it('returns a studio\'s numeric tier when set, and the default weight when unset', async () => {
    vi.resetModules()
    Object.defineProperty(window, 'localStorage', { value: makeLocalStorage(), configurable: true })
    const { normalizeTier, DEFAULT_TIER_WEIGHT } = await import('./studios-connector.js')
    expect(normalizeTier({ valueTier: 3 })).toBe(3)
    expect(normalizeTier({ valueTier: null })).toBe(DEFAULT_TIER_WEIGHT)
    expect(normalizeTier({})).toBe(DEFAULT_TIER_WEIGHT)
  })
})

describe('StudiosConnector (Notion-backed, token + studios db configured)', () => {
  let StudiosConnector

  beforeEach(async () => {
    vi.resetModules()
    const store = makeLocalStorage()
    store.setItem('cd_notion_token', 'secret_test_token')
    store.setItem('cd_studios_db_id', 'studios-db-123')
    Object.defineProperty(window, 'localStorage', { value: store, configurable: true })
    ;({ StudiosConnector } = await import('./studios-connector.js'))
  })

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('reports initialized and hasRemoteDb once both token and db id exist', () => {
    expect(StudiosConnector.isInitialized()).toBe(true)
    expect(StudiosConnector.hasRemoteDb()).toBe(true)
    expect(StudiosConnector.getDbId()).toBe('studios-db-123')
  })

  it('setDbId overwrites the stored id — the "paste an existing DB, don\'t create a new one" path', () => {
    StudiosConnector.setDbId('a-different-db-id')
    expect(StudiosConnector.getDbId()).toBe('a-different-db-id')
  })

  it('getStudios maps a Notion page into a studio, including the Steam Developer override and value tier', async () => {
    const page = {
      id: 'page-1',
      properties: {
        'Title': { title: [{ plain_text: 'Wadjet Eye Games' }] },
        'Steam Developer': { rich_text: [{ plain_text: 'Wadjet Eye' }] },
        'Notes': { rich_text: [{ plain_text: 'Point & click specialists' }] },
        'Personal Value Tier': { number: 3 }
      }
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [page], has_more: false, next_cursor: null })
    }))
    const studios = await StudiosConnector.getStudios()
    expect(studios).toEqual([{ id: 'page-1', name: 'Wadjet Eye Games', steamDeveloper: 'Wadjet Eye', notes: 'Point & click specialists', valueTier: 3 }])
  })

  it('getStudios maps a missing Personal Value Tier to null, not 0', async () => {
    const page = { id: 'page-2', properties: { 'Title': { title: [{ plain_text: 'Untiered Studio' }] } } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [page], has_more: false, next_cursor: null })
    }))
    const [studio] = await StudiosConnector.getStudios()
    expect(studio.valueTier).toBeNull()
  })

  it('updateStudio PATCHes the page and returns the mapped result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'page-1',
        properties: {
          'Title': { title: [{ plain_text: 'Wadjet Eye Games' }] },
          'Personal Value Tier': { number: 3 },
          'Notes': { rich_text: [{ plain_text: 'Updated notes' }] },
          'Steam Developer': { rich_text: [] }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const updated = await StudiosConnector.updateStudio('page-1', { name: 'Wadjet Eye Games', notes: 'Updated notes', valueTier: 3 })
    expect(updated.valueTier).toBe(3)
    expect(updated.notes).toBe('Updated notes')
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.path).toBe('pages/page-1')
    expect(body.method).toBe('PATCH')
  })

  it('addStudio sends the token header and relative /api/notion path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-page', properties: { Title: { title: [{ plain_text: 'New Studio' }] } } })
    })
    vi.stubGlobal('fetch', fetchMock)
    await StudiosConnector.addStudio({ name: 'New Studio' })
    expect(fetchMock).toHaveBeenCalledWith('/api/notion', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-notion-token': 'secret_test_token' })
    }))
  })

  it('seedIfEmpty does nothing when the remote db already has studios', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 'p1', properties: { Title: { title: [{ plain_text: 'Existing' }] } } }], has_more: false, next_cursor: null })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await StudiosConnector.seedIfEmpty()
    expect(result).toHaveLength(1)
    // Only the getStudios query ran — no addStudio (POST 'pages') calls fired.
    const pageCreations = fetchMock.mock.calls.filter(([, opts]) => {
      const body = JSON.parse(opts.body)
      return body.path === 'pages'
    })
    expect(pageCreations).toHaveLength(0)
  })
})
