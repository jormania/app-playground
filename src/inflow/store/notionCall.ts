/**
 * Every InFlow call to Notion goes through these two wrappers (audit A-03).
 *
 * **Paced.** The site's relay allows 20 requests per 10 seconds from one device
 * (`api/_shared.js`), and Notion itself about three a second. A large load or a copy to Notion
 * used to run into that and stop partway. Calls now wait their turn: at most `limit` in any
 * `windowMs`, a little under the relay's limit.
 *
 * **Retried.** A refusal that says "later" is tried again after a growing pause (0.5 s, 1 s,
 * 2 s, 4 s…, with a little jitter, or as long as Notion's Retry-After asks), up to `attempts`
 * times in all:
 *
 *   429                       always: the request was turned away, nothing happened
 *   500, 502, 503, 504        reads and updates only: they are safe to repeat
 *   network failure           reads and updates only, for the same reason
 *
 * Creating a page (`POST pages`) is retried only on 429. After a 5xx or a dropped connection
 * it may already exist, and a second try could make a duplicate; the copy log
 * (`copyToNotion`) is what makes a re-run of a copy safe instead.
 *
 * Anything else (400, 401, 403, 404…) is a real answer and is thrown at once.
 */
import type { NotionError } from '../../shared/notionClient'

export type Call = (path: string, method: string, body?: unknown) => Promise<Record<string, any>>

export interface CallOptions {
  /** Requests allowed in any window. */
  limit?: number
  windowMs?: number
  /** Tries in all, the first included. */
  attempts?: number
  baseDelayMs?: number
  /** Injected in tests. */
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Is this failure worth trying again, for this request? */
export function retryable(e: unknown, path: string, method: string): boolean {
  const status = (e as NotionError)?.status
  if (status === 429) return true
  const creates = method === 'POST' && path === 'pages'
  if (creates) return false
  if (status !== undefined) return status >= 500 && status <= 504
  // fetch rejects with a TypeError when the network is gone or the connection drops.
  return e instanceof TypeError
}

/** At most `limit` calls start in any `windowMs`; the rest wait, in order. */
export function paced(call: Call, opts: CallOptions = {}): Call {
  const limit = opts.limit ?? 18
  const windowMs = opts.windowMs ?? 10_000
  const sleep = opts.sleep ?? realSleep
  const now = opts.now ?? Date.now
  const started: number[] = []
  let queue = Promise.resolve()
  const slot = async () => {
    for (;;) {
      const t = now()
      while (started.length && t - started[0] >= windowMs) started.shift()
      if (started.length < limit) { started.push(t); return }
      await sleep(windowMs - (t - started[0]) + 5)
    }
  }
  return (path, method, body) => {
    const turn = queue.then(slot)
    queue = turn.catch(() => {})
    return turn.then(() => call(path, method, body))
  }
}

/** Tries a call again after a growing pause while the failure says "later". */
export function withRetry(call: Call, opts: CallOptions = {}): Call {
  const attempts = opts.attempts ?? 5
  const base = opts.baseDelayMs ?? 500
  const sleep = opts.sleep ?? realSleep
  return async (path, method, body) => {
    for (let i = 1; ; i++) {
      try {
        return await call(path, method, body)
      } catch (e) {
        if (i >= attempts || !retryable(e, path, method)) throw e
        const asked = (e as NotionError).retryAfter
        const wait = asked ? asked * 1000 : base * 2 ** (i - 1) * (1 + Math.random() * 0.2)
        await sleep(Math.min(wait, 30_000))
      }
    }
  }
}

/** Paced, then retried: each try waits its turn. */
export function reliable(call: Call, opts: CallOptions = {}): Call {
  return withRetry(paced(call, opts), opts)
}
