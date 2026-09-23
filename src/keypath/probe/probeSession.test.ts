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

  it('starts the counters over when the source is swapped', async () => {
    const { session, sim } = setup()
    await session.open()
    sim.press(60)
    session.use(new SimulatedConnection())
    expect(session.getSnapshot().tracker.counts.noteOn).toBe(0)
  })
})
