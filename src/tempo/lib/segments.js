let nextId = 0
function makeId(prefix) {
  nextId += 1
  return `${prefix}-${nextId}`
}

// Rounds mode covers both workout/circuit timers and Tabata — Tabata is just
// this generator called with {work: 20, rest: 10, rounds: 8}, not a separate
// code path.
export function buildRoundsSegments({ work, rest, rounds, warmup = 0, restAfterLast = false }) {
  if (!rounds || rounds <= 0) return []

  const segments = []
  if (warmup > 0) {
    segments.push({ id: makeId('warmup'), label: 'Warmup', seconds: warmup, kind: 'prepare' })
  }
  for (let round = 1; round <= rounds; round += 1) {
    segments.push({ id: makeId('work'), label: 'Work', seconds: work, kind: 'work' })
    const isLastRound = round === rounds
    if (!isLastRound || restAfterLast) {
      segments.push({ id: makeId('rest'), label: 'Rest', seconds: rest, kind: 'rest' })
    }
  }
  return segments
}

// Generic alternating focus/break generator — the Pomodoro Technique's 25/5/15
// numbers (long break every 4th cycle) are just this generator's default preset,
// the same way Tabata is Rounds' default preset. Named for the shape, not the technique.
export function buildCycleSegments({ focus, shortBreak, longBreak, cyclesBeforeLongBreak, totalCycles }) {
  if (!totalCycles || totalCycles <= 0) return []

  const segments = []
  for (let cycle = 1; cycle <= totalCycles; cycle += 1) {
    segments.push({ id: makeId('focus'), label: 'Focus', seconds: focus, kind: 'work' })
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
