/**
 * Pacing every Notion request, so a bulk operation finishes instead of 429ing.
 *
 * ── The bug this exists to prevent ───────────────────────────────────────
 * Two separate rate limits sit in front of `api/notion.js`, and Silva was
 * respecting neither:
 *
 *   1. **Silva's own relay** (`api/_shared.js`) allows 20 requests per 10
 *      seconds per IP — 2/s sustained.
 *   2. **Notion itself** averages ~3 requests per second and 429s past it.
 *
 * Meanwhile the app issues writes in bursts by design: a Kobo import creates
 * one page per highlight in a tight `await` loop (a realistic import is the
 * spec's own example of 300), coining or dissolving a clearing fires one
 * PATCH per member through `Promise.all`, and a season's expiry releases
 * every aged-out thing at once on load. All three blew straight past 20
 * requests and came back "Too many requests", part-done.
 *
 * ── The shape of the fix ─────────────────────────────────────────────────
 * A token bucket rather than a fixed delay, because the two cases have
 * opposite needs. Ordinary use — open the app, keep a thing — is a handful of
 * requests that should feel instant. Bulk use is hundreds that must be
 * slowed. A bucket with a small burst capacity gives the first case zero
 * added latency and only throttles once the burst is spent, which is exactly
 * when throttling is warranted.
 *
 * Retries are layered on top: a 429 (or a transient 5xx) waits and tries
 * again rather than surfacing, since the caller's alternative is to lose the
 * write. `Retry-After` is honoured when Notion sends one.
 *
 * Everything is injectable (`sleep`, `now`) so the tests exercise real
 * queueing behaviour without real time passing.
 */

/** Below the relay's 20-per-10s, leaving headroom for a second tab. */
export const BURST_CAPACITY = 12
/** ~1.6 requests/second sustained — inside both limits above. */
export const REFILL_INTERVAL_MS = 620
export const MAX_ATTEMPTS = 4

export interface RetryableError {
  status?: number
  retryAfterMs?: number
}

export interface QueueOptions {
  burstCapacity?: number
  refillIntervalMs?: number
  maxAttempts?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Worth waiting and trying again: the rate limiter, and the transient
 *  server-side failures. A 4xx that isn't 429 is the caller's fault and
 *  retrying it only wastes the budget. */
export function isRetryable(error: unknown): boolean {
  const status = (error as RetryableError)?.status
  if (status === 429) return true
  return typeof status === 'number' && status >= 500 && status < 600
}

/** How long to wait before attempt `attempt` (1-based) of a retryable
 *  failure — `Retry-After` when the server named one, otherwise exponential
 *  backoff from the refill interval. */
export function backoffMs(error: unknown, attempt: number, refillIntervalMs = REFILL_INTERVAL_MS): number {
  const named = (error as RetryableError)?.retryAfterMs
  if (typeof named === 'number' && named > 0) return named
  return refillIntervalMs * 2 ** (attempt - 1)
}

export type Enqueue = <T>(task: () => Promise<T>) => Promise<T>

/**
 * Serialises tasks through a token bucket, retrying the retryable ones.
 *
 * Serialising matters as much as the pacing: `Promise.all` over a batch of
 * updates would otherwise fire every request in the same tick, and no amount
 * of per-request delay helps if they all start at once.
 */
export function createRequestQueue({
  burstCapacity = BURST_CAPACITY,
  refillIntervalMs = REFILL_INTERVAL_MS,
  maxAttempts = MAX_ATTEMPTS,
  sleep = defaultSleep,
  now = Date.now,
}: QueueOptions = {}): Enqueue {
  let tokens = burstCapacity
  let lastRefill = now()
  // The chain every task waits behind, so tasks run one at a time in the
  // order they were enqueued.
  let tail: Promise<unknown> = Promise.resolve()

  function refill() {
    const elapsed = now() - lastRefill
    if (elapsed < refillIntervalMs) return
    const earned = Math.floor(elapsed / refillIntervalMs)
    tokens = Math.min(burstCapacity, tokens + earned)
    lastRefill += earned * refillIntervalMs
  }

  async function takeToken() {
    refill()
    if (tokens > 0) {
      tokens--
      return
    }
    // Wait exactly until the next token is due, then take it.
    const wait = Math.max(0, refillIntervalMs - (now() - lastRefill))
    await sleep(wait)
    refill()
    tokens = Math.max(0, tokens - 1)
  }

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(async () => {
      for (let attempt = 1; ; attempt++) {
        await takeToken()
        try {
          return await task()
        } catch (error) {
          if (attempt >= maxAttempts || !isRetryable(error)) throw error
          await sleep(backoffMs(error, attempt, refillIntervalMs))
        }
      }
    })
    // Keep the chain alive whether this task resolved or rejected — a single
    // failed write must not wedge every request after it.
    tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run as Promise<T>
  }
}
