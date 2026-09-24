import { describe, expect, it } from 'vitest'
import { SimulatedConnection } from '../midi/simulatedConnection'
import { WebMidiConnection } from '../midi/webMidiConnection'
import { ProbeSession } from './probeSession'
import { buildReport } from './report'

function setup() {
  let t = 1000
  const now = () => t
  const frames: (() => void)[] = []
  const sim = new SimulatedConnection(now)
  const session = new ProbeSession(sim, now, (cb) => frames.push(cb))
  return { session, sim, advance: (ms: number) => (t += ms), flushFrames: () => frames.splice(0).forEach((f) => f()) }
}

describe('ProbeSession', () => {
  it('runs a repeated-note test end to end from simulated events', async () => {
    const { session, sim, advance } = setup()
    await session.open()
    session.startTest('repeat')
    for (let i = 0; i < 4; i++) {
      sim.press(60)
      advance(120)
      sim.release(60)
      advance(300)
    }
    const s = session.getSnapshot()
    expect(s.test?.result.verdict).toBe('pass')
    expect(s.test?.finished).toBe(true)
    expect(s.results.repeat?.verdict).toBe('pass')
    expect(s.tracker.counts).toMatchObject({ noteOn: 4, noteOff: 4, orphanOffs: 0, doubleOns: 0 })
  })

  it('samples the time to the next frame for each Note On', async () => {
    const { session, sim, advance, flushFrames } = setup()
    await session.open()
    sim.press(64)
    advance(9)
    flushFrames()
    expect(session.getSnapshot().toFrame).toEqual([9])
  })

  it('logs events newest first and leaves realtime bytes out of the log', async () => {
    const { session, sim } = setup()
    await session.open()
    sim.press(60)
    sim.release(60)
    expect(session.getSnapshot().log.map((e) => e.type)).toEqual(['noteoff', 'noteon'])
  })

  it('produces a report with counts, timing and test verdicts', async () => {
    const { session, sim, advance } = setup()
    await session.open()
    session.startTest('anyKey')
    sim.press(67, 99)
    advance(200)
    sim.release(67)
    const r = buildReport(session.getSnapshot(), null, null)
    expect(r.midi.access).toBe('granted')
    expect(r.tests.anyKey?.verdict).toBe('pass')
    expect(r.observed.velocity).toEqual({ min: 99, max: 99 })
    expect(r.recentEvents.map((e) => e.type)).toEqual(['on', 'off'])
  })

  it('records an input dropping out and coming back — the OTG auto-off signature', async () => {
    const port = { id: 'y', name: 'Digital Keyboard', manufacturer: 'Yamaha', state: 'connected', onmidimessage: null }
    const access = { inputs: new Map([['y', port]]), onstatechange: null as null | (() => void) }
    const nav = { requestMIDIAccess: () => Promise.resolve(access) } as unknown as Navigator
    let t = 0
    const session = new ProbeSession(new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => t }), () => t, () => {})
    await session.open()
    t = 600_000
    access.inputs.delete('y')
    access.onstatechange!()
    t = 660_000
    access.inputs.set('y', port)
    access.onstatechange!()
    const s = session.getSnapshot()
    expect(s.connectionHistory.map((c) => c.inputs)).toEqual([['Digital Keyboard'], [], ['Digital Keyboard']])
    const report = buildReport(s, null, null)
    expect(report.midi.drops).toBe(1)
    expect(report.midi.history[1].t).toBe(600_000)
  })

  it('reads the keyboard tempo from MIDI Clock, and Style start/stop, into the report', async () => {
    const port = { id: 'y', name: 'Digital Keyboard', manufacturer: 'Yamaha', state: 'connected', onmidimessage: null as null | ((e: unknown) => void) }
    const access = { inputs: new Map([['y', port]]), onstatechange: null }
    const nav = { requestMIDIAccess: () => Promise.resolve(access) } as unknown as Navigator
    const session = new ProbeSession(new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 0 }), () => 0, () => {})
    await session.open()
    const send = (bytes: number[], timeStamp: number) => port.onmidimessage!({ data: new Uint8Array(bytes), timeStamp })
    send([0xfa], 1)
    const interval = 60000 / (78 * 24)
    for (let i = 0; i < 60; i++) send([0xf8], 10 + i * interval)
    send([0xfc], 2000)
    const r = buildReport(session.getSnapshot(), null, null)
    expect(r.clock).toMatchObject({ tempo: { bpm: 78 }, transport: 'stopped', starts: 1, stops: 1 })
    // Clock ticks are counted, never logged.
    expect(session.getSnapshot().log).toEqual([])
  })

  it('publishes MIDI-driven changes at most once per frame — a Style burst must not re-render per message', async () => {
    const port = { id: 'y', name: 'Digital Keyboard', manufacturer: 'Yamaha', state: 'connected', onmidimessage: null as null | ((e: unknown) => void) }
    const access = { inputs: new Map([['y', port]]), onstatechange: null }
    const nav = { requestMIDIAccess: () => Promise.resolve(access) } as unknown as Navigator
    const frames: (() => void)[] = []
    const session = new ProbeSession(new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 0 }), () => 0, () => {}, (cb) => frames.push(cb))
    await session.open()
    let publishes = 0
    session.subscribe(() => publishes++)
    for (let i = 0; i < 60; i++) port.onmidimessage!({ data: new Uint8Array([0xf8]), timeStamp: i })
    expect(publishes).toBe(0)
    expect(frames).toHaveLength(1)
    frames.splice(0).forEach((f) => f())
    expect(publishes).toBe(1)
    expect(session.getSnapshot().clock.ticks.length).toBeGreaterThan(40)
  })

  it('keeps the accompaniment (channels 9–16) out of the tests and the player view, but counts it', async () => {
    const port = { id: 'y', name: 'Digital Keyboard', manufacturer: 'Yamaha', state: 'connected', onmidimessage: null as null | ((e: unknown) => void) }
    const access = { inputs: new Map([['y', port]]), onstatechange: null }
    const nav = { requestMIDIAccess: () => Promise.resolve(access) } as unknown as Navigator
    const session = new ProbeSession(new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 0 }), () => 0, () => {}, () => {})
    await session.open()
    const send = (bytes: number[], t: number) => port.onmidimessage!({ data: new Uint8Array(bytes), timeStamp: t })
    session.startTest('anyKey')
    // A Style's snare on channel 10 (0x99 = Note On, ch 10) — must not pass the test for you.
    send([0x99, 38, 93], 10)
    send([0x99, 38, 0], 15)
    expect(session.getSnapshot().test?.result.verdict).toBe('waiting')
    send([0x90, 60, 70], 20)
    send([0x90, 60, 0], 200)
    const s = session.getSnapshot()
    expect(s.test?.result.verdict).toBe('pass')
    expect(s.player.channels).toEqual([1])
    expect(s.tracker.channels).toEqual([1, 10])
    expect(buildReport(s, null, null).observed.accompanimentChannels).toEqual([10])
    // Integrity and range are also reported for you alone.
    expect(buildReport(s, null, null).observed.player).toMatchObject({ counts: { noteOn: 1, noteOff: 1, orphanOffs: 0 }, range: { lowest: 'C4', highest: 'C4' } })
  })

  it('starts the counters over when the source is swapped', async () => {
    const { session, sim } = setup()
    await session.open()
    sim.press(60)
    session.use(new SimulatedConnection())
    expect(session.getSnapshot().tracker.counts.noteOn).toBe(0)
  })
})
