import { Button } from '../ds'
import { useRoute, type Route } from './app/router'
import { StateProvider, useStillflow } from './app/state'
import { Shell } from './components/Shell'
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
import styles from './App.module.css'

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

function Welcome() {
  const { preferences, savePreferences, sessions } = useStillflow()
  const demos = sessions.filter((x) => x.isDemo).length
  return (
    <div className={styles.welcome}>
      <div className={styles.welcomeInner}>
        <Wordmark size="lg" />
        <p className={styles.tagline}>Find your practice.</p>
        <p className={styles.sub}>A personal yoga companion. Choose by time, body and mood, then practise in the YouTube app.</p>
        {demos > 0 && (
          <p className={styles.note}>
            To show you around, the library holds {demos} clearly marked demo records. They aren’t real videos: replace them with your own
            sessions from Settings whenever you’re ready.
          </p>
        )}
        <Button onClick={() => savePreferences({ ...preferences, welcomed: true })}>Begin</Button>
      </div>
    </div>
  )
}

function Root() {
  const route = useRoute()
  const { ready, preferences } = useStillflow()
  if (!ready) return <div className={styles.loading} aria-busy="true"><Wordmark /></div>
  if (!preferences.welcomed) return <Welcome />
  return (
    <Shell route={route}>
      <Screen route={route} />
    </Shell>
  )
}

/** `repo` is for tests: the whole app on an in-memory store. */
export default function App({ repo }: { repo?: StillflowRepo }) {
  return (
    <StateProvider repo={repo}>
      <Root />
    </StateProvider>
  )
}
