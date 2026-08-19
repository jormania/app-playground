/**
 * Provocation dismissal tracking. Two separate concerns, deliberately on
 * different storage lifetimes:
 *
 * - Dismissed provocations persist across sessions (localStorage) — "the
 *   same pairing isn't offered twice" (SILVA.md), same pattern as
 *   WhereItWent's duplicate-transaction dismissal.
 * - "Already shown a provocation this session" is sessionStorage — the
 *   anti-feed rule ("at most one provocation is offered per session") is
 *   about the session, not forever.
 *
 * Both go through src/shared/storage.ts, which can't throw (Safari private
 * mode, quota, etc.) — a provocation silently just isn't remembered/gated
 * in that case, never a crash.
 */
import { readJson, writeJson, readSessionJson, writeSessionJson } from '../../shared/storage'

const DISMISSED_KEY = 'silva:provocation-dismissed'
const SHOWN_THIS_SESSION_KEY = 'silva:provocation-shown'

export function readDismissed(): Set<string> {
  return new Set(readJson<string[]>(DISMISSED_KEY, []))
}

export function addDismissed(key: string): void {
  const dismissed = readDismissed()
  dismissed.add(key)
  writeJson(DISMISSED_KEY, [...dismissed])
}

export function hasShownThisSession(): boolean {
  return readSessionJson<boolean>(SHOWN_THIS_SESSION_KEY, false)
}

export function markShownThisSession(): void {
  writeSessionJson(SHOWN_THIS_SESSION_KEY, true)
}
