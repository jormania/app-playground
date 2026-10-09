import { useEffect, useRef } from 'react'
import { BookOpen, Settings2 } from 'lucide-react'
import { ServicesProvider, useServices } from './app/services'
import { href, useRoute, type Route } from './app/router'
import { GUIDE_URL } from './app/links'
import { useNewVersion } from './app/freshness'
import { LandedPrompt } from './components/LandedPrompt'
import { WeekScreen } from './screens/Week'
import { ProgrammeScreen } from './screens/Programme'
import { ListenModeScreen } from './screens/ListenMode'
import { JournalScreen } from './screens/Journal'
import { LibraryScreen } from './screens/Library'
import { ThreadsScreen } from './screens/Threads'
import { NotebookScreen } from './screens/Notebook'
import { SettingsScreen } from './screens/Settings'
import type { Repo } from './store/repo'
import type { CuratorClient } from './curation/api'
import s from './styles/editorial.module.css'

const NAV: { route: Route; label: string }[] = [
  { route: { name: 'week' }, label: 'This week' },
  { route: { name: 'journal' }, label: 'Journal' },
  { route: { name: 'library' }, label: 'Library' },
  { route: { name: 'threads' }, label: 'Threads' },
  { route: { name: 'notebook' }, label: 'Notebook' },
]

function Shell() {
  const route = useRoute()
  const { week, settings } = useServices()
  const active = route.name === 'programme' || route.name === 'listen' ? 'week' : route.name
  const navRef = useRef<HTMLElement>(null)
  const newer = useNewVersion()
  // The nav slides rather than wraps; keep the current section's tab in view.
  useEffect(() => {
    // Only sideways: scrollIntoView would also move the page.
    const nav = navRef.current
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !tab) return
    const left = tab.offsetLeft - nav.offsetLeft
    if (left < nav.scrollLeft) nav.scrollLeft = left
    else if (left + tab.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = left + tab.offsetWidth - nav.clientWidth
  }, [active])
  return (
    <div className={s.page}>
      <header className={s.masthead}>
        <div className={s.brandRow}>
          <span className={s.brandStack}>
            <a className={s.brand} href="#/">The Long Listen</a>
            <span className={s.weekLine}>Week {week.number} · {week.label}</span>
          </span>
          <span className={s.mastRight}>
            <a className={s.iconLink} href={GUIDE_URL} target="_blank" rel="noopener noreferrer" aria-label="User’s guide" title="User’s guide"><BookOpen size={18} strokeWidth={1.6} /></a>
            <a className={`${s.iconLink} ${route.name === 'settings' ? s.iconOn : ''}`} href={href({ name: 'settings' })} aria-label="Settings" title="Settings"><Settings2 size={18} strokeWidth={1.6} /></a>
          </span>
        </div>
        {/* The listening view is one quiet screen: the sections step back, and
            its own link leads back to the programme. */}
        {route.name !== 'listen' && <nav ref={navRef} className={s.nav} aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.label} href={href(n.route)} className={`${s.navLink} ${active === n.route.name ? s.navActive : ''}`} aria-current={active === n.route.name ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>}
        {newer && (
          <p className={s.updateBar} role="status">
            A newer version of the app is ready. <button className={s.textButton} onClick={() => window.location.reload()}>Reload</button>
          </p>
        )}
        {settings.demo && <p className={s.demo}>Demo curator — canned programmes, for development only</p>}
      </header>
      {route.name !== 'listen' && route.name !== 'settings' && <LandedPrompt />}
      <main className={s.main} key={route.name === 'programme' ? route.id : route.name === 'listen' ? route.itemId : route.name}>
        {route.name === 'week' && <WeekScreen />}
        {route.name === 'programme' && <ProgrammeScreen id={route.id} />}
        {route.name === 'listen' && <ListenModeScreen programmeId={route.programmeId} itemId={route.itemId} />}
        {route.name === 'journal' && <JournalScreen />}
        {route.name === 'library' && <LibraryScreen />}
        {route.name === 'threads' && <ThreadsScreen />}
        {route.name === 'notebook' && <NotebookScreen />}
        {route.name === 'settings' && <SettingsScreen />}
      </main>
    </div>
  )
}

export default function App({ repo, curator }: { repo?: Repo; curator?: CuratorClient }) {
  return (
    <ServicesProvider repo={repo} curator={curator}>
      <Shell />
    </ServicesProvider>
  )
}
