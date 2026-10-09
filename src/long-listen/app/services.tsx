import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToastStack, ToastStack } from '../../ds'
import { Repo, indexedDbStore } from '../store/repo'
import { Journey } from '../curation/journey'
import { CuratorUnavailable, type CuratorClient, type PingResponse } from '../curation/api'
import { directCurator, promptVersions } from '../curator/curator'
import { SpotifyClient } from '../spotify/client'
import { completeSignIn, isCallback, SpotifyAuthError } from '../spotify/auth'
import { syncRecentPlays } from '../spotify/verify'
import { checkNotebook, relayCaller, syncToNotion, type NotebookCheck, type NotionCall } from '../notion/mirror'
import { parseNotionId } from '../../shared/notionId'
import { demoCurator } from '../dev/demoCurator'
import { loadSettings, saveSettings, type Settings } from './settings'
import { recordUsage } from './usage'
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
  /** The versions of the curator's prompts, for Settings → About. */
  prompts: Record<string, string>
  /** Can the curator be asked anything right now? (A key, or the demo.) */
  curatorReady: boolean
  /** Where the Notion notebook is written, if anywhere. */
  notion: { call: NotionCall; pageId: string } | null
  testCurator: () => Promise<PingResponse>
  testNotion: () => Promise<NotebookCheck>
  testSpotify: () => Promise<{ name: string; devices: { name: string; type: string; active: boolean }[] }>
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
  const [notionState, setNotionState] = useState<Services['notionState']>({ syncing: false })
  const { toasts, push, dismiss } = useToastStack()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const repo = useMemo(() => injectedRepo ?? repoSingleton(), [injectedRepo])
  const curator = useMemo<CuratorClient>(
    () => injectedCurator ?? (settings.demo ? demoCurator() : directCurator(() => settingsRef.current.anthropicKey, { onUsage: (_op, model, usage) => recordUsage(model, usage) })),
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
  useEffect(() => { document.documentElement.dataset.textSize = settings.textSize }, [settings.textSize])
  useSystemThemeFollow(settings.theme === 'system', () => applyTheme('system'))

  // The listener's own Notion token, through the shared /api/notion relay.
  const ownPage = parseNotionId(settings.notionPage)
  const notion = useMemo<Services['notion']>(() => {
    if (settings.notionToken.trim() && ownPage) return { call: relayCaller(settings.notionToken.trim()), pageId: ownPage }
    return null
  }, [settings.notionToken, ownPage])

  const curatorReady = settings.demo || Boolean(settings.anthropicKey.trim())

  const testCurator = useCallback(() => curator.call<PingResponse>('ping', {}), [curator])
  const testNotion = useCallback(async (): Promise<NotebookCheck> => {
    if (!notion) return { ok: false, message: 'Add your Notion token and the link to your notebook page first.', found: [], missing: [], tastePage: false, missingColumns: [] }
    return checkNotebook(notion.call, notion.pageId)
  }, [notion])
  const testSpotify = useCallback(async () => {
    const me = await spotify.me()
    return { name: me.name, devices: await spotify.devices().catch(() => []) }
  }, [spotify])

  const syncNotion = useCallback(async () => {
    if (!notion) return
    setNotionState((s) => ({ ...s, syncing: true, error: undefined }))
    try {
      await syncToNotion(notion.call, repo, notion.pageId, journey.currentWeek().key)
      setNotionState({ syncing: false, lastSync: new Date().toISOString() })
    } catch (e) {
      setNotionState({ syncing: false, error: e instanceof CuratorUnavailable ? e.message : 'Notion couldn’t be updated just now.' })
    }
  }, [notion, repo, journey])

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

  // Recent Spotify listening: on load, and again whenever the app comes back to
  // the foreground — an installed app resumed from the background never reloads,
  // and Spotify only keeps the last fifty plays. At most once every two minutes.
  useEffect(() => {
    let last = 0
    const look = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 120_000) return
      last = Date.now()
      syncSpotify().catch(() => {})
    }
    look()
    document.addEventListener('visibilitychange', look)
    return () => document.removeEventListener('visibilitychange', look)
  }, [syncSpotify])

  // Feedback left unread when the app last closed (taste is read in batches, see
  // Journey.scheduleTasteReading) is read once now, in one request.
  useEffect(() => {
    if (!curatorReady) return
    journey.interpretPendingFeedback().then((n) => { if (n) bump() }).catch(() => {})
  }, [journey, curatorReady, bump])

  // Spotify ends sign-ins after six months; say so once, plainly, and let views re-read.
  useEffect(() => spotify.onSignedOut((message) => { say(message, 'danger'); bump() }), [spotify, say, bump])

  const notionOnce = useRef(false)
  useEffect(() => {
    if (notion && !notionOnce.current) {
      notionOnce.current = true
      void syncNotion()
    }
  }, [notion, syncNotion])

  const value: Services = {
    repo, journey, curator, spotify, settings, updateSettings, version, bump, prompts: promptVersions(),
    curatorReady, notion, testCurator, testNotion, testSpotify,
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
