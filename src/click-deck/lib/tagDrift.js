// Guards against accidentally adding a near-duplicate to ALL_TAGS (seed-data.js)
// — e.g. "Point and Click" alongside the existing "Point & Click", or "Dark
// Humour" alongside "Dark Humor". Normalizes case/whitespace/punctuation so
// two spellings of the same underlying tag collapse to the same key, without
// being so aggressive that genuinely distinct tags (e.g. "History" vs
// "Historical") collapse together — those differ after stripping punctuation,
// so they correctly stay distinct.
export function normalizeTagForDriftCheck(tag) {
  if (!tag) return ''
  return tag.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
}

// Returns groups of 2+ tags from the given list that normalize to the same
// key — each group is a drift candidate worth a human look before either tag
// list is finalized. Empty array means no drift.
export function findNearDuplicateTags(tags) {
  const byKey = {}
  tags.forEach(tag => {
    const key = normalizeTagForDriftCheck(tag)
    if (!key) return
    if (!byKey[key]) byKey[key] = []
    byKey[key].push(tag)
  })
  return Object.values(byKey).filter(group => group.length > 1)
}
