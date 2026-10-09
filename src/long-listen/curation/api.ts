import type { OptionMood, TasteConfidence, TasteFacet, TasteStance, ResourceKind, WeekForm } from '../domain/types'

/**
 * The curator's contract: `call(op, payload)` and the shapes it answers with.
 * The implementation is curator/curator.js — Claude called from the browser
 * with the listener's own key, the way every app in the playground does it.
 */
export type CuratorErrorCode = 'locked' | 'bad-key' | 'busy' | 'offline' | 'declined' | 'failed'

export class CuratorUnavailable extends Error {
  constructor(readonly code: CuratorErrorCode, message: string) {
    super(message)
  }
}

/** What the listener reads when the curator can't answer. Never an internal error. */
const FRIENDLY: Record<CuratorErrorCode, string> = {
  locked: 'The curator needs your Anthropic key — add it in Settings, then test it.',
  'bad-key': 'Anthropic didn’t accept that key. Check it in Settings.',
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

// ── response shapes (mirroring curator/validate.js) ───────────────────────

export interface CuratedOption {
  mood: OptionMood
  title: string
  pitch: string
  character: string[]
  why: string
  angle: string
  returning?: { themeId: string; note: string }
  form?: WeekForm
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

export interface CompanionResponse {
  works: { key: string; movements: string[] }[]
  promptVersion: string
}

export interface PingResponse {
  ok: boolean
  model: string
}
