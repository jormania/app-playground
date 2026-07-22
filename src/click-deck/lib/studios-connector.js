// The Followed Studios list backing the [W] Anteroom's "Find New Games"
// discovery — a small, separate Notion database (own DB id, `cd_studios_db_id`
// in localStorage) so it lives alongside the main Click Deck DB rather than
// inside it. Mirrors mcp-connector.js's shape (BYO token, real-Notion path +
// localStorage-only demo fallback) deliberately, for the same reasons.

const LOCAL_STORAGE_KEY = 'click_deck_mock_studios'

// The 11 studios named when this feature was designed. Seeded once on first
// init/demo-use; fully editable afterward from Settings — this is a starting
// point, not a fixed list.
export const SEED_STUDIOS = [
  'Wadjet Eye Games', 'Powerhoof', 'SFB Games', 'Color Gray Games',
  'The Brotherhood', 'Clifftop Games', 'Octavi Navarro', 'Cloak and Dagger Games',
  'Grundislav Games', 'Cosmo D Studios', 'Inkle'
]

function getToken() { return localStorage.getItem('cd_notion_token') }
function getStudiosDbId() { return localStorage.getItem('cd_studios_db_id') }

function getLocalStudios() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY)
  return data ? JSON.parse(data) : null
}
function saveLocalStudios(data) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
}

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

const mapPageToStudio = (page) => ({
  id: page.id,
  name: page.properties['Title']?.title?.[0]?.plain_text || '',
  // The exact Steam developer-tag string, when it differs from the friendly
  // name (the live collection already shows this ambiguity: "Wadjet Eye" vs
  // "Wadjet Eye Games", "Microids" vs "Microïds" vs "Microids Studio Paris") —
  // used by the discovery search to verify a candidate's actual Steam
  // developer/publisher field, not just a loose name search.
  steamDeveloper: page.properties['Steam Developer']?.rich_text?.map(rt => rt.plain_text).join('') || '',
  notes: page.properties['Notes']?.rich_text?.map(rt => rt.plain_text).join('') || '',
  // A plain number, not an enum — see normalizeTier's comment for why
  // nothing in this file assumes a fixed 1-3 scale.
  valueTier: typeof page.properties['Personal Value Tier']?.number === 'number'
    ? page.properties['Personal Value Tier'].number
    : null
})

const mapStudioToProperties = (studio) => ({
  'Title': { title: [{ text: { content: studio.name || 'Untitled' } }] },
  'Steam Developer': { rich_text: studio.steamDeveloper ? [{ text: { content: studio.steamDeveloper } }] : [] },
  'Notes': { rich_text: studio.notes ? [{ text: { content: studio.notes } }] : [] },
  'Personal Value Tier': { number: typeof studio.valueTier === 'number' ? studio.valueTier : null }
})

// A studio's Personal Value Tier is a weighting, not a fixed enum — Gabriel's
// current scale is 1 (opportunistic) to 3 (automatic follow), but nothing
// here should assume that ceiling. Missing/unset tiers (legacy seeded
// studios, or ones added before this field existed) rank below any studio
// that has been deliberately tiered, but above nothing — they still show up,
// just last.
export const DEFAULT_TIER_WEIGHT = 0
export const normalizeTier = (studio) =>
  typeof studio?.valueTier === 'number' && !Number.isNaN(studio.valueTier)
    ? studio.valueTier
    : DEFAULT_TIER_WEIGHT

async function fetchNotion(path, method = 'POST', body = null) {
  const token = getToken()
  if (!token) throw new Error('No Notion token')

  const payload = { path, method }
  if (body) payload.body = body

  const res = await fetch('/api/notion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-notion-token': token
    },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Notion API error')
  return data
}

export const StudiosConnector = {
  isInitialized: () => Boolean((getToken() && getStudiosDbId()) || getLocalStudios() !== null),

  hasRemoteDb: () => Boolean(getToken() && getStudiosDbId()),

  setDbId: (id) => localStorage.setItem('cd_studios_db_id', id),
  getDbId: getStudiosDbId,

  getStudios: async () => {
    const token = getToken()
    const dbId = getStudiosDbId()
    if (token && dbId) {
      let results = []
      let hasMore = true
      let cursor
      while (hasMore) {
        const data = await fetchNotion(`databases/${dbId}/query`, 'POST', cursor ? { start_cursor: cursor } : {})
        results = results.concat(data.results.map(mapPageToStudio))
        hasMore = data.has_more
        cursor = data.next_cursor
      }
      return results
    }
    return getLocalStudios() || []
  },

  // Seeds the 11 default studios only if the list is currently empty — safe
  // to call every time the Followed Studios panel opens, never duplicates.
  seedIfEmpty: async () => {
    const existing = await StudiosConnector.getStudios()
    if (existing.length > 0) return existing
    for (const name of SEED_STUDIOS) {
      await StudiosConnector.addStudio({ name, steamDeveloper: '', notes: '' })
    }
    return await StudiosConnector.getStudios()
  },

  addStudio: async (studio) => {
    const token = getToken()
    const dbId = getStudiosDbId()
    if (token && dbId) {
      const data = await fetchNotion('pages', 'POST', {
        parent: { database_id: dbId },
        properties: mapStudioToProperties(studio)
      })
      return mapPageToStudio(data)
    }
    const list = getLocalStudios() || []
    const newStudio = { id: uuidv4(), steamDeveloper: '', notes: '', valueTier: null, ...studio }
    list.push(newStudio)
    saveLocalStudios(list)
    return newStudio
  },

  // Edits an existing studio's name/Steam-developer-tag/notes/tier in place —
  // the "opinions about a studio change over time" path (a tier bumped up
  // after a great release, a typo fixed in the Steam developer tag) without
  // round-tripping through Notion's own UI.
  updateStudio: async (id, updates) => {
    const token = getToken()
    const dbId = getStudiosDbId()
    if (token && dbId) {
      const data = await fetchNotion(`pages/${id}`, 'PATCH', {
        properties: mapStudioToProperties(updates)
      })
      return mapPageToStudio(data)
    }
    const list = getLocalStudios() || []
    const idx = list.findIndex(s => s.id === id)
    if (idx === -1) throw new Error('Studio not found')
    list[idx] = { ...list[idx], ...updates }
    saveLocalStudios(list)
    return list[idx]
  },

  removeStudio: async (id) => {
    const token = getToken()
    const dbId = getStudiosDbId()
    if (token && dbId) {
      await fetchNotion(`pages/${id}`, 'PATCH', { archived: true })
      return { id, archived: true }
    }
    let list = getLocalStudios() || []
    list = list.filter(s => s.id !== id)
    saveLocalStudios(list)
    return { id, archived: true }
  },

  clearLocal: () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    localStorage.removeItem('cd_studios_db_id')
  }
}
