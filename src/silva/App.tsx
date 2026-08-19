import { useEffect, useMemo, useState } from 'react'
import { Button, SegmentedControl } from '../ds'
import { SilvaStore } from './lib/store'
import { isExpired } from './lib/understory'
import type { Thing } from './lib/notion'
import type { Source } from './lib/sources'
import type { Locus } from './lib/loci'
import { withoutLocus, withLocusReplaced } from './lib/loci'
import type { Path } from './lib/paths'
import { ForestView } from './components/ForestView'
import { UnderstoryView } from './components/UnderstoryView'
import { IntakeField } from './components/IntakeField'
import { KoboImportPanel } from './components/KoboImportPanel'
import { ClearingsView } from './components/ClearingsView'
import { UndergroundView } from './components/UndergroundView'
import { SearchView } from './components/SearchView'
import { ProvocationBanner } from './components/ProvocationBanner'
import { SettingsView } from './components/SettingsView'
import { pickProvocation, provocationKey, type Provocation } from './lib/provocations'
import { readDismissed, addDismissed, hasShownThisSession, markShownThisSession } from './lib/provocationDismissals'
import { peekVectors } from './lib/vectorCache'
import { loadSilvaConfig, saveSilvaConfig, type SilvaConfig } from './lib/settingsConfig'
import { confirmTension } from './lib/tension'
import { syncSystemTheme } from './lib/theme'
import styles from './App.module.css'

type View = 'forest' | 'understory' | 'clearings' | 'underground' | 'search' | 'settings'

