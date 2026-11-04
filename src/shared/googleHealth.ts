/**
 * The browser half of Google Health: one key, one endpoint, a few typed calls.
 *
 * The key is GOOGLE_HEALTH_APP_KEY, entered once on /google-health.html. Every app
 * lives on the same origin, so they all read it from the same localStorage entry —
 * connect once, and Yoru and Touch Grass both see it. Without a key every call
 * here resolves to "not set up" rather than throwing at the caller, because each
 * app treats Google Health as optional.
 *
 * Server side: api/google-health.js. Setup and reasoning: GOOGLE_HEALTH.md.
 */
import { readJson, writeJson, removeJson } from './storage'

export const HEALTH_KEY_STORAGE = 'google-health:key'
export const HEALTH_ENDPOINT = '/api/google-health'
export const HEALTH_PAGE = '/google-health.html'

export interface HealthNight {
  /** The morning it ended, YYYY-MM-DD. */
  date: string | null
  start: string | null
  end: string | null
  /** When sleep actually began (first real sleep stage). */
  onset: string | null
  mainSleep: boolean
  nap: boolean
  processed: boolean
  minutesAsleep: number | null
  minutesAwake: number | null
  minutesInBed: number | null
  minutesToFallAsleep: number | null
  deep: number | null
  light: number | null
  rem: number | null
  awake: number | null
  wakeCount: number | null
}

export interface HealthWindow {
  start: string
  end: string
  steps: number | null
  distanceKm: number | null
  floors: number | null
  heart: { avg: number; max: number | null; min: number | null } | null
}

export interface HealthStatus {
  configured: boolean
  connected: boolean
  connectedAt: string | null
  lostAt: string | null
}

export class HealthClientError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function getHealthKey(): string {
  const k = readJson<string>(HEALTH_KEY_STORAGE, '')
  return typeof k === 'string' ? k : ''
}

export function setHealthKey(key: string): void {
  const k = key.trim()
  if (k) writeJson(HEALTH_KEY_STORAGE, k)
  else removeJson(HEALTH_KEY_STORAGE)
}

export function hasHealthKey(): boolean {
  return getHealthKey().length > 0
}

type Params = Record<string, string>

async function call<T>(mode: string, params: Params = {}, { timeoutMs = 8000, method = 'GET' }: { timeoutMs?: number; method?: string } = {}): Promise<T> {
  const key = getHealthKey()
  if (!key) throw new HealthClientError('Google Health is not set up on this device.', 0, 'no_key')
  const ctrl = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const qs = new URLSearchParams({ mode, ...params })
    const res = await fetch(`${HEALTH_ENDPOINT}?${qs}`, {
      method,
      headers: { 'x-health-key': key },
      signal: ctrl ? ctrl.signal : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new HealthClientError(data.message || `Google Health ${res.status}`, res.status, data.code || 'error')
    return data as T
  } catch (err) {
    if (err instanceof HealthClientError) throw err
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new HealthClientError(aborted ? 'Google Health took too long to answer.' : 'Could not reach Google Health.', 0, aborted ? 'timeout' : 'network')
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function fetchHealthStatus(): Promise<HealthStatus> {
  return call<HealthStatus>('status')
}

export function disconnectHealth(): Promise<{ connected: boolean }> {
  return call('disconnect', {}, { method: 'POST' })
}

/** Nights whose wake-up date is in [from, to], both YYYY-MM-DD, at most 90 days. */
export async function fetchSleep(from: string, to: string): Promise<HealthNight[]> {
  const data = await call<{ nights: HealthNight[] }>('sleep', { from, to })
  return Array.isArray(data.nights) ? data.nights : []
}

/** Steps, distance, floors and heart rate between two instants (ms), at most 24 h. */
export function fetchWindow(startMs: number, endMs: number, timeoutMs = 8000): Promise<HealthWindow> {
  return call<HealthWindow>('window', { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() }, { timeoutMs })
}

/** Local calendar date (YYYY-MM-DD) of a timestamp, in the device's time zone. */
export function localDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
