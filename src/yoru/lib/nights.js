// A short local log of the nights Yoru carried you down — and the one piece of
// Yoru that pairs with Google Health (YORU.md, "Nights and sleep").
//
// Only what's needed to compare nights is kept: when you began, how long you
// asked for, which blend, whether breathwork was on, the display mode. Never the
// note — the note is discarded at the end of a session by design, and a log is
// not a back door for it. Kept on this device only, capped, and never sent
// anywhere; the sleep readings are fetched to compare against it and not stored.
import { readJson, writeJson } from '../../shared/storage'
import { CURATED_MIXES, SCENE_PRESETS } from './storage'

export const NIGHTS_KEY = 'yoru:nights'
export const NIGHTS_CAP = 90

const LAYERS = ['rain', 'waves', 'stream', 'wind', 'leaves', 'chime', 'warmth', 'drone']
const SHAPERS = ['brightness', 'motion', 'pace'] // volume is yours, never part of a blend's identity

function sameOn(keys, a, b) {
  return keys.every((k) => (a[k] ?? null) === (b[k] ?? null))
}

/**
 * A human name for the blend a night played: one of the curated blends, one of
 * your saved ones, a quick-pick scene left as it was, or "own blend".
 */
export function blendLabel(mix, customMixes = []) {
  if (!mix || typeof mix !== 'object') return 'own blend'
  for (const c of customMixes || []) {
    if (c && c.mix && sameOn([...LAYERS, ...SHAPERS], { ...c.mix }, mix)) return c.name
  }
  for (const c of CURATED_MIXES) {
    // a curated blend only fixes the keys it lists
    const keys = Object.keys(c.mix)
    if (sameOn(keys, c.mix, mix)) return c.name
  }
  for (const [scene, layers] of Object.entries(SCENE_PRESETS)) {
    if (sameOn(LAYERS, layers, mix)) return scene
  }
  return 'own blend'
}

export function loadNights() {
  const list = readJson(NIGHTS_KEY, [])
  return Array.isArray(list) ? list.filter((n) => n && typeof n.startedAt === 'number') : []
}

function save(list) {
  writeJson(NIGHTS_KEY, list.slice(0, NIGHTS_CAP))
}

/** Log a night as it begins (newest first). A resume of the same start is a no-op. */
export function recordBegin(session, customMixes = []) {
  const list = loadNights()
  if (list.some((n) => n.startedAt === session.startedAt)) return
  save([
    {
      startedAt: session.startedAt,
      endedAt: null,
      minutes: Math.round((session.totalSec || 0) / 60),
      blend: blendLabel(session.mix, customMixes),
      breathwork: session.screen === 'lit' ? session.breathwork !== false : false,
      screen: session.screen || 'lit',
    },
    ...list,
  ])
}

/** Mark when it actually ended (a tap, or the timer). */
export function recordEnd(startedAt, endedAt = Date.now()) {
  const list = loadNights()
  const i = list.findIndex((n) => n.startedAt === startedAt)
  if (i === -1) return
  list[i] = { ...list[i], endedAt }
  save(list)
}

export function clearNights() {
  writeJson(NIGHTS_KEY, [])
}
