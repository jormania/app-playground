import { shuffle } from './rotation'

const DECOY_COUNT = 3

function byIds(ids, laws) {
  return (ids || []).map((id) => laws.find((l) => l.id === id)).filter(Boolean)
}

// Distinct laws from `list`, dropping the correct law and any repeats.
function dedupe(list, excludeId) {
  const seen = new Set([excludeId])
  const out = []
  for (const law of list) {
    if (!seen.has(law.id)) {
      seen.add(law.id)
      out.push(law)
    }
  }
  return out
}

// Same-family laws other than the correct one — the pool of thematically
// adjacent, plausible distractors that makes the harder tiers hard.
function familyPool(law, laws) {
  if (!law.family) return []
  return laws.filter((l) => l.id !== law.id && l.family === law.family)
}

// If a tier couldn't find enough close distractors (e.g. a tiny family, or a
// law with few curated decoys), pad up to DECOY_COUNT from the rest of the deck
// so we always render a full set of options.
function topUp(decoys, law, laws) {
  if (decoys.length >= DECOY_COUNT) return decoys.slice(0, DECOY_COUNT)
  const used = new Set([law.id, ...decoys.map((d) => d.id)])
  const rest = shuffle(laws.filter((l) => !used.has(l.id)))
  return [...decoys, ...rest].slice(0, DECOY_COUNT)
}

// How tempting a candidate is as a wrong answer for the user, in [0, 2.5]. Laws
// they miss often — and ones they just got wrong — are stickier traps, so the
// extreme tier surfaces them. Exported for direct testing (jitter-free).
export function adaptiveBoost(id, history) {
  const entry = history && history[id]
  if (!entry) return 0
  const total = entry.correctCount + entry.incorrectCount
  const missRate = total > 0 ? entry.incorrectCount / total : 0
  const recentMiss = entry.lastAnsweredCorrect === false ? 1 : 0
  return missRate * 2 + recentMiss * 0.5
}

// STANDARD — the original behavior: sample from the law's fixed, hand-curated
// decoy pool. Deliberately no top-up, so a law with a short pool keeps its
// short option list exactly as before.
function standardDecoys(law, laws) {
  return shuffle(byIds(law.decoyLawIds, laws)).slice(0, DECOY_COUNT)
}

// COMPLEX — curated decoys ∪ same-family laws, sampled at random. Every wrong
// answer is now thematically adjacent (no throwaway options), and the pool is
// wide enough that repeat viewings rarely repeat the same trio.
function complexDecoys(law, laws) {
  const pool = dedupe([...byIds(law.decoyLawIds, laws), ...familyPool(law, laws)], law.id)
  return topUp(shuffle(pool).slice(0, DECOY_COUNT), law, laws)
}

// EXTREME — same close pool, but ranked hardest-first by confusability: curated
// nearest-neighbors weigh most, same-family next, and the user's personal
// miss-history nudges their weak spots to the top. A little jitter keeps it from
// being fully deterministic across repeats.
function extremeDecoys(law, laws, history) {
  const curatedIds = new Set(law.decoyLawIds || [])
  const pool = dedupe([...byIds(law.decoyLawIds, laws), ...familyPool(law, laws)], law.id)
  const scored = pool.map((cand) => ({
    cand,
    score:
      (curatedIds.has(cand.id) ? 3 : 0) +
      (cand.family === law.family ? 2 : 0) +
      adaptiveBoost(cand.id, history) +
      Math.random() * 0.6,
  }))
  scored.sort((a, b) => b.score - a.score)
  return topUp(scored.map((s) => s.cand).slice(0, DECOY_COUNT), law, laws)
}

// Builds the 4-option list for a law. Distractor difficulty is set by the tier;
// `history` is the per-law answer record (see storage.js) used by extreme.
export function buildOptions(law, laws, { difficulty = 'standard', history = {} } = {}) {
  let decoys
  if (difficulty === 'extreme') decoys = extremeDecoys(law, laws, history)
  else if (difficulty === 'complex') decoys = complexDecoys(law, laws)
  else decoys = standardDecoys(law, laws)
  return shuffle([law, ...decoys]).map((l) => ({ id: l.id, title: l.lawTitle }))
}

export function gradeAnswer(selectedId, correctId) {
  return selectedId === correctId
}
