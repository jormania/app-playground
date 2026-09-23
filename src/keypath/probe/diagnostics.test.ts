import { describe, expect, it } from 'vitest'
import { evaluate, type NoteEvent } from './diagnostics'

const base = { source: 'webmidi' as const, deviceId: 'x', channel: 1 }
const on = (note: number, time: number, velocity = 80): NoteEvent => ({ ...base, type: 'noteon', note, velocity, time, receivedAt: time + 1 })
const off = (note: number, time: number): NoteEvent => ({ ...base, type: 'noteoff', note, velocity: 0, viaZeroVelocity: true, time, receivedAt: time + 1 })

describe('any-key test', () => {
  it('waits for the release, then passes', () => {
    expect(evaluate('anyKey', [on(62, 0)]).verdict).toBe('waiting')
    const r = evaluate('anyKey', [on(62, 0), off(62, 200)])
    expect(r.verdict).toBe('pass')
    expect(r.summary).toContain('D4')
  })
})

describe('repeated-note test', () => {
  const four = [0, 400, 800, 1200].flatMap((t) => [on(60, t), off(60, t + 150)])

  it('passes on four clean C4 presses and reports the onset intervals', () => {
    const r = evaluate('repeat', four)
    expect(r.verdict).toBe('pass')
    expect(r.details.join(' ')).toContain('400.0 ms')
  })

  it('keeps listening until the fourth press is released', () => {
    expect(evaluate('repeat', four.slice(0, 7)).verdict).toBe('waiting')
  })

  it('fails when a Note Off went missing', () => {
    const lost = [on(60, 0), on(60, 400), off(60, 550), on(60, 800), off(60, 950), on(60, 1200), off(60, 1350)]
    const r = evaluate('repeat', lost)
    expect(r.verdict).toBe('fail')
    expect(r.summary).toMatch(/lost Note Off/)
  })

  it('names a wrong key', () => {
    const r = evaluate('repeat', [...four, on(62, 1500), off(62, 1600)], true)
    expect(r.verdict).toBe('fail')
    expect(r.summary).toContain('D4')
  })
})

describe('chord test', () => {
  it('fails an event that arrives stamped earlier than the one before it', () => {
    const r = evaluate('chord', [on(64, 3), on(60, 0), on(67, 11), off(60, 500), off(64, 505), off(67, 510)])
    expect(r.verdict).toBe('fail')
    expect(r.summary).toMatch(/earlier timestamp/)
  })

  it('passes C–E–G and reports the onset spread', () => {
    const r = evaluate('chord', [on(60, 0), on(64, 3), on(67, 11), off(60, 500), off(64, 505), off(67, 510)])
    expect(r.verdict).toBe('pass')
    expect(r.details.join(' ')).toContain('11.0 ms')
  })

  it('waits while the chord is held', () => {
    expect(evaluate('chord', [on(60, 0), on(64, 3), on(67, 5)]).verdict).toBe('waiting')
  })

  it('fails when a chord note never arrived', () => {
    const r = evaluate('chord', [on(60, 0), on(64, 3), on(65, 5), off(60, 500), off(64, 500), off(65, 500)])
    expect(r.verdict).toBe('fail')
    expect(r.summary).toContain('Missing: G4')
  })
})

// Overlapping, as a real glissando is: each key is still down when the next goes.
const glissando = () =>
  Array.from({ length: 10 }, (_, i) => [on(60 + i, i * 20), off(60 + i, i * 20 + 30)])
    .flat()
    .sort((a, b) => a.time - b.time)

describe('glissando test', () => {
  it('waits for Finish, then passes when every note was released', () => {
    const sweep = glissando()
    expect(evaluate('sweep', sweep).verdict).toBe('waiting')
    expect(evaluate('sweep', sweep, true).verdict).toBe('pass')
  })

  it('reports a stuck key', () => {
    const sweep = glissando()
    const r = evaluate('sweep', [...sweep, on(80, 400)], true)
    expect(r.verdict).toBe('fail')
    expect(r.summary).toContain('Stuck')
  })
})
