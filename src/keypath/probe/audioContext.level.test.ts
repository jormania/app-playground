// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveOutputLevel } from './outputLevel'

afterEach(() => localStorage.clear())

describe('KeyPath’s sound through the keyboard', () => {
  it('starts at the level saved on this phone, not at 0 until Diagnostics is opened', async () => {
    saveOutputLevel({ level: 50, lastLevel: 50 })
    vi.resetModules()
    const { currentKeyboardGain } = await import('./audioContext')
    expect(currentKeyboardGain()).toBeCloseTo(0.25)
  })

  it('is silent on a phone that never turned it up', async () => {
    vi.resetModules()
    const { currentKeyboardGain } = await import('./audioContext')
    expect(currentKeyboardGain()).toBe(0)
  })
})
