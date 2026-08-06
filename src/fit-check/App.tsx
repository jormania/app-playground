import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ds'
import Navigation, { type Tab } from './components/Navigation.tsx'
import WardrobeGrid from './components/WardrobeGrid.tsx'
import AddGarment from './components/AddGarment.tsx'
import Settings from './components/Settings.tsx'
import { NotionClient } from './lib/notionClient.ts'
import { pruneCache } from './lib/imageCache.ts'
import { loadConfig, saveConfig, isConfigured, type FitCheckConfig } from './lib/config.ts'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

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
    })
    client.listGarments()
      .then((rows) => {
        if (cancelled) return
        setGarments(rows)
        // Cached photos for garments that no longer exist would otherwise
        // accumulate forever. Fire-and-forget housekeeping.
        void pruneCache(rows.map((g) => g.id))
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [config.notionToken, config.garmentsDbId, config.outfitsDbId])

  const demoMode = !isConfigured(config)
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
                config={config}
                onHomeChange={(home) => updateConfig({ activeHome: home })}
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
          <p className="fc-empty">
            Outfit suggestions arrive in the next update.
          </p>
        )}

        {tab === 'history' && (
          <p className="fc-empty">
            Once you start wearing things, they'll show up here.
          </p>
        )}

        {tab === 'settings' && <Settings config={config} onChange={updateConfig} />}
      </main>

      <Navigation tab={tab} onChange={setTab} />
    </>
  )
}
