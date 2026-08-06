/**
 * On-device settings. Nothing here ever ships in the repo — the Notion token,
 * the database ids and the Anthropic key are entered in Settings and stay on
 * this device (repo convention: bring-your-own-key).
 */
import { readJson, writeJson } from '../../shared/storage.ts'
import type { Home } from './vocabulary.ts'

const KEY = 'fitCheck_config'

export interface FitCheckConfig {
  notionToken: string
  garmentsDbId: string
  outfitsDbId: string
  anthropicKey: string
  theme: 'light' | 'dark' | null
  /** Display names for the two homes. The Notion option keys never change. */
  homeNames: { 'Home A': string; 'Home B': string }
  /** Which home's wardrobe is currently in view. */
  activeHome: Home
  /** Last known coordinates; Bucharest is the fallback (charter). */
  coords: { lat: number; lon: number } | null
}

export const BUCHAREST = { lat: 44.4268, lon: 26.1025 }

export const DEFAULT_CONFIG: FitCheckConfig = {
  notionToken: '',
  garmentsDbId: '',
  outfitsDbId: '',
  anthropicKey: '',
  theme: null,
  homeNames: { 'Home A': 'Home A', 'Home B': 'Home B' },
  activeHome: 'Both',
  coords: null,
}

export function loadConfig(): FitCheckConfig {
  const stored = readJson<Partial<FitCheckConfig>>(KEY, {})
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    // Merged explicitly: a config saved before this field existed would
    // otherwise spread `undefined` over the defaults and blank both names.
    homeNames: { ...DEFAULT_CONFIG.homeNames, ...(stored.homeNames || {}) },
  }
}

export function saveConfig(config: FitCheckConfig): boolean {
  return writeJson(KEY, config)
}

/**
 * The name to show for a home. "Both" is the app's own word for "everywhere",
 * not one of Nora's places, so it is never renameable.
 */
export function homeLabel(config: FitCheckConfig, home: Home): string {
  if (home === 'Both') return 'Both'
  return config.homeNames[home]?.trim() || home
}

/** True once there is enough configuration to talk to Notion at all. */
export function isConfigured(config: FitCheckConfig): boolean {
  return Boolean(config.notionToken && config.garmentsDbId)
}
