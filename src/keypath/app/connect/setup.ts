import type { AccessState } from '../../midi/types'

/**
 * The connection wizard's steps (KEYPATH.md §2, the order that worked on the
 * S24). Each is checked before the next one opens; the wizard never asks
 * someone to do a thing it can already see has been done.
 */
export type SetupStep = 'browser' | 'otg' | 'plug' | 'allow' | 'find' | 'play' | 'done'

export interface SetupFacts {
  /** From the connection, or the pre-check when Web MIDI isn't there at all. */
  access: AccessState
  /** A keyboard port is open. */
  connected: boolean
  /** Xiaomi, Redmi or POCO: host mode needs the OTG switch first. */
  xiaomi: boolean
  otgConfirmed: boolean
  plugConfirmed: boolean
  /** A key was played on the keyboard since the wizard opened. */
  heard: boolean
}

export function currentStep(f: SetupFacts): SetupStep {
  if (f.access === 'unsupported' || f.access === 'insecure') return 'browser'
  // Already plugged in and allowed: skip straight to proving that notes arrive.
  if (f.connected) return f.heard ? 'done' : 'play'
  if (f.xiaomi && !f.otgConfirmed) return 'otg'
  if (!f.plugConfirmed) return 'plug'
  if (f.access !== 'granted') return 'allow'
  return 'find'
}

/** The steps this phone will be shown, in order. */
export function stepsFor(xiaomi: boolean): SetupStep[] {
  return ['browser', ...(xiaomi ? (['otg'] as const) : []), 'plug', 'allow', 'find', 'play']
}

export type StepState = 'done' | 'current' | 'todo'

export function stateOf(step: SetupStep, current: SetupStep, xiaomi: boolean): StepState {
  if (current === 'done') return 'done'
  const order = stepsFor(xiaomi)
  const i = order.indexOf(step)
  const c = order.indexOf(current)
  return i < c ? 'done' : i === c ? 'current' : 'todo'
}

/** How long a step may wait for the keyboard before the wizard shows what to check. */
export const STUCK_AFTER_MS: Partial<Record<SetupStep, number>> = { find: 6000, play: 15000 }

export function isStuck(step: SetupStep, msInStep: number): boolean {
  const limit = STUCK_AFTER_MS[step]
  return limit !== undefined && msInStep >= limit
}

/**
 * Xiaomi's own phones, by model: the brand names, or Xiaomi's numeric model
 * codes such as the Poco F3's M2012K11AG (year-month, then a suffix). Chrome
 * only gives the model through UA Client Hints; the classic user agent says "K".
 */
export function isXiaomiModel(model: string | null | undefined): boolean {
  if (!model) return false
  return /xiaomi|redmi|poco|^mi\s|^M?2\d{3}[A-Z0-9]{4,}$/i.test(model.trim())
}

type UaData = { getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>> }

export async function detectXiaomi(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  if (/xiaomi|redmi|poco/i.test(navigator.userAgent)) return true
  try {
    const nav = navigator as Navigator & { userAgentData?: UaData }
    const hi = await nav.userAgentData?.getHighEntropyValues?.(['model'])
    return isXiaomiModel(typeof hi?.model === 'string' ? hi.model : null)
  } catch {
    return false
  }
}
