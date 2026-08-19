import { useEffect, useRef, useState } from 'react'
import type { Thing, ThingKind } from '../lib/notion'
import { embed, contentHash } from '../lib/embeddings'
import { getVector, setVector } from '../lib/vectorCache'
import { combineResults, filterByKind, type SearchResult } from '../lib/search'
import styles from './SearchView.module.css'

// Same order as notion.ts's ThingKind union — a fixed vocabulary, not
// derived from what's actually present, so a kind with zero things right
// now still shows as a filter (consistent, not a moving target).
const ALL_KINDS: ThingKind[] = ['Passage', 'Observation', 'Dialogue', 'Question', 'Image', 'Link', 'Fragment', 'Mine']

export interface SearchViewProps {
  things: Thing[]
}

type IndexPhase = 'loading-model' | 'indexing' | 'ready'

function summarize(thing: Thing, max = 140): string {
  return thing.body.length > max ? `${thing.body.slice(0, max)}…` : thing.body
}

/** Search — lexical and semantic matching in one box (SILVA.md "Views").
 *  Only starts loading the embedding model and indexing things the first
 *  time this view mounts (i.e. the first time Search is opened), not on
 *  every app load. Lexical results appear immediately; semantic results
 *  fill in once the model and index are ready. */
export function SearchView({ things }: SearchViewProps) {
  const [phase, setPhase] = useState<IndexPhase>('loading-model')
  const [progress, setProgress] = useState({ done: 0, total: things.length })
  const [vectors, setVectors] = useState<Map<string, Float32Array>>(new Map())
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<ThingKind | null>(null)
  const [queryVector, setQueryVector] = useState<Float32Array | null>(null)
  const [modelError, setModelError] = useState('')
  const cancelledRef = useRef(false)

  // Index once per mount — i.e. once per visit to this tab. Re-running this
  // on every keystroke would be absurd; it only depends on `things` at the
  // moment Search was opened.
  useEffect(() => {
    cancelledRef.current = false

    async function indexAll() {
      const map = new Map<string, Float32Array>()
      try {
        for (let i = 0; i < things.length; i++) {
          if (cancelledRef.current) return
          const thing = things[i]
          const hash = contentHash(thing.body)
          let vector = await getVector(thing.id, hash)
          if (!vector) {
            vector = await embed(thing.body)
            await setVector(thing.id, hash, vector)
          }
          if (i === 0) setPhase('indexing')
          map.set(thing.id, vector)
          setProgress({ done: i + 1, total: things.length })
          // Yield to the event loop periodically so indexing a few hundred
          // things doesn't freeze typing or scrolling elsewhere in the tab.
          if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0))
        }
        if (!cancelledRef.current) {
          setVectors(map)
          setPhase('ready')
        }
      } catch (e) {
        if (!cancelledRef.current) {
          setModelError((e as Error).message || 'Could not load the search model.')
        }
      }
    }

    if (things.length === 0) {
      setPhase('ready')
    } else {
      indexAll()
    }

    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately once per mount, not per `things` change
  }, [])

  // Debounced: embed the query itself once the index is ready, so semantic
  // results fill in without blocking lexical ones (which need no vector).
  useEffect(() => {
    setQueryVector(null)
    if (phase !== 'ready' || !query.trim()) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const vector = await embed(query.trim())
        if (!cancelled) setQueryVector(vector)
      } catch {
        // Semantic search just doesn't fill in this round — lexical results
        // still work, so this is never surfaced as an error.
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, phase])

  const kindFiltered = filterByKind(things, kindFilter)
  const results: SearchResult[] = query.trim()
    ? combineResults(query, kindFiltered, queryVector, vectors)
    : kindFilter
      ? kindFiltered.map((thing): SearchResult => ({ thing, matchType: 'lexical', score: 1 }))
      : []

  return (
    <div className={styles.wrap}>
      <input
        className={styles.input}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="I remember something about…"
        disabled={things.length === 0}
      />

      <div className={styles.kindFilters}>
        <button
          type="button"
          className={styles.kindChip}
          data-active={kindFilter === null}
          onClick={() => setKindFilter(null)}
        >
          All
        </button>
        {ALL_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={styles.kindChip}
            data-active={kindFilter === kind}
            onClick={() => setKindFilter(kindFilter === kind ? null : kind)}
          >
            {kind}
          </button>
        ))}
      </div>

      {phase !== 'ready' && (
        <p className={styles.status}>
          {progress.done === 0
            ? 'Loading the search model — first time only, about 25 MB…'
            : `Indexing ${progress.done} of ${progress.total}…`}
        </p>
      )}

      {modelError && (
        <p className={styles.error}>
          {modelError} Lexical search still works while this is unavailable.
        </p>
      )}

      {results.length === 0 && (query.trim() || kindFilter) && (
        <p className={styles.empty}>
          {query.trim() ? `Nothing found for "${query.trim()}".` : `Nothing kept as ${kindFilter} yet.`}
        </p>
      )}

      <ul className={styles.list}>
        {results.map((result) => (
          <li key={result.thing.id} className={styles.row}>
            <p className={styles.body}>{summarize(result.thing)}</p>
            <p className={styles.meta}>
              <span className={styles.badge}>{result.matchType}</span>
              <span className={styles.state}>{result.thing.state}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
