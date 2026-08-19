/**
 * Keeping the mycorrhiza layer alive.
 *
 * SILVA.md builds three of the seven provocation kinds (Near neighbours, A
 * clearing forming, Tension) and the whole oxblood underground layer on
 * embeddings — "when you see oxblood, you are looking at something the app
 * noticed and you haven't." But nothing outside the Search view ever called
 * `embed()`, and both the provocation picker and the graph only ever *peek*
 * the cache. The practical consequence was that unless you had already opened
 * Search — a view SILVA.md explicitly says is not the point of the app — no
 * mycorrhizal provocation and no oxblood thread could ever appear. The half
 * of Silva that distinguishes it from a randomiser was unreachable.
 *
 * This module is the missing piece: a background pass that embeds every kept
 * thing that doesn't have a fresh vector already, yielding to the event loop
 * between items so it never blocks reading.
 *
 * It is **opt-in** (Settings -> "Let Silva notice things"), because the first
 * run downloads a ~25 MB model, and downloading that unasked on someone's
 * phone data is not a thing this app gets to do. After the first run the model
 * is in Cache Storage and the vectors are in IndexedDB, so subsequent passes
 * are near-instant cache hits.
 */

import { embed, contentHash } from './embeddings'
import { getVector, setVector } from './vectorCache'
import type { Thing } from './notion'

export interface IndexProgress {
  done: number
  total: number
  /** True while the very first `embed()` call is still fetching the model. */
  loadingModel: boolean
}

export interface IndexOptions {
  onProgress?: (progress: IndexProgress) => void
  /** Checked between items so a view change or unmount stops the pass
   *  promptly rather than embedding the whole collection first. */
  isCancelled?: () => boolean
  /** Yield to the event loop every N items. */
  yieldEvery?: number
}

/**
 * Embeds `things` (skipping anything already cached under its current content
 * hash) and returns every vector it has for them — cached or freshly made.
 *
 * Never rejects on an individual failure: one thing that won't embed is
 * skipped and the pass continues, because a partial mycorrhiza is strictly
 * better than none. It *does* reject if the model itself can't be loaded,
 * which is the one failure worth telling someone about.
 */
export async function indexThings(
  things: Thing[],
  { onProgress, isCancelled, yieldEvery = 5 }: IndexOptions = {},
): Promise<Map<string, Float32Array>> {
  const vectors = new Map<string, Float32Array>()
  const total = things.length
  let done = 0
  let modelReady = false

  onProgress?.({ done: 0, total, loadingModel: total > 0 })

  for (const thing of things) {
    if (isCancelled?.()) break

    const hash = contentHash(thing.body)
    let vector = await getVector(thing.id, hash)

    if (!vector) {
      // The first embed() is the one that fetches the model; a failure there
      // is a real, reportable problem rather than one awkward passage.
      if (!modelReady) {
        vector = await embed(thing.body)
        modelReady = true
      } else {
        try {
          vector = await embed(thing.body)
        } catch {
          done++
          onProgress?.({ done, total, loadingModel: false })
          continue
        }
      }
      await setVector(thing.id, hash, vector)
    }

    modelReady = true
    vectors.set(thing.id, vector)
    done++
    onProgress?.({ done, total, loadingModel: false })

    if (done % yieldEvery === 0) await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return vectors
}

/** The things worth spending embeddings on: kept ones. Understory items are
 *  not yet part of the collection (SILVA.md: "A thing that was encountered
 *  but never kept never became yours"), and Released ones have left it. */
export function indexableThings(things: Thing[]): Thing[] {
  return things.filter((thing) => thing.state === 'Kept')
}
