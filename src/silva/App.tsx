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
import { pruneLinkPreviews } from './lib/linkPreviewCache'
import { readSeen, writeSeen, withSeen, prunedSeen, type SeenMap } from './lib/seen'
import { parseSharedIntake, urlWithoutShare, type SharedIntake } from './lib/sharedIntake'
import { putLocalPhoto, localImageRef, pruneLocalPhotos } from './lib/photoStore'
import { ocrPhoto } from './lib/ocr'
import { resizePhoto, photoFilename, isImageFile } from '../shared/photo'
import { indexThings, indexableThings } from './lib/indexer'
import { loadSilvaConfig, saveSilvaConfig, type SilvaConfig } from './lib/settingsConfig'
import { confirmTension } from './lib/tension'
import { resolveSource } from './lib/sourceCapture'
import { isBareUrl } from './lib/kindInference'
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
  // shared has landed — arriving on the Forest would hide it.
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && parseSharedIntake(window.location.search) ? 'nursery' : 'forest',
  )
  const [importOpen, setImportOpen] = useState(false)
  const [provocation, setProvocation] = useState<Provocation | null>(null)
  const [vectorsById, setVectorsById] = useState<Map<string, Float32Array>>(new Map())
  const [indexing, setIndexing] = useState<{ done: number; total: number; loadingModel: boolean } | null>(null)
  const [seen, setSeen] = useState<SeenMap>({})
  const [photoBusy, setPhotoBusy] = useState(false)

  // A share arriving from elsewhere on the device. Read once, synchronously, so
  // the very first render already has it — then the query string is cleared so
  // a refresh can't re-add what you already captured.
  const [shared, setShared] = useState<SharedIntake | null>(() => {
    if (typeof window === 'undefined') return null
    const parsed = parseSharedIntake(window.location.search)
    if (parsed) {
      window.history.replaceState(null, '', urlWithoutShare(window.location.href))
    }
    return parsed
  })

  // The live collection, readable from inside an async callback without
  // capturing a stale closure — what `write` reverts to on failure.
  const forestRef = useRef<Forest>({ things: [], sources: [], loci: [], paths: [] })
  useEffect(() => {
    forestRef.current = { things, sources, loci, paths }
  }, [things, sources, loci, paths])

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
  const write = useCallback(
    async (apply: () => void, commit: () => Promise<void>, failure: string) => {
      const snapshot = forestRef.current
      apply()
      try {
        await commit()
      } catch (e) {
        restore(snapshot)
        notify(`${failure}${errorText(e)}`, { tone: 'alarm' })
      }
    },
    [notify],
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [loaded, loadedSources, loadedLoci, loadedPaths] = await Promise.all([
          store.listThings(),
          store.listSources(),
          store.listLoci(),
          store.listPaths(),
        ])
        if (cancelled) return
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
        if (!cancelled) {
          setError((e as Error).message || 'Could not load the forest.')
          setLoading(false)
        }
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
    write(
      () => setThings((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
      async () => {
        const updated = await store.updateThing(id, patch)
        setThings((prev) => prev.map((t) => (t.id === id ? updated : t)))
      },
      'That could not be kept',
    )
  }

  function handleRelease(id: string) {
    triggerHaptic('light')
    const released = things.find((t) => t.id === id)
    write(
      () => setThings((prev) => prev.map((t) => (t.id === id ? { ...t, state: 'Released' } : t))),
      async () => {
        const updated = await store.updateThing(id, { state: 'Released' })
        setThings((prev) => prev.map((t) => (t.id === id ? updated : t)))
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
          if (!path.id.startsWith(DRAFT_PREFIX)) await store.archivePath(path.id)
        }
        if (!id.startsWith(DRAFT_PREFIX)) await store.archiveThing(id)
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
        if (!thing.id.startsWith(DRAFT_PREFIX)) await store.unarchiveThing(thing)
        for (const path of restoredPaths) {
          if (!path.id.startsWith(DRAFT_PREFIX)) await store.unarchivePath(path)
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
          if (!thing.id.startsWith(DRAFT_PREFIX)) await store.updateThing(thing.id, { sourceId: null })
        }
        if (!id.startsWith(DRAFT_PREFIX)) await store.archiveSource(id)
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
        const updated = await store.updateThing(id, previous)
        setThings((prev) => prev.map((t) => (t.id === id ? updated : t)))
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
    const fullPatch: Partial<Thing> = sourceId !== undefined ? { ...patch, sourceId } : patch

    write(
      () => {
        if (sourceDraft) setSources((prev) => [sourceDraft, ...prev])
        setThings((prev) => prev.map((t) => (t.id === id ? { ...t, ...fullPatch } : t)))
      },
      async () => {
        let realPatch = fullPatch
        if (sourceDraft) {
          const createdSource = await store.createSource({ title: sourceDraft.title, author: sourceDraft.author })
          setSources((prev) => prev.map((s) => (s.id === sourceDraft.id ? createdSource : s)))
          realPatch = { ...fullPatch, sourceId: createdSource.id }
        }
        const updated = await store.updateThing(id, realPatch)
        setThings((prev) => prev.map((t) => (t.id === id ? updated : t)))
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

  function handleIntake(body: string, locator = '', sourceInput = '') {
    const today = todayIso()
    const { sourceId, sourceDraft } = resolveSourceDraft(sourceInput)
    // A pasted body that's nothing but a URL already *is* the link — reading
    // it into the field a Link thing's preview card actually needs, rather
    // than requiring a trip to Edit before the thumbnail in the Nursery (or
    // the card in the Forest) can show anything at all.
    const link = isBareUrl(body) ? body.trim() : null
    const draft: Thing = {
      id: draftId(),
      handle: body.slice(0, 60),
      body,
      kind: null,
      state: 'Understory',
      sourceId,
      locator,
      encountered: today,
      kept: null,
      note: '',
      lociIds: [],
      image: null,
      link,
      koboBookmarkId: null,
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
          setSources((prev) => prev.map((s) => (s.id === sourceDraft.id ? createdSource : s)))
          realSourceId = createdSource.id
        }
        const created = await store.createThing({ body, locator, sourceId: realSourceId, link })
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
      const updated = await store.updateThing(id, { body: text })
      setThings((prev) => prev.map((t) => (t.id === id ? updated : t)))
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
    const updated = await Promise.all(updates.map((u) => store.updateThing(u.id, u.patch)))
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
