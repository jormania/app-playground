import { describe, expect, it } from 'vitest'
import { KEYBOARD_RANGE } from './range'
import { fingerList, lineBeats, STARTER_PACK, starterSong } from './starterPack'
import { fingeringProblems } from './testing/fingering'

describe('starter pack', () => {
  it('has a title in both languages for every song, and unique ids', () => {
    expect(new Set(STARTER_PACK.map((s) => s.id)).size).toBe(STARTER_PACK.length)
    for (const s of STARTER_PACK) {
      expect(s.title.en).toBeTruthy()
      expect(s.title.ro).toBeTruthy()
    }
  })

  it('writes a finger for every note of every hand, and the fingering holds together', () => {
    for (const s of STARTER_PACK) {
      expect(fingerList(s.fingers?.right).length, s.id).toBe(s.right.length)
      if (s.left) expect(fingerList(s.fingers?.left).length, `${s.id} left`).toBe(s.left.length)
      expect(fingeringProblems(starterSong(s)), s.id).toEqual([])
      for (const n of starterSong(s).notes) expect([1, 2, 3, 4, 5], s.id).toContain(n.finger)
    }
  })

  it('fills whole bars, and both hands end together', () => {
    for (const s of STARTER_PACK) {
      expect(lineBeats(s.right) % s.beatsPerBar, s.id).toBe(0)
      if (s.left) expect(lineBeats(s.left), s.id).toBe(lineBeats(s.right))
    }
  })

  it('fits the PSR-E383 and stays around middle C for the right hand', () => {
    for (const s of STARTER_PACK) {
      const song = starterSong(s)
      for (const n of song.notes) {
        expect(n.pitch).toBeGreaterThanOrEqual(KEYBOARD_RANGE.low)
        expect(n.pitch).toBeLessThanOrEqual(KEYBOARD_RANGE.high)
        if (n.hand === 'right') expect(n.pitch).toBeGreaterThanOrEqual(55)
      }
    }
  })

  it('builds songs in time order, with ids in that order and bars that never go back', () => {
    for (const s of STARTER_PACK) {
      const song = starterSong(s, 'ro')
      expect(song.title).toBe(s.title.ro)
      song.notes.forEach((n, i) => {
        expect(n.id).toBe(i)
        if (i > 0) {
          expect(n.startMs).toBeGreaterThanOrEqual(song.notes[i - 1].startMs)
          expect(n.bar).toBeGreaterThanOrEqual(song.notes[i - 1].bar)
        }
      })
      expect(song.notes.at(-1)!.bar).toBe(lineBeats(s.right) / s.beatsPerBar - 1)
    }
  })

  it('times notes from the tempo, sounding for 90% of their value', () => {
    const twinkle = starterSong(STARTER_PACK.find((s) => s.id === 'starter:twinkle')!)
    const right = twinkle.notes.filter((n) => n.hand === 'right')
    // 90 bpm: a beat is 666.7 ms. C C G G A A G(2 beats)…
    expect(right.slice(0, 3).map((n) => n.startMs)).toEqual([0, 667, 1333])
    expect(right[6].durationMs).toBe(Math.round(2 * (60000 / 90) * 0.9))
    expect(right[7].bar).toBe(2)
  })
})
