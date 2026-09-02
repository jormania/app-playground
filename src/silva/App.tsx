import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, SegmentedControl } from '../ds'
import { triggerHaptic } from '../shared/haptics'
import { SilvaStore } from './lib/store'
import { isExpired, todayIso } from './lib/understory'
import type { Thing } from './lib/notion'
import type { Source } from './lib/sources'
import type { Locus } from './lib/loci'
import { withoutLocus, withLocusReplaced } from './lib/loci'
import type { Path } from './lib/paths'
import { deriveLabel } from './lib/paths'
import { ForestView } from './components/ForestView'
import { NurseryView } from './components/NurseryView'
import { IntakeField } from './components/IntakeField'
import { KoboImportPanel } from './components/KoboImportPanel'
import { ClearingsView } from './components/ClearingsView'
import { PathsView } from './components/PathsView'
import { RootsView } from './components/RootsView'
import { ForageView } from './components/ForageView'
import { ProvocationBanner } from './components/ProvocationBanner'
import { HearthView } from './components/HearthView'
import { Toasts, useToasts } from './components/Toasts'
import { TabBar } from './components/TabBar'
import { pickProvocation, provocationKey, type Provocation } from './lib/provocations'
import { readDismissed, addDismissed, hasShownThisSession, markShownThisSession } from './lib/provocationDismissals'
import {
  collectionFingerprint,
  readThresholdState,
  recordProvocationOffered,
  thresholdCrossed,
} from './lib/provocationThreshold'
import { peekVectors, pruneVectors } from './lib/vectorCache'
import { pruneLinkPreviews, getLinkPreview } from './lib/linkPreviewCache'
import { readSeen, writeSeen, withSeen, prunedSeen, type SeenMap } from './lib/seen'
import { parseSharedIntake, urlWithoutShare, type SharedIntake } from './lib/sharedIntake'
import { putLocalPhoto, localImageRef, pruneLocalPhotos } from './lib/photoStore'
import { ocrPhoto } from './lib/ocr'
import { resizePhoto, photoFilename, isImageFile } from '../shared/photo'
import { indexThings, indexableThings } from './lib/indexer'
import { loadSilvaConfig, saveSilvaConfig, type SilvaConfig } from './lib/settingsConfig'
import { confirmTension } from './lib/tension'
import { resolveSource } from './lib/sourceCapture'
import { intakeFields } from './lib/intakeFields'
import { findLinkDuplicate, duplicateNotice } from './lib/linkDuplicate'
import { normalizeCapturedText } from './lib/textNormalize'
import {
  readCollectionCache,
  writeCollectionCache,
  needsFullSync,
  wasPageReloaded,
  incrementalSince,
  mergeById,
} from './lib/collectionCache'
import { linkFactsPatch, linkSourceTitle } from './lib/linkFacts'
import { loadThemeChoice, saveThemeChoice, watchTheme, type ThemeChoice } from './lib/theme'
import styles from './App.module.css'

type View = 'forest' | 'nursery' | 'clearings' | 'paths' | 'roots' | 'forage' | 'hearth'

/** One list, two presentations: the segmented control on a desktop header and
 *  the bottom TabBar on a phone. The `value`s double as icon names in
 *  components/TabBar.tsx. */
const VIEWS: { value: View; label: string }[] = [
  { value: 'forest', label: 'Forest' },
  { value: 'nursery', label: 'Nursery' },
  { value: 'clearings', label: 'Clearings' },
  { value: 'paths', label: 'Paths' },
  { value: 'roots', label: 'Roots' },
  { value: 'forage', label: 'Forage' },
  { value: 'hearth', label: 'Hearth' },
]

/** A collection snapshot, so a failed live write can put back exactly what
 *  was on screen before the optimistic change. */
interface Forest {
  things: Thing[]
  sources: Source[]
  loci: Locus[]
  paths: Path[]
}

/** Optimistic rows carry a temporary id until Notion hands back the real one;
 *  this prefix is how the reconcile step finds them again. */
const DRAFT_PREFIX = 'silva-draft-'
let draftCounter = 0
const draftId = () => `${DRAFT_PREFIX}${(draftCounter += 1)}`

function errorText(e: unknown): string {
  const message = (e as Error)?.message
  return message ? ` (${message})` : ''
}

/**
 * The share that launched this page, read once when the module loads — and
 * the query string cleared in the same breath, so a refresh can't re-add
 * what you already captured.
 *
 * Module scope rather than a `useState` initializer, because an initializer
 * is not a safe place to do something that can only happen once: React runs
 * it twice under StrictMode, and the second run read a query string the
 * first had already cleared and concluded that nothing had been shared. Read
 * here, it is the same value however often the component mounts, and both
 * the opening view and the intake prefill come off the one read.
 */
const arrived: SharedIntake | null = (() => {
  if (typeof window === 'undefined') return null
  const parsed = parseSharedIntake(window.location.search)
  if (parsed) window.history.replaceState(null, '', urlWithoutShare(window.location.href))
  return parsed
})()

