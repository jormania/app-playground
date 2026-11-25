/**
 * InFlow — a lightweight freelancer income tracker.
 *
 * Overview (the 20-second answer), Income (every payment), Costs (optional),
 * Reports (who, where, what kind of work, P&L, cash flow, tax) and Settings.
 * Hash routes, so a reload or a home-screen launch lands where you were.
 */
import { useEffect, useState } from 'react'
import { BarChart3, LayoutDashboard, List, Plus, Receipt, Settings as Cog, Waves } from 'lucide-react'
import { SegmentedControl, ToastStack } from '../ds'
import { InflowProvider, useInflow, type ProviderProps } from './app/state'
import { CostForm } from './components/CostForm'
import { EntryForm } from './components/EntryForm'
import { Tour } from './components/Tour'
import { PRESET_LABEL, resolvePeriod, type PeriodPreset } from './lib/period'
import { Costs, EMPTY_COST_FILTER, type CostFilter } from './screens/Costs'
import { Income } from './screens/Income'
import { Overview } from './screens/Overview'
import { REPORT_TABS, Reports, type ReportTab } from './screens/Reports'
import { Settings } from './screens/Settings'
import { THEME_KEY } from './store/settings'
import { writeJson } from '../shared/storage'
import type { ThemeChoice } from './domain/types'
import styles from './styles/ui.module.css'

/** Dispatched on window to reopen the welcome tour (Settings → Show the tour). */
export const TOUR_EVENT = 'inflow:tour'

type Screen = 'overview' | 'income' | 'costs' | 'reports' | 'settings'

interface Route { screen: Screen; report: ReportTab }

