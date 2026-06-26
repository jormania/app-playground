// On-device settings. NOTHING here is ever baked into the build or sent to our own
// servers: the Notion token + the three data-source IDs live only in this browser's
// localStorage. This is the bring-your-own-key foundation — the public deploy stays
// keyless, and the blast radius of the token is the user's own Notion workspace.

export interface Settings {
  /** Notion internal-integration token (secret_… / ntn_…). */
  token: string
  /** Data-source IDs for the three databases. */
  dsOdysseys: string
  dsCheckins: string
  dsReflections: string
  /** Human buddy — name + email only. MVP sends no messages. */
  buddyName: string
  buddyEmail: string
  /** Recorded only in MVP (no notifications fire). */
  dailyTime: string
  weeklySlot: string
  /** Companion guidance: gentle in-page background notes (twisties). */
  showGuidance: boolean
  /** Show the landing page (intro instructions) on the home screen. */
  showLanding: boolean
  /** Optional AI companion: a bring-your-own Anthropic key (on-device; calls go straight to
   *  Anthropic, never our servers) + an opt-in toggle. Never replaces the human buddy. */
  anthropicKey: string
  companionEnabled: boolean
  /** Opt-in local reminders (daily check-in + weekly reflect nudges). Best-effort, on-device, no
   *  server — uses dailyTime / weeklySlot as the target windows. */
  remindersEnabled: boolean
}

export const EMPTY_SETTINGS: Settings = {
  token: '',
  dsOdysseys: '',
  dsCheckins: '',
  dsReflections: '',
  buddyName: '',
  buddyEmail: '',
  dailyTime: '',
  weeklySlot: '',
  // Newcomers get guidance on by default; it's switched off once it's second nature.
  showGuidance: true,
  showLanding: true,
  // The AI companion is strictly opt-in: no key, and off, until the user chooses it.
  anthropicKey: '',
  companionEnabled: false,
  // Reminders are opt-in too.
  remindersEnabled: false,
}

const STORAGE_KEY = 'sol-odyssey:settings'

/** The fields required before the app can reach Notion at all. */
const REQUIRED_KEYS: (keyof Settings)[] = [
  'token',
  'dsOdysseys',
  'dsCheckins',
  'dsReflections',
]

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Resolve a storage backend; falls back to a no-op so SSR/tests never throw. */
function storage(explicit?: StorageLike): StorageLike | null {
  if (explicit) return explicit
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* access can throw in locked-down contexts */
  }
  return null
}

/** Merge whatever is stored over the empty shape, trimming all string values. */
export function loadSettings(explicit?: StorageLike): Settings {
  const store = storage(explicit)
  if (!store) return { ...EMPTY_SETTINGS }
  let raw: string | null = null
  try {
    raw = store.getItem(STORAGE_KEY)
  } catch {
    return { ...EMPTY_SETTINGS }
  }
  if (!raw) return { ...EMPTY_SETTINGS }
  return normalize(safeParse(raw))
}

/** Persist settings (trimmed). No-op if no storage is available. */
export function saveSettings(next: Partial<Settings>, explicit?: StorageLike): Settings {
  const merged = normalize({ ...loadSettings(explicit), ...next })
  const store = storage(explicit)
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(merged))
    } catch {
      /* quota / private mode — settings simply don't persist */
    }
  }
  return merged
}

export function clearSettings(explicit?: StorageLike): void {
  const store = storage(explicit)
  try {
    store?.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** True once the token + all three data-source IDs are present. */
export function isConfigured(settings: Settings): boolean {
  return REQUIRED_KEYS.every((k) => String(settings[k]).trim().length > 0)
}

/** True when the optional AI companion should be offered — a key is present AND it's switched on.
 *  Independent of `isConfigured`: the companion is additive and never required. */
export function companionActive(settings: Pick<Settings, 'anthropicKey' | 'companionEnabled'>): boolean {
  return settings.anthropicKey.trim().length > 0 && settings.companionEnabled === true
}

/** A light email-shape check (one @, a dot in the domain, no spaces) — enough to catch typos
 *  before a buddy is required, without over-policing valid-but-unusual addresses. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function normalize(value: Partial<Settings>): Settings {
  const out = { ...EMPTY_SETTINGS }
  for (const key of Object.keys(EMPTY_SETTINGS) as (keyof Settings)[]) {
    const fallback = EMPTY_SETTINGS[key]
    const v = value[key]
    if (typeof fallback === 'boolean') {
      // Coerce stored value to boolean; unknown/missing → the default.
      ;(out as Record<string, unknown>)[key] = typeof v === 'boolean' ? v : fallback
    } else {
      ;(out as Record<string, unknown>)[key] = typeof v === 'string' ? v.trim() : fallback
    }
  }
  return out
}

function safeParse(raw: string): Partial<Settings> {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export { STORAGE_KEY }
