import { ServicesProvider, useServices } from './app/services'
import { href, useRoute, type Route } from './app/router'
import { WeekScreen } from './screens/Week'
import { ProgrammeScreen } from './screens/Programme'
import { ThreadsScreen } from './screens/Threads'
import { ListeningScreen } from './screens/Listening'
import { NotebookScreen } from './screens/Notebook'
import { SettingsScreen } from './screens/Settings'
import type { Repo } from './store/repo'
import type { CuratorClient } from './curation/api'
import s from './styles/editorial.module.css'

const NAV: { route: Route; label: string }[] = [
  { route: { name: 'week' }, label: 'This week' },
  { route: { name: 'threads' }, label: 'Threads' },
  { route: { name: 'listening' }, label: 'Listening' },
  { route: { name: 'notebook' }, label: 'Notebook' },
  { route: { name: 'settings' }, label: 'Settings' },
]

function Shell() {
  const route = useRoute()
  const { week, settings } = useServices()
  const active = route.name === 'programme' ? 'week' : route.name
  return (
    <div className={s.page}>
      <header className={s.masthead}>
        <div className={s.brandRow}>
          <a className={s.brand} href="#/">The Long Listen</a>
          <span className={s.weekLine}>Week {week.number} · {week.label}</span>
        </div>
        <nav className={s.nav} aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.label} href={href(n.route)} className={`${s.navLink} ${active === n.route.name ? s.navActive : ''}`} aria-current={active === n.route.name ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        {settings.demo && <p className={s.demo}>Demo curator — canned programmes, for development only</p>}
      </header>
      <main className={s.main} key={route.name === 'programme' ? route.id : route.name}>
        {route.name === 'week' && <WeekScreen />}
        {route.name === 'programme' && <ProgrammeScreen id={route.id} />}
        {route.name === 'threads' && <ThreadsScreen />}
        {route.name === 'listening' && <ListeningScreen />}
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
