/**
 * Settings live on this device (localStorage). The Notion token never leaves
 * it except as the per-request header to the site's own relay, and is never
 * written into a backup file.
 */
import { parseNotionId } from '../../shared/notionId'
import { readJson, writeJson } from '../../shared/storage'
import { DEMO_SETTINGS_TAX } from '../data/demo'
import type { Settings } from '../domain/types'

export const SETTINGS_KEY = 'inflow:settings'
/** Read by inflow-react.html before first paint. */
export const THEME_KEY = 'inflow:theme'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  mode: 'device',
  notionToken: '',
  incomeDbId: '',
  tax: { ...DEMO_SETTINGS_TAX },
  monthlyTarget: 30_000,
  largeMultiple: 4,
  demoSeeded: false,
  trackTax: true,
  showTour: true,
  trackCosts: true,
  openingCash: 0,
  openingCashDate: '',
}

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>(SETTINGS_KEY, {})
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    tax: { ...DEFAULT_SETTINGS.tax, ...(stored.tax ?? {}) },
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
