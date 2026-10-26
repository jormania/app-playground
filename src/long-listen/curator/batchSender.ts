import { anthropicHeaders } from '../../shared/anthropic'
import type { Send } from './curator'

/**
 * A `Send` that goes through the Message Batches API instead of one request at a
 * time: every token at half price, in exchange for an answer within minutes
 * (at most 24 hours) instead of seconds. For the curation check only — nobody
 * waits on it, and it is the heaviest thing run on the owner's key (eight or
 * more Sonnet calls a run). The app itself keeps the direct sender: a listener
 * is waiting there.
 *
 * Requests made together are sent together. A request waits `gatherMs` for
 * others to join; when none has arrived for that long, the ones waiting go out
 * as one batch, and each caller gets its own message back as if it had been
 * an ordinary call. The check runs its profiles side by side, so the four
 * directions go out as one batch and the four programmes as the next.
 */
export const BATCHES_ENDPOINT = 'https://api.anthropic.com/v1/messages/batches'

export interface BatchSenderOptions {
  fetchImpl?: typeof fetch
  /** How long a request waits for others before its batch is sent. */
  gatherMs?: number
  /** How often a sent batch is asked whether it has ended. */
  pollMs?: number
  /** Said once per batch: sent, and ended. */
  log?: (line: string) => void
}

interface Waiting {
  body: Record<string, unknown>
  resolve: (message: Record<string, any>) => void
  reject: (error: Error) => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function batchSender(apiKey: string, opts: BatchSenderOptions = {}): Send {
  const { fetchImpl = fetch, gatherMs = 2000, pollMs = 30_000, log = () => {} } = opts
  const headers = anthropicHeaders(apiKey)
  let queue: Waiting[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let sent = 0

  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetchImpl(url, { ...init, headers })
    if (!res.ok) throw new Error(`Batches API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
    return res
  }

  async function run(group: Waiting[]) {
    const n = ++sent
    const ids = group.map((_, i) => `r${n}-${i}`)
    try {
      const created = await (await call(BATCHES_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ requests: group.map((w, i) => ({ custom_id: ids[i], params: w.body })) }),
      })).json()
      log(`batch ${n}: ${group.length} request(s) sent (${created.id})`)
      let batch = created
      while (batch.processing_status !== 'ended') {
        await sleep(pollMs)
        batch = await (await call(`${BATCHES_ENDPOINT}/${created.id}`)).json()
      }
      const text = await (await call(batch.results_url ?? `${BATCHES_ENDPOINT}/${created.id}/results`)).text()
      const byId = new Map<string, any>()
      for (const line of text.split('\n')) if (line.trim()) {
        const row = JSON.parse(line)
        byId.set(row.custom_id, row.result)
      }
      log(`batch ${n}: ended`)
      group.forEach((w, i) => {
        const result = byId.get(ids[i])
        if (result?.type === 'succeeded') w.resolve(result.message)
        else w.reject(new Error(`Batch request ${result?.type ?? 'missing'}${result?.error ? `: ${JSON.stringify(result.error).slice(0, 300)}` : ''}`))
      })
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      for (const w of group) w.reject(error)
    }
  }

  return (body) => new Promise((resolve, reject) => {
    queue.push({ body, resolve, reject })
    clearTimeout(timer)
    timer = setTimeout(() => {
      const group = queue
      queue = []
      void run(group)
    }, gatherMs)
  })
}
