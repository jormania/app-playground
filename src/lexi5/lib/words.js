import { daysSinceEpoch } from './dateKey'
import { resolveDictionaryList, getCustomDictionaryEpoch } from './dictionaries'

/** Deterministic daily/endless word selection and its non-repeating cycle maths. */

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  return hash >>> 0
}

// Deterministic PRNG (mulberry32) so a shuffle is reproducible from a numeric seed
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shuffleCache = new Map()

// A deterministic shuffled permutation of a list's indices, reseeded automatically
// whenever the list's contents change OR when the list completes a full cycle. Deliberately
// takes a single cycleNumber and nothing else — see getWord for why Crown and Endless each
// compute the cycleNumber they pass in very differently, but both must funnel through this
// exact key format unchanged, since changing it reseeds every word this app has ever served
// under any cycleNumber that's still reachable (in-progress games and shared seed links
// re-derive their word from scratch on every load rather than persisting it).
function getShuffledOrder(list, cycleNumber = 0) {
  const key = `${list.length}:${hashString(list.join(','))}:cycle:${cycleNumber}`
  const cached = shuffleCache.get(key)
  if (cached) return cached

  const rand = mulberry32(hashString(key))
  const order = list.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  shuffleCache.set(key, order)
  return order
}

export function getWordProgress(dictionary = 'standard', dateString, iteration = 0) {
  const list = resolveDictionaryList(dictionary)
  const total = list.length

  let seq
  let cycleNumber

  if (iteration === 0) {
    const anchor = dictionary === 'custom' ? getCustomDictionaryEpoch() : 0
    seq = (daysSinceEpoch(dateString) - anchor)
    cycleNumber = Math.floor(seq / total)
  } else {
    // Endless mode's own lap count through the list, counted from its own first play
    // (iteration 1) rather than the calendar — so a handful of Endless plays doesn't look
    // like the whole list got exhausted (cycleNumber used to be offset by `total * 100`
    // for an unrelated reason — see getWord — which also made it always >= 100 here,
    // firing the staleness banner after just a couple of Endless games).
    seq = iteration - 1
    cycleNumber = Math.floor(seq / total)
  }

  const position = ((seq % total) + total) % total
  return { position, total, cycleNumber, justWrapped: position === 0 && cycleNumber > 0 }
}

// Deterministic word based on local date, dictionary, and iteration. Pure function of its
// inputs (needed so shared/seeded game links resolve to the same word), picking from a
// per-list shuffled order so words don't repeat until the whole list cycles.
export function getWord(dictionary = 'standard', dateString, iteration = 0) {
  const list = resolveDictionaryList(dictionary)
  const total = list.length

  if (iteration === 0) {
    const { position, cycleNumber } = getWordProgress(dictionary, dateString, iteration)
    const order = getShuffledOrder(list, cycleNumber)
    return list[order[position]]
  }

  // Endless (iteration > 0) deliberately does NOT reuse getWordProgress's (position,
  // cycleNumber) above — those were fixed to report Endless's real progress, which changes
  // the numbers for iteration > total. Word *selection* has to stay byte-for-byte identical
  // to how this app has always picked an Endless word instead, because it isn't persisted:
  // an in-progress Endless game (or a previously shared seed link — handleShareBoard encodes
  // iteration too) re-derives its word from scratch via this exact function on every load.
  // The `total * 100` offset was never actually the staleness bug — it already keeps
  // Endless's shuffle order from colliding with Crown's (Crown doesn't reach cycleNumber 100
  // for centuries on any real list size), so there was nothing to fix here.
  const legacySeq = (total * 100) + iteration
  const legacyCycleNumber = Math.floor(legacySeq / total)
  const legacyPosition = ((legacySeq % total) + total) % total
  const order = getShuffledOrder(list, legacyCycleNumber)
  return list[order[legacyPosition]]
}

export function parseSeed(seedStr) {
  try {
    const decoded = atob(seedStr)
    const [date, iterationStr, dictionary] = decoded.split('|')
    if (date && iterationStr && dictionary) {
      return { date, iteration: parseInt(iterationStr, 10), dictionary }
    }
  } catch (_e) {
    // ignore invalid seeds
  }
  return null
}

// Built once at module scope: this runs on every Enter, and `Array.includes` over
