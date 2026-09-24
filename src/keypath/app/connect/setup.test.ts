import { describe, expect, it } from 'vitest'
import { currentStep, isStuck, isXiaomiModel, stateOf, stepsFor, type SetupFacts } from './setup'

const base: SetupFacts = { access: 'idle', connected: false, xiaomi: false, otgConfirmed: false, plugConfirmed: false, heard: false }

describe('connection wizard steps', () => {
  it('walks the S24 order: plug in, allow, find, press a key', () => {
    expect(currentStep(base)).toBe('plug')
    expect(currentStep({ ...base, plugConfirmed: true })).toBe('allow')
    expect(currentStep({ ...base, plugConfirmed: true, access: 'denied' })).toBe('allow')
    expect(currentStep({ ...base, plugConfirmed: true, access: 'granted' })).toBe('find')
    expect(currentStep({ ...base, plugConfirmed: true, access: 'granted', connected: true })).toBe('play')
    expect(currentStep({ ...base, plugConfirmed: true, access: 'granted', connected: true, heard: true })).toBe('done')
  })

  it('asks for OTG first on a Xiaomi phone only', () => {
    expect(currentStep({ ...base, xiaomi: true })).toBe('otg')
    expect(currentStep({ ...base, xiaomi: true, otgConfirmed: true })).toBe('plug')
    expect(stepsFor(true)).toEqual(['browser', 'otg', 'plug', 'allow', 'find', 'play'])
    expect(stepsFor(false)).not.toContain('otg')
  })

  it('stops at the browser when Web MIDI is out of reach', () => {
    expect(currentStep({ ...base, access: 'unsupported' })).toBe('browser')
    expect(currentStep({ ...base, access: 'insecure', plugConfirmed: true })).toBe('browser')
  })

  it('skips what it can already see: a keyboard already connected goes straight to the key press', () => {
    expect(currentStep({ ...base, xiaomi: true, access: 'granted', connected: true })).toBe('play')
  })

  it('goes back to plugging in when the keyboard disappears', () => {
    expect(currentStep({ ...base, access: 'granted', connected: false, heard: true })).toBe('plug')
    expect(currentStep({ ...base, access: 'granted', connected: false, heard: true, plugConfirmed: true })).toBe('find')
  })

  it('marks steps before the current one done', () => {
    expect(stateOf('browser', 'find', false)).toBe('done')
    expect(stateOf('find', 'find', false)).toBe('current')
    expect(stateOf('play', 'find', false)).toBe('todo')
    expect(stateOf('play', 'done', false)).toBe('done')
  })

  it('shows what to check only after a step has waited a while', () => {
    expect(isStuck('find', 5999)).toBe(false)
    expect(isStuck('find', 6000)).toBe(true)
    expect(isStuck('play', 14000)).toBe(false)
    expect(isStuck('plug', 1e9)).toBe(false)
  })
})

describe('isXiaomiModel', () => {
  it('knows Xiaomi phones by name or model code', () => {
    for (const m of ['M2012K11AG', 'POCO F3', 'Redmi Note 12', 'Mi 11', '2107113SG', 'Xiaomi 14']) expect(isXiaomiModel(m), m).toBe(true)
  })
  it('leaves everyone else alone, including the S24', () => {
    for (const m of ['SM-S921B', 'Pixel 8', 'K', '', null, undefined]) expect(isXiaomiModel(m), String(m)).toBe(false)
  })
})