export default function App() {
  // SILVA.md: "Light and dark, syncing to the device" — no manual toggle,
  // purely OS `prefers-color-scheme`. Runs once; the returned cleanup
  // detaches the listener on unmount (App never unmounts in practice, but
  // matches every other effect's own cleanup discipline in this file).
  useEffect(() => syncSystemTheme(), [])

  // Settings holds the Notion token (and Anthropic key) on this device —
  // store.ts already supported a live token since Session 3, this just
  // wires it to a real UI. Re-deriving `store` when the token changes
  // re-triggers the load effect below for free (it already depends on
  // [store]) — a fresh SilvaStore instance is a new effect dependency.
  const [config, setConfig] = useState<SilvaConfig>(() => loadSilvaConfig())
  const store = useMemo(() => new SilvaStore(config.notionToken), [config.notionToken])

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
  const [view, setView] = useState<View>('understory')
  const [importOpen, setImportOpen] = useState(false)
  const [provocation, setProvocation] = useState<Provocation | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [loaded, loadedSources, loadedLoci, loadedPaths] = await Promise.all([
          store.listThings(),
          store.listSources(),
          store.listLoci(),
          store.listPaths(),
        ])
        if (!cancelled) setSources(loadedSources)
        if (!cancelled) setLoci(loadedLoci)
        if (!cancelled) setPaths(loadedPaths)

        // Season expiry: quietly release anything that's fully aged out of
        // the understory. No badge, no counter — it just isn't there next
        // time (SILVA.md "The understory").
        const expired = loaded.filter((thing) => isExpired(thing))
        const released = await Promise.all(
          expired.map((thing) => store.updateThing(thing.id, { state: 'Released' })),
        )
        const releasedIds = new Set(released.map((thing) => thing.id))
        const settled = loaded.map((thing) => {
          const replacement = released.find((r) => r.id === thing.id)
          return releasedIds.has(thing.id) && replacement ? replacement : thing
        })

        if (!cancelled) setThings(settled)

        // At most one provocation per session (SILVA.md's anti-feed rule) —
        // computed once here, never reconsidered even if vectors become
        // available later (e.g. a visit to Search). Only *peeks* whatever's
        // already cached in IndexedDB — never calls embed(), so this never
        // triggers the ~25 MB model to load on its own.
        if (!cancelled && !hasShownThisSession()) {
          const keptThings = settled.filter((t) => t.state === 'Kept')
          const vectorsById = await peekVectors(keptThings)
          const picked = pickProvocation({
            things: settled,
            loci: loadedLoci,
            paths: loadedPaths,
            vectorsById,
            dismissed: readDismissed(),
            tensionEnabled: Boolean(config.anthropicKey),
          })
          if (!cancelled && picked) {
            markShownThisSession()
            // Tension is the one kind gatherTension only pre-filters by
            // similarity band — a real contradiction still needs the model
            // to confirm it, once, only for this single chosen pair (see
            // lib/provocations.ts's header comment). A "no" or any failure
            // just means nothing is shown this session, same as if no
            // provocation had been eligible at all — never a wrong nudge.
            if (picked.kind === 'tension') {
              const confirmed = await confirmTension(config.anthropicKey, picked.a, picked.b)
              if (!cancelled && confirmed) setProvocation(picked)
            } else {
              setProvocation(picked)
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Could not load the forest.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [store, config.anthropicKey])

  async function handleKeep(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    const updated = await store.updateThing(id, { state: 'Kept', kept: today })
    setThings((prev) => prev.map((thing) => (thing.id === id ? updated : thing)))
  }

  async function handleRelease(id: string) {
    const updated = await store.updateThing(id, { state: 'Released' })
    setThings((prev) => prev.map((thing) => (thing.id === id ? updated : thing)))
  }

  async function handleEditThing(id: string, patch: Partial<Thing>) {
    const updated = await store.updateThing(id, patch)
    setThings((prev) => prev.map((thing) => (thing.id === id ? updated : thing)))
  }

  async function handleIntake(body: string) {
    const created = await store.createThing({ body })
    setThings((prev) => [created, ...prev])
  }

  const understoryThings = things.filter((thing) => thing.state === 'Understory')
  const existingKoboBookmarkIds = useMemo(
    () => new Set(things.map((t) => t.koboBookmarkId).filter((id): id is string => Boolean(id))),
    [things],
  )

  async function handleImported(created: Thing[]) {
    setThings((prev) => [...created, ...prev])
    // A Kobo import may have created new Sources (or backfilled an existing
    // one's koboVolumeId) — refresh so the forest can resolve their titles.
    setSources(await store.listSources())
  }

  // Locus membership lives entirely on the Things side (Thing.lociIds) —
  // every clearing action below is really "patch some things, then maybe
  // touch the locus record itself." This applies a batch of patches and
  // folds the results back into `things` state in one pass.
  async function applyThingUpdates(updates: { id: string; patch: Partial<Thing> }[]) {
    const updated = await Promise.all(updates.map((u) => store.updateThing(u.id, u.patch)))
    const byId = new Map(updated.map((t) => [t.id, t]))
    setThings((prev) => prev.map((t) => byId.get(t.id) ?? t))
  }

  async function handleCoin(name: string, meaning: string, seedThingIds: string[]) {
    const locus = await store.createLocus({ name, meaning })
    setLoci((prev) => [locus, ...prev])
    if (seedThingIds.length === 0) return
    await applyThingUpdates(
      seedThingIds
        .map((id) => things.find((t) => t.id === id))
        .filter((t): t is Thing => Boolean(t))
        .map((t) => ({ id: t.id, patch: { lociIds: [...t.lociIds, locus.id] } })),
    )
  }

  async function handleRename(locusId: string, name: string, meaning: string) {
    const updated = await store.updateLocus(locusId, { name, meaning })
    setLoci((prev) => prev.map((l) => (l.id === locusId ? updated : l)))
  }

  async function handleAddThings(locusId: string, thingIds: string[]) {
    await applyThingUpdates(
      thingIds
        .map((id) => things.find((t) => t.id === id))
        .filter((t): t is Thing => Boolean(t))
        .map((t) => ({ id: t.id, patch: { lociIds: [...t.lociIds, locusId] } })),
    )
  }

  async function handleRemoveThing(locusId: string, thingId: string) {
    const thing = things.find((t) => t.id === thingId)
    if (!thing) return
    await applyThingUpdates([{ id: thing.id, patch: { lociIds: withoutLocus(thing.lociIds, locusId) } }])
  }

  async function handleMerge(survivorId: string, mergeAwayId: string) {
    const affected = things.filter((t) => t.lociIds.includes(mergeAwayId))
    if (affected.length > 0) {
      await applyThingUpdates(
        affected.map((t) => ({ id: t.id, patch: { lociIds: withLocusReplaced(t.lociIds, mergeAwayId, survivorId) } })),
      )
    }
    await store.archiveLocus(mergeAwayId)
    setLoci((prev) => prev.filter((l) => l.id !== mergeAwayId))
  }

  async function handleDissolve(locusId: string) {
    const affected = things.filter((t) => t.lociIds.includes(locusId))
    if (affected.length > 0) {
      await applyThingUpdates(affected.map((t) => ({ id: t.id, patch: { lociIds: withoutLocus(t.lociIds, locusId) } })))
    }
    await store.archiveLocus(locusId)
    setLoci((prev) => prev.filter((l) => l.id !== locusId))
  }

  // A split things's membership in the old locus is replaced with the new
  // one — same withLocusReplaced helper handleMerge uses, just in the other
  // direction. Other loci a thing already belongs to are untouched.
  async function handleSplit(locusId: string, thingIds: string[], name: string, meaning: string) {
    const newLocus = await store.createLocus({ name, meaning })
    setLoci((prev) => [newLocus, ...prev])
    const affected = thingIds
      .map((id) => things.find((t) => t.id === id))
      .filter((t): t is Thing => Boolean(t))
    if (affected.length > 0) {
      await applyThingUpdates(
        affected.map((t) => ({ id: t.id, patch: { lociIds: withLocusReplaced(t.lociIds, locusId, newLocus.id) } })),
      )
    }
  }

  async function handleMakePath(fromId: string, toId: string, why: string) {
    const fromThing = things.find((t) => t.id === fromId)
    const toThing = things.find((t) => t.id === toId)
    if (!fromThing || !toThing) return
    const path = await store.createPath({
      fromId,
      toId,
      fromHandle: fromThing.handle,
      toHandle: toThing.handle,
      why,
    })
    setPaths((prev) => [path, ...prev])
  }

  async function handleEditPathWhy(pathId: string, why: string) {
    const updated = await store.updatePathWhy(pathId, why)
    setPaths((prev) => prev.map((p) => (p.id === pathId ? updated : p)))
  }

  async function handleRemovePath(pathId: string) {
    await store.archivePath(pathId)
    setPaths((prev) => prev.filter((p) => p.id !== pathId))
  }

  function handleDismissProvocation() {
    if (!provocation) return
    addDismissed(provocationKey(provocation))
    setProvocation(null)
  }

  async function handleAcceptProvocationPair(a: Thing, b: Thing, why: string) {
    const path = await store.createPath({
      fromId: a.id,
      toId: b.id,
      fromHandle: a.handle,
      toHandle: b.handle,
      why,
      origin: 'Accepted',
    })
    setPaths((prev) => [path, ...prev])
    setProvocation(null)
  }

  async function handleAcceptClearingForming(clusterThings: Thing[], name: string) {
    await handleCoin(name, '', clusterThings.map((t) => t.id))
    setProvocation(null)
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Silva</h1>
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { value: 'understory', label: 'Understory' },
            { value: 'forest', label: 'Forest' },
            { value: 'clearings', label: 'Clearings' },
            { value: 'underground', label: 'Underground' },
            { value: 'search', label: 'Search' },
            { value: 'settings', label: 'Settings' },
          ]}
        />
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
          <ForestView things={things} sources={sources} onEdit={handleEditThing} />
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
            onMake={handleMakePath}
            onEditWhy={handleEditPathWhy}
            onRemove={handleRemovePath}
          />
        ) : view === 'search' ? (
          <SearchView things={things} />
        ) : (
          <SettingsView config={config} onChange={handleConfigChange} />
        )}
      </main>
    </div>
  )
}
