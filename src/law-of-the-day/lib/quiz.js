import { shuffle } from './rotation'

const DECOY_COUNT = 3

// Correct law + 3 decoys sampled from its pool of 3-5 candidates, shuffled
// into a renderable option list. Sampling (rather than using the whole pool)
// keeps the option count consistent at 4 even though pools vary in size, and
// gives variety across repeat viewings when a law's pool has more than 3.
export function buildOptions(law, laws) {
  const decoyPool = law.decoyLawIds
    .map((id) => laws.find((l) => l.id === id))
    .filter(Boolean)
  const decoys = shuffle(decoyPool).slice(0, DECOY_COUNT)
  return shuffle([law, ...decoys]).map((l) => ({ id: l.id, title: l.lawTitle }))
}

export function gradeAnswer(selectedId, correctId) {
  return selectedId === correctId
}
