// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseSmf } from '../../engine'
import { memoryStore } from '../store'
import { midiFilename, takeToSmf } from './midiExport'
import type { Recording } from './recorder'
import { saveFile } from './saveFile'
import { MAX_NAME, TakeRepo } from './takes'

const take: Recording = {
  ms: 3000,
  notes: [
    { pitch: 60, velocity: 90, startMs: 0, durationMs: 700 },
    { pitch: 64, velocity: 60, startMs: 750, durationMs: 700 },
    { pitch: 64, velocity: 60, startMs: 1500, durationMs: 700 }, // the same key again
    { pitch: 67, velocity: 127, startMs: 2250, durationMs: 750 },
  ],
  pedal: [
    { atMs: 1500, down: true },
    { atMs: 2900, down: false },
  ],
}

describe('takeToSmf', () => {
  it('writes a file the reader reads back to the same notes, at the count-in tempo', () => {
    const file = parseSmf(takeToSmf(take, { name: 'Take 1', bpm: 80 }))
    expect(file.format).toBe(0)
    expect(file.tracks[0].name).toBe('Take 1')
    expect(file.tempos[0].usPerQuarter).toBe(750_000) // 80 BPM
    expect(file.timeSignatures[0]).toMatchObject({ numerator: 4, denominator: 4 })
    // At 80 BPM a beat is 750 ms: she played on the beats, so the notes sit on whole quarters.
    expect(file.notes.map((n) => [n.pitch, n.startTick / file.ticksPerQuarter, n.velocity])).toEqual([
      [60, 0, 90],
      [64, 1, 60],
      [64, 2, 60],
      [67, 3, 127],
    ])
    for (const [i, n] of file.notes.entries()) {
      expect(Math.abs(n.startMs - take.notes[i].startMs)).toBeLessThanOrEqual(1)
      expect(Math.abs(n.endMs - n.startMs - take.notes[i].durationMs)).toBeLessThanOrEqual(2)
    }
  })

  it('without a count-in, keeps the timing exact at 120 BPM', () => {
    const file = parseSmf(takeToSmf({ ms: 1000, notes: [{ pitch: 62, velocity: 80, startMs: 333, durationMs: 100 }], pedal: [] }, { name: 'x' }))
    expect(file.tempos[0].usPerQuarter).toBe(500_000)
    expect(Math.abs(file.notes[0].startMs - 333)).toBeLessThanOrEqual(1)
  })

  it('puts the pedal on channel 1 and ends the track after the take', () => {
    const bytes = takeToSmf(take, { name: 'p', bpm: 120 })
    const cc = [...bytes].findIndex((b, i) => b === 0xb0 && bytes[i + 1] === 64 && bytes[i + 2] === 127)
    expect(cc).toBeGreaterThan(0)
    expect([...bytes.slice(-3)]).toEqual([0xff, 0x2f, 0])
  })
})

describe('midiFilename', () => {
  it('keeps letters of any language and drops what a file system minds', () => {
    expect(midiFilename('Ode to Joy, take 2')).toBe('Ode-to-Joy-take-2.mid')
    expect(midiFilename('Cântecul Norei / vara')).toBe('Cântecul-Norei-vara.mid')
    expect(midiFilename('???')).toBe('KeyPath-take.mid')
  })
})

describe('saveFile', () => {
  afterEach(() => vi.restoreAllMocks())
  const file = () => new File([new Uint8Array([1, 2, 3])], 'Take-1.mid', { type: 'audio/midi' })

  it('downloads when the browser won’t share the file (Chrome and .mid)', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const nav = { share: vi.fn(), canShare: vi.fn(() => false) }
    expect(await saveFile(file(), 'Take 1', nav)).toBe('saved')
    expect(nav.share).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('Take-1.mid')
  })

  it('shares when it can, and a closed sheet is not an error', async () => {
    const nav = { share: vi.fn(async () => {}), canShare: vi.fn(() => true) }
    expect(await saveFile(file(), 'Take 1', nav)).toBe('shared')
    expect(nav.share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Take 1', files: [expect.any(File)] }))
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' })
    expect(await saveFile(file(), 'Take 1', { share: vi.fn(async () => Promise.reject(abort)), canShare: () => true })).toBe('cancelled')
  })
})

describe('TakeRepo.rename', () => {
  it('names a take, trims and caps the name, and a blank one gives the number back', async () => {
    const repo = new TakeRepo(memoryStore())
    const t = (await repo.keep('nora', take, { style: false }))!
    await repo.rename('nora', t.id, '  My   song  ')
    expect((await repo.list('nora'))[0].name).toBe('My song')
    await repo.rename('nora', t.id, 'x'.repeat(100))
    expect((await repo.list('nora'))[0].name).toHaveLength(MAX_NAME)
    await repo.rename('nora', t.id, '   ')
    expect((await repo.list('nora'))[0]).not.toHaveProperty('name')
  })

  it('keeps the count-in tempo with the take', async () => {
    const repo = new TakeRepo(memoryStore())
    await repo.keep('nora', take, { style: false, bpm: 80 })
    expect((await repo.list('nora'))[0].bpm).toBe(80)
  })
})
