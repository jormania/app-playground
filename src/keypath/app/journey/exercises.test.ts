import { describe, expect, it } from 'vitest'
import { songOf } from '../../engine/testing/songs'
import { Chords, FindAll, Prompts, Tune } from './exercises'

const C4 = 60, D4 = 62, E4 = 64, G4 = 67

describe('Prompts', () => {
  it('asks for one key at a time, counts wrong keys, and keeps asking until it gets the right one', () => {
    const ex = new Prompts([
      { accept: (p) => p % 12 === 2, show: [D4], say: { key: 'jPressNote', notes: [D4] } },
      { accept: (p) => p % 12 === 4, say: { key: 'jPressNote', notes: [E4] } },
    ])
    expect(ex.view()).toMatchObject({ targets: [D4], done: 0, total: 2 })
    expect(ex.press(C4)).toBe('wrong')
    expect(ex.press(D4 + 12)).toBe('right') // any D: it's the name that counts
    expect(ex.view()).toMatchObject({ targets: [], done: 1 })
    expect(ex.press(E4)).toBe('right')
    expect(ex.finished).toBe(true)
    expect(ex.wrong).toBe(1)
  })
})

describe('FindAll', () => {
  it('needs different keys of the same name; the same one twice is harmless', () => {
    const ex = new FindAll(0, 3, { key: 'jFindThreeCs' })
    expect(ex.press(C4)).toBe('right')
    expect(ex.press(C4)).toBeNull()
    expect(ex.press(D4)).toBe('wrong')
    expect(ex.press(48)).toBe('right')
    expect(ex.finished).toBe(false)
    expect(ex.press(72)).toBe('right')
    expect(ex).toMatchObject({ finished: true, wrong: 1 })
  })
})

describe('Chords', () => {
  const C = { pitchClasses: [0, 4, 7], show: [C4, E4, G4], say: { key: 'jChord' as const } }

  it('counts a chord whose keys land within the window, in any order and octave', () => {
    const ex = new Chords([C, C], 100)
    expect(ex.press(G4, 0)).toBeNull()
    expect(ex.press(C4, 30)).toBeNull()
    expect(ex.press(E4, 90)).toBe('right')
    ;[G4, C4, E4].forEach((p) => ex.release(p))
    expect(ex.press(E4 - 12, 1000)).toBeNull()
    expect(ex.press(C4 + 12, 1010)).toBeNull()
    expect(ex.press(G4 - 12, 1020)).toBe('right')
    expect(ex).toMatchObject({ finished: true, wrong: 0 })
  })

  it('calls keys spread too far apart a near miss, not a wrong note, and waits for every key to lift', () => {
    const ex = new Chords([C], 100)
    ex.press(C4, 0)
    ex.press(E4, 50)
    expect(ex.press(G4, 400)).toBe('spread')
    expect(ex.wrong).toBe(0)
    // Still holding E and G: nothing counts until all are up.
    ex.release(C4)
    expect(ex.press(C4, 500)).toBeNull()
    ;[C4, E4, G4].forEach((p) => ex.release(p))
    ex.press(C4, 600)
    ex.press(E4, 610)
    expect(ex.press(G4, 620)).toBe('right')
  })

  it('counts a key outside the chord as wrong', () => {
    const ex = new Chords([C], 100)
    expect(ex.press(D4, 0)).toBe('wrong')
    expect(ex.wrong).toBe(1)
  })
})

describe('Tune', () => {
  const song = songOf([[C4, 0], [D4, 500], [E4, 1000]])

  it('waits on each note; lights the next key in a practice', () => {
    const ex = new Tune(song, 'right', true, { key: 'jFollowLit' })
    expect(ex.view().targets).toEqual([C4])
    expect(ex.press(E4, 0)).toBe('wrong')
    expect(ex.press(C4, 0)).toBe('right')
    expect(ex.view()).toMatchObject({ targets: [D4], done: 1, total: 3 })
    expect(ex.step?.startMs).toBe(500)
    ex.press(D4, 0)
    ex.press(E4, 0)
    expect(ex).toMatchObject({ finished: true, wrong: 1 })
    expect(ex.played()).toEqual(new Set([0, 1, 2]))
  })

  it('shows no keys in a check', () => {
    expect(new Tune(song, 'right', false, { key: 'jPlayTune' }).view().targets).toEqual([])
  })
})
