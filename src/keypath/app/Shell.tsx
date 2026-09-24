import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext, type KeyPathApp } from './context'
import { translate } from './i18n'
import { EngagementLog } from './log'
import { DEFAULT_PROFILE_SETTINGS, ProfileRepo, type Profile, type ProfileSettings } from './profiles'
import { navigate, useRoute } from './router'
import { indexedDbStore, type KeyValueStore } from './store'
import { useWakeLock } from '../../shared/useWakeLock'
import { WhoIsPlaying } from './screens/WhoIsPlaying'
import { Home } from './screens/Home'
import { DoorScreen } from './screens/DoorScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { DiagnosticsScreen } from './screens/DiagnosticsScreen'
import { SongsHome } from './songs/SongsHome'
import { ImportSong } from './songs/ImportSong'
import { PlayScreen } from './songs/PlayScreen'
import { ConnectWizard } from './connect/ConnectWizard'
import { JourneyHome } from './journey/JourneyHome'
import { StepScreen } from './journey/StepScreen'
import { StudioScreen } from './studio/StudioScreen'
import styles from './app.module.css'

/**
 * The KeyPath app: who's playing, the four doors, settings, diagnostics.
 * Everything is kept on this phone (store.ts).
 */
export function Shell({ store = indexedDbStore }: { store?: KeyValueStore }) {
  const profiles = useMemo(() => new ProfileRepo(store), [store])
  const log = useMemo(() => new EngagementLog(store), [store])
  const route = useRoute()
  const [loaded, setLoaded] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS)
  const sessionStart = useRef<number | null>(null)

  const startSession = useCallback(
    (p: Profile) => {
      sessionStart.current = Date.now()
      void log.add(p.id, { type: 'session_start' })
    },
    [log],
  )
  const endSession = useCallback(
    (p: Profile | null) => {
      if (!p || sessionStart.current === null) return
      void log.add(p.id, { type: 'session_end', durationMs: Date.now() - sessionStart.current })
      sessionStart.current = null
    },
    [log],
  )

  const load = useCallback(async () => {
    const current = await profiles.current()
    setProfile(current)
    setSettings(current ? await profiles.settings(current.id) : DEFAULT_PROFILE_SETTINGS)
    setLoaded(true)
    return current
  }, [profiles])

  // First load: open straight into this phone's player, if there is one.
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void load().then((current) => {
      if (current) startSession(current)
    })
  }, [load, startSession])

  // A session ends when KeyPath leaves the screen, and a new one starts on return.
  useEffect(() => {
    const onVisibility = () => {
      if (!profile) return
      if (document.visibilityState === 'hidden') endSession(profile)
      else if (sessionStart.current === null) startSession(profile)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [profile, startSession, endSession])

  // Hands are on the keys, not the phone: the screen stays on while KeyPath is
  // open. Chrome drops the lock when the page is hidden; the hook takes it back.
  useWakeLock(true)

  // Language drives the page's own lang attribute too (screen readers, hyphenation).
  useEffect(() => {
    document.documentElement.lang = settings.language
  }, [settings.language])

  const app: KeyPathApp = {
    store,
    profiles,
    log,
    profile,
    settings,
    t: (key, vars) => translate(settings.language, key, vars),
    updateSetting: async (key, value) => {
      if (!profile) return
      const next = { ...settings, [key]: value }
      const from = settings[key]
      setSettings(next)
      await profiles.saveSettings(profile.id, next)
      await log.add(profile.id, { type: 'setting_changed', key, from, to: value })
    },
    choose: async (p) => {
      endSession(profile)
      await profiles.setCurrent(p?.id ?? null)
      setProfile(p)
      setSettings(p ? await profiles.settings(p.id) : DEFAULT_PROFILE_SETTINGS)
      if (p) startSession(p)
    },
    reload: async () => {
      await load()
    },
  }

  if (!loaded) return null

  // Without a player, every screen but Diagnostics leads to "Who's playing?".
  const effective = !profile && route.name !== 'diagnostics' ? 'who' : route.name === 'start' ? 'home' : route.name
  return (
    <AppContext.Provider value={app}>
      <div className={styles.app}>
        {effective === 'who' && <WhoIsPlaying onChosen={() => navigate({ name: 'home' }, { replace: true })} />}
        {effective === 'home' && <Home />}
        {effective === 'door' && route.name === 'door' && (route.door === 'songs' ? <SongsHome /> : route.door === 'journey' ? <JourneyHome /> : route.door === 'studio' ? <StudioScreen /> : <DoorScreen door={route.door} />)}
        {effective === 'songImport' && <ImportSong />}
        {effective === 'play' && route.name === 'play' && <PlayScreen songId={route.songId} />}
        {effective === 'settings' && <SettingsScreen />}
        {effective === 'diagnostics' && <DiagnosticsScreen />}
        {effective === 'connect' && <ConnectWizard />}
        {effective === 'studio' && route.name === 'studio' && <StudioScreen key={route.songId} songId={route.songId} />}
        {effective === 'journeyStep' && route.name === 'journeyStep' && <StepScreen stepId={route.step} />}
      </div>
    </AppContext.Provider>
  )
}
