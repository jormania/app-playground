import { describe, expect, it } from 'vitest'
import { KEYBOARD_RANGE } from './range'
import { barName } from './song'
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

  it('fills whole bars (a pickup made whole by the last bar, or the last bar whole), and both hands end together', () => {
    for (const s of STARTER_PACK) {
      const pickup = s.pickup ?? 0
      const left = (lineBeats(s.right) - pickup) % s.beatsPerBar
      expect(pickup ? [0, s.beatsPerBar - pickup] : [0], s.id).toContain(left)
      if (s.left) expect(lineBeats(s.left), s.id).toBe(lineBeats(s.right))
    }
  })

  it('bars a song with a pickup as printed: the pickup is bar 0, and each phrase starts with its own', () => {
    const birthday = starterSong(STARTER_PACK.find((s) => s.id === 'starter:birthday')!)
    const bars = (from: number, to: number) => birthday.notes.filter((n) => n.bar >= from && n.bar < to).map((n) => n.pitch)
    // "Hap-py | birth-day to | you, Hap-py |": G G, then A G C, then B and the next G G.
    expect(bars(0, 1)).toEqual([67, 67])
    expect(bars(1, 2)).toEqual([69, 67, 72])
    expect(bars(2, 3)).toEqual([71, 67, 67])
    expect(barName(birthday, 0)).toBe('0')
    expect(barName(birthday, 8)).toBe('8')
    expect(birthday.barTimes!.map((b) => b.quarters)).toEqual([1, 3, 3, 3, 3, 3, 3, 3, 2])
    // Every phrase starts on "Hap-", a beat before its bar.
    for (const [i, bar] of birthday.phrases!.entries()) {
      if (i === 0) continue
      const first = birthday.notes.find((n) => n.startMs >= birthday.barTimes![bar].startMs - birthday.phraseLeadMs![i])!
      expect(first.pitch, `phrase ${i + 1}`).toBe(i === 3 ? 77 : 67)
    }
  })

  it('lands every downbeat of When the Saints and Brahms’ Lullaby where the score has it', () => {
    const at = (id: string) => {
      const song = starterSong(STARTER_PACK.find((s) => s.id === id)!)
      return (bar: number) => song.notes.find((n) => n.startMs === song.barTimes![bar].startMs)?.pitch
    }
    // Saints: "saints" (G) on bars 1, 3, 5 and 13; "in" (C) on the last.
    const saints = at('starter:saints')
    expect([1, 3, 5, 13, 15].map(saints)).toEqual([67, 67, 67, 67, 60])
    // Brahms: G on "night" (bars 1, 2), F G A in bar 11 and G on bar 12, F E D then C to end.
    const brahms = at('starter:brahms')
    expect([1, 2, 11, 12, 15, 16].map(brahms)).toEqual([67, 67, 65, 67, 65, 60])
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
      const pickup = s.pickup ?? 0
      expect(song.notes.at(-1)!.bar).toBe(pickup ? Math.ceil((lineBeats(s.right) - pickup) / s.beatsPerBar) : lineBeats(s.right) / s.beatsPerBar - 1)
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
