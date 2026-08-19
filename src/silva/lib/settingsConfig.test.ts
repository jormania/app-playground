// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { loadSilvaConfig, saveSilvaConfig, DEFAULT_CONFIG } from './settingsConfig'

describe('settingsConfig', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the default config when nothing is stored', () => {
    expect(loadSilvaConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('round-trips a saved config', () => {
    saveSilvaConfig({ notionToken: 'secret_abc', anthropicKey: 'sk-ant-xyz', mycorrhizaEnabled: true })
    expect(loadSilvaConfig()).toEqual({
      notionToken: 'secret_abc',
      anthropicKey: 'sk-ant-xyz',
      mycorrhizaEnabled: true,
    })
  })

  it('leaves the embedding model opt-in off by default — it costs a ~25 MB download', () => {
    expect(DEFAULT_CONFIG.mycorrhizaEnabled).toBe(false)
  })

  it('fills in missing fields from a partial stored blob', () => {
    localStorage.setItem('silva_config', JSON.stringify({ notionToken: 'secret_abc' }))
    expect(loadSilvaConfig()).toEqual({
      notionToken: 'secret_abc',
      anthropicKey: '',
      mycorrhizaEnabled: false,
    })
  })
})
