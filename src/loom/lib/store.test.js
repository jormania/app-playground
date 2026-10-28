import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Same stub shape as rhythm.test.js and drafts.test.js, this app's house style (R-017).
const store = {}
const localStorageStub = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
}
vi.stubGlobal('localStorage', localStorageStub)

import {
  DEFAULT_DATABASE_ID, getToken, setToken, clearToken,
  getDatabaseId, hasCustomDatabase, setDatabaseId, isLive,
  DEFAULT_VIEW_PREFS, loadViewPrefs, saveViewPrefs,
  testConnection, getClient,
} from './store.js'

const DB_A = '0123456789abcdef0123456789abcdef'

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('localStorage', localStorageStub)
})

describe('the token and live mode', () => {
  it('is demo mode until a token is saved', () => {
    expect(getToken()).toBe('')
    expect(isLive()).toBe(false)
    expect(getClient().mode).toBe('demo')
  })

  it('trims a pasted token, and a saved one means live Notion', () => {
    setToken('  secret_abc \n')
    expect(getToken()).toBe('secret_abc')
    expect(isLive()).toBe(true)
    expect(getClient().mode).toBe('live')
  })

  it('a whitespace-only token is not a token', () => {
    setToken('   ')
    expect(isLive()).toBe(false)
    expect(getClient().mode).toBe('demo')
  })

  it('clearing the token returns to demo mode', () => {
    setToken('secret_abc')
    clearToken()
    expect(isLive()).toBe(false)
  })

  it('reads as demo mode, rather than throwing, when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    })
    expect(getToken()).toBe('')
    expect(isLive()).toBe(false)
    expect(getDatabaseId()).toBe(DEFAULT_DATABASE_ID)
    expect(hasCustomDatabase()).toBe(false)
    expect(loadViewPrefs()).toEqual(DEFAULT_VIEW_PREFS)
    expect(() => setToken('x')).not.toThrow()
    expect(() => clearToken()).not.toThrow()
    expect(() => setDatabaseId(DB_A)).not.toThrow()
    expect(() => saveViewPrefs({ view: 'skeins' })).not.toThrow()
  })
})

describe('the database id', () => {
  it('defaults to the built-in database', () => {
    expect(getDatabaseId()).toBe(DEFAULT_DATABASE_ID)
    expect(hasCustomDatabase()).toBe(false)
  })

  it('stores the id parsed out of a pasted Notion URL and returns it', () => {
    const id = setDatabaseId(`https://www.notion.so/Loom-${DB_A}?v=fedcba9876543210fedcba9876543210`)
    expect(id).toBe(DB_A)
    expect(getDatabaseId()).toBe(DB_A)
    expect(hasCustomDatabase()).toBe(true)
  })

  it('clears the override when given blank or unparseable input', () => {
    setDatabaseId(DB_A)
    expect(setDatabaseId('not a database')).toBe('')
    expect(hasCustomDatabase()).toBe(false)
    expect(getDatabaseId()).toBe(DEFAULT_DATABASE_ID)
  })

  it('the live client is built on the configured database', () => {
    setToken('secret_abc')
    expect(getClient().databaseId).toBe(DEFAULT_DATABASE_ID)
    setDatabaseId(DB_A)
    expect(getClient().databaseId).toBe(DB_A)
  })
})

describe('view prefs', () => {
  it('starts at the defaults, and hands back a copy it cannot be mutated through', () => {
    const p = loadViewPrefs()
    expect(p).toEqual(DEFAULT_VIEW_PREFS)
    p.skeinOrder.push('x')
    p.view = 'tapestry'
    expect(loadViewPrefs().view).toBe('loom')
  })

  it('round-trips what was saved', () => {
    saveViewPrefs({ view: 'skeins', showWoven: true, skeinOrder: ['Work', 'Home'] })
    expect(loadViewPrefs()).toEqual({
      ...DEFAULT_VIEW_PREFS, view: 'skeins', showWoven: true, skeinOrder: ['Work', 'Home'],
    })
  })

  it('fills keys missing from an older save with the defaults', () => {
    // A save that predates collapseWoven must not leave it undefined.
    store.loom_view_prefs = JSON.stringify({ view: 'tapestry' })
    expect(loadViewPrefs()).toEqual({ ...DEFAULT_VIEW_PREFS, view: 'tapestry' })
  })

  it('reads corrupt storage as the defaults rather than throwing on open', () => {
    store.loom_view_prefs = '{not json'
    expect(loadViewPrefs()).toEqual(DEFAULT_VIEW_PREFS)
  })
})

describe('testConnection', () => {
  function stubFetch() {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [{ id: 'p' }] }) }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('probes the typed-but-unsaved database with the trimmed token, saving nothing', async () => {
    const fetchMock = stubFetch()
    const res = await testConnection('  secret_abc ', DB_A)
    expect(res).toEqual({ ok: true, hasEntries: true })
    const sent = JSON.stringify(fetchMock.mock.calls[0])
    expect(sent).toContain(`databases/${DB_A}/query`)
    expect(sent).toContain('secret_abc')
    expect(sent).not.toContain('secret_abc ')
    expect(Object.keys(store)).toEqual([])
  })

  it('falls back to the built-in database when the field is blank', async () => {
    const fetchMock = stubFetch()
    await testConnection('secret_abc', '')
    expect(JSON.stringify(fetchMock.mock.calls[0])).toContain(`databases/${DEFAULT_DATABASE_ID}/query`)
  })
})