export default function App() {
  // SILVA.md: "Light and dark, syncing to the device." Syncing is the
  // *default* (choice === null), not the only option — a phone that flips
  // dark at sunset shouldn't drag a reading app along with it when the
  // reader would rather it stayed put (see lib/theme.ts).
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() => loadThemeChoice())
  useEffect(() => watchTheme(themeChoice), [themeChoice])

  function handleThemeChange(choice: ThemeChoice) {
    saveThemeChoice(choice)
    setThemeChoice(choice)
  }

  const [config, setConfig] = useState<SilvaConfig>(() => loadSilvaConfig())
  const store = useMemo(() => new SilvaStore(config.notionToken), [config.notionToken])
  const { toasts, notify, dismiss } = useToasts()

  function handleConfigChange(patch: Partial<SilvaConfig>) {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      saveSilvaConfig(next)
      return next
    })
  }

  const [things, setThings] = useState<Thing[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loci, setLoci] = useState<Locus[]>([])
  const [paths, setPaths] = useState<Path[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // A share opens on the understory, because that is where what you just
  // shared has landed — arriving on the Forest would hide it. Read from the
  // same single parse as `shared` below (`arrived`), not a second one of its
  // own: two reads of `location.search` is two chances to disagree about
  // what came in, and the first of them ran before the query was cleared.
  const [view, setView] = useState<View>(() => (arrived ? 'nursery' : 'forest'))
  const [importOpen, setImportOpen] = useState(false)
  const [provocation, setProvocation] = useState<Provocation | null>(null)
  const [vectorsById, setVectorsById] = useState<Map<string, Float32Array>>(new Map())
  const [indexing, setIndexing] = useState<{ done: number; total: number; loadingModel: boolean } | null>(null)
  const [seen, setSeen] = useState<SeenMap>({})
  const [photoBusy, setPhotoBusy] = useState(false)

  // A share arriving from elsewhere on the device. Held in state so it can be
  // cleared once taken in; `arrived` above is the one read of the URL.
  const [shared, setShared] = useState<SharedIntake | null>(arrived)

  /**
   * Draft id -> the real Notion id it became.
   *
   * ── The bug this closes ─────────────────────────────────────────────────
   * An optimistic create shows the row instantly under a `silva-draft-N`
   * id, so anything you do to it in the next moment — Keep, Release, Edit —
   * captured *that* id and eventually handed it to Notion, which of course
   * has no such page. The write failed and `write` rolled back to a
   * snapshot taken before the create had reconciled, so the local forest
   * kept a phantom draft row that could never be saved again while the real
   * row sat orphaned in Notion, invisible until a reload.
   *
   * Every request is serialised through lib/requestQueue.ts, so a commit
   * enqueued after a create always runs after that create has resolved —
   * which means this map is already populated by the time anything needs to
   * look an id up. Resolving at *commit* time rather than at call time is
   * what makes that true.
   */
  const realIdByDraft = useRef(new Map<string, string>())
  const liveId = useCallback((id: string) => realIdByDraft.current.get(id) ?? id, [])
  const isDraft = useCallback((id: string) => liveId(id).startsWith(DRAFT_PREFIX), [liveId])

  /**
   * When the collection last agreed with Notion. Set by `load` once a sync
   * succeeds, and read by the mirroring effect below — which must never
   * write a cache before there is a real sync to stamp it with, or a later
   * open would treat a half-built collection as the last known good one.
   */
  const syncStampsRef = useRef<{ syncedAt: string; fullSyncedAt: string } | null>(null)

  // The live collection, readable from inside an async callback without
  // capturing a stale closure — what `write` reverts to on failure.
  const forestRef = useRef<Forest>({ things: [], sources: [], loci: [], paths: [] })
  useEffect(() => {
    forestRef.current = { things, sources, loci, paths }
  }, [things, sources, loci, paths])

  /**
   * Keep the on-device mirror agreeing with what is on screen.
   *
   * The cache used to be written once, at the end of a load, which quietly
   * broke the one guarantee it makes. Deleting a thing removes it from
   * state and archives it in Notion — and an archived row does not come
   * back from a query marked deleted, it simply stops appearing. So an
   * incremental sync had no way to say "this is gone", the cache kept its
   * copy, and reopening inside the full-sync window put the deleted thing
   * back on screen. Mirroring state instead closes that: the delete is in
   * the cache the moment it is on screen.
   *
   * Debounced, because a load or a batch clearing action can move all four
   * lists in quick succession and only the settled result is worth storing.
   *
   * Drafts are filtered out on purpose. An optimistic row carries a
   * temporary `silva-draft-N` id until Notion hands back the real one;
   * caching one would reopen the app holding a row whose id nothing can act
   * on, *and* fetch the real row alongside it — the same thing twice.
   */
  const persistCollection = useCallback(() => {
    if (!config.notionToken) return
    const stamps = syncStampsRef.current
    if (!stamps) return
    // Read through the ref rather than closing over state, so the
    // flush-on-hide path below writes what is on screen at that moment
    // rather than whatever was current when its listener was attached.
    const { things: t, sources: s, loci: l, paths: pa } = forestRef.current
    const live = <T extends { id: string }>(rows: T[]) =>
      rows.filter((row) => !row.id.startsWith(DRAFT_PREFIX))
    void writeCollectionCache(config.notionToken, {
      things: live(t),
      sources: live(s),
      loci: live(l),
      paths: live(pa),
      ...stamps,
    })
  }, [config.notionToken])

  useEffect(() => {
    const timer = setTimeout(persistCollection, 400)
    return () => clearTimeout(timer)
  }, [things, sources, loci, paths, persistCollection])

  /**
   * The debounce above is a 400ms window in which a change is on screen but
   * not yet mirrored — and closing the app inside it drops the pending
   * write, which for a *delete* means the row comes back on the next open.
   * `pagehide` and the hidden half of `visibilitychange` are the two
   * events a phone actually fires when an app is swiped away or
   * backgrounded, so flushing on both closes that window. Writing the same
   * collection twice costs nothing.
   */
  useEffect(() => {
    const flush = () => persistCollection()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [persistCollection])

  function restore(snapshot: Forest) {
    setThings(snapshot.things)
    setSources(snapshot.sources)
    setLoci(snapshot.loci)
    setPaths(snapshot.paths)
  }

  /**
   * Local-first, as SILVA.md specifies it: "the forest in React state is what
   * the UI renders and mutates instantly (keeping, releasing, coining a locus,
   * accepting a provocation never wait on the network); the active client is
   * the backing store, written through in the background. A failed live write
   * reverts the optimistic change and surfaces a short toast — nothing is
   * silently lost."
   *
   * Before this, every handler awaited the network *before* touching state and
   * caught nothing, so on live Notion a tap did nothing for the length of a
   * round trip and a failure was an unhandled rejection with no UI change at
   * all. `apply` now runs first and `commit` runs behind it; a rejection puts
   * the whole snapshot back rather than leaving a half-applied batch.
   */
  /**
   * Counts optimistic changes, so a rollback can tell whether it is still
   * the most recent one. See `write`.
   */
  const writeGeneration = useRef(0)

  const write = useCallback(
    async (apply: () => void, commit: () => Promise<void>, failure: string) => {
      const snapshot = forestRef.current
      const generation = ++writeGeneration.current
      apply()
      try {
        await commit()
      } catch (e) {
        /**
         * Roll back only if nothing else has been applied since.
         *
         * The snapshot is the whole forest, taken before this change — so
         * restoring it unconditionally also reverts every *other* optimistic
         * change made while this request was in flight. Two taps in quick
         * succession (keep one thing, then another) and a failure on the
         * first would silently undo the second on screen while its own
         * write succeeded in Notion, leaving the two permanently
         * disagreeing. Requests are serialised through lib/requestQueue.ts,
         * so the commits are ordered; the *applies* are not, which is what
         * makes this reachable at all.
         */
        if (writeGeneration.current === generation) {
          restore(snapshot)
        }
        /**
         * Either way the device may now disagree with Notion: rolled back
         * locally when the request actually landed, or left in place when it
         * didn't. Only a full read can tell, so mark the mirror for one on
         * the next open rather than waiting out the day-long interval
         * (lib/collectionCache.ts). The stamp reaches the cache through the
         * mirroring effect, or through its flush when the app is closed.
         */
        if (syncStampsRef.current) {
          syncStampsRef.current = { ...syncStampsRef.current, fullSyncedAt: new Date(0).toISOString() }
        }
        notify(`${failure}${errorText(e)}`, { tone: 'alarm' })
      }
    },
    [notify],
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError('')

      // ── The head start ─────────────────────────────────────────────────
      // What this device already knows, on screen before Notion is asked
      // anything at all. Live collections only: the demo forest persists to
      // localStorage inside the store itself, so it has never waited on a
      // network and has nothing to gain here.
      const usingNotion = Boolean(config.notionToken)
      const cached = usingNotion ? await readCollectionCache(config.notionToken) : null
      if (cancelled) return
      if (cached) {
        // Seed the stamps from the cache itself, so the mirroring effect can
        // keep working even if *this* session's refresh never lands. Without
        // it, a delete made while offline would not reach the cache and the
        // row would be back on the next open.
        syncStampsRef.current = {
          syncedAt: cached.syncedAt,
          fullSyncedAt: cached.fullSyncedAt,
        }
        setSources(cached.sources)
        setLoci(cached.loci)
        setPaths(cached.paths)
        setThings(cached.things)
        // The line this whole change exists for: with a cache there is
        // nothing to wait for, so "Walking into the forest…" never appears
        // on a return visit — only on the very first one, and after a
        // schema change or a switch of token.
        setLoading(false)
      } else {
        setLoading(true)
      }

      try {
        // Everything, on a first open and periodically after — the only way
        // to notice a row deleted directly in Notion, which an incremental
        // read cannot see (it stops appearing rather than coming back
        // marked). Otherwise just what changed. See lib/collectionCache.ts.
        // A pull-to-refresh reloads the page, and that gesture means "fetch
        // everything again" — the one moment a reader asks for correctness
        // over speed. It is also the only way, short of waiting out the
        // day-long interval, to notice a row deleted directly in Notion.
        const fullSync = wasPageReloaded() || needsFullSync(cached)
        // Started an hour before the last sync rather than exactly at it —
        // the mark is device time and Notion's `last_edited_time` is not, so
        // a fast clock would otherwise ask for a moment that has not happened
        // server-side and silently receive nothing (lib/collectionCache.ts).
        const since = !fullSync && cached ? incrementalSince(cached.syncedAt) : undefined
        // Stamped *before* the request goes out, so an edit made while it is
        // in flight is caught next time rather than skipped. Fetching one row
        // twice costs nothing; missing one costs correctness.
        const syncStartedAt = new Date().toISOString()

        const [freshThings, freshSources, freshLoci, freshPaths] = await Promise.all([
          store.listThings(since),
          store.listSources(since),
          store.listLoci(since),
          store.listPaths(since),
        ])
        if (cancelled) return

        const loaded = fullSync ? freshThings : mergeById(cached?.things ?? [], freshThings)
        const loadedSources = fullSync ? freshSources : mergeById(cached?.sources ?? [], freshSources)
        const loadedLoci = fullSync ? freshLoci : mergeById(cached?.loci ?? [], freshLoci)
        const loadedPaths = fullSync ? freshPaths : mergeById(cached?.paths ?? [], freshPaths)

        setSources(loadedSources)
        setLoci(loadedLoci)
        setPaths(loadedPaths)

        // Season expiry: quietly release anything fully aged out of the
        // understory. No badge, no counter (SILVA.md "The understory").
        //
        // Applied locally FIRST and written through afterwards, rather than
        // awaited before the first paint. Expiry is a pure function of dates
        // (`isExpired`), so the client already knows the answer and doesn't
        // need the server to agree before rendering it — and waiting was
        // costly in exactly the case that matters: coming back after months
        // away, when a whole season has aged out at once. Those writes are
        // now paced (lib/requestQueue.ts), so awaiting a few hundred of them
        // would have held the app on "Walking into the forest…" for minutes.
        const expired = loaded.filter((thing) => isExpired(thing))
        const expiredIds = new Set(expired.map((thing) => thing.id))
        const settled = loaded.map((thing) =>
          expiredIds.has(thing.id) ? { ...thing, state: 'Released' as const } : thing,
        )
        if (cancelled) return
        setThings(settled)
        setLoading(false)

        // Hand the sync stamps to the mirroring effect below, which writes
        // the cache from React state from here on. Writing it *here* was a
        // real bug: a delete removes a row from state and archives it in
        // Notion, but an archived row simply stops appearing in a query —
        // so an incremental sync could never tell the cache it was gone,
        // and reopening within the day resurrected it on screen.
        syncStampsRef.current = {
          syncedAt: syncStartedAt,
          fullSyncedAt: fullSync ? syncStartedAt : (cached?.fullSyncedAt ?? syncStartedAt),
        }

        // Best-effort per item, in the background — one row Notion refuses
        // must not turn the whole load into "Could not load the forest", and
        // anything that fails simply expires again on the next load.
        void Promise.all(
          expired.map(async (thing) => {
            try {
              const released = await store.updateThing(thing.id, { state: 'Released' })
              if (!cancelled) {
                setThings((prev) => prev.map((t) => (t.id === released.id ? released : t)))
              }
            } catch {
              // Stays Released locally for this session; retried next load.
            }
          }),
        )

        // Reading history (lib/seen.ts) — local, derived, never in Notion.
        const loadedSeen = prunedSeen(await readSeen(), settled.map((t) => t.id))
        if (cancelled) return
        setSeen(loadedSeen)
        // Cached vectors for things that no longer exist, dropped in the
        // background. `pruneVectors` was written, tested and then never
        // called from anywhere, so IndexedDB grew by ~1.5 KB per deleted
        // thing forever. Deliberately not awaited — it is housekeeping, and
        // nothing on screen depends on it.
        void pruneVectors(settled.map((t) => t.id))
        // Same housekeeping for cached Open Graph previews, keyed by URL —
        // and the same trap: `pruneLinkPreviews` shipped written and tested
        // but uncalled, which is exactly how `pruneVectors` grew IndexedDB
        // forever before it.
        void pruneLinkPreviews(
          settled.map((t) => t.link).filter((link): link is string => Boolean(link)),
        )
        // And the costliest of the three: a page photograph is 200–400 KB
        // against a vector's ~1.5 KB, and nothing has ever reclaimed one.
        //
        // Demo mode only, and the guard is load-bearing rather than an
        // optimisation: local blobs belong exclusively to the demo forest
        // (a live thing's `image` is a Notion URL — see photoStore.ts), so
        // running this against a live collection would find *nothing* live
        // and delete every demo photo. Someone who connects Notion and
        // later opens the demo again would find its photographs silently
        // gone.
        if (!config.notionToken) {
          void pruneLocalPhotos(settled.map((t) => t.image))
        }

        // Whatever's already cached, so the graph and the picker have
        // something even when the indexer is switched off.
        const kept = indexableThings(settled)
        let vectors = await peekVectors(kept)
        if (cancelled) return
        setVectorsById(vectors)

        // The background pass that keeps the mycorrhiza layer alive. Opt-in,
        // because its first run fetches ~25 MB — see lib/indexer.ts.
        if (config.mycorrhizaEnabled && kept.length > 0) {
          try {
            vectors = await indexThings(kept, {
              isCancelled: () => cancelled,
              onProgress: (p) => {
                if (!cancelled) setIndexing(p.done >= p.total ? null : p)
              },
            })
            if (cancelled) return
            setVectorsById(vectors)
          } catch (e) {
            if (!cancelled) {
              notify(`Silva could not load its noticing model${errorText(e)}. Everything else still works.`)
            }
          } finally {
            if (!cancelled) setIndexing(null)
          }
        }

        if (cancelled) return
        await maybeProvoke(settled, loadedLoci, loadedPaths, vectors, loadedSeen, () => cancelled)
      } catch (e) {
        if (cancelled) return
        // With a cache already on screen, a failed refresh is not a failed
        // load. The forest being read is real — it is simply a little
        // behind. Going offline should mean "yesterday's forest", never a
        // blank error page over a collection this device is holding.
        if (cached) {
          notify(`Could not reach Notion${errorText(e)}. Showing what this device already had.`)
        } else {
          setError((e as Error).message || 'Could not load the forest.')
        }
        setLoading(false)
      }
    }

    /**
     * At most one provocation per session (SILVA.md's anti-feed rule) — and
     * only when a real threshold has been crossed, which is the half of that
     * rule lib/provocationThreshold.ts now enforces. Silence is a valid state.
     */
    async function maybeProvoke(
      allThings: Thing[],
      allLoci: Locus[],
      allPaths: Path[],
      vectors: Map<string, Float32Array>,
      seenHistory: SeenMap,
      isCancelled: () => boolean,
    ) {
      if (!config.provocationsEnabled) return
      if (hasShownThisSession()) return
      const fingerprint = collectionFingerprint(allThings, allLoci, allPaths)
      if (!thresholdCrossed(fingerprint, readThresholdState())) return

      const picked = pickProvocation({
        things: allThings,
        loci: allLoci,
        paths: allPaths,
        vectorsById: vectors,
        dismissed: readDismissed(),
        seen: seenHistory,
        tensionEnabled: Boolean(config.anthropicKey),
      })
      if (!picked || isCancelled()) return

      // Tension is the one kind gatherTension only pre-filters by similarity
      // band — a real contradiction still needs the model to confirm it, once,
      // for this single chosen pair. A "no" or any failure just means nothing
      // is shown, same as if no provocation had been eligible at all.
      if (picked.kind === 'tension' && !(await confirmTension(config.anthropicKey, picked.a, picked.b))) return
      if (isCancelled()) return

      markShownThisSession()
      recordProvocationOffered(fingerprint)
      setProvocation(picked)
    }

    load()
    return () => {
      cancelled = true
    }
    // `config.notionToken` adds no extra runs — `store` is already memoised
    // on exactly that value — but the photo prune above reads it directly,
    // so listing it keeps the dependency honest rather than leaning on that
    // coupling holding.
  }, [store, config.notionToken, config.anthropicKey, config.mycorrhizaEnabled, config.provocationsEnabled, notify])

  /**
   * Records that a thing was genuinely looked at. Fired by the plate's dwell
   * observer (components/useDwell.ts), from the walk and the scroll alike — so
   * the history accrues from all reading, not only from the ritual.
   *
   * Local and derived, exactly like the embedding vectors: never written to
   * Notion, and deleting it costs nothing but the signal. It stays invisible
   * by design — SILVA.md forbids scoring anything in the collection, and the
   * defence is that this measures *you*, not the things.
   */
  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      const next = withSeen(prev, [id])
      // withSeen returns the same object when nothing changed, so an already-
      // recorded thing costs neither a write nor a re-render.
      if (next !== prev) void writeSeen(next)
      return next
    })
  }, [])

  function handleKeep(id: string, note?: string) {
    // The one act SILVA.md calls "the field that means something" — it gets
    // the affirmative pulse. Release gets the lighter one just below: both
    // are decisions, but only one of them is a commitment.
    triggerHaptic('success')
    const today = todayIso()
    // An optional why, offered right at the moment of deciding (the
    // Nursery's "+ Why" toggle) rather than making the one-tap Keep wait on
    // it. Omitted entirely when blank, so it never clobbers a note already
    // on the thing.
    const patch: Partial<Thing> = { state: 'Kept', kept: today, ...(note ? { note } : {}) }
    void write(
      () => setThings((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
      async () => {
        const updated = await store.updateThing(liveId(id), patch)
        setThings((prev) => prev.map((t) => (t.id === updated.id || t.id === id ? updated : t)))
      },
      'That could not be kept',
    ).then(() => fillLinkFacts(id, things.find((t) => t.id === id)))
  }

  /**
   * What a kept link reads off its own page: the article's title, the byline
   * and year for its specimen label, and the publication to file it under —
   * so it lands in the forest as "The joy of missing out · Ness Labs · 2021"
   * rather than `https://nesslabs.com/jomo` with every other field blank,
   * leaving the note underneath it as the only thing still worth typing.
   *
   * Everything sharp lives in `lib/linkFacts.ts`, and none of it overrides
   * you: only a body that is nothing but a URL, only an empty locator, only
   * a thing with no source. Runs *after* the keep has been written through —
   * the thing has a live id by then — and never blocks it: the preview is
   * usually already in the device cache (the Nursery row fetched it for its
   * thumbnail), and when it isn't, a slow or failed fetch simply leaves the
   * link exactly as it was.
   */
  async function fillLinkFacts(id: string, kept: Thing | undefined) {
    // The freshest copy if one is in state, and otherwise the one that was
    // just kept — `forestRef` trails a render behind a write-through, so
    // reading it alone would skip the fill about as often as not.
    const thing = forestRef.current.things.find((t) => t.id === id || t.id === liveId(id)) ?? kept
    if (!thing || !thing.link) return

    const preview = await getLinkPreview(thing.link)
    if (!preview) return

    // The publication, resolved against the sources already in the forest —
    // one "Ness Labs" however many pieces of theirs you keep. Created as an
    // `Article`, which is what a link with a site name is; the Kobo lane
    // sets `Book` on its own sources for exactly the same reason.
    const siteName = linkSourceTitle(thing, preview)
    const { sourceId, sourceDraft } = siteName
      ? resolveSourceDraft(siteName)
      : { sourceId: null, sourceDraft: null }

    const patch: Partial<Thing> = {
      ...linkFactsPatch(thing, preview),
      ...(sourceId ? { sourceId } : {}),
    }
    if (Object.keys(patch).length === 0) return

    const previous: Partial<Thing> = {
      body: thing.body,
      handle: thing.handle,
      locator: thing.locator,
      sourceId: thing.sourceId,
    }
    // The keep may have swapped a draft id for the real Notion one by now,
    // so match on either — the same thing under two names.
    const isThis = (t: Thing) => t.id === thing.id || t.id === liveId(thing.id)
    if (sourceDraft) setSources((prev) => [sourceDraft, ...prev])
    setThings((prev) => prev.map((t) => (isThis(t) ? { ...t, ...patch } : t)))
    try {
      if (sourceDraft) {
        const createdSource = await store.createSource({ title: sourceDraft.title, author: sourceDraft.author, kind: 'Article' })
        realIdByDraft.current.set(sourceDraft.id, createdSource.id)
        setSources((prev) => prev.map((sc) => (sc.id === sourceDraft.id ? createdSource : sc)))
        patch.sourceId = createdSource.id
      }
      const updated = await store.updateThing(liveId(thing.id), patch)
      setThings((prev) => prev.map((t) => (t.id === updated.id || isThis(t) ? updated : t)))
    } catch {
      // Reverts this one thing rather than the whole forest (`write`'s
      // snapshot rollback would undo unrelated edits made in the meantime),
      // and stays quiet: facts nobody asked for failing to land is not worth
      // a toast — the link is intact and reads exactly as before.
      setThings((prev) => prev.map((t) => (isThis(t) ? { ...t, ...previous } : t)))
      if (sourceDraft) setSources((prev) => prev.filter((sc) => sc.id !== sourceDraft.id))
    }
  }

  function handleRelease(id: string) {
    triggerHaptic('light')
    const released = things.find((t) => t.id === id)
    write(
      () => setThings((prev) => prev.map((t) => (t.id === id ? { ...t, state: 'Released' } : t))),
      async () => {
        const updated = await store.updateThing(liveId(id), { state: 'Released' })
        setThings((prev) => prev.map((t) => (t.id === updated.id || t.id === id ? updated : t)))
      },
      'That could not be released',
    )
    // Releasing is the one action that takes something out of view without
    // asking first — so it's the one action that offers a way back.
    //
    // The way back restores exactly what the thing was, rather than always
    // sending it to the understory. That was harmless while only nursery
    // arrivals could be released, and a trap the moment the Forest could:
    // undoing on something kept a year ago would have dropped its `kept`
    // date and put it in the understory, where `isExpired` counts from
    // `encountered` — so it would have silently expired again on the very
    // next load. Undo has to be an undo.
    if (released) {
      const previous: Partial<Thing> = { state: released.state, kept: released.kept }
      // Says where it went, because "Released" alone invites the wrong
      // guess. Releasing a *kept* thing does not return it to the nursery
      // to wait again — it is compost, out of both views for good. That
      // reading is easy to make once Release exists in the Forest as well,
      // so the toast names the destination rather than just the act.
      notify(
        released.state === 'Kept' ? 'Released — it has left the forest.' : 'Released.',
        { undo: () => handleRestore(id, previous) },
      )
    }
  }

  /**
   * Deletes a thing for good, and cleans up everything that pointed at it.
   *
   * The reason this lives in the app at all: deleting the page straight out
   * of Notion leaves every Path that referenced it stranded with a dangling
   * end, and leaves this device's caches holding bytes for something that no
   * longer exists. Nothing in Notion can know to tidy either. Doing it here
   * means one act covers all four:
   *
   *   1. the thing itself (archived — recoverable from Notion's trash)
   *   2. every path with this thing at either end, archived too
   *   3. the local caches keyed by it — vector, link preview, photograph
   *   4. its reading history
   *
   * Deleting is the sharp edge, so unlike Release it asks first (each
   * caller puts it behind a confirm) and offers no undo toast: Notion's own
   * trash is the real safety net, and pretending to a local undo that
   * couldn't restore the archived paths would be a worse promise.
   */
  function handleDeleteThing(id: string) {
    const doomed = things.find((t) => t.id === id)
    if (!doomed) return
    const doomedIndex = things.findIndex((t) => t.id === id)
    const doomedPaths = paths.filter((p) => p.fromId === id || p.toId === id)

    write(
      () => {
        setThings((prev) => prev.filter((t) => t.id !== id))
        if (doomedPaths.length > 0) {
          const doomedIds = new Set(doomedPaths.map((p) => p.id))
          setPaths((prev) => prev.filter((p) => !doomedIds.has(p.id)))
        }
      },
      async () => {
        // Paths first: a path whose end is already gone is the exact orphan
        // this is here to prevent, so it must not survive a partial failure.
        for (const path of doomedPaths) {
          if (!isDraft(path.id)) await store.archivePath(liveId(path.id))
        }
        if (!isDraft(id)) await store.archiveThing(liveId(id))
      },
      'That could not be deleted',
    )

    // Notably *not* pruning the local caches here, which is what makes this
    // undo honest rather than half of one. A deleted thing's photograph
    // lives only in this device's IndexedDB (photoStore.ts) — reclaiming it
    // now would make the bytes unrecoverable while the toast still offered
    // to bring the thing back. The load-time prunes reclaim it on the next
    // start instead, which is exactly the housekeeping they exist for.
    notify(
      doomedPaths.length > 0
        ? `Deleted, with ${doomedPaths.length} path${doomedPaths.length === 1 ? '' : 's'}.`
        : 'Deleted.',
      { undo: () => handleUndelete(doomed, doomedIndex, doomedPaths) },
    )
  }

  /** Puts a deleted thing back where it was, with every path that went with
   *  it. The thing is restored before its paths, so no path is ever live
   *  again while the end it points at is still archived. */
  function handleUndelete(thing: Thing, index: number, restoredPaths: Path[]) {
    write(
      () => {
        setThings((prev) => {
          const next = [...prev]
          next.splice(Math.min(index, next.length), 0, thing)
          return next
        })
        if (restoredPaths.length > 0) setPaths((prev) => [...restoredPaths, ...prev])
      },
      async () => {
        if (!isDraft(thing.id)) await store.unarchiveThing({ ...thing, id: liveId(thing.id) })
        for (const path of restoredPaths) {
          if (!isDraft(path.id)) await store.unarchivePath({ ...path, id: liveId(path.id) })
        }
      },
      'That could not be put back',
    )
  }

  /**
   * Deletes a source, detaching it from anything that came from it.
   *
   * The things themselves are never touched beyond losing their `sourceId` —
   * a source is where something came from, not what it is, so removing the
   * provenance must not remove the passage.
   */
  function handleDeleteSource(id: string) {
    const attached = things.filter((t) => t.sourceId === id)

    write(
      () => {
        setSources((prev) => prev.filter((s) => s.id !== id))
        setThings((prev) => prev.map((t) => (t.sourceId === id ? { ...t, sourceId: null } : t)))
      },
      async () => {
        for (const thing of attached) {
          if (!isDraft(thing.id)) await store.updateThing(liveId(thing.id), { sourceId: null })
        }
        if (!isDraft(id)) await store.archiveSource(liveId(id))
      },
      'That source could not be deleted',
    )
  }

  /** Puts a released thing back exactly as it was — the undo behind the
   *  release toast, for a nursery arrival and a kept thing alike. */
  function handleRestore(id: string, previous: Partial<Thing>) {
    write(
      () => setThings((prev) => prev.map((t) => (t.id === id ? { ...t, ...previous } : t))),
      async () => {
        const updated = await store.updateThing(liveId(id), previous)
        setThings((prev) => prev.map((t) => (t.id === updated.id || t.id === id ? updated : t)))
      },
      'That could not be put back',
    )
  }

  /**
   * Turns a typed "where did you encounter this" line into something a Thing
   * draft can point `sourceId` at right away, and a matching commit step that
   * makes it real. Two shapes:
   *
   *   - Text that clearly names an existing Source (lib/sourceCapture.ts's
   *     CAPTURE_MATCH_THRESHOLD) resolves to its real id synchronously — no
   *     draft needed, no network call, since matching only reads `sources`,
   *     already in memory.
   *   - Anything else becomes a Source *draft*, using the same `draftId()` +
   *     reconcile-on-commit pattern `handleCoin` already uses for a locus:
   *     the optimistic apply can show it immediately, and the commit step
   *     creates the real row and points the thing at the real id once it
   *     exists.
   *
   * Returns `null, null` for empty input — most captures have no source, and
   * that must stay free of both a draft and a resolved id.
   */
  function resolveSourceDraft(sourceInput: string): { sourceId: string | null; sourceDraft: Source | null } {
    const resolution = resolveSource(sourceInput, sources)
    if (resolution.kind === 'none') return { sourceId: null, sourceDraft: null }
    if (resolution.kind === 'existing') return { sourceId: resolution.source.id, sourceDraft: null }
    const sourceDraft: Source = {
      id: draftId(),
      title: resolution.title,
      author: resolution.author,
      kind: null,
      cover: null,
      koboVolumeId: null,
      notes: '',
    }
    return { sourceId: sourceDraft.id, sourceDraft }
  }

  /** `sourceInput` is undefined when the edit form's Source field wasn't
   *  touched at all — vs. an empty string, which means it was actively
   *  cleared, and should blank `sourceId` rather than leave it stale. */
  function handleEditThing(id: string, patch: Partial<Thing>, sourceInput?: string) {
    const { sourceId, sourceDraft } = sourceInput !== undefined
      ? resolveSourceDraft(sourceInput)
      : { sourceId: undefined, sourceDraft: null }
    // The same whitespace hygiene every other write path applies
    // (lib/textNormalize.ts). Text pasted into the edit form arrives with
    // exactly the artifacts text pasted into intake does, and it would be
    // strange for the identical paste to be cleaned in one field and left
    // alone in the other. `note` is deliberately untouched here, as it is
    // at capture: it is the one field that is yours rather than the
    // source's.
    const normalized: Partial<Thing> = patch.body !== undefined
      ? { ...patch, body: normalizeCapturedText(patch.body) }
      : patch
    const fullPatch: Partial<Thing> = sourceId !== undefined ? { ...normalized, sourceId } : normalized

    write(
      () => {
        if (sourceDraft) setSources((prev) => [sourceDraft, ...prev])
        setThings((prev) => prev.map((t) => (t.id === id ? { ...t, ...fullPatch } : t)))
      },
      async () => {
        let realPatch = fullPatch
        if (sourceDraft) {
          const createdSource = await store.createSource({ title: sourceDraft.title, author: sourceDraft.author })
          realIdByDraft.current.set(sourceDraft.id, createdSource.id)
          setSources((prev) => prev.map((s) => (s.id === sourceDraft.id ? createdSource : s)))
          realPatch = { ...fullPatch, sourceId: createdSource.id }
        }
        const updated = await store.updateThing(liveId(id), realPatch)
        setThings((prev) => prev.map((t) => (t.id === updated.id || t.id === id ? updated : t)))
      },
      'That edit could not be saved',
    )
  }

  function handleEditSource(id: string, patch: Partial<Source>) {
    write(
      () => setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
      async () => {
        const updated = await store.updateSource(id, patch)
        setSources((prev) => prev.map((s) => (s.id === id ? updated : s)))
      },
      'That could not be saved',
    )
  }

  function handleIntake(rawBody: string, locator = '', sourceInput = '') {
    // Whitespace hygiene only — never a rewrite. Fixes the CRLF, trailing
    // spaces and padded-out blank lines a badly-formatted source (or the
    // paste mechanism itself) adds, uniformly across typed, pasted and
    // shared-in text (lib/textNormalize.ts). Every word stays exactly as
    // written.
    const typed = normalizeCapturedText(rawBody)
    const today = todayIso()
    const { sourceId, sourceDraft } = resolveSourceDraft(sourceInput)
    // What the capture already knows about itself: the URL it *is* (pasted,
    // or arriving in the locator from the share sheet) and the one Kind that
    // reads out of it. Nothing inferred — see lib/intakeFields.ts. The body
    // comes back too, because a body that is *only* a URL is cleaned along
    // with the link it becomes; every other body is returned as it was
    // written.
    const { body, locator: fieldLocator, link, kind } = intakeFields(typed, locator)
    const draft: Thing = {
      id: draftId(),
      handle: body.slice(0, 60),
      body,
      kind,
      state: 'Understory',
      sourceId,
      locator: fieldLocator,
      encountered: today,
      kept: null,
      note: '',
      lociIds: [],
      image: null,
      link,
      koboBookmarkId: null,
      // An optimistic draft has not reached Notion yet, so it has no
      // `created_time` to read back — the season falls back to `encountered`
      // until the real row lands, which for a typed capture is the same day.
      arrived: null,
    }
    write(
      () => {
        if (sourceDraft) setSources((prev) => [sourceDraft, ...prev])
        setThings((prev) => [draft, ...prev])
      },
      async () => {
        let realSourceId = sourceId
        if (sourceDraft) {
          const createdSource = await store.createSource({ title: sourceDraft.title, author: sourceDraft.author })
          realIdByDraft.current.set(sourceDraft.id, createdSource.id)
          setSources((prev) => prev.map((s) => (s.id === sourceDraft.id ? createdSource : s)))
          realSourceId = createdSource.id
        }
        const created = await store.createThing({ body, locator: fieldLocator, sourceId: realSourceId, link, kind })
        realIdByDraft.current.set(draft.id, created.id)
        setThings((prev) => prev.map((t) => (t.id === draft.id ? created : t)))
      },
      'That could not be added to the nursery',
    )
    setShared(null)
  }

  /**
   * The photograph lane. A picture of a page is a legitimate thing and is
   * deliberately not OCR'd (SILVA.md "Intake") — until now `Image` was a Kind
   * in the vocabulary with no way to create one, and `Thing.image` was read by
   * `toThing` and written by nothing.
   *
   * Live: downscale, then Notion's two-call upload through the *existing*
   * `api/notion-upload` relay — no new serverless function, the budget is full.
   * Demo: the blob goes to IndexedDB and the thing holds a reference, because a
   * ~300 KB data URL inside the localStorage demo snapshot would take the whole
   * demo forest down within a handful of photos (see lib/photoStore.ts).
   */
  async function handlePhoto(file: File) {
    if (!isImageFile(file)) {
      notify('That file is not an image.', { tone: 'alarm' })
      return
    }
    setPhotoBusy(true)
    try {
      const blob = await resizePhoto(file)
      const filename = photoFilename(file.name)

      let createdId: string
      if (!config.notionToken) {
        const id = `local-${Date.now()}`
        const created = await store.createThing({ body: '', kind: 'Image', image: localImageRef(id) })
        await putLocalPhoto(id, blob)
        setThings((prev) => [created, ...prev])
        createdId = created.id
      } else {
        const created = await store.createThing({ body: '', kind: 'Image' })
        setThings((prev) => [created, ...prev])
        const photo = await store.uploadPhoto(blob, filename)
        const withImage = await store.attachPhoto(created.id, photo)
        setThings((prev) => prev.map((t) => (t.id === created.id ? withImage : t)))
        createdId = created.id
      }
      notify('Photograph added to the nursery.')
      if (config.autoTranscribe && config.anthropicKey) void transcribePhoto(createdId, blob)
    } catch (e) {
      notify(`That photo could not be added${errorText(e)}`, { tone: 'alarm' })
    } finally {
      setPhotoBusy(false)
    }
  }

  /**
   * OCR, run once, in the background, after the photo itself is already safe
   * (lib/ocr.ts). Deliberately not awaited by handlePhoto — a vision round
   * trip takes several seconds, and blocking "Photograph added" on it would
   * make an optional, off-by-default feature stall the one thing everyone
   * gets: the photo landing in the understory. A failed or empty OCR just
   * leaves the thing exactly as it would have been without this feature.
   */
  async function transcribePhoto(id: string, blob: Blob) {
    const text = await ocrPhoto(config.anthropicKey, blob)
    if (!text) return
    try {
      // Same whitespace hygiene as any other lane (lib/textNormalize.ts) —
      // an OCR transcription is exactly the kind of text that can carry a
      // stray trailing space per line or an odd run of blank lines from
      // the page's own layout.
      const updated = await store.updateThing(liveId(id), { body: normalizeCapturedText(text) })
      setThings((prev) => prev.map((t) => (t.id === updated.id || t.id === id ? updated : t)))
      notify('Text found on the page — added as its passage.')
    } catch {
      // Best-effort: the photo is already saved either way; losing the
      // auto-transcription only means typing it in later, same as always.
    }
  }

  const nurseryThings = things.filter((thing) => thing.state === 'Understory')
  const existingKoboBookmarkIds = useMemo(
    () => new Set(things.map((t) => t.koboBookmarkId).filter((id): id is string => Boolean(id))),
    [things],
  )

  /**
   * Whether the link that just arrived from the share sheet is one the
   * forest already holds — said in the intake field, never enforced.
   *
   * Read off the share itself rather than the live field, so editing what
   * arrived doesn't make the remark flicker: the question it answers ("have
   * I read this already?") is about the thing you just shared, and it stops
   * being interesting the moment you start writing about it anyway.
   */
  const sharedDuplicate = useMemo(() => {
    if (!shared) return null
    const { link } = intakeFields(shared.body, shared.locator)
    return duplicateNotice(findLinkDuplicate(things, link))
  }, [shared, things])

  async function handleImported(created: Thing[]) {
    if (created.length > 0) setThings((prev) => [...created, ...prev])
    // A Kobo import may have created new Sources (or backfilled an existing
    // one's koboVolumeId) — refresh so the forest can resolve their titles.
    try {
      setSources(await store.listSources())
    } catch {
      // The things themselves are already in; the titles resolve next load.
    }
  }

  // Locus membership lives entirely on the Things side (Thing.lociIds) — every
  // clearing action is really "patch some things, then maybe touch the locus
  // record itself." This applies a batch of patches optimistically and folds
  // the store's canonical rows back in as they land.
  function applyLocally(updates: { id: string; patch: Partial<Thing> }[]) {
    const patchById = new Map(updates.map((u) => [u.id, u.patch]))
    setThings((prev) => prev.map((t) => {
      const patch = patchById.get(t.id)
      return patch ? { ...t, ...patch } : t
    }))
  }

  async function commitThingUpdates(updates: { id: string; patch: Partial<Thing> }[]) {
    const updated = await Promise.all(updates.map((u) => store.updateThing(liveId(u.id), u.patch)))
    const byId = new Map(updated.map((t) => [t.id, t]))
    setThings((prev) => prev.map((t) => byId.get(t.id) ?? t))
  }

  function membershipUpdates(thingIds: string[], toPatch: (thing: Thing) => Partial<Thing>) {
    return thingIds
      .map((id) => things.find((t) => t.id === id))
      .filter((t): t is Thing => Boolean(t))
      .map((t) => ({ id: t.id, patch: toPatch(t) }))
  }

  function handleCoin(name: string, meaning: string, seedThingIds: string[]) {
    triggerHaptic('success')
    const draft: Locus = { id: draftId(), name, meaning, coined: todayIso() }
    const updates = membershipUpdates(seedThingIds, (t) => ({ lociIds: [...t.lociIds, draft.id] }))
    write(
      () => {
        setLoci((prev) => [draft, ...prev])
        applyLocally(updates)
      },
      async () => {
        const locus = await store.createLocus({ name, meaning })
        realIdByDraft.current.set(draft.id, locus.id)
        setLoci((prev) => prev.map((l) => (l.id === draft.id ? locus : l)))
        // The seeds were pointed at the draft id; re-point them at the real
        // one before the write-through, or Notion gets a relation to nothing.
        const real = updates.map((u) => ({
          id: u.id,
          patch: { lociIds: (u.patch.lociIds ?? []).map((id) => (id === draft.id ? locus.id : id)) },
        }))
        setThings((prev) => prev.map((t) => ({
          ...t,
          lociIds: t.lociIds.map((id) => (id === draft.id ? locus.id : id)),
        })))
        if (real.length > 0) await commitThingUpdates(real)
      },
      'That clearing could not be coined',
    )
  }

  function handleRename(locusId: string, name: string, meaning: string) {
    write(
      () => setLoci((prev) => prev.map((l) => (l.id === locusId ? { ...l, name, meaning } : l))),
      async () => {
        const updated = await store.updateLocus(locusId, { name, meaning })
        setLoci((prev) => prev.map((l) => (l.id === locusId ? updated : l)))
      },
      'That clearing could not be renamed',
    )
  }

  function handleAddThings(locusId: string, thingIds: string[]) {
    const updates = membershipUpdates(thingIds, (t) => ({ lociIds: [...t.lociIds, locusId] }))
    write(() => applyLocally(updates), () => commitThingUpdates(updates), 'Those could not be added to the clearing')
  }

  function handleRemoveThing(locusId: string, thingId: string) {
    const updates = membershipUpdates([thingId], (t) => ({ lociIds: withoutLocus(t.lociIds, locusId) }))
    if (updates.length === 0) return
    write(() => applyLocally(updates), () => commitThingUpdates(updates), 'That could not be removed from the clearing')
  }

  function handleMerge(survivorId: string, mergeAwayId: string) {
    const affected = things.filter((t) => t.lociIds.includes(mergeAwayId))
    const updates = affected.map((t) => ({
      id: t.id,
      patch: { lociIds: withLocusReplaced(t.lociIds, mergeAwayId, survivorId) },
    }))
    write(
      () => {
        applyLocally(updates)
        setLoci((prev) => prev.filter((l) => l.id !== mergeAwayId))
      },
      async () => {
        if (updates.length > 0) await commitThingUpdates(updates)
        await store.archiveLocus(mergeAwayId)
      },
      'Those clearings could not be combined',
    )
  }

  function handleDissolve(locusId: string) {
    const affected = things.filter((t) => t.lociIds.includes(locusId))
    const updates = affected.map((t) => ({ id: t.id, patch: { lociIds: withoutLocus(t.lociIds, locusId) } }))
    write(
      () => {
        applyLocally(updates)
        setLoci((prev) => prev.filter((l) => l.id !== locusId))
      },
      async () => {
        if (updates.length > 0) await commitThingUpdates(updates)
        await store.archiveLocus(locusId)
      },
      'That clearing could not be dissolved',
    )
  }

  // A split thing's membership in the old locus is replaced with the new one —
  // the same withLocusReplaced helper handleMerge uses, in the other direction.
  // Other loci a thing already belongs to are untouched.
  function handleSplit(locusId: string, thingIds: string[], name: string, meaning: string) {
    triggerHaptic('success')
    const draft: Locus = { id: draftId(), name, meaning, coined: todayIso() }
    const updates = membershipUpdates(thingIds, (t) => ({
      lociIds: withLocusReplaced(t.lociIds, locusId, draft.id),
    }))
    write(
      () => {
        setLoci((prev) => [draft, ...prev])
        applyLocally(updates)
      },
      async () => {
        const newLocus = await store.createLocus({ name, meaning })
        realIdByDraft.current.set(draft.id, newLocus.id)
        setLoci((prev) => prev.map((l) => (l.id === draft.id ? newLocus : l)))
        const real = updates.map((u) => ({
          id: u.id,
          patch: { lociIds: (u.patch.lociIds ?? []).map((id) => (id === draft.id ? newLocus.id : id)) },
        }))
        setThings((prev) => prev.map((t) => ({
          ...t,
          lociIds: t.lociIds.map((id) => (id === draft.id ? newLocus.id : id)),
        })))
        if (real.length > 0) await commitThingUpdates(real)
      },
      'That clearing could not be split',
    )
  }

  function walkPath(fromThing: Thing, toThing: Thing, why: string, origin: Path['origin']) {
    triggerHaptic('success')
    const draft: Path = {
      id: draftId(),
      label: deriveLabel(fromThing.handle, toThing.handle),
      fromId: fromThing.id,
      toId: toThing.id,
      why,
      made: todayIso(),
      origin,
    }
    write(
      () => setPaths((prev) => [draft, ...prev]),
      async () => {
        const path = await store.createPath({
          fromId: fromThing.id,
          toId: toThing.id,
          fromHandle: fromThing.handle,
          toHandle: toThing.handle,
          why,
          origin: origin ?? 'Yours',
        })
        realIdByDraft.current.set(draft.id, path.id)
        setPaths((prev) => prev.map((p) => (p.id === draft.id ? path : p)))
      },
      'That path could not be walked',
    )
  }

  function handleMakePath(fromId: string, toId: string, why: string) {
    const fromThing = things.find((t) => t.id === fromId)
    const toThing = things.find((t) => t.id === toId)
    if (!fromThing || !toThing) return
    walkPath(fromThing, toThing, why, 'Yours')
  }

  function handleEditPathWhy(pathId: string, why: string) {
    write(
      () => setPaths((prev) => prev.map((p) => (p.id === pathId ? { ...p, why } : p))),
      async () => {
        const updated = await store.updatePathWhy(pathId, why)
        setPaths((prev) => prev.map((p) => (p.id === pathId ? updated : p)))
      },
      'That path could not be updated',
    )
  }

  function handleRemovePath(pathId: string) {
    write(
      () => setPaths((prev) => prev.filter((p) => p.id !== pathId)),
      () => store.archivePath(pathId),
      'That path could not be removed',
    )
  }

  function handleDismissProvocation() {
    if (!provocation) return
    triggerHaptic('light')
    addDismissed(provocationKey(provocation))
    setProvocation(null)
  }

  function handleAcceptProvocationPair(a: Thing, b: Thing, why: string) {
    walkPath(a, b, why, 'Accepted')
    setProvocation(null)
    setView('paths')
    notify('Path walked — it is drawn in Paths.')
  }

  function handleAcceptClearingForming(clusterThings: Thing[], name: string) {
    handleCoin(name, '', clusterThings.map((t) => t.id))
    setProvocation(null)
    setView('clearings')
    notify(`"${name}" coined.`)
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Silva</h1>
          {/* Names the view on a phone, where navigation lives at the far end
           *  of the screen in 9.5px small caps. */}
          <span className={styles.where}>{VIEWS.find((v) => v.value === view)?.label}</span>
        </div>
        <div className={styles.nav}>
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v as View)}
            options={VIEWS}
            size="sm"
          />
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {/* The Forest, and only the Forest. Rendered outside <main>, this sat
          on top of all six surfaces at once — a pair of passages placed over
          a token field in the Hearth, or over a Kobo import mid-review, is an
          interruption rather than the app's voice. The Forest is the kept
          collection, which is what every provocation is *about*, and it is
          the view Silva opens on, so nothing is missed by confining it here.
          Switching away never dismisses it: it is still waiting on the way
          back. */}
      {provocation && view === 'forest' && (
        <ProvocationBanner
          provocation={provocation}
          onDismiss={handleDismissProvocation}
          onAcceptPair={handleAcceptProvocationPair}
          onAcceptClearingForming={handleAcceptClearingForming}
        />
      )}

      <main className={styles.main}>
        {loading ? (
          <p className={styles.loading}>Walking into the forest…</p>
        ) : view === 'nursery' ? (
          <>
            <IntakeField
              onSubmit={handleIntake}
              onPhoto={handlePhoto}
              prefill={shared}
              busy={photoBusy}
              sources={sources}
              notice={sharedDuplicate}
            />
            {importOpen ? (
              <KoboImportPanel
                store={store}
                existingKoboBookmarkIds={existingKoboBookmarkIds}
                onImported={handleImported}
                onClose={() => setImportOpen(false)}
              />
            ) : (
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                Import from Kobo
              </Button>
            )}
            <NurseryView
              things={nurseryThings}
              sources={sources}
              onKeep={handleKeep}
              onRelease={handleRelease}
              onDelete={handleDeleteThing}
            />
          </>
        ) : view === 'forest' ? (
          <ForestView
            things={things}
            sources={sources}
            loci={loci}
            paths={paths}
            vectorsById={vectorsById}
            seen={seen}
            onEdit={handleEditThing}
            onRelease={handleRelease}
            onDelete={handleDeleteThing}
            onSeen={markSeen}
            onMakePath={handleMakePath}
            showWalk={config.showWalk}
            showGraph={config.showGraph}
          />
        ) : view === 'clearings' ? (
          <ClearingsView
            things={things}
            loci={loci}
            onCoin={handleCoin}
            onRename={handleRename}
            onAddThings={handleAddThings}
            onRemoveThing={handleRemoveThing}
            onMerge={handleMerge}
            onDissolve={handleDissolve}
            onSplit={handleSplit}
          />
        ) : view === 'paths' ? (
          <PathsView
            things={things}
            loci={loci}
            paths={paths}
            vectorsById={vectorsById}
            onMake={handleMakePath}
            onEditWhy={handleEditPathWhy}
            onRemove={handleRemovePath}
            showGraph={config.showGraph}
          />
        ) : view === 'roots' ? (
          <RootsView
            things={things}
            sources={sources}
            loci={loci}
            onEditThing={handleEditThing}
            onReleaseThing={handleRelease}
            onDeleteThing={handleDeleteThing}
            onDeleteSource={handleDeleteSource}
            onSeen={markSeen}
            onEditSource={handleEditSource}
            showRootstock={config.showRootstock}
          />
        ) : view === 'forage' ? (
          <ForageView things={things} sources={sources} vectorsById={vectorsById} />
        ) : (
          <HearthView
            config={config}
            onChange={handleConfigChange}
            indexing={indexing}
            themeChoice={themeChoice}
            onThemeChange={handleThemeChange}
          />
        )}
      </main>

      <TabBar value={view} options={VIEWS} onChange={(v) => setView(v as View)} />

      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
