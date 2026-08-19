/**
 * Silva's own BYO-credentials config — one localStorage blob, same shape as
 * Fit Check's `lib/config.ts`. Only a Notion token and an Anthropic key:
 * unlike Fit Check, Silva's four database ids are fixed (the owner's own
 * live databases, `store.ts`'s DEFAULT_*_DATABASE_ID constants), so there's
 * nothing else here to configure per device.
 */

import { readJson, writeJson } from '../../shared/storage'

const STORAGE_KEY = 'silva_config'

export interface SilvaConfig {
  notionToken: string
  anthropicKey: string
  /**
   * Opt-in for the local embedding model (see lib/indexer.ts). Off by
   * default because the first run fetches ~25 MB — but it is what powers
   * the mycorrhiza, so Settings presents it as the thing that makes the
   * underground layer exist, not as an obscure toggle.
   */
  mycorrhizaEnabled: boolean
}

export const DEFAULT_CONFIG: SilvaConfig = {
  notionToken: '',
  anthropicKey: '',
  mycorrhizaEnabled: false,
}

export function loadSilvaConfig(): SilvaConfig {
  return { ...DEFAULT_CONFIG, ...readJson(STORAGE_KEY, DEFAULT_CONFIG) }
}

export function saveSilvaConfig(config: SilvaConfig): void {
  writeJson(STORAGE_KEY, config)
}
