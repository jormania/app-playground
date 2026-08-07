import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ds'
import Navigation, { type Tab } from './components/Navigation.tsx'
import WardrobeGrid from './components/WardrobeGrid.tsx'
import Today from './components/Today.tsx'
import AddGarment from './components/AddGarment.tsx'
import Settings from './components/Settings.tsx'
import { NotionClient } from './lib/notionClient.ts'
import { pruneCache } from './lib/imageCache.ts'
import { loadConfig, saveConfig, isConfigured, type FitCheckConfig } from './lib/config.ts'
import { resolveFilter, type Wardrobe } from './lib/wardrobes.ts'
import { useWeather } from './lib/useWeather.ts'
import type { Mood } from './lib/vocabulary.ts'
import type { Garment } from './lib/types.ts'

const TAB_TITLES: Record<Tab, { title: string; subtitle: string }> = {
  today: { title: 'Today', subtitle: 'Three things you could wear.' },
  wardrobe: { title: 'Wardrobe', subtitle: 'Everything you own, in one place.' },
  history: { title: 'History', subtitle: 'What you actually wore.' },
  settings: { title: 'Settings', subtitle: 'Keys, names and how it looks.' },
}

export default function App() {
  const [config, setConfig] = useState<FitCheckConfig>(loadConfig)
  const [tab, setTab] = useState<Tab>('wardrobe')
  const [garments, setGarments] = useState<Garment[]>([])
  const [wardrobes, setWardrobes] = useState<Wardrobe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [wardrobeBusy, setWardrobeBusy] = useState(false)
  const [wardrobeProgress, setWardrobeProgress] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)

  // Asked for once per session, and a refusal is fine — Bucharest stands in.
  const { weather, loading: weatherLoading } = useWeather(config.coords)

  // Theme: an explicit choice wins, otherwise follow the device. The entry HTML
  // applies the same rule before first paint so there's no flash.
  useEffect(() => {
    const dark = config.theme
      ? config.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [config.theme])

  useEffect(() => { saveConfig(config) }, [config])

  const updateConfig = useCallback((patch: Partial<FitCheckConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  // Reload whenever the credentials change — not on every config edit, or
  // renaming a home would refetch the whole wardrobe.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const client = new NotionClient(config.notionToken, {
      garments: config.garmentsDbId,
      outfits: config.outfitsDbId,
      wardrobes: config.wardrobesDbId,
    })
    Promise.all([client.listGarments(), client.listWardrobes()])
      .then(([rows, wardrobeRows]) => {
        if (cancelled) return
        setGarments(rows)
        setWardrobes(wardrobeRows)
        // Cached photos for garments that no longer exist would otherwise
        // accumulate forever. Fire-and-forget housekeeping.
        void pruneCache(rows.map((g) => g.id))
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [config.notionToken, config.garmentsDbId, config.outfitsDbId, config.wardrobesDbId])

  const demoMode = !isConfigured(config)

  // Wardrobe edits follow one path whether or not Notion is connected: apply
  // locally first, then persist if we can. In demo mode "persist" is simply a
  // no-op, so the whole feature is explorable before anything is set up — the
  // changes just live for the session, which is what demo data should do.
  const wardrobeClient = useCallback(() => new NotionClient(config.notionToken, {
    garments: config.garmentsDbId,
    outfits: config.outfitsDbId,
    wardrobes: config.wardrobesDbId,
  }), [config.notionToken, config.garmentsDbId, config.outfitsDbId, config.wardrobesDbId])

  const canPersistWardrobes = Boolean(config.notionToken && config.wardrobesDbId)

  const runWardrobeTask = useCallback(async (task: () => Promise<void>) => {
    setWardrobeBusy(true)
    setError('')
    try {
      await task()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setWardrobeBusy(false)
      setWardrobeProgress('')
    }
  }, [])

  const createWardrobe = useCallback(async (name: string, order: number) => {
    await runWardrobeTask(async () => {
      if (canPersistWardrobes) {
        const created = await wardrobeClient().createWardrobe({ name, active: true, order })
        if (created) setWardrobes((prev) => [...prev, created])
        return
      }
      setWardrobes((prev) => [
        ...prev,
        { id: `local_w_${Date.now()}`, name, active: true, order },
      ])
    })
  }, [canPersistWardrobes, wardrobeClient, runWardrobeTask])

  const patchWardrobe = useCallback(async (id: string, patch: Partial<Omit<Wardrobe, 'id'>>) => {
    await runWardrobeTask(async () => {
      setWardrobes((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
      if (canPersistWardrobes) await wardrobeClient().updateWardrobe(id, patch)
    })
  }, [canPersistWardrobes, wardrobeClient, runWardrobeTask])

  const deleteWardrobe = useCallback(async (wardrobe: Wardrobe) => {
    await runWardrobeTask(async () => {
      if (canPersistWardrobes) {
        await wardrobeClient().deleteWardrobe(wardrobe.id, garments, (done, total) => {
          setWardrobeProgress(`Unfiling ${done} of ${total}…`)
        })
      }
      // Local state mirrors exactly what the server does: the clothes survive,
      // unfiled, rather than disappearing with the wardrobe.
      setGarments((prev) => prev.map((g) => (
        g.wardrobeIds.includes(wardrobe.id)
          ? { ...g, wardrobeIds: g.wardrobeIds.filter((w) => w !== wardrobe.id) }
          : g
      )))
      setWardrobes((prev) => prev.filter((w) => w.id !== wardrobe.id))
      // The filter may have been pointing at what was just deleted.
      setConfig((prev) => (
        prev.wardrobeFilterId === wardrobe.id ? { ...prev, wardrobeFilterId: null } : prev
      ))
    })
  }, [canPersistWardrobes, wardrobeClient, runWardrobeTask, garments])
  const { title, subtitle } = adding && tab === 'wardrobe'
    ? { title: 'Add something', subtitle: 'Photograph it and it joins your wardrobe.' }
    : TAB_TITLES[tab]

  return (
    <>
      <main className="fc-app">
        <header className="fc-header">
          <div>
            <h1 className="fc-title">{title}</h1>
            <p className="fc-subtitle">{subtitle}</p>
          </div>
        </header>

        {demoMode && tab !== 'settings' && (
          <p className="fc-demo-banner" role="status">
            <span aria-hidden="true">👀</span>
            You're looking at a demo wardrobe — nothing here is yours yet.
          </p>
        )}

        {/* A wardrobe-load failure is worth showing on the wardrobe (it explains
            the empty grid) and on Settings (that's where it gets fixed), but on
            the capture screen it's just a stale message about somewhere else. */}
        {error && !adding && (
          <p className="fc-status" data-ok="false" role="alert">{error}</p>
        )}

        {tab === 'wardrobe' && (
          adding ? (
            <AddGarment
              config={config}
              wardrobes={wardrobes}
              onCancel={() => setAdding(false)}
              onAdded={(garment) => {
                setGarments((prev) => [...prev, garment])
                setAdding(false)
              }}
            />
          ) : loading ? (
            <p className="fc-empty">Getting your wardrobe…</p>
          ) : (
            <>
              <WardrobeGrid
                garments={garments}
                wardrobes={wardrobes}
                filterId={resolveFilter(config.wardrobeFilterId, wardrobes)}
                onFilterChange={(id) => updateConfig({ wardrobeFilterId: id })}
              />
              <div className="fc-actions">
                <Button onClick={() => setAdding(true)} disabled={demoMode}>
                  <Plus size={16} aria-hidden="true" /> Add something
                </Button>
              </div>
              {demoMode && (
                <p className="fc-settings-hint" style={{ marginTop: 8 }}>
                  Connect Notion in Settings to start adding your own clothes.
                </p>
              )}
            </>
          )
        )}

        {tab === 'today' && (
          <Today
            garments={garments}
            wardrobes={wardrobes}
            filterId={resolveFilter(config.wardrobeFilterId, wardrobes)}
            weather={weather}
            weatherLoading={weatherLoading}
            mood={mood}
            onMoodChange={setMood}
          />
        )}

        {tab === 'history' && (
          <p className="fc-empty">
            Once you start wearing things, they'll show up here.
          </p>
        )}

        {tab === 'settings' && (
          <Settings
            config={config}
            onChange={updateConfig}
            wardrobes={wardrobes}
            garments={garments}
            wardrobeBusy={wardrobeBusy}
            wardrobeProgress={wardrobeProgress}
            onCreateWardrobe={createWardrobe}
            onRenameWardrobe={(id, name) => patchWardrobe(id, { name })}
            onToggleWardrobe={(id, active) => patchWardrobe(id, { active })}
            onDeleteWardrobe={deleteWardrobe}
          />
        )}
      </main>

      <Navigation tab={tab} onChange={setTab} />
    </>
  )
}
