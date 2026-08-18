import { useEffect, useMemo, useState } from 'react'
import { Button, SegmentedControl } from '../ds'
import { SilvaStore } from './lib/store'
import { isExpired } from './lib/understory'
import type { Thing } from './lib/notion'
import type { Source } from './lib/sources'
import { ForestView } from './components/ForestView'
import { UnderstoryView } from './components/UnderstoryView'
import { IntakeField } from './components/IntakeField'
import { KoboImportPanel } from './components/KoboImportPanel'
import styles from './App.module.css'

type View = 'forest' | 'understory'

export default function App() {
  // No Settings/token entry yet (deferred — see plan) — demo mode is what
  // actually runs this session. lib/store.ts already supports a live token,
  // ready for whichever later session adds the UI to enter one.
  const store = useMemo(() => new SilvaStore(''), [])
  const [things, setThings] = useState<Thing[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('understory')
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [loaded, loadedSources] = await Promise.all([store.listThings(), store.listSources()])
        if (!cancelled) setSources(loadedSources)

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
        ) : (
          <ForestView things={things} sources={sources} />
        )}
      </main>
    </div>
  )
}
