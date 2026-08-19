/**
 * Combines lexical and semantic matching in one result set — SILVA.md's
 * "a search field that does lexical and semantic matching in one box."
 * Pure and synchronous: the caller already has the query's own embedding
 * (or null, if the model hasn't loaded/finished yet) and a map of
 * thing id -> cached vector; this module never touches the model or
 * IndexedDB itself.
 */

import type { Thing, ThingKind } from './notion'
import { cosineSimilarity } from './embeddings'

export type MatchType = 'lexical' | 'semantic' | 'both'

export interface SearchResult {
  thing: Thing
  matchType: MatchType
  score: number
}

// Below this, two things just aren't related enough to be worth surfacing —
// cosine similarity on sentence embeddings is noisy near zero, so a low
// bar here would mostly show noise, not near-misses.
const SEMANTIC_THRESHOLD = 0.35
const MAX_RESULTS = 30

/** Plain case-insensitive substring match against everything a thing
 *  carries in its own words — body, note, its handle (derived from body,
 *  but cheap to check directly too) — plus its source's title and author,
 *  when it has one. "I remember something Shelby Foote said" should find
 *  it even when "Shelby" never appears in the passage itself; the caller
 *  (SearchView) looks these up, since a Thing only carries a `sourceId`,
 *  not the Source record. */
export function lexicalMatch(query: string, thing: Thing, sourceTitle = '', sourceAuthor = ''): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  return (
    thing.body.toLowerCase().includes(q) ||
    thing.note.toLowerCase().includes(q) ||
    thing.handle.toLowerCase().includes(q) ||
    sourceTitle.toLowerCase().includes(q) ||
    sourceAuthor.toLowerCase().includes(q)
  )
}

/**
 * Merges lexical and semantic matches into one ranked list, deduped by
 * thing id. A thing matching both ways is marked 'both' and ranks by
 * whichever score is higher. `queryVector` is null when semantic search
 * isn't available yet (model still loading) — lexical-only results still
 * come back immediately rather than waiting on it.
 */
export function combineResults(
  query: string,
  things: Thing[],
  queryVector: Float32Array | null,
  vectorsById: Map<string, Float32Array>,
  sourceById: Map<string, { title: string; author: string }> = new Map(),
): SearchResult[] {
  const q = query.trim()
  if (!q) return []

  const results = new Map<string, SearchResult>()

  for (const thing of things) {
    const source = thing.sourceId ? sourceById.get(thing.sourceId) : undefined
    if (lexicalMatch(q, thing, source?.title, source?.author)) {
      results.set(thing.id, { thing, matchType: 'lexical', score: 1 })
    }
  }

  if (queryVector) {
    for (const thing of things) {
      const vector = vectorsById.get(thing.id)
      if (!vector) continue
      const similarity = cosineSimilarity(queryVector, vector)
      if (similarity < SEMANTIC_THRESHOLD) continue

      const existing = results.get(thing.id)
      if (existing) {
        existing.matchType = 'both'
        existing.score = Math.max(existing.score, similarity)
      } else {
        results.set(thing.id, { thing, matchType: 'semantic', score: similarity })
      }
    }
  }

  return [...results.values()].sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS)
}

/** A facet, not a second query — narrows the candidate set before lexical/
 *  semantic matching runs. `null` (no filter) returns `things` unchanged. */
export function filterByKind(things: Thing[], kind: ThingKind | null): Thing[] {
  return kind ? things.filter((t) => t.kind === kind) : things
}

/** Same shape as `filterByKind`, for Source — "everything from this book,"
 *  independent of a text query. `null` returns everything unchanged. */
export function filterBySource(things: Thing[], sourceId: string | null): Thing[] {
  return sourceId ? things.filter((t) => t.sourceId === sourceId) : things
}
