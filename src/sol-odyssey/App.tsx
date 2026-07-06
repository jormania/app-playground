import { SettingsPage } from './pages/Settings'
import { CharterPage } from './pages/Charter'
import { LandingPage } from './pages/Landing'
import { OverviewPage } from './pages/Overview'
import { TodayPage } from './pages/Today'
import { TrackerPage } from './pages/Tracker'
import { WeeklyPage } from './pages/Weekly'
import { HarvestPage } from './pages/Harvest'
import { StatsPage } from './pages/Stats'
import { useHashRoute } from './lib/useHashRoute'
import { useSettings } from './lib/settingsContext'
import { GuidanceProvider } from './lib/guidanceContext'
import { useActiveOdysseys } from './lib/useActiveOdysseys'
import { useNextOdysseyNumber } from './lib/useNextOdysseyNumber'
import { useHasCompleted } from './lib/useOdysseyArchive'
import { useReminderSync } from './lib/useReminderSync'
import { useSyncStatus } from './lib/syncContext'
import { useTheme } from './lib/themeContext'
import { isConfigured } from './lib/settings'
import { cn } from './lib/cn'
import {
  CloudOff,
  RefreshCw,
  ScrollText as CharterIcon,
  Sun as TodayIcon,
  LayoutGrid as TrackerIcon,
  NotebookPen as WeeklyIcon,
  LineChart as StatsIcon,
  BookOpen as GuideIcon,
  Settings as SettingsIcon,
  Moon as DarkIcon,
  SunMedium as LightIcon,
  type LucideIcon,
} from 'lucide-react'

export default function App() {
  const { settings } = useSettings()
  const { route, navigate } = useHashRoute()
  const active = useActiveOdysseys()
  const completed = useHasCompleted()
  // Keep the reminders snapshot fresh on every route (not just Today/Weekly) so enabling reminders
  // from Settings — and the start/harvest readiness — is mirrored to the worker right away.
  useReminderSync()
  // Context-aware nav: the daily loop tabs only matter once an Odyssey is under way; Stats + Export
  // only once an Odyssey has been completed (harvested). No active Odyssey → the bar focuses on
  // Charter (+ utilities).
  const hasActive = (active.data?.length ?? 0) > 0
  const hasCompleted = completed.data ?? false

  return (
    <GuidanceProvider show={settings.showGuidance}>
      <div className="min-h-screen bg-background-primary">
        <header className="sticky top-0 z-20 border-b border-tertiary bg-background-primary/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4 sm:gap-3 sm:px-5">
            <button
              className="flex items-center gap-3"
              onClick={() => navigate('/')}
              aria-label="Sol Odyssey home"
            >
              <img src="/sol-odyssey-logo.svg" alt="" width={36} height={36} aria-hidden />
              {/* Wordmark drops on narrow phones so the nav fits; returns on ≥sm. */}
              <span className="hidden flex-col items-start sm:flex">
                <span className="font-display text-lg leading-none">Sol Odyssey</span>
                <span className="font-mono text-xs text-text-secondary">
                  one behaviour · 42 days · witnessed
                </span>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <SyncPill />
              <nav className="flex items-center gap-0.5 sm:gap-1">
                <NavLink current={route} to="/overview" label="Charter" onClick={navigate} icon={CharterIcon} />
                {hasActive && (
                  <>
                    <NavLink current={route} to="/" label="Today" onClick={navigate} icon={TodayIcon} />
                    <NavLink current={route} to="/tracker" label="Tracker" onClick={navigate} icon={TrackerIcon} />
                    <NavLink current={route} to="/weekly" label="Weekly" onClick={navigate} icon={WeeklyIcon} />
                  </>
                )}
                {hasCompleted && (
                  <NavLink current={route} to="/stats" label="Stats" onClick={navigate} icon={StatsIcon} iconOnly />
                )}
                <a
                  href="/sol-odyssey-guide.html"
                  target="_blank"
                  rel="noopener"
                  aria-label="Field guide"
                  title="Field guide"
                  className="rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-background-secondary"
                >
                  <GuideIcon size={18} aria-hidden />
                </a>
                <ThemeToggle />
                <NavLink current={route} to="/settings" label="Settings" onClick={navigate} icon={SettingsIcon} iconOnly />
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-8">
          <Route route={route} navigate={navigate} configured={isConfigured(settings)} showLanding={settings.showLanding} />
        </main>
      </div>
    </GuidanceProvider>
  )
}

