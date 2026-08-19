/**
 * Provocations — "the app's only voice" (SILVA.md). Places things beside
 * each other and says nothing: never summarizes, never explains the
 * connection, never writes the insight. Computed fresh each session from
 * data that already exists — there's no Notion database for a
 * provocation itself.
 *
 * Tension (the one kind needing a live Anthropic call) is deferred — see
 * project_silva-build-plan memory. This module covers the six kinds that
 * need no key and no network: four deterministic, two mycorrhizal
 * (embeddings-only, never triggering the model to load — see
 * lib/vectorCache.ts and App.tsx, which only ever *peek* an
 * already-cached vector here).
 */

import type { Thing } from './notion'
import type { Locus } from './loci'
import type { Path } from './paths'
import { cosineSimilarity } from './embeddings'
import { daysSince } from './understory'

export type ProvocationKind =
  | 'shuffle'
  | 'random-clearing'
  | 'long-unvisited'
  | 'blind-pairing'
  | 'near-neighbours'
  | 'clearing-forming'

export type Provocation =
  | { kind: 'shuffle'; thing: Thing }
  | { kind: 'random-clearing'; locus: Locus; things: Thing[] }
  | { kind: 'long-unvisited'; thing: Thing }
  | { kind: 'blind-pairing'; a: Thing; b: Thing }
  | { kind: 'near-neighbours'; a: Thing; b: Thing; similarity: number }
  | { kind: 'clearing-forming'; things: Thing[] }

// A thing kept this long ago without a real "last visited" signal (Silva
// doesn't track viewing history) is treated as unvisited — an approximation
// stated plainly, not assumed accurate.
export const LONG_UNVISITED_DAYS = 180
// Higher bar than Search's 0.35 — a provocation should be a confident
// nudge, not the same net a search box casts.
export const NEAR_NEIGHBOUR_THRESHOLD = 0.55
export const CLEARING_FORMING_THRESHOLD = 0.5
export const CLEARING_FORMING_MIN_SIZE = 4

function keptThings(things: Thing[]): Thing[] {
  return things.filter((t) => t.state === 'Kept')
}

function pairKey(aId: string, bId: string): string {
  return [aId, bId].sort().join('::')
}

/** A pair already connected by a real Path isn't a discovery — it's
 *  already asserted. Both pairwise kinds exclude these. */
function isConnected(aId: string, bId: string, paths: Path[]): boolean {
  const key = pairKey(aId, bId)
  return paths.some((p) => p.fromId && p.toId && pairKey(p.fromId, p.toId) === key)
}

/** Stable identity for a provocation, used both to exclude something
 *  already dismissed and to record a new dismissal. */
export function provocationKey(p: Provocation): string {
  switch (p.kind) {
    case 'shuffle':
      return `shuffle:${p.thing.id}`
    case 'random-clearing':
      return `random-clearing:${p.locus.id}`
    case 'long-unvisited':
      return `long-unvisited:${p.thing.id}`
    case 'blind-pairing':
      return `blind-pairing:${pairKey(p.a.id, p.b.id)}`
    case 'near-neighbours':
      return `near-neighbours:${pairKey(p.a.id, p.b.id)}`
    case 'clearing-forming':
      return `clearing-forming:${p.things.map((t) => t.id).sort().join(',')}`
  }
}

function gatherShuffle(things: Thing[]): Provocation[] {
  return keptThings(things).map((thing) => ({ kind: 'shuffle', thing }))
}

function gatherRandomClearing(loci: Locus[], things: Thing[]): Provocation[] {
  return loci
    .map((locus) => ({ kind: 'random-clearing' as const, locus, things: things.filter((t) => t.lociIds.includes(locus.id)) }))
    .filter((p) => p.things.length > 0)
}

function gatherLongUnvisited(things: Thing[], today: Date): Provocation[] {
  return keptThings(things)
    .filter((t) => t.kept && daysSince(t.kept, today) >= LONG_UNVISITED_DAYS)
    .map((thing) => ({ kind: 'long-unvisited', thing }))
}

function gatherBlindPairing(things: Thing[], paths: Path[]): Provocation[] {
  const kept = keptThings(things)
  const out: Provocation[] = []
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      if (isConnected(kept[i].id, kept[j].id, paths)) continue
      out.push({ kind: 'blind-pairing', a: kept[i], b: kept[j] })
    }
  }
  return out
}

function gatherNearNeighbours(things: Thing[], paths: Path[], vectorsById: Map<string, Float32Array>): Provocation[] {
  const kept = keptThings(things).filter((t) => vectorsById.has(t.id))
  const out: Provocation[] = []
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      if (isConnected(kept[i].id, kept[j].id, paths)) continue
      const similarity = cosineSimilarity(vectorsById.get(kept[i].id)!, vectorsById.get(kept[j].id)!)
      if (similarity < NEAR_NEIGHBOUR_THRESHOLD) continue
      out.push({ kind: 'near-neighbours', a: kept[i], b: kept[j], similarity })
    }
  }
  return out
}

/** A simple greedy cluster, not real k-means — good enough for a
 *  provocation, which is a nudge, not an authoritative grouping. */
function gatherClearingForming(things: Thing[], vectorsById: Map<string, Float32Array>): Provocation[] {
  const kept = keptThings(things).filter((t) => vectorsById.has(t.id))
  const out: Provocation[] = []
  for (const seed of kept) {
    const seedVector = vectorsById.get(seed.id)!
    const neighbours = kept.filter((t) => {
      if (t.id === seed.id) return false
      return cosineSimilarity(seedVector, vectorsById.get(t.id)!) >= CLEARING_FORMING_THRESHOLD
    })
    const group = [seed, ...neighbours]
    if (group.length < CLEARING_FORMING_MIN_SIZE) continue
    // Skip a group that's already entirely gathered under one locus —
    // nothing new to notice there.
    const alreadyGathered = seed.lociIds.some((locusId) => group.every((t) => t.lociIds.includes(locusId)))
    if (alreadyGathered) continue
    out.push({ kind: 'clearing-forming', things: group })
  }
  return out
}

export interface PickProvocationInput {
  things: Thing[]
  loci: Locus[]
  paths: Path[]
  vectorsById: Map<string, Float32Array>
  dismissed: Set<string>
  today?: Date
  random?: () => number
}

/**
 * Uniform random among *eligible kinds* first, then uniform within that
 * kind's candidates — picking uniformly over every individual candidate
 * would let whichever kind happens to have the most instances (often
 * Shuffle or Blind pairing) dominate every session.
 */
export function pickProvocation({
  things,
  loci,
  paths,
  vectorsById,
  dismissed,
  today = new Date(),
  random = Math.random,
}: PickProvocationInput): Provocation | null {
  const byKind = [
    gatherShuffle(things),
    gatherRandomClearing(loci, things),
    gatherLongUnvisited(things, today),
    gatherBlindPairing(things, paths),
    gatherNearNeighbours(things, paths, vectorsById),
    gatherClearingForming(things, vectorsById),
  ].map((candidates) => candidates.filter((p) => !dismissed.has(provocationKey(p))))
    .filter((candidates) => candidates.length > 0)

  if (byKind.length === 0) return null

  const chosenKind = byKind[Math.floor(random() * byKind.length)]
  return chosenKind[Math.floor(random() * chosenKind.length)]
}
