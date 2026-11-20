import { Button } from '../ds'
import { useRoute, type Route } from './app/router'
import { StateProvider, useStillflow } from './app/state'
import { Shell } from './components/Shell'
import { useTheme } from './app/theme'
import { Wordmark } from './components/ui'
import { CollectionDetail, Collections } from './screens/Collections'
import { Discover } from './screens/Discover'
import { Explore } from './screens/Explore'
import { Practice } from './screens/Practice'
import { SessionDetail } from './screens/SessionDetail'
import { SessionEditor } from './screens/SessionEditor'
import { Settings } from './screens/Settings'
import { Surprise } from './screens/Surprise'
import { SeriesDetail, SeriesList } from './screens/Series'
import type { StillflowRepo } from './store/repo'
import type { Session } from './domain/types'
import styles from './App.module.css'
import screenStyles from './screens/screens.module.css'

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'discover': return <Discover />
    case 'explore': return <Explore />
    case 'session': return <SessionDetail key={route.id} id={route.id} />
    case 'surprise': return <Surprise />
    case 'practice': return <Practice />
    case 'collections': return <Collections />
    case 'collection': return <CollectionDetail key={route.id} id={route.id} />
    case 'series': return <SeriesList />
    case 'seriesDetail': return <SeriesDetail key={route.id} id={route.id} />
    case 'settings': return <Settings />
    case 'editor': return <SessionEditor key={route.id ?? 'new'} id={route.id} />
  }
}

/** One key per screen (and per session, series or collection), so each arrival animates. */
function screenKey(route: Route): string {
  return 'id' in route && route.id ? `${route.name}:${route.id}` : route.name
}

function Welcome() {
  const { preferences, savePreferences, sessions } = useStillflow()
  const demos = sessions.filter((x) => x.isDemo).length
  return (
    <div className={styles.welcome}>
      <div className={styles.welcomeInner}>
        <Wordmark size="lg" />
        <p className={styles.tagline}>Find your practice.</p>
        <p className={styles.sub}>A personal yoga companion. Choose by time, body and mood, then practise in the YouTube app.</p>
        <p className={styles.note}>
          {demos > 0
            ? `The library holds ${demos} clearly marked demo records to show you around. They aren’t real videos.`
            : 'Start in Settings: “Import the whole channel” brings in Adriene’s videos. Her series are ready to follow meanwhile.'}
        </p>
        <Button onClick={() => savePreferences({ ...preferences, welcomed: true })}>Begin</Button>
      </div>
    </div>
  )
}

function Root() {
  const route = useRoute()
  const { ready, preferences } = useStillflow()
  useTheme(preferences.theme)
  if (!ready) return <div className={styles.loading} aria-busy="true"><Wordmark /></div>
  if (!preferences.welcomed) return <Welcome />
  return (
    <Shell route={route}>
      <div key={screenKey(route)} className={screenStyles.screenIn}>
        <Screen route={route} />
      </div>
    </Shell>
  )
}

/** `repo` is for tests: the whole app on an in-memory store. */
export default function App({ repo, seed }: { repo?: StillflowRepo; seed?: Session[] }) {
  return (
    <StateProvider repo={repo} seed={seed}>
      <Root />
    </StateProvider>
  )
}