function Route({
  route,
  navigate,
  configured,
  showLanding,
}: {
  route: string
  navigate: (to: string) => void
  configured: boolean
  showLanding: boolean
}) {
  if (route === '/settings') return <SettingsPage navigate={navigate} />
  if (route === '/charter') return <CharterPage navigate={navigate} />
  if (route === '/tracker') return <TrackerPage navigate={navigate} />
  if (route === '/weekly') return <WeeklyPage navigate={navigate} />
  if (route === '/harvest') return <HarvestPage navigate={navigate} />
  if (route === '/stats') return <StatsPage navigate={navigate} />
  if (route === '/overview') return <OverviewPage navigate={navigate} />
  return <Home navigate={navigate} configured={configured} showLanding={showLanding} />
}

function Home({
  navigate,
  configured,
  showLanding,
}: {
  navigate: (to: string) => void
  configured: boolean
  showLanding: boolean
}) {
  const active = useActiveOdysseys()
  const history = useNextOdysseyNumber()
  const hasActive = (active.data?.length ?? 0) > 0
  const hasPrior = history.data?.hasPrior ?? false
  // The Landing intro is for genuine first-timers only: connected, opted-in, nothing active, and
  // no Odyssey ever run. Once there's history, the home is Today (which shows a "begin your next
  // Odyssey" prompt). Today also handles the not-connected and active cases.
  if (configured && showLanding && !hasActive && !hasPrior && !active.isPending && !history.isPending) {
    return <LandingPage navigate={navigate} />
  }
  return <TodayPage navigate={navigate} />
}

function ThemeToggle() {
  const { mode, cycle, current } = useTheme()
  const dark = mode === 'dark'
  // The cycle steps through all eight presets in order; each press flips light↔dark, so the
  // "switch to the opposite mode" glyph stays truthful. The title names the CURRENT palette.
  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${current.name}. Tap to cycle to the next palette.`}
      title={`${current.name} — tap to cycle`}
      className="rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-background-secondary"
    >
      {dark ? <LightIcon size={18} aria-hidden /> : <DarkIcon size={18} aria-hidden />}
    </button>
  )
}

function SyncPill() {
  const { online, pending } = useSyncStatus()
  if (online && pending === 0) return null
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-mono text-xs',
        !online
          ? 'border-caution/40 bg-background-secondary text-caution'
          : 'border-accent/30 bg-accent-soft text-accent',
      )}
      title={!online ? 'Offline — changes are saved on this device and will sync' : `${pending} change(s) waiting to sync`}
    >
      {!online ? <CloudOff size={13} aria-hidden /> : <RefreshCw size={13} aria-hidden />}
      {/* Label hides on phones to save room; the icon + tooltip carry the meaning. */}
      <span className="hidden sm:inline">{!online ? 'Offline' : `${pending} to sync`}</span>
    </span>
  )
}

function NavLink({
  current,
  to,
  label,
  onClick,
  icon: Icon,
  iconOnly = false,
}: {
  current: string
  to: string
  label: string
  onClick: (to: string) => void
  icon: LucideIcon
  /** Utility tabs (Stats/Settings) stay icon-only at every width; content tabs show the icon on
   *  phones and the text label on ≥sm. */
  iconOnly?: boolean
}) {
  const activeRoute = current === to
  return (
    <button
      onClick={() => onClick(to)}
      aria-current={activeRoute ? 'page' : undefined}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-md font-sans text-sm transition-colors duration-fast',
        iconOnly ? 'p-2' : 'p-2 sm:px-3 sm:py-1.5',
        activeRoute ? 'bg-accent-soft text-accent' : 'text-text-secondary hover:bg-background-secondary',
      )}
    >
      {iconOnly ? (
        <Icon size={18} aria-hidden />
      ) : (
        <>
          <Icon size={18} aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{label}</span>
        </>
      )}
    </button>
  )
}
