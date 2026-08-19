import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, SegmentedControl } from '../ds'
import { SilvaStore } from './lib/store'
import { isExpired } from './lib/understory'
import type { Thing } from './lib/notion'
import type { Source } from './lib/sources'
import type { Locus } from './lib/loci'
import { withoutLocus, withLocusReplaced } from './lib/loci'
import type { Path } from './lib/paths'
import { deriveLabel } from './lib/paths'
import { ForestView } from './components/ForestView'
import { UnderstoryView } from './components/UnderstoryView'
import { IntakeField } from './components/IntakeField'
import { KoboImportPanel } from './components/KoboImportPanel'
import { ClearingsView } from './components/ClearingsView'
import { UndergroundView } from './components/UndergroundView'
import { SearchView } from './components/SearchView'
import { ProvocationBanner } from './components/ProvocationBanner'
import { SettingsView } from './components/SettingsView'
import { Toasts, useToasts } from './components/Toasts'
import { pickProvocation, provocationKey, type Provocation } from './lib/provocations'
import { readDismissed, addDismissed, hasShownThisSession, markShownThisSession } from './lib/provocationDismissals'
import {
  collectionFingerprint,
  readThresholdState,
  recordProvocationOffered,
  thresholdCrossed,
} from './lib/provocationThreshold'
import { peekVectors } from './lib/vectorCache'
import { indexThings, indexableThings } from './lib/indexer'
import { loadSilvaConfig, saveSilvaConfig, type SilvaConfig } from './lib/settingsConfig'
import { confirmTension } from './lib/tension'
import { syncSystemTheme } from './lib/theme'
import styles from './App.module.css'

type View = 'forest' | 'understory' | 'clearings' | 'underground' | 'search' | 'settings'

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
  // SILVA.md: "Light and dark, syncing to the device" — no manual toggle,
  // purely OS `prefers-color-scheme`.
  useEffect(() => syncSystemTheme(), [])

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
  const [view, setView] = useState<View>('forest')
  const [importOpen, setImportOpen] = useState(false)
  const [provocation, setProvocation] = useState<Provocation | null>(null)
  const [vectorsById, setVectorsById] = useState<Map<string, Float32Array>>(new Map())
  const [indexing, setIndexing] = useState<{ done: number; total: number; loadingModel: boolean } | null>(null)

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
        // Best-effort per item — one row Notion refuses must not turn the
        // whole load into "Could not load the forest", which is what an
        // unguarded Promise.all did here before.
        const expired = loaded.filter((thing) => isExpired(thing))
        const releasedById = new Map<string, Thing>()
        await Promise.all(
          expired.map(async (thing) => {
            try {
              releasedById.set(thing.id, await store.updateThing(thing.id, { state: 'Released' }))
            } catch {
              // Left in the understory; it expires again on the next load.
            }
          }),
        )
        const settled = loaded.map((thing) => releasedById.get(thing.id) ?? thing)
        if (cancelled) return
        setThings(settled)
        setLoading(false)

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
        await maybeProvoke(settled, loadedLoci, loadedPaths, vectors, () => cancelled)
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
      isCancelled: () => boolean,
    ) {
      if (hasShownThisSession()) return
      const fingerprint = collectionFingerprint(allThings, allLoci, allPaths)
      if (!thresholdCrossed(fingerprint, readThresholdState())) return

      const picked = pickProvocation({
        things: allThings,
        loci: allLoci,
        paths: allPaths,
        vectorsById: vectors,
        dismissed: readDismissed(),
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
  }, [store, config.anthropicKey, config.mycorrhizaEnabled, notify])

  function handleKeep(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    const patch: Partial<Thing> = { state: 'Kept', kept: today }
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
    if (released) {
      notify('Released.', { undo: () => handleReturnToUnderstory(id) })
    }
  }

  function handleReturnToUnderstory(id: string) {
    const patch: Partial<Thing> = { state: 'Understory', kept: null }
    write(
      () => setThings((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
      async () => {
        const updated = await store.updateThing(id, patch)
        setThings((prev) => prev.map((t) => (t.id === id ? updated : t)))
      },
      'That could not be put back',
    )
  }

  function handleEditThing(id: string, patch: Partial<Thing>) {
    write(
      () => setThings((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
      async () => {
        const updated = await store.updateThing(id, patch)
        setThings((prev) => prev.map((t) => (t.id === id ? updated : t)))
      },
      'That edit could not be saved',
    )
  }

  function handleIntake(body: string) {
    const today = new Date().toISOString().slice(0, 10)
    const draft: Thing = {
      id: draftId(),
      handle: body.slice(0, 60),
      body,
      kind: null,
      state: 'Understory',
      sourceId: null,
      locator: '',
      encountered: today,
      kept: null,
      note: '',
      lociIds: [],
      image: null,
      link: null,
      koboBookmarkId: null,
    }
    write(
      () => setThings((prev) => [draft, ...prev]),
      async () => {
        const created = await store.createThing({ body })
        setThings((prev) => prev.map((t) => (t.id === draft.id ? created : t)))
      },
      'That could not be added to the understory',
    )
  }

  const understoryThings = things.filter((thing) => thing.state === 'Understory')
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
    const draft: Locus = { id: draftId(), name, meaning, coined: new Date().toISOString().slice(0, 10) }
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
    const draft: Locus = { id: draftId(), name, meaning, coined: new Date().toISOString().slice(0, 10) }
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
    const draft: Path = {
      id: draftId(),
      label: deriveLabel(fromThing.handle, toThing.handle),
      fromId: fromThing.id,
      toId: toThing.id,
      why,
      made: new Date().toISOString().slice(0, 10),
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
    addDismissed(provocationKey(provocation))
    setProvocation(null)
  }

  function handleAcceptProvocationPair(a: Thing, b: Thing, why: string) {
    walkPath(a, b, why, 'Accepted')
    setProvocation(null)
    setView('underground')
    notify('Path walked — it is drawn in the Underground.')
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
        <h1 className={styles.title}>Silva</h1>
        <div className={styles.nav}>
          <SegmentedControl
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { value: 'forest', label: 'Forest' },
            { value: 'understory', label: 'Understory' },
            { value: 'clearings', label: 'Clearings' },
            { value: 'underground', label: 'Underground' },
            { value: 'search', label: 'Search' },
            { value: 'settings', label: 'Settings' },
          ]}
          />
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {provocation && (
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
        ) : view === 'understory' ? (
          <>
            <IntakeField onSubmit={handleIntake} />
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
            <UnderstoryView
              things={understoryThings}
              onKeep={handleKeep}
              onRelease={handleRelease}
            />
          </>
        ) : view === 'forest' ? (
          <ForestView things={things} sources={sources} loci={loci} onEdit={handleEditThing} />
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
        ) : view === 'underground' ? (
          <UndergroundView
            things={things}
            loci={loci}
            paths={paths}
            vectorsById={vectorsById}
            onMake={handleMakePath}
            onEditWhy={handleEditPathWhy}
            onRemove={handleRemovePath}
          />
        ) : view === 'search' ? (
          <SearchView things={things} vectorsById={vectorsById} />
        ) : (
          <SettingsView config={config} onChange={handleConfigChange} indexing={indexing} />
        )}
      </main>

      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
