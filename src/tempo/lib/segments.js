let nextId = 0
function makeId(prefix) {
  nextId += 1
  return `${prefix}-${nextId}`
}

// Every session is a flat list of { id, label, seconds, kind }. `kind` is
// cosmetic only — it drives the ring/label tint and nothing about timing.
// Vocabulary: prepare | active | rest | focus | sit | walk | inhale | hold | exhale.

// ── Rounds — movement intervals (a Tabata set is just its default preset). ──
export function buildRoundsSegments({ work, rest, rounds, warmup = 0, restAfterLast = false }) {
  if (!rounds || rounds <= 0) return []

  const segments = []
  if (warmup > 0) {
    segments.push({ id: makeId('warmup'), label: 'Warm-up', seconds: warmup, kind: 'prepare' })
  }
  for (let round = 1; round <= rounds; round += 1) {
    segments.push({ id: makeId('move'), label: 'Move', seconds: work, kind: 'active' })
    const isLastRound = round === rounds
    if (!isLastRound || restAfterLast) {
      segments.push({ id: makeId('rest'), label: 'Rest', seconds: rest, kind: 'rest' })
    }
  }
  return segments
}

// ── Cycles — focus/break blocks (the Pomodoro rhythm is its default preset). ─
export function buildCycleSegments({ focus, shortBreak, longBreak, cyclesBeforeLongBreak, totalCycles }) {
  if (!totalCycles || totalCycles <= 0) return []

  const segments = []
  for (let cycle = 1; cycle <= totalCycles; cycle += 1) {
    segments.push({ id: makeId('focus'), label: 'Focus', seconds: focus, kind: 'focus' })
    const isLastCycle = cycle === totalCycles
    if (!isLastCycle) {
      const isLongBreak = cyclesBeforeLongBreak > 0 && cycle % cyclesBeforeLongBreak === 0
      segments.push({
        id: makeId('break'),
        label: isLongBreak ? 'Long break' : 'Break',
        seconds: isLongBreak ? longBreak : shortBreak,
        kind: 'rest',
      })
    }
  }
  return segments
}

// ── Sit–Walk — a macro-cycle for longer sitting practice, with mindful
//    walking transitions between the seated blocks (Vipassana style). ────────
export function buildSitWalkSegments({ sit, walk, sits = 2 }) {
  if (!sits || sits <= 0) return []

  const segments = []
  for (let i = 1; i <= sits; i += 1) {
    segments.push({ id: makeId('sit'), label: 'Sit', seconds: sit, kind: 'sit' })
    if (i < sits) {
      segments.push({ id: makeId('walk'), label: 'Walk', seconds: walk, kind: 'walk' })
    }
  }
  return segments
}

// ── Repeating steps — the shared engine behind the breathing protocols.
//    `steps` is the breath template; it repeats `cycles` times. 4-7-8 and Box
//    Breathing are just two different step templates over this one builder. ──
export function buildRepeatingSegments({ steps, cycles }) {
  if (!cycles || cycles <= 0 || !steps || steps.length === 0) return []

  const segments = []
  for (let c = 1; c <= cycles; c += 1) {
    for (const step of steps) {
      segments.push({ id: makeId(step.kind), label: step.label, seconds: step.seconds, kind: step.kind })
    }
  }
  return segments
}

// 4-7-8: inhale 4 · hold 7 · exhale 8 (the durations are the protocol, fixed).
export function build478Segments({ cycles }) {
  return buildRepeatingSegments({
    cycles,
    steps: [
      { label: 'Inhale', seconds: 4, kind: 'inhale' },
      { label: 'Hold', seconds: 7, kind: 'hold' },
      { label: 'Exhale', seconds: 8, kind: 'exhale' },
    ],
  })
}

// Box breathing: four equal segments (inhale · hold · exhale · hold), `side` seconds each.
export function buildBoxSegments({ side, cycles }) {
  return buildRepeatingSegments({
    cycles,
    steps: [
      { label: 'Inhale', seconds: side, kind: 'inhale' },
      { label: 'Hold', seconds: side, kind: 'hold' },
      { label: 'Exhale', seconds: side, kind: 'exhale' },
      { label: 'Hold', seconds: side, kind: 'hold' },
    ],
  })
}
