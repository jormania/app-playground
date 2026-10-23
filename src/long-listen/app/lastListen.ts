import { readJson, writeJson } from '../../shared/storage'
import type { ListenTarget } from '../domain/nowListening'

/**
 * The listening view last opened, kept on the device: with nothing playing,
 * the masthead's "listen along" can still lead back to a work left part-way.
 */
const KEY = 'long-listen:last-listen'
/** Long enough for an evening and the morning after; past it, the work has moved on. */
export const LAST_LISTEN_FOR_MS = 18 * 3_600_000

export function rememberListen(t: ListenTarget, now = Date.now()): void {
  writeJson(KEY, { ...t, at: now })
}

export function lastListen(now = Date.now()): ListenTarget | null {
  const v = readJson<(ListenTarget & { at?: number }) | null>(KEY, null)
  if (!v || typeof v.programmeId !== 'string' || typeof v.itemId !== 'string' || typeof v.at !== 'number') return null
  return now - v.at <= LAST_LISTEN_FOR_MS ? v : null
}
