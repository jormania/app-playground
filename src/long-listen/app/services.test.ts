import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { curatorProgress } from './services'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('what the listener is told while the curator works (batch one, 23 October 2026)', () => {
  it('a wait on a programme past half a minute is said once; one that ends sooner is not', () => {
    const told: string[] = []
    const progress = curatorProgress((m) => told.push(m), 30_000)
    progress('programme', 'start')
    vi.advanceTimersByTime(29_000)
    expect(told).toEqual([])
    vi.advanceTimersByTime(2_000)
    expect(told).toEqual(['Still with the curator — a full programme can take a minute or two.'])
    progress('programme', 'end')
    progress('themes', 'start')
    progress('themes', 'end')
    vi.advanceTimersByTime(60_000)
    expect(told).toHaveLength(1)
  })

  it('a second asking is said as it happens', () => {
    const told: string[] = []
    const progress = curatorProgress((m) => told.push(m), 30_000)
    progress('themes', 'start')
    progress('themes', 'retry')
    expect(told).toEqual(['The curator is checking its first answer and asking once more — a little longer.'])
  })

  it('the quick jobs in the background say nothing', () => {
    const told: string[] = []
    const progress = curatorProgress((m) => told.push(m), 30_000)
    progress('taste', 'start')
    progress('taste', 'retry')
    vi.advanceTimersByTime(60_000)
    expect(told).toEqual([])
  })
})
