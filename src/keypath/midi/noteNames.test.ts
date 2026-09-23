import { describe, expect, it } from 'vitest'
import { isBlackKey, noteName } from './noteNames'
import { looksLikeYamaha } from './identify'

describe('noteName', () => {
  it('uses scientific pitch: 60 is C4', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(64)).toBe('E4')
    expect(noteName(67)).toBe('G4')
    expect(noteName(36)).toBe('C2')
    expect(noteName(96)).toBe('C7')
    expect(noteName(61)).toBe('C#4')
    expect(noteName(0)).toBe('C-1')
  })

  it('knows the black keys', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([false, true, false, true, false, false, true])
  })
})

describe('looksLikeYamaha', () => {
  it('matches on manufacturer or a Yamaha-ish port name', () => {
    expect(looksLikeYamaha('Digital Keyboard', '')).toBe(true)
    expect(looksLikeYamaha('Port 1', 'Yamaha Corporation')).toBe(true)
    expect(looksLikeYamaha('PSR-E383', '')).toBe(true)
    expect(looksLikeYamaha('Arturia KeyStep', 'Arturia')).toBe(false)
  })
})
