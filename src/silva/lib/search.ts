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

/**
 * Splits a query into the terms that must *all* be present, honouring
 * double quotes around a phrase that must appear intact.
 *
 * The whole query used to be matched as one contiguous substring, which
 * quietly failed the most ordinary way anyone searches a thing they half
 * remember: two words from different parts of it. "dog tram" found nothing
 * against "A dog sat at the tram stop…" — not because the passage wasn't
 * there, but because those five characters never sit together. Requiring
 * every term, each anywhere, is what people already expect a search box to
 * do; quoting restores the old exact behaviour when it is what you want.
 */
export function queryTerms(query: string): string[] {
  const terms: string[] = []
  // Quoted runs first, then whatever plain words are left over.
  const rest = query.toLowerCase().replace(/"([^"]+)"/g, (_match, phrase: string) => {
    const trimmed = phrase.trim()
    if (trimmed) terms.push(trimmed)
    return ' '
  })
  for (const word of rest.split(/\s+/)) {
    if (word) terms.push(word)
  }
  return terms
}

/** Case-insensitive match against everything a thing carries in its own
 *  words — body, note, locator, its handle (derived from body, but cheap
 *  to check directly too) — plus its source's title and author, when it
 *  has one. "I remember something Shelby Foote said" should find it even
 *  when "Shelby" never appears in the passage itself; the caller
 *  (ForageView) looks these up, since a Thing only carries a `sourceId`,
 *  not the Source record.
 *
 *  `locator` is in that list because it holds your own words about where
 *  you were — "overheard on the 32 tram" is exactly the fragment someone
 *  remembers and types, and it was the one field a thing carries that
 *  searching could not reach.
 *
 *  `link` is in it for the opposite reason — nobody types a URL from memory,
 *  but a publication's domain is the one part of it people do recall
 *  ("something on nesslabs"), and a kept link *loses* its URL from the body
 *  the moment the article's title lands there (lib/linkFacts.ts). Without
 *  this the piece became unfindable by the only handle its reader had. */
export function lexicalMatch(query: string, thing: Thing, sourceTitle = '', sourceAuthor = ''): boolean {
  const terms = queryTerms(query)
  if (terms.length === 0) return false

  const haystack = [
    thing.body,
    thing.note,
    thing.locator,
    thing.handle,
    thing.link || '',
    sourceTitle,
    sourceAuthor,
  ].join(' ').toLowerCase()

  return terms.every((term) => haystack.includes(term))
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
