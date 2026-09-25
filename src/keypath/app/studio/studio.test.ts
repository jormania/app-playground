import { describe, expect, it, vi } from 'vitest'
import type { MidiEvent } from '../../midi/types'
import { memoryStore } from '../store'
import { LOOKAHEAD_MS, Playback, type Clock, type Sink } from './playback'
import { CLICK, Metronome } from './metronome'
import { Recorder, type Recording } from './recorder'
import { keyboardSink } from './sinks'
import { MAX_KEPT, TakeRepo } from './takes'

const ev = (e: Partial<MidiEvent> & { type: string }) => ({ channel: 1, time: 0, ...e }) as unknown as MidiEvent

describe('Recorder', () => {
  it('keeps her notes and pedal, never the Style’s channels, in take time', () => {
    const r = new Recorder(1000)
    r.feed(ev({ type: 'noteon', note: 60, velocity: 70, time: 1100 }))
    r.feed(ev({ type: 'noteon', note: 36, velocity: 100, channel: 10, time: 1150 })) // Style drums
    r.feed(ev({ type: 'cc', controller: 64, value: 127, time: 1200 }))
    r.feed(ev({ type: 'noteoff', note: 60, time: 1600 }))
    r.feed(ev({ type: 'cc', controller: 64, value: 0, time: 1700 }))
    r.feed(ev({ type: 'realtime', status: 0xf8, time: 1710 }))
    expect(r.stop(2000)).toEqual({
      ms: 1000,
      notes: [{ pitch: 60, velocity: 70, startMs: 100, durationMs: 500 }],
      pedal: [
        { atMs: 200, down: true },
        { atMs: 700, down: false },
      ],
    })
  })

  it('ends keys still down, and the pedal, when the take stops', () => {
    const r = new Recorder(0)
    r.noteOn(64, 80, 100)
    r.pedal(true, 150)
    const take = r.stop(900)
    expect(take.notes).toEqual([{ pitch: 64, velocity: 80, startMs: 100, durationMs: 800 }])
    expect(take.pedal.at(-1)).toEqual({ atMs: 900, down: false })
  })

  it('closes a key struck again before its release, and ignores a release it never saw', () => {
    const r = new Recorder(0)
    r.noteOff(62, 50)
    r.noteOn(60, 80, 100)
    r.noteOn(60, 90, 300)
    expect(r.stop(500).notes).toEqual([
      { pitch: 60, velocity: 80, startMs: 100, durationMs: 200 },
      { pitch: 60, velocity: 90, startMs: 300, durationMs: 200 },
    ])
  })
})

/** A clock the test moves by hand. */
function fakeClock() {
  let now = 0
  let tick: (() => void) | null = null
  const clock: Clock = {
    now: () => now,
    every: (_ms, fn) => {
      tick = fn
      return () => (tick = null)
    },
  }
  return {
    clock,
    advance(ms: number) {
      for (let i = 0; i < ms; i += 100) {
        now += 100
        tick?.()
      }
    },
    get running() {
      return tick !== null
    },
  }
}

function recordingSink() {
  const sent: string[] = []
  const sink: Sink = {
    noteOn: (p, v, at) => sent.push(`on ${p} ${v} @${at}`),
    noteOff: (p, at) => sent.push(`off ${p} @${at}`),
    pedal: (d, at) => sent.push(`pedal ${d ? 'down' : 'up'} @${at}`),
    silence: () => sent.push('silence'),
  }
  return { sink, sent }
}

const TAKE: Recording = {
  ms: 2000,
  notes: [
    { pitch: 60, velocity: 70, startMs: 0, durationMs: 400 },
    { pitch: 64, velocity: 80, startMs: 1000, durationMs: 500 },
  ],
  pedal: [{ atMs: 900, down: true }, { atMs: 1600, down: false }],
}

describe('Playback', () => {
  it('hands each event over a little ahead, stamped with its exact moment, and ends by itself', () => {
    const c = fakeClock()
    const { sink, sent } = recordingSink()
    const end = vi.fn()
    new Playback(TAKE, sink, c.clock, end).start()
    // Starts 50 ms out; only what falls inside the lookahead has been sent.
    expect(sent).toEqual(['on 60 70 @50'])
    c.advance(1000)
    expect(sent).toEqual(['on 60 70 @50', 'off 60 @450', 'pedal down @950', 'on 64 80 @1050'])
    c.advance(1200)
    expect(sent.slice(4)).toEqual(['off 64 @1550', 'pedal up @1650'])
    expect(end).toHaveBeenCalledOnce()
    expect(c.running).toBe(false)
  })

  it('stops at once and silences everything', () => {
    const c = fakeClock()
    const { sink, sent } = recordingSink()
    const p = new Playback(TAKE, sink, c.clock)
    p.start()
    c.advance(300)
    p.stop()
    expect(sent.at(-1)).toBe('silence')
    c.advance(3000)
    expect(sent.filter((s) => s.startsWith('on'))).toHaveLength(1)
    expect(p.playing).toBe(false)
  })

  it('never sends more than the lookahead ahead of now', () => {
    expect(LOOKAHEAD_MS).toBeLessThanOrEqual(300)
  })
})

