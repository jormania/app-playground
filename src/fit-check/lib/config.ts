/**
 * On-device settings. Nothing here ever ships in the repo — the Notion token,
 * the database ids and the Anthropic key are entered in Settings and stay on
 * this device (repo convention: bring-your-own-key).
 */
import { readJson, writeJson } from '../../shared/storage.ts'

const KEY = 'fitCheck_config'

export interface FitCheckConfig {
  notionToken: string
  garmentsDbId: string
  outfitsDbId: string
  wardrobesDbId: string
  anthropicKey: string
  theme: 'light' | 'dark' | null
  /**
   * Which wardrobe is being viewed; null means All. A device-local *view*
   * preference — the wardrobes themselves live in Notion so they follow Nora
   * between devices. This id can outlive the wardrobe it names, so every read
   * goes through `resolveFilter` (lib/wardrobes.ts) rather than being trusted.
   */
  wardrobeFilterId: string | null
  /** Last known coordinates; Bucharest is the fallback (charter). */
  coords: { lat: number; lon: number } | null
}

export const BUCHAREST = { lat: 44.4268, lon: 26.1025 }

export const DEFAULT_CONFIG: FitCheckConfig = {
  notionToken: '',
  garmentsDbId: '',
  outfitsDbId: '',
  wardrobesDbId: '',
  anthropicKey: '',
  theme: null,
  wardrobeFilterId: null,
  coords: null,
}

export function loadConfig(): FitCheckConfig {
  const stored = readJson<Partial<FitCheckConfig>>(KEY, {})
  // A config written before a field existed simply falls back to its default.
  return { ...DEFAULT_CONFIG, ...stored }
}

export function saveConfig(config: FitCheckConfig): boolean {
  return writeJson(KEY, config)
}

/** True once there is enough configuration to talk to Notion at all. */
export function isConfigured(config: FitCheckConfig): boolean {
  return Boolean(config.notionToken && config.garmentsDbId)
}
