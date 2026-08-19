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
import styles from './App.module.css'

type View = 'forest' | 'understory' | 'clearings' | 'underground'

export default function App() {
  // No Settings/token entry yet (deferred — see plan) — demo mode is what
  // actually runs this session. lib/store.ts already supports a live token,
  // ready for whichever later session adds the UI to enter one.
  const store = useMemo(() => new SilvaStore(''), [])
  const [things, setThings] = useState<Thing[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loci, setLoci] = useState<Locus[]>([])
  const [paths, setPaths] = useState<Path[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('understory')
  const [importOpen, setImportOpen] = useState(false)

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
  }, [store])

  async function handleKeep(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    const updated = await store.updateThing(id, { state: 'Kept', kept: today })
    setThings((prev) => prev.map((thing) => (thing.id === id ? updated : thing)))
  }

  async function handleRelease(id: string) {
    const updated = await store.updateThing(id, { state: 'Released' })
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
          ]}
        />
      </header>

      {error && <p className={styles.error}>{error}</p>}

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
          <ForestView things={things} sources={sources} />
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
          />
        ) : (
          <UndergroundView
            things={things}
            paths={paths}
            onMake={handleMakePath}
            onEditWhy={handleEditPathWhy}
            onRemove={handleRemovePath}
          />
        )}
      </main>
    </div>
  )
}
