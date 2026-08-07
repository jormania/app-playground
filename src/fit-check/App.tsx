import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ds'
import Navigation, { type Tab } from './components/Navigation.tsx'
import WardrobeGrid from './components/WardrobeGrid.tsx'
import Today from './components/Today.tsx'
import History from './components/History.tsx'
import AddGarment from './components/AddGarment.tsx'
import Settings from './components/Settings.tsx'
import GarmentDetailsModal from './components/GarmentDetailsModal.tsx'
import UndoToast from './components/UndoToast.tsx'
import { NotionClient } from './lib/notionClient.ts'
import { pruneCache } from './lib/imageCache.ts'
import { loadConfig, saveConfig, isConfigured, type FitCheckConfig } from './lib/config.ts'
import { resolveFilter, type Wardrobe } from './lib/wardrobes.ts'
import { useWeather } from './lib/useWeather.ts'
import { weatherSnapshot } from './lib/weatherText.ts'
import { todayIso } from './lib/today.ts'
import type { OutfitSuggestion } from './lib/recommend.ts'
import type { Mood, Verdict } from './lib/vocabulary.ts'
import type { Garment, Outfit } from './lib/types.ts'

const TAB_TITLES: Record<Tab, { title: string; subtitle: string }> = {
  today: { title: 'Today', subtitle: 'Three things you could wear.' },
  wardrobe: { title: 'Wardrobe', subtitle: 'Everything you own, in one place.' },
  history: { title: 'History', subtitle: "What you wore — and what you didn't." },
  settings: { title: 'Settings', subtitle: 'Keys, names and how it looks.' },
}

