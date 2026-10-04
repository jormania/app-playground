import { describe, expect, it } from 'vitest'
import { phoneLatencyMs } from './audioContext'

describe('the phone’s sound delay', () => {
  it('adds the output’s and the context’s latency, in ms', () => {
    expect(phoneLatencyMs({ outputLatency: 0.06, baseLatency: 0.01 })).toBe(70)
  })

  it('is 0 before anything has played or where the browser doesn’t say, and never more than 300 ms', () => {
    expect(phoneLatencyMs(null)).toBe(0)
    expect(phoneLatencyMs({ outputLatency: Number.NaN, baseLatency: 0.005 })).toBe(5)
    expect(phoneLatencyMs({ outputLatency: 2, baseLatency: 0 })).toBe(300)
  })
})
