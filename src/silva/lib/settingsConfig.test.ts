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
    saveSilvaConfig({
      notionToken: 'secret_abc',
      anthropicKey: 'sk-ant-xyz',
      mycorrhizaEnabled: true,
      showGraph: false,
      showRootstock: false,
      showWalk: false,
      provocationsEnabled: false,
      autoTranscribe: true,
    })
    expect(loadSilvaConfig()).toEqual({
      notionToken: 'secret_abc',
      anthropicKey: 'sk-ant-xyz',
      mycorrhizaEnabled: true,
      showGraph: false,
      showRootstock: false,
      showWalk: false,
      provocationsEnabled: false,
      autoTranscribe: true,
    })
  })

  it('leaves the embedding model opt-in off by default — it costs a ~25 MB download', () => {
    expect(DEFAULT_CONFIG.mycorrhizaEnabled).toBe(false)
  })

  it('leaves auto-transcription off by default — sending photos to a third party is its own consent', () => {
    expect(DEFAULT_CONFIG.autoTranscribe).toBe(false)
  })

  it('leaves the graph, the walk and provocations on by default — nothing new is hidden unasked', () => {
    expect(DEFAULT_CONFIG.showGraph).toBe(true)
    expect(DEFAULT_CONFIG.showWalk).toBe(true)
    expect(DEFAULT_CONFIG.provocationsEnabled).toBe(true)
  })

  it('fills in missing fields from a partial stored blob', () => {
    localStorage.setItem('silva_config', JSON.stringify({ notionToken: 'secret_abc' }))
    expect(loadSilvaConfig()).toEqual({
      notionToken: 'secret_abc',
      anthropicKey: '',
      mycorrhizaEnabled: false,
      showGraph: true,
      showRootstock: true,
      showWalk: true,
      provocationsEnabled: true,
      autoTranscribe: false,
    })
  })
})
