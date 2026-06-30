// Pure stats over the whole journal. Deliberately descriptive, never evaluative:
// no streaks, no scores, no "you missed a day" — those would reimport the
// gratitude-log pressure the practice avoids. Just counts and averages.
import { wordCount } from './notion.js'
import { todayKey, keyToDate } from './dates.js'

function words(entry) {
  // Prefer Notion's saved formula value; fall back to a live count of the text.
  return entry.wordCount != null ? entry.wordCount : wordCount(entry.entry)
}

// Every distinct value in `field`, with its count, most-frequent first (ties
// alphabetical). Returns ALL of them — the Stats panel renders these as a
// frequency heatmap, so nothing is sliced off (a rare tag/person staying visible
// is the whole point). `limit` is available for callers that want a top-N.
function rankCounts(entries, field, limit = Infinity) {
  const counts = new Map()
  for (const e of entries) {
    for (const name of e[field] || []) counts.set(name, (counts.get(name) || 0) + 1)
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))
  return Number.isFinite(limit) ? ranked.slice(0, limit) : ranked
}

export function computeStats(entries, today = new Date()) {
  const list = (entries || []).filter(e => e && e.date)
  const total = list.length
  if (total === 0) {
    return {
      total: 0, last7: 0, avgWords: 0, totalWords: 0,
      daysSinceFirst: null, longest: 0, shortest: 0, topTags: [], topPeople: [],
    }
  }

  // entries dated within the trailing 7 days (including today)
  const todayDate = keyToDate(todayKey(today))
  const weekAgo = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 6)
  const last7 = list.filter(e => {
    const d = keyToDate(e.date)
    return d && d >= weekAgo && d <= todayDate
  }).length

  const wordList = list.map(words)
  const totalWords = wordList.reduce((a, b) => a + b, 0)
  const avgWords = Math.round(totalWords / total)

  const earliest = list.reduce((min, e) => (e.date < min ? e.date : min), list[0].date)
  const firstDate = keyToDate(earliest)
  const daysSinceFirst = firstDate
    ? Math.round((todayDate - firstDate) / 86400000)
    : null

  return {
    total,
    last7,
    avgWords,
    totalWords,
    daysSinceFirst,
    longest: Math.max(...wordList),
    shortest: Math.min(...wordList),
    topTags: rankCounts(list, 'tags'),
    topPeople: rankCounts(list, 'people'),
  }
}