export default function App() {
  const [config, setConfig] = useState<FitCheckConfig>(loadConfig)
  const [tab, setTab] = useState<Tab>('wardrobe')
  const [garments, setGarments] = useState<Garment[]>([])
  const [wardrobes, setWardrobes] = useState<Wardrobe[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null)
  const [wardrobeBusy, setWardrobeBusy] = useState(false)
  const [wardrobeProgress, setWardrobeProgress] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  // Today's outcomes, keyed by the suggestion's own id (its sorted garment
  // ids) — lifted here rather than into Today so switching tabs and coming
  // back still shows "Worn today" instead of asking again.
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [recordingIds, setRecordingIds] = useState<Set<string>>(new Set())
  // Which wardrobe(s) the last-added garment went into. AddGarment already
  // defaults to whichever wardrobe is currently filtered to; this only matters
  // as the fallback when viewing "All" — adding five things in a row while
  // browsing everywhere shouldn't mean re-tapping the same wardrobe chip five
  // times. Session-only on purpose: it's a small convenience, not a setting.
  // times. Session-only on purpose: it's a small convenience, not a setting.
  const [lastWardrobeIds, setLastWardrobeIds] = useState<string[] | null>(null)
  const [undoToast, setUndoToast] = useState<{ id: string, message: string, onUndo: () => void } | null>(null)

  // Asked for once per session, and a refusal is fine — Bucharest stands in.
  const { weather, loading: weatherLoading } = useWeather(config.coords)

  // Screens are swapped, not routed to — nothing about switching tabs implies
  // a scroll reset on its own. Scroll to the bottom of Wardrobe, tap History,
  // and land halfway down an unrelated page without this.
  useEffect(() => { window.scrollTo(0, 0) }, [tab])

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

  const client = useCallback(() => new NotionClient(config.notionToken, {
    garments: config.garmentsDbId,
    outfits: config.outfitsDbId,
    wardrobes: config.wardrobesDbId,
  }), [config.notionToken, config.garmentsDbId, config.outfitsDbId, config.wardrobesDbId])

  // The actual fetch, shared by the automatic reload below and by a manual
  // "Sync now" in Settings — Notion is the real source of truth, and if
  // Gabriel fixes a typo directly in a database, this is how that reaches the
  // app without a full page reload (and losing whatever tab/scroll state
  // was in the middle of).
  const loadAll = useCallback(async (isCancelled: () => boolean) => {
    setError('')
    const [rows, wardrobeRows, outfitRows] = await Promise.all([
      client().listGarments(), client().listWardrobes(), client().listOutfits(),
    ])
    if (isCancelled()) return
    setGarments(rows)
    setWardrobes(wardrobeRows)
    setOutfits(outfitRows)
    // `verdicts`/`recordingIds` are keyed by outfit ids computed from THIS
    // garment set. Swapping the set from under them (demo → live, one Notion
    // database → another, or a manual sync pulling in an edit) would
    // otherwise leave Today claiming "Worn today" for a combination the
    // fresh `outfits` list has no record of — a state History would visibly
    // disagree with.
    setVerdicts({})
    setRecordingIds(new Set())
    // Cached photos for garments that no longer exist would otherwise
    // accumulate forever. Fire-and-forget housekeeping.
    void pruneCache(rows.map((g) => g.id))
  }, [client])

  // Reload whenever the credentials change — not on every config edit, or
  // renaming a wardrobe would refetch the whole thing.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadAll(() => cancelled)
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [config.notionToken, config.garmentsDbId, config.outfitsDbId, config.wardrobesDbId, loadAll])

  const [syncing, setSyncing] = useState(false)
  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {
      await loadAll(() => false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }, [loadAll])

  const demoMode = !isConfigured(config)
  const canPersistWardrobes = Boolean(config.notionToken && config.wardrobesDbId)
  const canPersistOutfits = Boolean(config.notionToken && config.outfitsDbId)

  const runTask = useCallback(async (task: () => Promise<void>) => {
    setError('')
    try {
      await task()
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  // Wardrobe edits follow one path whether or not Notion is connected: apply
  // locally first, then persist if we can. In demo mode "persist" is simply a
  // no-op, so the whole feature is explorable before anything is set up — the
  // changes just live for the session, which is what demo data should do.
  const runWardrobeTask = useCallback(async (task: () => Promise<void>) => {
    setWardrobeBusy(true)
    await runTask(task)
    setWardrobeBusy(false)
    setWardrobeProgress('')
  }, [runTask])

  const createWardrobe = useCallback(async (name: string, order: number) => {
    await runWardrobeTask(async () => {
      if (canPersistWardrobes) {
        const created = await client().createWardrobe({ name, active: true, order })
        if (created) setWardrobes((prev) => [...prev, created])
        return
      }
      setWardrobes((prev) => [
        ...prev,
        { id: `local_w_${Date.now()}`, name, active: true, order },
      ])
    })
  }, [canPersistWardrobes, client, runWardrobeTask])

  const patchWardrobe = useCallback(async (id: string, patch: Partial<Omit<Wardrobe, 'id'>>) => {
    await runWardrobeTask(async () => {
      setWardrobes((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
      if (canPersistWardrobes) await client().updateWardrobe(id, patch)
    })
  }, [canPersistWardrobes, client, runWardrobeTask])

  const deleteWardrobe = useCallback(async (wardrobe: Wardrobe) => {
    await runWardrobeTask(async () => {
      if (canPersistWardrobes) {
        await client().deleteWardrobe(wardrobe.id, garments, (done, total) => {
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
  }, [canPersistWardrobes, client, runWardrobeTask, garments])

  // A garment favourite is a single field flip — always applied locally first
  // for an instant star, persisted only when there's somewhere to persist it.
  const toggleGarmentFavourite = useCallback((garment: Garment) => {
    const next = !garment.favourite
    setGarments((prev) => prev.map((g) => (g.id === garment.id ? { ...g, favourite: next } : g)))
    if (!demoMode) void runTask(async () => { await client().updateGarment(garment.id, { favourite: next }) })
  }, [demoMode, client, runTask])

  const toggleOutfitFavourite = useCallback((outfit: Outfit) => {
    const next = !outfit.favourite
    setOutfits((prev) => prev.map((o) => (o.id === outfit.id ? { ...o, favourite: next } : o)))
    if (canPersistOutfits) void runTask(async () => { await client().updateOutfit(outfit.id, { favourite: next }) })
  }, [canPersistOutfits, client, runTask])

  const resolvedFilterId = resolveFilter(config.wardrobeFilterId, wardrobes)

  /**
   * Wear or skip a suggestion. Both create a history row (per Nora: skip means
   * "not today", not "never again", so the log records it happened without
   * judging it). Only Worn touches the garments themselves — wearCount and
   * lastWorn feed the recommender's recency nudge and the roadmap's future
   * personalisation; a skip is not a permanent mark against anything.
   */
  const recordVerdict = useCallback(async (outfit: OutfitSuggestion, verdict: Verdict) => {
    // The buttons disable via `recordingIds`, but that only takes effect on the
    // next render — two taps inside one frame would both get through and write
    // two history rows for one outfit.
    if (recordingIds.has(outfit.id) || verdicts[outfit.id]) return
    setRecordingIds((prev) => new Set(prev).add(outfit.id))
    setError('')
    try {
      const date = todayIso()
      const garmentIds = outfit.garments.map((g) => g.id)
      const record: Partial<Outfit> = {
        name: outfit.garments.map((g) => g.name).join(' + '),
        date,
        garmentIds,
        mood,
        weather: weatherSnapshot(weather),
        verdict,
        favourite: false,
        wardrobeIds: resolvedFilterId ? [resolvedFilterId] : [],
      }

      let saved: Outfit = { id: `local_o_${Date.now()}`, ...record } as Outfit
      if (canPersistOutfits) {
        const created = await client().createOutfit(record)
        if (created) saved = created
      }
      setOutfits((prev) => [...prev, saved])

      if (verdict === 'Worn') {
        setGarments((prev) => prev.map((g) => (
          garmentIds.includes(g.id) ? { ...g, wearCount: g.wearCount + 1, lastWorn: date } : g
        )))
        if (!demoMode) {
          for (const stale of outfit.garments) {
            // Count up from the CURRENT garment, not from `outfit.garments` —
            // that's a snapshot pinned when the suggestions were built. Two
            // cards can share a pair of shoes; wearing both would otherwise
            // write `snapshot + 1` twice, so Notion ends up one behind the
            // local count and stays wrong from then on.
            const current = garments.find((g) => g.id === stale.id) ?? stale
            await client().updateGarment(stale.id, {
              wearCount: current.wearCount + 1,
              lastWorn: date,
            })
          }
        }
      }

      setVerdicts((prev) => ({ ...prev, [outfit.id]: verdict }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRecordingIds((prev) => {
        const next = new Set(prev)
        next.delete(outfit.id)
        return next
      })
    }
  }, [mood, weather, resolvedFilterId, canPersistOutfits, demoMode, client, garments, recordingIds, verdicts])

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
            This is a demo wardrobe. Nice clothes, but they're not yours yet.
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
              lastWardrobeIds={lastWardrobeIds}
              onCancel={() => setAdding(false)}
              onAdded={(garment) => {
                setGarments((prev) => [...prev, garment])
                setLastWardrobeIds(garment.wardrobeIds)
                setAdding(false)
              }}
            />
          ) : loading ? (
            <p className="fc-empty">Getting your wardrobe…</p>
          ) : error ? null : ( // the banner above already explains it; a second,
            // conflicting "nothing here yet" underneath it doubles the message
            <WardrobeGrid
              garments={garments}
              wardrobes={wardrobes}
              filterId={resolvedFilterId}
              onFilterChange={(id) => updateConfig({ wardrobeFilterId: id })}
              onSelect={setSelectedGarment}
              onToggleFavourite={toggleGarmentFavourite}
              action={
                <div className="fc-wardrobe-action">
                  <Button onClick={() => setAdding(true)}>
                    <Plus size={16} aria-hidden="true" /> Add something
                  </Button>
                  {demoMode && (
                    <span className="fc-settings-hint">
                      Demo additions last for this visit only.
                    </span>
                  )}
                </div>
              }
            />
          )
        )}

        {tab === 'today' && (
          loading ? (
            <p className="fc-empty">Getting your wardrobe…</p>
          ) : error ? null : (
            <Today
              garments={garments}
              wardrobes={wardrobes}
              filterId={resolvedFilterId}
              weather={weather}
              weatherLoading={weatherLoading}
              mood={mood}
              onMoodChange={setMood}
              verdicts={verdicts}
              recordingIds={recordingIds}
              onRecordVerdict={recordVerdict}
            />
          )
        )}

        {tab === 'history' && (
          loading ? (
            <p className="fc-empty">Getting your history…</p>
          ) : error ? null : (
            <History
              outfits={outfits}
              garments={garments}
              wardrobes={wardrobes}
              onToggleFavourite={toggleOutfitFavourite}
              onDeleteOutfit={(outfit) => {
                const deletedOutfit = outfits.find(o => o.id === outfit.id)
                setOutfits((prev) => prev.filter((o) => o.id !== outfit.id))
                
                if (!deletedOutfit) return
                
                let executeDelete = true
                
                const timeout = setTimeout(() => {
                  if (executeDelete && canPersistOutfits) {
                    runTask(async () => { await client().deleteOutfit(outfit.id) })
                  }
                  setUndoToast(current => current?.id === outfit.id ? null : current)
                }, 5000)
                
                setUndoToast({
                  id: outfit.id,
                  message: `Outfit log deleted`,
                  onUndo: () => {
                    executeDelete = false
                    clearTimeout(timeout)
                    setOutfits((prev) => [...prev, deletedOutfit])
                    setUndoToast(null)
                  }
                })
              }}
            />
          )
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
            demoMode={demoMode}
            syncing={syncing}
            onSync={syncNow}
          />
        )}
      </main>

      <GarmentDetailsModal
        garment={selectedGarment}
        open={!!selectedGarment}
        config={config}
        wardrobes={wardrobes}
        onClose={() => setSelectedGarment(null)}
        onUpdate={(updated) => {
          setGarments((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
        }}
        onDelete={(id) => {
          const deletedGarment = garments.find(g => g.id === id)
          setGarments((prev) => prev.filter((g) => g.id !== id))
          setSelectedGarment(null)
          
          if (!deletedGarment) return
          
          let executeDelete = true
          
          const timeout = setTimeout(() => {
            if (executeDelete && !demoMode) {
              runTask(async () => { await client().deleteGarment(id) })
            }
            setUndoToast(current => current?.id === id ? null : current)
          }, 5000)
          
          setUndoToast({
            id,
            message: `Garment deleted`,
            onUndo: () => {
              executeDelete = false
              clearTimeout(timeout)
              setGarments((prev) => [...prev, deletedGarment])
              setUndoToast(null)
            }
          })
        }}
        onToggleFavourite={(garment) => {
          toggleGarmentFavourite(garment)
          if (selectedGarment?.id === garment.id) {
            setSelectedGarment({ ...garment, favourite: !garment.favourite })
          }
        }}
      />

      <Navigation tab={tab} onChange={setTab} />
      
      {undoToast && (
        <UndoToast
          key={undoToast.id}
          message={undoToast.message}
          onUndo={undoToast.onUndo}
        />
      )}
    </>
  )
}
