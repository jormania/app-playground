/**
 * Settings live on this device (localStorage). The Notion token never leaves
 * it except as the per-request header to the site's own relay, and is never
 * written into a backup file.
 */
import { parseNotionId } from '../../shared/notionId'
import { readJson, writeJson } from '../../shared/storage'
import { DEMO_SETTINGS_TAX } from '../data/demo'
import type { FeatureKey, Features, Settings, TaxProfile } from '../domain/types'

export const SETTINGS_KEY = 'inflow:settings'
/** Read by inflow-react.html before first paint. */
export const THEME_KEY = 'inflow:theme'

/** Everything on for a new user; each can be switched off in Settings → Features. */
export const ALL_FEATURES: Features = {
  tax: true,
  costs: true,
  deals: true,
  insights: true,
  expected: true,
  currencies: true,
  targets: true,
  printable: true,
  reportTools: true,
  unusual: true,
}

/** Features that only make sense with another one on (none today; kept for the next one). */
export const FEATURE_NEEDS: Partial<Record<FeatureKey, FeatureKey>> = {}

/** A feature is on only if it and whatever it needs are on. */
export function featureOn(features: Features, key: FeatureKey): boolean {
  const need = FEATURE_NEEDS[key]
  return !!features[key] && (!need || !!features[need])
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  mode: 'device',
  notionToken: '',
  incomeDbId: '',
  tax: { ...DEMO_SETTINGS_TAX },
  monthlyTarget: 30_000,
  largeMultiple: 4,
  demoSeeded: false,
  workspace: null,
  showTour: true,
  features: { ...ALL_FEATURES },
  openingCash: 0,
  openingCashDate: '',
}

/** What `updateSettings` accepts: nested tax and features merge rather than replace. */
export type SettingsPatch = Partial<Omit<Settings, 'tax' | 'features'>> & { tax?: Partial<TaxProfile>; features?: Partial<Features> }

export function mergeSettings(cur: Settings, patch: SettingsPatch): Settings {
  return { ...cur, ...patch, tax: { ...cur.tax, ...(patch.tax ?? {}) }, features: { ...cur.features, ...(patch.features ?? {}) } }
}

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings> & { trackTax?: boolean; trackCosts?: boolean }>(SETTINGS_KEY, {})
  const { trackTax, trackCosts, ...rest } = stored
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...rest,
    tax: { ...DEFAULT_SETTINGS.tax, ...(stored.tax ?? {}) },
    features: {
      ...ALL_FEATURES,
      // Settings saved before the feature map kept two switches of their own.
      ...(trackTax === false ? { tax: false } : {}),
      ...(trackCosts === false ? { costs: false } : {}),
      ...(stored.features ?? {}),
    },
  }
  merged.incomeDbId = merged.incomeDbId ? parseNotionId(merged.incomeDbId) || merged.incomeDbId : ''
  return merged
}

export function saveSettings(s: Settings): boolean {
  writeJson(THEME_KEY, s.theme)
  return writeJson(SETTINGS_KEY, s)
}

export function notionReady(s: Settings): boolean {
  return s.mode === 'notion' && !!s.notionToken && !!s.incomeDbId
}
