import type { OptionMood, TasteConfidence, TasteFacet, TasteStance, ResourceKind } from '../domain/types'

/**
 * The browser's side of /api/long-listen. Everything that needs Claude or the
 * Notion token goes through here; the key itself never leaves the server. The
 * listener unlocks the curator once with a passphrase, kept on this device.
 */
export const ENDPOINT = '/api/long-listen'

export type CuratorErrorCode = 'locked' | 'not-set-up' | 'busy' | 'offline' | 'declined' | 'failed'

export class CuratorUnavailable extends Error {
  constructor(readonly code: CuratorErrorCode, message: string) {
    super(message)
  }
}

/** What the listener reads when the curator can't answer. Never an internal error. */
const FRIENDLY: Record<CuratorErrorCode, string> = {
  locked: 'The curator needs your passphrase — add it in Settings.',
  'not-set-up': 'The curator isn’t set up on the server yet.',
  busy: 'The curator is busy. Try again in a minute.',
  offline: 'You seem to be offline. What’s already here is still yours to read.',
  declined: 'The curator couldn’t help with that one.',
  failed: 'The curator couldn’t finish just now. Nothing was lost — try again shortly.',
}

export function friendly(code: CuratorErrorCode): string {
  return FRIENDLY[code]
}

export interface CuratorClient {
  call<T>(op: string, payload: unknown): Promise<T>
}

export function httpCurator(getPassphrase: () => string, fetchImpl: typeof fetch = (...a) => fetch(...a)): CuratorClient {
  return {
    async call<T>(op: string, payload: unknown): Promise<T> {
      const key = getPassphrase()
      if (!key) throw new CuratorUnavailable('locked', FRIENDLY.locked)
      let res: Response
      try {
        res = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-long-listen-key': key },
          body: JSON.stringify({ op, payload }),
        })
      } catch {
        throw new CuratorUnavailable('offline', FRIENDLY.offline)
      }
      let data: unknown = null
      try { data = await res.json() } catch { /* empty or non-JSON body */ }
      if (res.ok) return data as T
      const code: CuratorErrorCode =
        res.status === 401 ? 'locked'
          : res.status === 501 ? 'not-set-up'
            : res.status === 429 ? 'busy'
              : res.status === 422 ? 'declined'
                : 'failed'
      // A Notion error message names the problem (a missing property, a bad id)
      // and is the one upstream message worth showing; everything else is ours.
      const message = op === 'notion' && typeof (data as { message?: unknown })?.message === 'string'
        ? (data as { message: string }).message
        : FRIENDLY[code]
      throw new CuratorUnavailable(code, message)
    },
  }
}

// ── response shapes (mirroring api/_lib/longListen/validate.js) ───────────

export interface CuratedOption {
  mood: OptionMood
  title: string
  pitch: string
  character: string[]
  why: string
  angle: string
  returning?: { themeId: string; note: string }
}

export interface ThemesResponse {
  options: CuratedOption[]
  promptVersion: string
  model: string
}

export interface CuratedPerformers {
  conductor?: string
  orchestra?: string
  ensemble?: string
  soloists: { name: string; instrument?: string }[]
  year?: string
}

export interface CuratedItem extends CuratedPerformers {
  composer: string
  workTitle: string
  catalogue?: string
  composed?: string
  form?: string
  workContext?: string
  character: string[]
  why: string
  whyThisRecording: string
  listenFor: string[]
  revisitReason?: string
}

export interface CuratedComparison {
  composer: string
  workTitle: string
  catalogue?: string
  framing: string
  whyBoth: string
  perspectives: (CuratedPerformers & { character: string; listenFor?: string })[]
}

export interface CuratedProgramme {
  title: string
  dek: string
  introduction: string
  whyNow: string
  historicalPlace: string
  howTheyRelate: string
  continuityNote?: string
  sections: { role: string; heading: string; note?: string; items: CuratedItem[] }[]
  comparisons: CuratedComparison[]
}

export interface ProgrammeResponse {
  programme: CuratedProgramme
  removedRepeats: number
  promptVersion: string
  model: string
}

export interface TasteResponse {
  observations: {
    facet: TasteFacet
    subject: string
    statement: string
    stance: TasteStance
    confidence: TasteConfidence
    evidence: string[]
    replaces?: string
  }[]
  questions: string[]
  promptVersion: string
}

export interface ContinuityResponse {
  reaction: string
  openQuestions: string[]
  adjacentTopics: string[]
  nextDirections: string[]
  closingNote: string
  promptVersion: string
}

export interface ExplainResponse {
  heading: string
  body: string
  promptVersion: string
}

export interface CompareResponse {
  framing: string
  whyBoth: string
  current: { character: string; listenFor?: string }
  other: CuratedPerformers & { character: string; listenFor?: string }
  promptVersion: string
}

export interface ResourcesResponse {
  resources: { kind: ResourceKind; title: string; url: string; source: string; purpose: string; relatesTo?: string }[]
  dropped: number
  promptVersion: string
}

export interface StatusResponse {
  curator: boolean
  notion: boolean
  notionPageId?: string
  prompts: Record<string, string>
}
