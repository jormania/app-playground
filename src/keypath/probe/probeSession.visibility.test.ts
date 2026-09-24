// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { SimulatedConnection } from '../midi/simulatedConnection'
import { ProbeSession } from './probeSession'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => setVisibility('visible'))

describe('frame timing while the page is hidden', () => {
  it('discards a sample whose frame only ran after the page came back', async () => {
    let t = 0
    const frames: (() => void)[] = []
    const sim = new SimulatedConnection(() => t)
    const session = new ProbeSession(sim, () => t, (cb) => frames.push(cb), () => {})
    await session.open()

    sim.press(60) // visible: a frame is scheduled
    setVisibility('hidden') // …then another app comes to the front
    t = 14000
    setVisibility('visible')
    frames.splice(0).forEach((f) => f()) // the held-back frame finally runs
    expect(session.getSnapshot().toFrame).toEqual([])

    sim.press(62) // a normal note: frame follows promptly
    t += 9
    frames.splice(0).forEach((f) => f())
    expect(session.getSnapshot().toFrame).toEqual([9])
  })

  it('does not even schedule a sample for a note that arrives while hidden', async () => {
    const frames: (() => void)[] = []
    const sim = new SimulatedConnection(() => 0)
    const session = new ProbeSession(sim, () => 0, (cb) => frames.push(cb), () => {})
    await session.open()
    setVisibility('hidden')
    sim.press(60)
    expect(frames).toHaveLength(0)
  })
})
