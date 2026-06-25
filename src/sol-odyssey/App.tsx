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
import { useSyncStatus } from './lib/syncContext'
import { isConfigured } from './lib/settings'
import { cn } from './lib/cn'
import { CloudOff, RefreshCw, LineChart as StatsIcon, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'

export default function App() {
  const { settings } = useSettings()
  const { route, navigate } = useHashRoute()
  const active = useActiveOdysseys()
  const history = useNextOdysseyNumber()
  // Context-aware nav: the daily loop tabs only matter once an Odyssey is under way; Stats only
  // once there's history. No active Odyssey → the bar focuses on Charter (+ utilities).
  const hasActive = (active.data?.length ?? 0) > 0
  const hasPrior = history.data?.hasPrior ?? false

  return (
    <GuidanceProvider show={settings.showGuidance}>
      <div className="min-h-screen bg-background-primary">
        <header className="sticky top-0 z-20 border-b border-tertiary bg-background-primary/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
            <button
              className="flex items-center gap-3"
              onClick={() => navigate('/')}
              aria-label="Sol Odyssey home"
            >
              <img src="/sol-odyssey-logo.svg" alt="" width={36} height={36} aria-hidden />
              <span className="flex flex-col items-start">
                <span className="font-display text-lg leading-none">Sol Odyssey</span>
                <span className="font-mono text-xs text-text-secondary">
                  one behaviour · 42 days · witnessed
                </span>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <SyncPill />
              <nav className="flex items-center gap-1">
                <NavLink current={route} to="/overview" label="Charter" onClick={navigate} />
                {hasActive && (
                  <>
                    <NavLink current={route} to="/" label="Today" onClick={navigate} />
                    <NavLink current={route} to="/tracker" label="Tracker" onClick={navigate} />
                    <NavLink current={route} to="/weekly" label="Weekly" onClick={navigate} />
                  </>
                )}
                {hasPrior && (
                  <NavLink current={route} to="/stats" label="Stats" onClick={navigate} icon={StatsIcon} />
                )}
                <NavLink current={route} to="/settings" label="Settings" onClick={navigate} icon={SettingsIcon} />
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
      {!online ? 'Offline' : `${pending} to sync`}
    </span>
  )
}

function NavLink({
  current,
  to,
  label,
  onClick,
  icon: Icon,
}: {
  current: string
  to: string
  label: string
  onClick: (to: string) => void
  icon?: LucideIcon
}) {
  const activeRoute = current === to
  return (
    <button
      onClick={() => onClick(to)}
      aria-current={activeRoute ? 'page' : undefined}
      aria-label={Icon ? label : undefined}
      title={Icon ? label : undefined}
      className={cn(
        'rounded-md font-sans text-sm transition-colors duration-fast',
        Icon ? 'p-2' : 'px-3 py-1.5',
        activeRoute ? 'bg-accent-soft text-accent' : 'text-text-secondary hover:bg-background-secondary',
      )}
    >
      {Icon ? <Icon size={18} aria-hidden /> : label}
    </button>
  )
}
