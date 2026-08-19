/**
 * Local, in-browser embeddings (SILVA.md "The semantic layer"). A small
 * quantised sentence-transformer via `@huggingface/transformers`
 * (successor to `@xenova/transformers`) — model weights and the ONNX/WASM
 * runtime are fetched from Hugging Face's CDN the first time they're
 * needed and held in the browser's own Cache Storage from then on. This is
 * the one deliberate exception to the repo's usual self-hosted-asset
 * preference: it's the architecture the spec itself calls for ("fetched
 * once and held in Cache Storage"), not an oversight.
 *
 * Loaded lazily — only `loadEmbedder()` touches the network, and nothing
 * in this module calls it eagerly. See components/ForageView.tsx, the only
 * caller.
 *
 * The `@huggingface/transformers` import itself is dynamic, not just the
 * call to it — `cosineSimilarity`/`contentHash` below are plain, dependency-
 * free functions used widely (provocations.ts, graph.ts, search.ts,
 * vectorCache.ts), and a static top-level import would have pulled the
 * whole library into every one of those call sites' bundle chunk even
 * though most of them never touch the model. Confirmed via `npm run
 * build`: this dropped Silva's main chunk from 622 kB to well under half
 * that, with `@huggingface/transformers` split into its own chunk that
 * only loads once `embed()` is actually first called.
 */

import type { FeatureExtractionPipeline } from '@huggingface/transformers'

// MiniLM-class, 384-dim, quantised by default — matches SILVA.md's "~25 MB,
// MiniLM-class, 384-dim" exactly.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

// The model handles ~256 tokens well; a plain character cap is a coarse but
// dependency-free stand-in for a real tokenizer count, generous enough for
// any Silva thing (a "passage" is a quotation or a short thought, not a
// chapter) while staying safely under the model's real limit.
const MAX_EMBED_CHARS = 800

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null

function loadEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = import('@huggingface/transformers').then(
      ({ pipeline }) => pipeline('feature-extraction', MODEL_ID) as Promise<FeatureExtractionPipeline>,
    )
  }
  return pipelinePromise
}

/** Embeds one string into a 384-dim unit vector. Truncates long bodies
 *  before embedding — the model degrades past ~256 tokens, and a thing's
 *  opening is what it's actually about. */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await loadEmbedder()
  const truncated = text.length > MAX_EMBED_CHARS ? text.slice(0, MAX_EMBED_CHARS) : text
  const output = await extractor(truncated, { pooling: 'mean', normalize: true })
  return output.data as Float32Array
}

/** Standard cosine similarity, -1..1. Vectors from `embed()` are already
 *  unit-normalized (so this reduces to a dot product for them), but this
 *  stays general so it's correct for any vector pair, not just the model's
 *  own output. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/** A deterministic, dependency-free string hash (same shape as Lexi5's
 *  seed hash in lib/words.js) — used as the staleness key for a cached
 *  vector: a thing's cached vector is valid only while this still matches
 *  its current body. */
export function contentHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return (hash >>> 0).toString(36)
}
