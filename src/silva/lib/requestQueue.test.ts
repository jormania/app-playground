import { describe, it, expect } from 'vitest'
import { createRequestQueue, isRetryable, backoffMs, BURST_CAPACITY } from './requestQueue'

/** A controllable clock: `sleep` advances it instantly, so a test can assert
 *  on real pacing decisions without real time passing. */
function fakeClock() {
  let t = 0
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms },
    advance: (ms: number) => { t += ms },
    get time() { return t },
  }
}

describe('isRetryable', () => {
  it('retries the rate limiter and transient server failures', () => {
    expect(isRetryable({ status: 429 })).toBe(true)
    expect(isRetryable({ status: 500 })).toBe(true)
    expect(isRetryable({ status: 503 })).toBe(true)
  })

  // Retrying a 400 or a 404 just burns the rate-limit budget on a request
  // that will fail identically every time.
  it('does not retry a request that was simply wrong', () => {
    expect(isRetryable({ status: 400 })).toBe(false)
    expect(isRetryable({ status: 401 })).toBe(false)
    expect(isRetryable({ status: 404 })).toBe(false)
    expect(isRetryable(new Error('offline'))).toBe(false)
  })
})

describe('backoffMs', () => {
  it('honours a Retry-After the server named', () => {
    expect(backoffMs({ status: 429, retryAfterMs: 5000 }, 1, 600)).toBe(5000)
  })

  it('backs off exponentially when the server named nothing', () => {
    expect(backoffMs({ status: 429 }, 1, 600)).toBe(600)
    expect(backoffMs({ status: 429 }, 2, 600)).toBe(1200)
    expect(backoffMs({ status: 429 }, 3, 600)).toBe(2400)
  })
})

describe('createRequestQueue', () => {
  it('runs a burst immediately — ordinary use must not feel throttled', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock, burstCapacity: 5, refillIntervalMs: 600 })

    await Promise.all([1, 2, 3, 4, 5].map((n) => enqueue(async () => n)))

    // Five tasks inside the burst: no waiting at all.
    expect(clock.time).toBe(0)
  })

  // The bug this exists for: a Kobo import creates one page per highlight in
  // a tight loop, and the relay allows 20 requests per 10 seconds.
  it('paces past the burst instead of firing everything at once', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock, burstCapacity: 3, refillIntervalMs: 600 })

    await Promise.all([1, 2, 3, 4, 5, 6].map((n) => enqueue(async () => n)))

    // Three ran free; the next three each waited out a refill interval.
    expect(clock.time).toBe(1800)
  })

  it('serialises tasks, so Promise.all over a batch cannot burst', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock, burstCapacity: 100, refillIntervalMs: 0 })
    const order: number[] = []

    await Promise.all(
      [1, 2, 3].map((n) => enqueue(async () => { order.push(n) })),
    )

    expect(order).toEqual([1, 2, 3])
  })

  it('retries a 429 and returns the eventual success', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock, refillIntervalMs: 600 })
    let attempts = 0

    const result = await enqueue(async () => {
      attempts++
      if (attempts < 3) throw { status: 429 }
      return 'landed'
    })

    expect(result).toBe('landed')
    expect(attempts).toBe(3)
  })

  it('gives up after maxAttempts rather than retrying forever', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock, maxAttempts: 3 })
    let attempts = 0

    await expect(
      enqueue(async () => { attempts++; throw { status: 429, message: 'rate limited' } }),
    ).rejects.toMatchObject({ status: 429 })
    expect(attempts).toBe(3)
  })

  it('surfaces a non-retryable failure immediately, without burning retries', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock })
    let attempts = 0

    await expect(
      enqueue(async () => { attempts++; throw { status: 400 } }),
    ).rejects.toMatchObject({ status: 400 })
    expect(attempts).toBe(1)
  })

  // A failed write must not wedge the queue: everything enqueued behind it
  // still has to run.
  it('keeps running after a task rejects', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock, burstCapacity: 10, refillIntervalMs: 0 })

    const failed = enqueue(async () => { throw { status: 400 } })
    await expect(failed).rejects.toBeDefined()

    await expect(enqueue(async () => 'still here')).resolves.toBe('still here')
  })

  it('refills over time, so a later burst is free again', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock, burstCapacity: 2, refillIntervalMs: 600 })

    await Promise.all([enqueue(async () => 1), enqueue(async () => 2)])
    expect(clock.time).toBe(0)

    // A quiet minute passes while nothing is being written.
    clock.advance(60_000)

    await Promise.all([enqueue(async () => 3), enqueue(async () => 4)])
    expect(clock.time).toBe(60_000)
  })

  it('defaults to a burst that clears the relay\'s 20-per-10s window', () => {
    // The relay (api/_shared.js) allows 20 per 10s; the default burst must
    // sit under it with room for a second tab.
    expect(BURST_CAPACITY).toBeLessThan(20)
  })

  it('passes a task\'s own rejection through unchanged', async () => {
    const clock = fakeClock()
    const enqueue = createRequestQueue({ ...clock })
    const boom = new Error('offline')
    await expect(enqueue(async () => { throw boom })).rejects.toBe(boom)
  })
})
