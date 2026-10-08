import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToastStack, ToastStack } from '../../ds'
import { Repo, indexedDbStore } from '../store/repo'
import { Journey } from '../curation/journey'
import { httpCurator, CuratorUnavailable, type CuratorClient, type StatusResponse } from '../curation/api'
import { SpotifyClient } from '../spotify/client'
import { completeSignIn, isCallback, SpotifyAuthError } from '../spotify/auth'
import { syncRecentPlays } from '../spotify/verify'
import { syncToNotion } from '../notion/mirror'
import { demoCurator } from '../dev/demoCurator'
import { loadSettings, saveSettings, type Settings } from './settings'
import { applyTheme } from './theme'
import { useSystemThemeFollow } from '../../shared/theme'
import type { ListeningWeek } from '../domain/week'

export interface Services {
  repo: Repo
  journey: Journey
  curator: CuratorClient
  spotify: SpotifyClient
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  /** Bumped whenever stored data changes, so views reload. */
  version: number
  bump: () => void
  status: StatusResponse | null
  refreshStatus: () => Promise<void>
  notionState: { syncing: boolean; error?: string; lastSync?: string }
  syncNotion: () => Promise<void>
  syncSpotify: () => Promise<number>
  say: (message: string, tone?: 'neutral' | 'success' | 'danger') => void
  week: ListeningWeek
}

const Ctx = createContext<Services | null>(null)

export function useServices(): Services {
  const s = useContext(Ctx)
  if (!s) throw new Error('useServices outside ServicesProvider')
  return s
}

let sharedRepo: Repo | null = null
function repoSingleton(): Repo {
  if (!sharedRepo) sharedRepo = new Repo(indexedDbStore())
  return sharedRepo
}

// One Spotify session per page, like the repo. It reads the Client ID fresh
// from settings whenever it needs to refresh a token.
let sharedSpotify: SpotifyClient | null = null
function spotifySingleton(): SpotifyClient {
  if (!sharedSpotify) sharedSpotify = new SpotifyClient(() => loadSettings().spotifyClientId)
  return sharedSpotify
}

export function ServicesProvider({ children, repo: injectedRepo, curator: injectedCurator }: { children: ReactNode; repo?: Repo; curator?: CuratorClient }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [version, setVersion] = useState(0)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [notionState, setNotionState] = useState<Services['notionState']>({ syncing: false })
  const { toasts, push, dismiss } = useToastStack()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const repo = useMemo(() => injectedRepo ?? repoSingleton(), [injectedRepo])
  const curator = useMemo<CuratorClient>(
    () => injectedCurator ?? (settings.demo ? demoCurator() : httpCurator(() => settingsRef.current.passphrase)),
    [injectedCurator, settings.demo],
  )
  const journey = useMemo(() => new Journey(repo, curator, { timeZone: settings.timeZone }), [repo, curator, settings.timeZone])
  const spotify = spotifySingleton()
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const say = useCallback((message: string, tone: 'neutral' | 'success' | 'danger' = 'neutral') => { push({ message, tone }) }, [push])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  useEffect(() => applyTheme(settings.theme), [settings.theme])
  useSystemThemeFollow(settings.theme === 'system', () => applyTheme('system'))

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await curator.call<StatusResponse>('status', {}))
    } catch {
      setStatus(null)
    }
  }, [curator])

  const syncNotion = useCallback(async () => {
    const pageId = status?.notionPageId
    if (!status?.notion || !pageId) return
    setNotionState((s) => ({ ...s, syncing: true, error: undefined }))
    try {
      await syncToNotion(curator, repo, pageId, journey.currentWeek().key)
      setNotionState({ syncing: false, lastSync: new Date().toISOString() })
    } catch (e) {
      setNotionState({ syncing: false, error: e instanceof CuratorUnavailable ? e.message : 'Notion couldn’t be updated just now.' })
    }
  }, [status, curator, repo, journey])

  const syncSpotify = useCallback(
    () => syncRecentPlays(repo, spotify).then((n) => { if (n) bump(); return n }),
    [spotify, repo, bump],
  )

  // Once per load: finish a Spotify sign-in, learn what the server offers,
  // pick up recent Spotify listening. None of these may block reading.
  useEffect(() => {
    if (isCallback(window.location.search)) {
      const search = window.location.search
      history.replaceState(null, '', `${window.location.pathname}#/settings`)
      completeSignIn(search)
        .then((t) => { spotify.setTokens(t); say('Spotify is connected.', 'success'); bump() })
        .catch((e) => say(e instanceof SpotifyAuthError ? e.message : 'Spotify sign-in didn’t complete.', 'danger'))
    }
  }, [spotify, say, bump])

  useEffect(() => { void refreshStatus() }, [refreshStatus, settings.passphrase])
  useEffect(() => { syncSpotify().catch(() => {}) }, [syncSpotify])

  const notionOnce = useRef(false)
  useEffect(() => {
    if (status?.notion && !notionOnce.current) {
      notionOnce.current = true
      void syncNotion()
    }
  }, [status, syncNotion])

  const value: Services = {
    repo, journey, curator, spotify, settings, updateSettings, version, bump, status, refreshStatus,
    notionState, syncNotion, syncSpotify, say, week: journey.currentWeek(),
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  )
}

/** Load something from the store, again whenever data changes. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: unknown; loading: boolean } {
  const { version } = useServices()
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({ data: undefined, error: undefined, loading: true })
  useEffect(() => {
    let live = true
    setState((s) => ({ ...s, loading: true }))
    load().then(
      (data) => { if (live) setState({ data, error: undefined, loading: false }) },
      (error) => { if (live) setState({ data: undefined, error, loading: false }) },
    )
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])
  return state
}