export function parseRoute(hash: string): Route {
  const [, screen = 'overview', sub = ''] = hash.replace(/^#/, '').split('/')
  const s: Screen = (['overview', 'income', 'costs', 'reports', 'settings'] as const).includes(screen as Screen) ? (screen as Screen) : 'overview'
  const report: ReportTab = (REPORT_TABS as readonly string[]).includes(sub) ? (sub as ReportTab) : 'clients'
  return { screen: s, report }
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const on = () => { setRoute(parseRoute(location.hash)); window.scrollTo?.({ top: 0 }) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

const THEME_COLOR = { light: '#f4f3ef', dark: '#101312' }

function useTheme(choice: ThemeChoice) {
  useEffect(() => {
    writeJson(THEME_KEY, choice)
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const t = choice === 'system' ? (mq?.matches ? 'dark' : 'light') : choice
      document.documentElement.setAttribute('data-theme', t)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
    }
    apply()
    mq?.addEventListener?.('change', apply)
    return () => mq?.removeEventListener?.('change', apply)
  }, [choice])
}

const TABS: { screen: Screen; label: string; icon: typeof List; href: string }[] = [
  { screen: 'overview', label: 'Overview', icon: LayoutDashboard, href: '#/overview' },
  { screen: 'income', label: 'Income', icon: List, href: '#/income' },
  { screen: 'costs', label: 'Costs', icon: Receipt, href: '#/costs' },
  { screen: 'reports', label: 'Reports', icon: BarChart3, href: '#/reports' },
  { screen: 'settings', label: 'Settings', icon: Cog, href: '#/settings' },
]

const PRESETS: PeriodPreset[] = ['week', 'month', 'last_month', 'year', 'custom']
const SHORT: Record<PeriodPreset, string> = { week: 'Week', month: 'Month', last_month: 'Last month', year: 'Year', custom: 'Custom' }

function Shell() {
  const { settings, data, load, error, offlineCopy, period, setPeriod, today, toasts, reload } = useInflow()
  const route = useRoute()
  /** The open form: an income record or a cost; `copyOf` starts a new one from an old one. */
  const [entry, setEntry] = useState<{ kind: 'income' | 'cost'; id: string | null; copyOf: string | null; n: number } | null>(null)
  const [costFilter, setCostFilter] = useState<CostFilter>(EMPTY_COST_FILTER)
  // The tour opens on launch while its "show next time" box is ticked, and on request from Settings.
  const [tour, setTour] = useState(() => settings.showTour)
  useEffect(() => {
    const on = () => setTour(true)
    window.addEventListener(TOUR_EVENT, on)
    return () => window.removeEventListener(TOUR_EVENT, on)
  }, [])
  useTheme(settings.theme)
  // The add button folds to a round icon while you scroll down a list, so it hides less of it.
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const on = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      setCompact(y > 120 && y > last)
      last = y
    }
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const open = (id: string | null) => setEntry((e) => ({ kind: 'income', id, copyOf: null, n: (e?.n ?? 0) + 1 }))
  const openCost = (id: string | null) => setEntry((e) => ({ kind: 'cost', id, copyOf: null, n: (e?.n ?? 0) + 1 }))
  const copy = (kind: 'income' | 'cost', id: string) => setEntry((e) => ({ kind, id: null, copyOf: id, n: (e?.n ?? 0) + 1 }))
  const record = entry?.kind === 'income' && entry.id ? data.records.find((r) => r.id === entry.id) ?? null : null
  const cost = entry?.kind === 'cost' && entry.id ? data.costs.find((c) => c.id === entry.id) ?? null : null
  const copyOfRecord = entry?.kind === 'income' && entry.copyOf ? data.records.find((r) => r.id === entry.copyOf) ?? null : null
  const copyOfCost = entry?.kind === 'cost' && entry.copyOf ? data.costs.find((c) => c.id === entry.copyOf) ?? null : null
  // Costs is optional: with it off, its tab and screen go away.
  const screen: Screen = route.screen === 'costs' && !settings.trackCosts ? 'overview' : route.screen
  const tabs = TABS.filter((t) => t.screen !== 'costs' || settings.trackCosts)
  const showPeriod = screen !== 'settings'
  const custom = resolvePeriod(period, today)
  const notion = settings.mode === 'notion' && !!settings.notionToken && !!settings.incomeDbId

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}><Waves size={22} aria-hidden /> InFlow</div>
          <span className={styles.modeTag} title={notion ? 'Reading and writing your Notion databases' : 'Stored in this browser'}>
            {notion ? (offlineCopy ? 'Notion · offline copy' : 'Notion') : data.records.some((r) => r.demo) ? 'Demo · this device' : 'This device'}
          </span>
        </div>
        {showPeriod && (
          <div className={styles.periodBar}>
            <SegmentedControl size="sm" label="Period" value={period.preset}
              options={PRESETS.map((p) => ({ value: p, label: SHORT[p] }))}
              onChange={(v) => setPeriod(v === 'custom' ? { preset: 'custom', from: custom.from, to: custom.to } : { preset: v as PeriodPreset })} />
            {period.preset === 'custom' && (
              <div className={styles.customRange}>
                <input type="date" aria-label="From" value={custom.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
                <span>to</span>
                <input type="date" aria-label="To" value={custom.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
              </div>
            )}
          </div>
        )}
      </header>

      <main className={styles.main} aria-label={PRESET_LABEL[period.preset]}>
        {error && (
          <div className={styles.banner} role="alert">
            <span>{error}</span>
            <button type="button" className={styles.linkButton} onClick={() => void reload()}>Try again</button>
          </div>
        )}
        {load === 'loading' && data.records.length === 0 ? (
          <div className={styles.empty}>Loading…</div>
        ) : (
          <>
            {screen === 'overview' && <Overview onOpen={open} onAddCost={() => openCost(null)} />}
            {screen === 'income' && <Income onOpen={open} />}
            {screen === 'costs' && <Costs onOpen={openCost} filter={costFilter} setFilter={setCostFilter} />}
            {screen === 'reports' && <Reports tab={route.report} onTab={(t) => { location.hash = `#/reports/${t}` }} onAddCost={() => openCost(null)} />}
            {screen === 'settings' && <Settings />}
          </>
        )}
      </main>

      {screen !== 'settings' && (
        <button type="button" className={`${styles.fab} ${compact ? styles.fabCompact : ''}`} onClick={() => (screen === 'costs' ? openCost(null) : open(null))}
          aria-label={screen === 'costs' ? 'Add cost' : 'Add income'}>
          <Plus size={22} aria-hidden /> <span className={styles.fabLabel}>{screen === 'costs' ? 'Add cost' : 'Add income'}</span>
        </button>
      )}

      <nav className={styles.tabbar} aria-label="Sections">
        <div className={styles.tabbarInner} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map(({ screen: s, label, icon: Icon, href }) => (
            <a key={s} href={href} className={styles.tab} aria-current={screen === s ? 'page' : undefined}>
              <Icon size={20} aria-hidden />
              {label}
            </a>
          ))}
        </div>
      </nav>

      {entry?.kind === 'income' && (
        <EntryForm key={`i-${entry.id ?? 'new'}-${entry.n}`} open record={record} copyOf={copyOfRecord}
          onClose={() => setEntry(null)} onDuplicate={(r) => copy('income', r.id)} />
      )}
      {entry?.kind === 'cost' && (
        <CostForm key={`c-${entry.id ?? 'new'}-${entry.n}`} cost={cost} copyOf={copyOfCost}
          onClose={() => setEntry(null)} onDuplicate={(c) => copy('cost', c.id)} />
      )}
      <Tour open={tour && !entry} onClose={() => setTour(false)} />
      <ToastStack toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  )
}

export default function App(props: Omit<ProviderProps, 'children'>) {
  return (
    <InflowProvider {...props}>
      <Shell />
    </InflowProvider>
  )
}
