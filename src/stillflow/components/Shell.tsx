import { useEffect, useState, type ReactNode } from 'react'
import { Compass, LayoutGrid, Sparkles, NotebookPen, Library, Settings, CalendarRange } from 'lucide-react'
import { hrefOf, tabOf, type Route, type Tab } from '../app/router'
import { useStillflow } from '../app/state'
import { cx } from '../../ds/lib/cx'
import { CompleteSheet } from './Sheets'
import { localDate } from '../lib/practice'
import { toggleDay } from '../lib/series'
import { Wordmark } from './ui'
import styles from './Shell.module.css'

const TABS: { tab: Tab; label: string; icon: typeof Compass }[] = [
  { tab: 'discover', label: 'Discover', icon: Compass },
  { tab: 'explore', label: 'Explore', icon: LayoutGrid },
  { tab: 'surprise', label: 'Surprise Me', icon: Sparkles },
  { tab: 'series', label: 'Series', icon: CalendarRange },
  { tab: 'practice', label: 'My Practice', icon: NotebookPen },
  { tab: 'collections', label: 'Collections', icon: Library },
]

const SHORT: Partial<Record<Tab, string>> = { practice: 'Practice', surprise: 'Surprise', collections: 'Lists' }

/** Minimum time away before "Back from…?" is offered; a quick bounce isn't a practice. */
const RETURN_AFTER_MS = 60_000

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])
  return online
}

function ReturnBanner() {
  const { pending, byId, clearPending, seriesDefs, seriesProgress, saveProgress, toast } = useStillflow()
  const [now, setNow] = useState(() => Date.now())
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    const id = window.setInterval(tick, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
      window.clearInterval(id)
    }
  }, [])

  const session = pending?.sessionId ? byId.get(pending.sessionId) : undefined
  const def = pending?.seriesId ? seriesDefs.find((d) => d.id === pending.seriesId) : undefined
  const progress = def ? seriesProgress[def.id] : undefined
  const orphaned = !!pending && !session && !def

  // A launch whose session (or series) has since gone can never be answered.
  useEffect(() => { if (orphaned) clearPending() }, [orphaned, clearPending])

  if (!pending || orphaned) return null
  if (now - pending.at < RETURN_AFTER_MS && !completing) return null

  const dayLabel = def && pending.day ? `${def.name} ${def.unit} ${pending.day}` : null
  const what = dayLabel && session ? `${dayLabel}: ${session.title}` : dayLabel ?? session?.title ?? ''

  const confirm = () => {
    if (session) { setCompleting(true); return }
    // A series day with no session in the catalogue: tick the day itself.
    if (def && pending.day && progress?.status === 'active') {
      saveProgress(toggleDay(progress, pending.day, localDate(), true))
      toast(`${dayLabel} done`, 'success')
    }
    clearPending()
  }

  return (
    <>
      <div className={styles.banner} role="status">
        <div>
          <span className={styles.bannerKicker}>Welcome back</span>
          <p>Did you finish <strong>{what}</strong>?</p>
        </div>
        <div className={styles.bannerActions}>
          <button type="button" className={styles.bannerPrimary} onClick={confirm}>Yes, mark it done</button>
          <button type="button" className={styles.bannerSecondary} onClick={clearPending}>Not this time</button>
        </div>
      </div>
      {completing && session && (
        <CompleteSheet open session={session} onClose={() => { setCompleting(false); clearPending() }} />
      )}
    </>
  )
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const active = tabOf(route)
  const online = useOnline()
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <a href="#/" className={styles.brand}><Wordmark /></a>
        <p className={styles.tagline}>Find your practice.</p>
        <nav aria-label="Main">
          {TABS.map(({ tab, label, icon: Icon }) => (
            <a key={tab} href={hrefOf({ name: tab })} className={cx(styles.side, active === tab && styles.on)}
              aria-current={active === tab ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.6} /> {label}
            </a>
          ))}
          <a href="#/settings" className={cx(styles.side, route.name === 'settings' || route.name === 'editor' ? styles.on : undefined)}>
            <Settings size={18} strokeWidth={1.6} /> Settings
          </a>
        </nav>
      </aside>

      <header className={styles.top}>
        <a href="#/" className={styles.brand}><Wordmark size="sm" /></a>
        <a href="#/settings" className={styles.gear} aria-label="Settings"><Settings size={20} strokeWidth={1.6} /></a>
      </header>

      <main className={styles.main}>
        {!online && <p className={styles.offline}>You’re offline. Your library and history are here; videos need a connection.</p>}
        <ReturnBanner />
        {children}
      </main>

      <nav className={styles.bottom} aria-label="Main">
        {TABS.map(({ tab, label, icon: Icon }) => (
          <a key={tab} href={hrefOf({ name: tab })} className={cx(styles.tab, active === tab && styles.on, tab === 'surprise' && styles.surpriseTab)}
            aria-current={active === tab ? 'page' : undefined}>
            <Icon size={21} strokeWidth={1.6} />
            <span>{SHORT[tab] ?? label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
