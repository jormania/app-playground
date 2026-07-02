import {
  buildRoundsSegments,
  buildCycleSegments,
  buildSitWalkSegments,
  build478Segments,
  buildBoxSegments,
} from './segments'
import { IconRounds, IconCycles, IconCustom, IconSitWalk, IconBreath, IconBox } from '../components/icons'

// Single source of truth for the six panels. A "mode" bundles its identity, its
// calm copy, its practice family (which drives the background gradient + the
// sound cue), its numeric setup fields, and a pure `build()` that turns a config
// into the flat segment list the engine plays. Adding a practice = adding an
// entry here; no screen or engine change.
//
// family → gradient key + sound cue:
//   movement/focus/custom use a neutral "ding"; the three mindfulness
//   practices use a soft "bell".

function totalSeconds(segments) {
  return segments.reduce((sum, s) => sum + s.seconds, 0)
}

function formatMinutes(seconds) {
  const m = Math.round(seconds / 60)
  return `${m} min`
}

export const MODES = {
  rounds: {
    id: 'rounds',
    name: 'Rounds',
    tagline: 'Move and rest, on repeat',
    blurb: 'Alternating movement and rest — for interval sessions, flows, or a Tabata set. Move when it says move, ease off when it says rest.',
    family: 'movement',
    grad: 'rounds',
    cue: 'ding',
    Icon: IconRounds,
    defaults: { work: 20, rest: 10, rounds: 8, warmup: 0 },
    fields: [
      { key: 'work', label: 'Move (sec)', min: 1, max: 600 },
      { key: 'rest', label: 'Rest (sec)', min: 1, max: 600 },
      { key: 'rounds', label: 'Rounds', min: 1, max: 50 },
      { key: 'warmup', label: 'Warm-up (sec)', min: 0, max: 600 },
    ],
    build: (c) => buildRoundsSegments(c),
    summarize: (c) => (c ? `${c.work}s move · ${c.rest}s rest · ${c.rounds}×` : null),
  },

  cycles: {
    id: 'cycles',
    name: 'Cycles',
    tagline: 'Focus, then a real break',
    blurb: 'Focused stretches with breaks between them, and a longer breather every few rounds. The Pomodoro rhythm, if you want it — or your own.',
    family: 'focus',
    grad: 'cycles',
    cue: 'ding',
    Icon: IconCycles,
    defaults: { focus: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLongBreak: 4, totalCycles: 8 },
    fields: [
      { key: 'focus', label: 'Focus (min)', min: 1, max: 180 },
      { key: 'shortBreak', label: 'Short break (min)', min: 1, max: 60 },
      { key: 'longBreak', label: 'Long break (min)', min: 1, max: 60 },
      { key: 'cyclesBeforeLongBreak', label: 'Long break every (cycles)', min: 1, max: 20 },
      { key: 'totalCycles', label: 'Total cycles', min: 1, max: 40 },
    ],
    build: (c) =>
      buildCycleSegments({
        focus: c.focus * 60,
        shortBreak: c.shortBreak * 60,
        longBreak: c.longBreak * 60,
        cyclesBeforeLongBreak: c.cyclesBeforeLongBreak,
        totalCycles: c.totalCycles,
      }),
    summarize: (c) => (c ? `${c.focus}m focus · ${c.shortBreak}m break · ${c.totalCycles}×` : null),
  },

  sitwalk: {
    id: 'sitwalk',
    name: 'Sit–Walk',
    tagline: 'Seated practice, walking between',
    blurb: 'Longer sitting broken by mindful walking — the traditional Vipassana rhythm. Sit, rise and walk slowly, then settle back down.',
    family: 'mindfulness',
    grad: 'sitwalk',
    cue: 'bell',
    Icon: IconSitWalk,
    defaults: { sit: 20, walk: 5, sits: 2 },
    fields: [
      { key: 'sit', label: 'Sit (min)', min: 1, max: 90 },
      { key: 'walk', label: 'Walk (min)', min: 1, max: 60 },
      { key: 'sits', label: 'Seated blocks', min: 1, max: 8 },
    ],
    build: (c) => buildSitWalkSegments({ sit: c.sit * 60, walk: c.walk * 60, sits: c.sits }),
    summarize: (c) => (c ? `${c.sit}m sit · ${c.walk}m walk · ${c.sits} sits` : null),
  },

  breath478: {
    id: 'breath478',
    name: '4-7-8 Breathing',
    tagline: 'Inhale 4 · hold 7 · exhale 8',
    blurb: 'A calming pranayama pattern: breathe in for four, hold for seven, and let a long eight-count exhale carry the tension out. A few rounds is plenty.',
    family: 'mindfulness',
    grad: 'breath478',
    cue: 'bell',
    Icon: IconBreath,
    defaults: { cycles: 4 },
    fields: [{ key: 'cycles', label: 'Breaths', min: 1, max: 20 }],
    build: (c) => build478Segments({ cycles: c.cycles }),
    summarize: (c) => (c ? `Inhale 4 · hold 7 · exhale 8 · ${c.cycles} breaths` : null),
  },

  box: {
    id: 'box',
    name: 'Box Breathing',
    tagline: 'Four even counts, all the way round',
    blurb: 'In, hold, out, hold — every side the same length. A steadying, evenly-paced breath used to settle the nervous system before or after effort.',
    family: 'mindfulness',
    grad: 'box',
    cue: 'bell',
    Icon: IconBox,
    defaults: { side: 4, cycles: 8 },
    fields: [
      { key: 'side', label: 'Each count (sec)', min: 3, max: 10 },
      { key: 'cycles', label: 'Rounds', min: 1, max: 40 },
    ],
    build: (c) => buildBoxSegments({ side: c.side, cycles: c.cycles }),
    summarize: (c) => (c ? `${c.side}-${c.side}-${c.side}-${c.side} · ${c.cycles} rounds` : null),
  },

  custom: {
    id: 'custom',
    name: 'Custom',
    tagline: 'Build your own sequence',
    blurb: 'Your own steps, in your own order — for anything the presets don’t cover: a stretch routine, a study ritual, a bedtime wind-down.',
    family: 'custom',
    grad: 'custom',
    cue: 'ding',
    Icon: IconCustom,
    isCustom: true,
    // Custom stores its saved config as the segment list itself, so summarize
    // reads that directly to show "what the last sequence is about".
    summarize: (segments) => {
      if (!segments || !segments.length) return null
      const labels = [...new Set(segments.map((s) => s.label))].slice(0, 3).join(' · ')
      const more = new Set(segments.map((s) => s.label)).size > 3 ? '…' : ''
      return `${segments.length} steps · ${formatMinutes(totalSeconds(segments))} · ${labels}${more}`
    },
  },
}

// Default panel order (movement → focus → custom → the three mindfulness practices).
export const DEFAULT_ORDER = ['rounds', 'cycles', 'custom', 'sitwalk', 'breath478', 'box']

// Reconcile a saved order with the current mode set: keep the saved order, drop
// unknown ids, and append any modes added since the order was saved.
export function reconcileOrder(saved) {
  const known = new Set(DEFAULT_ORDER)
  const kept = (saved || []).filter((id) => known.has(id))
  const missing = DEFAULT_ORDER.filter((id) => !kept.includes(id))
  return [...kept, ...missing]
}
