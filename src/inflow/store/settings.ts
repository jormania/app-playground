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

export const ALL_FEATURES: Features = { tax: true, costs: true, deals: true, insights: true, expected: true, currencies: true, printable: true }
export const NO_FEATURES: Features = { tax: false, costs: false, deals: false, insights: false, expected: false, currencies: false, printable: false }
/** Where a new user starts: income, where it comes from, insights, expected payments. The rest is a switch away. */
export const SIMPLE_FEATURES: Features = { ...NO_FEATURES, insights: true, expected: true }

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
  monthlyTarget: 0,
  largeMultiple: 4,
  demoSeeded: false,
  workspace: null,
  showTour: true,
  features: { ...SIMPLE_FEATURES },
  simpleStartNotice: true,
  openingCash: 0,
  openingCashDate: '',
}

/** What `updateSettings` accepts: nested tax and features merge rather than replace. */
export type SettingsPatch = Partial<Omit<Settings, 'tax' | 'features'>> & { tax?: Partial<TaxProfile>; features?: Partial<Features> }

export function mergeSettings(cur: Settings, patch: SettingsPatch): Settings {
  return { ...cur, ...patch, tax: { ...cur.tax, ...(patch.tax ?? {}) }, features: { ...cur.features, ...(patch.features ?? {}) } }
}

type Stored = Partial<Settings> & { trackTax?: boolean; trackCosts?: boolean; features?: Partial<Features> & { targets?: boolean; unusual?: boolean; reportTools?: boolean } }

/**
 * A new user (nothing stored) starts simple. Someone who has used InFlow keeps
 * their switches: a feature they never set stays on, as it was for them.
 * Older settings are carried over: the two early switches (trackTax,
 * trackCosts), and the target and unusual-payment flags, which are now plain
 * settings (0 = off) rather than features.
 */
export function loadSettings(): Settings {
  const raw = readJson<Stored | null>(SETTINGS_KEY, null)
  if (!raw) return { ...DEFAULT_SETTINGS, features: { ...SIMPLE_FEATURES } }
  const { trackTax, trackCosts, features: f = {} as NonNullable<Stored['features']>, ...rest } = raw
  const { targets, unusual, reportTools: _r, ...kept } = f
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    monthlyTarget: 30_000,
    simpleStartNotice: false,
    ...rest,
    tax: { ...DEFAULT_SETTINGS.tax, ...(raw.tax ?? {}) },
    features: {
      ...ALL_FEATURES,
      ...(trackTax === false ? { tax: false } : {}),
      ...(trackCosts === false ? { costs: false } : {}),
      ...kept,
    },
  }
  if (targets === false) merged.monthlyTarget = 0
  if (unusual === false) merged.largeMultiple = 0
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
