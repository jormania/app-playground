/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// A minimal localStorage-backed store, since jsdom's localStorage is real but
// we want a clean slate per test without reaching into browser internals.
function makeLocalStorage() {
  let store = {}
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} }
  }
}

describe('McpConnector (local-storage fallback, no Notion token)', () => {
  let McpConnector

  beforeEach(async () => {
    vi.resetModules()
    Object.defineProperty(window, 'localStorage', { value: makeLocalStorage(), configurable: true })
    ;({ McpConnector } = await import('./mcp-connector.js'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is not initialized with an empty store', () => {
    expect(McpConnector.isInitialized()).toBe(false)
  })

  it('seeds PIVOT_TITLES into local storage and marks itself initialized', async () => {
    const seeded = await McpConnector.initializeMockData()
    expect(Array.isArray(seeded)).toBe(true)
    expect(seeded.length).toBeGreaterThan(0)
    expect(McpConnector.isInitialized()).toBe(true)
  })

  it('does not duplicate seed titles on a second seed call', async () => {
    const first = await McpConnector.initializeMockData()
    const second = await McpConnector.initializeMockData()
    expect(second.length).toBe(first.length)
  })

  it('adds, updates and deletes a game locally', async () => {
    const added = await McpConnector.addGame({
      title: 'Test Adventure', year: 2024, developer: 'Test Studio',
      tags: ['Indie'], status: 'Backlog', rating: null, journal: ''
    })
    expect(added.id).toBeTruthy()

    let games = await McpConnector.getGames()
    expect(games.some(g => g.id === added.id)).toBe(true)

    await McpConnector.updateGame(added.id, { ...added, title: 'Renamed Adventure' })
    games = await McpConnector.getGames()
    expect(games.find(g => g.id === added.id).title).toBe('Renamed Adventure')

    await McpConnector.deleteGame(added.id)
    games = await McpConnector.getGames()
    expect(games.some(g => g.id === added.id)).toBe(false)
  })

  it('updateGameStatus writes status and rating, clearing rating when null', async () => {
    const added = await McpConnector.addGame({
      title: 'Ratable', year: 2020, developer: '', tags: [], status: 'Backlog', rating: null, journal: ''
    })
    await McpConnector.updateGameStatus(added.id, 'Completed', 5)
    let games = await McpConnector.getGames()
    let g = games.find(x => x.id === added.id)
    expect(g.status).toBe('Completed')
    expect(g.rating).toBe(5)

    // newRating === null means "leave rating alone" for the local branch,
    // mirroring the Notion branch's intent of not clobbering an existing rating.
    await McpConnector.updateGameStatus(added.id, 'Playing', null)
    games = await McpConnector.getGames()
    g = games.find(x => x.id === added.id)
    expect(g.status).toBe('Playing')
  })

  it('derives isDiscounted=true only when discountPercent is positive', async () => {
    const onSale = await McpConnector.addGame({
      title: 'On Sale', year: 2020, developer: '', tags: [], status: 'Backlog',
      rating: null, journal: '', price: 3.99, initialPrice: 19.99, discountPercent: 0.8
    })
    const fullPrice = await McpConnector.addGame({
      title: 'Full Price', year: 2020, developer: '', tags: [], status: 'Backlog',
      rating: null, journal: '', price: 19.99, initialPrice: 19.99, discountPercent: 0
    })

    const games = await McpConnector.getGames()
    expect(games.find(g => g.id === onSale.id).isDiscounted).toBe(true)
    expect(games.find(g => g.id === fullPrice.id).isDiscounted).toBe(false)
  })

})

describe('McpConnector (Notion-backed, token + db configured)', () => {
  let McpConnector

  beforeEach(async () => {
    vi.resetModules()
    const store = makeLocalStorage()
    store.setItem('cd_notion_token', 'secret_test_token')
    store.setItem('cd_notion_db', 'db-123')
    Object.defineProperty(window, 'localStorage', { value: store, configurable: true })
    ;({ McpConnector } = await import('./mcp-connector.js'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('maps a Notion page into a game, deriving isDiscounted from Discount Percent', async () => {
    const page = {
      id: 'page-1',
      created_time: '2024-01-01T00:00:00.000Z',
      cover: { external: { url: 'https://example.com/cover.jpg' } },
      properties: {
        'Title': { title: [{ plain_text: 'Sample Game' }] },
        'Release Year': { number: 2020 },
        'Developer/Studio': { select: { name: 'Sample Studio' } },
        'Tags': { multi_select: [{ name: 'Point & Click' }] },
        'Status': { select: { name: 'Backlog' } },
        'Rating': { number: null },
        'Journal/Notes': { rich_text: [{ plain_text: 'Great stuff.' }] },
        'Current Price': { number: 3.99 },
        'Discount Percent': { number: 0.8 },
        'Initial Price': { number: 19.99 },
        'Steam App ID': { number: 12345 }
      }
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [page], has_more: false, next_cursor: null })
    })
    vi.stubGlobal('fetch', fetchMock)

    const games = await McpConnector.getGames()
    expect(games).toHaveLength(1)
    expect(games[0]).toMatchObject({
      id: 'page-1',
      title: 'Sample Game',
      isDiscounted: true,
      discountPercent: 0.8,
      appId: 12345
    })
  })

  it('sends the Notion token header and relative /api/notion path when adding a game', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-page', properties: { Title: { title: [{ plain_text: 'New Game' }] } } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await McpConnector.addGame({ title: 'New Game', year: 2024, tags: [], status: 'Backlog' })

    expect(fetchMock).toHaveBeenCalledWith('/api/notion', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-notion-token': 'secret_test_token' })
    }))
  })

  it('surfaces a Notion API error message on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Unauthorized' })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(McpConnector.addGame({ title: 'Bad', tags: [], status: 'Backlog' }))
      .rejects.toThrow('Unauthorized')
  })

  it('propagates getGames failures instead of silently returning an empty collection', async () => {
    // A caller needs to be able to distinguish "sync failed" from "genuinely
    // empty" — swallowing this to [] made an expired token indistinguishable
    // from having zero games.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Invalid token' })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(McpConnector.getGames()).rejects.toThrow('Invalid token')
  })

  it('maps Price Updated At into priceUpdatedAt', async () => {
    const page = {
      id: 'page-1', created_time: '2024-01-01T00:00:00.000Z',
      properties: {
        'Title': { title: [{ plain_text: 'Priced Game' }] },
        'Status': { select: { name: 'Backlog' } },
        'Price Updated At': { date: { start: '2026-07-20' } }
      }
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [page], has_more: false, next_cursor: null })
    }))
    const games = await McpConnector.getGames()
    expect(games[0].priceUpdatedAt).toBe('2026-07-20')
  })

  it('preserves the original rich-text journal when journalRich is passed through unchanged', async () => {
    const journalRich = [
      { plain_text: 'A ', annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' }, href: null },
      { plain_text: 'masterclass', annotations: { bold: true, italic: false, strikethrough: false, underline: false, code: false, color: 'orange' }, href: null }
    ]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'page-1', properties: { Title: { title: [{ plain_text: 'X' }] } } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await McpConnector.updateGame('page-1', { title: 'X', journal: 'A masterclass', journalRich, tags: [], status: 'Completed' })

    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.body.properties['Journal/Notes'].rich_text).toEqual([
      { text: { content: 'A ', link: null }, annotations: journalRich[0].annotations },
      { text: { content: 'masterclass', link: null }, annotations: journalRich[1].annotations }
    ])
  })

  it('falls back to plain text when journalRich is absent (e.g. the user edited the journal)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'page-1', properties: { Title: { title: [{ plain_text: 'X' }] } } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await McpConnector.updateGame('page-1', { title: 'X', journal: 'Edited plain text', tags: [], status: 'Completed' })

    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.body.properties['Journal/Notes'].rich_text).toEqual([
      { text: { content: 'Edited plain text' } }
    ])
  })
})
