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
  /** Show the crossing (the whole-forest graph in Underground) *and* the
   *  small node-link drawing inside a plate's own Neighbourhood panel — the
   *  same picture at two scales, one setting for both. On by default; the
   *  toggle exists for the density the crossing can reach at real scale,
   *  not because either drawing is wrong at the sizes most forests start
   *  at. The path list, the make-a-path form, and paths themselves are
   *  unaffected either way — this hides the drawings, not the paths. */
  showGraph: boolean
  /** Show "the rootstock" at the head of Roots — the crossing's twin,
   *  grouping kept things by the source they came from. Its own toggle
   *  rather than sharing the crossing's: they answer different questions,
   *  and someone may well want one drawing and not the other. */
  showRootstock: boolean
  /** Show "the walk" above the Forest's scroll. On by default; some people
   *  would rather the Forest just be the list, with nothing above it
   *  claiming their attention first. */
  showWalk: boolean
  /** Master switch for every provocation kind, deterministic and
   *  mycorrhizal alike — distinct from `mycorrhizaEnabled`, which only
   *  gates the three kinds that need embeddings. Off means what SILVA.md
   *  calls the default state anyway: silence. On by default, since a
   *  provocation only ever appears at most once a session already. */
  provocationsEnabled: boolean
  /** Auto-transcribe a photographed page's text into its Body the moment
   *  it's added — see lib/ocr.ts. Off by default, and gated separately from
   *  merely having an Anthropic key set: sending a photograph to a third
   *  party is a different privacy trade than sending text for Tension, and
   *  deserves its own explicit opt-in rather than riding along on the key. */
  autoTranscribe: boolean
}

export const DEFAULT_CONFIG: SilvaConfig = {
  notionToken: '',
  anthropicKey: '',
  mycorrhizaEnabled: false,
  showGraph: true,
  showRootstock: true,
  showWalk: true,
  provocationsEnabled: true,
  autoTranscribe: false,
}

export function loadSilvaConfig(): SilvaConfig {
  return { ...DEFAULT_CONFIG, ...readJson(STORAGE_KEY, DEFAULT_CONFIG) }
}

export function saveSilvaConfig(config: SilvaConfig): void {
  writeJson(STORAGE_KEY, config)
}
