import { useEffect, useMemo, useRef, useState } from 'react'
import type { Thing, ThingKind } from '../lib/notion'
import type { Source } from '../lib/sources'
import { embed } from '../lib/embeddings'
import { indexThings } from '../lib/indexer'
import { combineResults, filterByKind, filterBySource, type SearchResult } from '../lib/search'
import { ExpandableText } from './ExpandableText'
import styles from './ForageView.module.css'

// Same order as notion.ts's ThingKind union — a fixed vocabulary, not
// derived from what's actually present, so a kind with zero things right
// now still shows as a filter (consistent, not a moving target).
const ALL_KINDS: ThingKind[] = ['Passage', 'Observation', 'Dialogue', 'Question', 'Image', 'Link', 'Fragment', 'Mine']

export interface ForageViewProps {
  things: Thing[]
  sources: Source[]
  /** Whatever App already has cached or indexed. Search starts from these
   *  rather than from an empty map, so with the indexer on it is ready the
   *  moment the view opens instead of re-walking the whole collection. */
  vectorsById: Map<string, Float32Array>
}

type IndexPhase = 'loading-model' | 'indexing' | 'ready'

/**
 * A result used to be truncated at 140 characters with nothing to click —
 * you could find the thing you were looking for and still not be able to
 * read it, which made foraging a dead end and sent you off to scroll the
 * Forest by hand. Expanding in place is what Clearings and Paths already do
 * with a long body; opening a full plate here would quietly turn Forage
 * into a second Forest, which it is deliberately not.
 */
const RESULT_PREVIEW_LENGTH = 140

/** Search — lexical and semantic matching in one box (SILVA.md "Views").
 *  Only starts loading the embedding model and indexing things the first
 *  time this view mounts (i.e. the first time Search is opened), not on
 *  every app load. Lexical results appear immediately; semantic results
 *  fill in once the model and index are ready. */
export function ForageView({ things, sources, vectorsById }: ForageViewProps) {
  // Released things are out of scope entirely: SILVA.md's "compost, not debt"
  // means something you let go has left the collection, and a box that keeps
  // digging it back up is the opposite of that. They are neither indexed (so
  // nothing is spent embedding them) nor matched.
  const forageable = useMemo(() => things.filter((t) => t.state !== 'Released'), [things])
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, { title: s.title, author: s.author }])), [sources])
  // Only sources actually in play — a book with nothing kept from it yet
  // shouldn't clutter a facet meant for narrowing what's here.
  const usedSourceIds = useMemo(() => new Set(forageable.map((t) => t.sourceId).filter((id): id is string => Boolean(id))), [forageable])
  const usedSources = useMemo(
    () => sources.filter((s) => usedSourceIds.has(s.id)).sort((a, b) => a.title.localeCompare(b.title)),
    [sources, usedSourceIds],
  )

  const [phase, setPhase] = useState<IndexPhase>('loading-model')
  const [progress, setProgress] = useState({ done: 0, total: forageable.length })
  const [vectors, setVectors] = useState<Map<string, Float32Array>>(vectorsById)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<ThingKind | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [queryVector, setQueryVector] = useState<Float32Array | null>(null)
  const [modelError, setModelError] = useState('')
  const cancelledRef = useRef(false)

  // Indexing now runs whenever the searchable set changes, not once per mount.
  // Mount-only meant anything captured or edited after Search was first opened
  // stayed unsearchable-by-meaning until the tab was reloaded. Everything
  // already indexed is a cache hit, so re-running is cheap: the pass costs one
  // embed per genuinely new or edited body (lib/indexer.ts).
  const signature = forageable.map((t) => `${t.id}:${t.body.length}`).join('|')
  useEffect(() => {
    cancelledRef.current = false

    if (forageable.length === 0) {
      setPhase('ready')
      return
    }

    indexThings(forageable, {
      isCancelled: () => cancelledRef.current,
      onProgress: (p) => {
        if (cancelledRef.current) return
        setProgress({ done: p.done, total: p.total })
        if (p.done > 0) setPhase('indexing')
      },
    })
      .then((map) => {
        if (cancelledRef.current) return
        setVectors(map)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (!cancelledRef.current) {
          setModelError((e as Error).message || 'Could not load the search model.')
        }
      })

    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` is the stable identity of `things` for indexing purposes
  }, [signature])

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

  const faceted = filterBySource(filterByKind(forageable, kindFilter), sourceFilter)
  const results: SearchResult[] = query.trim()
    ? combineResults(query, faceted, queryVector, vectors, sourceById)
    : kindFilter || sourceFilter
      ? faceted.map((thing): SearchResult => ({ thing, matchType: 'lexical', score: 1 }))
      : []

  const sourceFilterName = sourceFilter ? sourceById.get(sourceFilter)?.title : null

  return (
    <div className={styles.wrap}>
      <input
        className={styles.input}
        type="text"
        aria-label="Forage for something by its words or by its meaning"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="I remember something about…"
        disabled={forageable.length === 0}
      />

      <div className={styles.kindFilters} role="group" aria-label="Filter by kind">
        <button
          type="button"
          className={styles.kindChip}
          data-active={kindFilter === null}
          aria-pressed={kindFilter === null}
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
            aria-pressed={kindFilter === kind}
            onClick={() => setKindFilter(kindFilter === kind ? null : kind)}
          >
            {kind}
          </button>
        ))}
      </div>

      {/* A dropdown, not chips like Kind above — a forest can plausibly hold
          dozens of sources, where it holds exactly eight kinds. Only shown
          once there's a second source to actually narrow between. */}
      {usedSources.length > 1 && (
        <label className={styles.sourceFilter}>
          <span className={styles.srOnly}>Filter by source</span>
          <select
            className={styles.select}
            value={sourceFilter ?? ''}
            onChange={(e) => setSourceFilter(e.target.value || null)}
          >
            <option value="">Every source</option>
            {usedSources.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
      )}

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

      {results.length === 0 && (query.trim() || kindFilter || sourceFilter) && (
        <p className={styles.empty}>
          {query.trim()
            ? `Nothing found for "${query.trim()}".`
            : kindFilter && sourceFilterName
              ? `Nothing here is a ${kindFilter} from ${sourceFilterName}.`
              : kindFilter
                ? `Nothing kept as ${kindFilter} yet.`
                : `Nothing here is from ${sourceFilterName} yet.`}
        </p>
      )}

      <ul className={styles.list}>
        {results.map((result) => {
          const source = result.thing.sourceId ? sourceById.get(result.thing.sourceId) : undefined
          return (
            <li key={result.thing.id} className={styles.row}>
              <ExpandableText
                text={result.thing.body}
                max={RESULT_PREVIEW_LENGTH}
                textClassName={styles.body}
                toggleClassName={styles.expandToggle}
              />
              <p className={styles.meta}>
                <span className={styles.badge}>{result.matchType}</span>
                <span className={styles.state}>{result.thing.state}</span>
                {source && <span className={styles.source}>{source.title}</span>}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
