// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { loadConfig, saveConfig, isConfigured, DEFAULT_CONFIG } from './config.ts'

const KEY = 'fitCheck_config'
const ID = 'a49728e146b64480833d69c112419e83'

describe('loadConfig', () => {
  beforeEach(() => localStorage.clear())

  it('returns defaults with nothing stored', () => {
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('fills in fields that did not exist when the config was written', () => {
    localStorage.setItem(KEY, JSON.stringify({ notionToken: 'ntn_x' }))
    const config = loadConfig()
    expect(config.notionToken).toBe('ntn_x')
    expect(config.wardrobesDbId).toBe('')
    expect(config.wardrobeFilterId).toBe(null)
  })

  it('migrates a stored Notion URL down to a bare id', () => {
    // The real bug this guards: database fields were only normalised on blur of
    // an edited field, so a URL saved before link support existed survived
    // forever and reached Notion as `databases/https://...`, which comes back
    // as "Invalid request URL" — an error that names nothing useful.
    localStorage.setItem(KEY, JSON.stringify({
      garmentsDbId: `https://app.notion.com/p/${ID}`,
      wardrobesDbId: `https://www.notion.so/Fit-Check-Wardrobes-${ID}?pvs=4`,
      outfitsDbId: ID,
    }))
    const config = loadConfig()
    expect(config.garmentsDbId).toBe(ID)
    expect(config.wardrobesDbId).toBe(ID)
    expect(config.outfitsDbId).toBe(ID)
  })

  it('leaves an unrecognisable value alone rather than blanking it', () => {
    // Losing what someone typed is worse than letting Test connection report a
    // real error about it.
    localStorage.setItem(KEY, JSON.stringify({ garmentsDbId: 'something-odd' }))
    expect(loadConfig().garmentsDbId).toBe('something-odd')
  })

  it('leaves empty database fields empty', () => {
    localStorage.setItem(KEY, JSON.stringify({ garmentsDbId: '' }))
    expect(loadConfig().garmentsDbId).toBe('')
  })

  it('survives corrupt JSON rather than throwing on startup', () => {
    localStorage.setItem(KEY, '{not json')
    expect(() => loadConfig()).not.toThrow()
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
  })
})

describe('saveConfig / isConfigured', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips through storage', () => {
    saveConfig({ ...DEFAULT_CONFIG, notionToken: 'ntn_x', garmentsDbId: ID })
    const loaded = loadConfig()
    expect(loaded.notionToken).toBe('ntn_x')
    expect(loaded.garmentsDbId).toBe(ID)
  })

  it('needs both a token and a garments database to count as configured', () => {
    expect(isConfigured({ ...DEFAULT_CONFIG })).toBe(false)
    expect(isConfigured({ ...DEFAULT_CONFIG, notionToken: 'ntn_x' })).toBe(false)
    expect(isConfigured({ ...DEFAULT_CONFIG, garmentsDbId: ID })).toBe(false)
    expect(isConfigured({ ...DEFAULT_CONFIG, notionToken: 'ntn_x', garmentsDbId: ID })).toBe(true)
  })
})