describe('keyboardSink', () => {
  it('plays on channel 1 and, when stopped, releases what sounds now and again after the lookahead', () => {
    const send = vi.fn((_data: number[], _at?: number) => true)
    const s = keyboardSink(send)
    s.noteOn(60, 70, 100)
    s.pedal(true, 120)
    s.silence()
    expect(send.mock.calls.slice(0, 2)).toEqual([
      [[0x90, 60, 70], 100],
      [[0xb0, 64, 127], 120],
    ])
    const hush = send.mock.calls.slice(2).map(([data, at]) => [data, at === undefined ? 'now' : 'later'])
    expect(hush).toEqual([
      [[0x80, 60, 0], 'now'],
      [[0xb0, 64, 0], 'now'],
      [[0xb0, 123, 0], 'now'],
      [[0x80, 60, 0], 'later'],
      [[0xb0, 64, 0], 'later'],
      [[0xb0, 123, 0], 'later'],
    ])
  })
})

describe('TakeRepo', () => {
  const rec: Recording = { ms: 1000, notes: [{ pitch: 60, velocity: 80, startMs: 0, durationMs: 300 }], pedal: [] }

  it('numbers takes per player, lists the newest first, and favourites and deletes them', async () => {
    const repo = new TakeRepo(memoryStore())
    const a = await repo.keep('nora', rec, { style: false }, new Date('2026-09-24T10:00:00Z'))
    const b = await repo.keep('nora', rec, { style: true, songId: 'starter:ode', songTitle: 'Ode to Joy' }, new Date('2026-09-24T11:00:00Z'))
    expect([a?.n, b?.n]).toEqual([1, 2])
    expect((await repo.list('nora')).map((t) => t.n)).toEqual([2, 1])
    await repo.update('nora', a!.id, { favourite: true })
    expect((await repo.list('nora')).find((t) => t.id === a!.id)?.favourite).toBe(true)
    await repo.remove('nora', b!.id)
    expect((await repo.list('nora')).map((t) => t.n)).toEqual([1])
    // Numbers are never reused.
    expect((await repo.keep('nora', rec, { style: false }))?.n).toBe(2)
    expect(await repo.list('gabriel')).toEqual([])
  })

  it('refuses to keep more than the limit, rather than dropping one silently', async () => {
    const repo = new TakeRepo(memoryStore())
    for (let i = 0; i < MAX_KEPT; i++) await repo.keep('nora', rec, { style: false })
    expect(await repo.keep('nora', rec, { style: false })).toBeNull()
    expect(await repo.list('nora')).toHaveLength(MAX_KEPT)
  })
})

describe('Metronome', () => {
  it('clicks every beat from the take’s first beat, louder on each bar’s first, a little ahead of time', () => {
    const c = fakeClock()
    const { sink, sent } = recordingSink()
    const m = new Metronome(sink, 120, 1000, c.clock) // a beat every 500 ms, beat 1 at 1000
    m.start()
    expect(sent).toEqual([]) // nothing yet: beat 1 is further off than the lookahead
    c.advance(1000)
    const ons = () => sent.filter((x) => x.startsWith('on'))
    expect(ons()).toEqual([`on ${CLICK} 110 @1000`]) // handed over with its exact time; 1500 is past the lookahead
    c.advance(1800)
    expect(ons().map((x) => x.split(' ')[2])).toEqual(['110', '70', '70', '70', '110']) // bar 2 starts at 3000
    expect(sent.some((x) => x.startsWith(`off ${CLICK}`))).toBe(true)
    m.stop()
    expect(sent.at(-1)).toBe('silence')
    expect(c.running).toBe(false)
  })

  it('knows its own clicks when the keyboard sends them back, and not her notes', () => {
    const c = fakeClock()
    const { sink } = recordingSink()
    const m = new Metronome(sink, 120, 0, c.clock)
    m.start()
    c.advance(600)
    expect(m.isClick(CLICK, 505)).toBe(true) // the 500 ms click, echoed 5 ms late
    expect(m.isClick(CLICK, 250)).toBe(false) // the same key between clicks: hers
    expect(m.isClick(60, 500)).toBe(false) // another key on the beat: hers
    m.stop()
  })
})
