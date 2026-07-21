import { PIVOT_TITLES } from './seed-data'

const LOCAL_STORAGE_KEY = 'click_deck_mock_db'

function getToken() { return localStorage.getItem('cd_notion_token') }
function getDbId() { return localStorage.getItem('cd_notion_db') }

function getLocalDb() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY)
  return data ? JSON.parse(data) : null
}
function saveLocalDb(data) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
}

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

// === Notion Mapping ===
const mapPageToGame = (page) => ({
  id: page.id,
  title: page.properties['Title']?.title?.[0]?.plain_text || 'Unknown',
  year: page.properties['Release Year']?.number || 0,
  developer: page.properties['Developer/Studio']?.select?.name || '',
  tags: page.properties['Tags']?.multi_select?.map(t => t.name) || [],
  status: page.properties['Status']?.select?.name || 'Backlog',
  rating: page.properties['Rating']?.number || null,
  journal: page.properties['Journal/Notes']?.rich_text?.map(rt => rt.plain_text).join('') || '',
  createdTime: page.created_time || new Date().toISOString(),
  coverUrl: page.cover?.external?.url || page.cover?.file?.url || ''
})

const mapGameToProperties = (game) => {
  const props = {
    'Title': { title: [{ text: { content: game.title || 'Untitled' } }] },
    'Release Year': { number: game.year ? parseInt(game.year) : null },
    'Status': { select: { name: game.status || 'Backlog' } }
  }
  if (game.developer) props['Developer/Studio'] = { select: { name: game.developer } }
  else props['Developer/Studio'] = { select: null }
  
  if (game.tags) props['Tags'] = { multi_select: game.tags.map(t => ({ name: t })) }
  
  if (game.rating) props['Rating'] = { number: parseInt(game.rating) }
  else props['Rating'] = { number: null }
  
  if (game.journal) props['Journal/Notes'] = { rich_text: [{ text: { content: game.journal } }] }
  else props['Journal/Notes'] = { rich_text: [] }
  
  return props
}

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

export const McpConnector = {
  isInitialized: () => {
    return (getToken() && getDbId()) || getLocalDb() !== null
  },
  
  initializeMockData: async () => {
    const token = getToken()
    const dbId = getDbId()

    if (token && dbId) {
      // Seed real Notion DB
      for (const game of PIVOT_TITLES) {
        await fetchNotion('pages', 'POST', {
          parent: { database_id: dbId },
          properties: mapGameToProperties(game)
        })
      }
      return true
    } else {
      // Seed local storage
      const initialGames = PIVOT_TITLES.map(game => ({ id: uuidv4(), ...game }))
      saveLocalDb(initialGames)
      return initialGames
    }
  },

  clearData: () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    localStorage.removeItem('cd_notion_token')
    localStorage.removeItem('cd_notion_db')
  },

  getGames: async () => {
    const token = getToken()
    const dbId = getDbId()
    
    if (token && dbId) {
      try {
        let results = []
        let hasMore = true
        let cursor = undefined
        while (hasMore) {
          const data = await fetchNotion(`databases/${dbId}/query`, 'POST', cursor ? { start_cursor: cursor } : {})
          results = results.concat(data.results.map(mapPageToGame))
          hasMore = data.has_more
          cursor = data.next_cursor
        }
        return results
      } catch (err) {
        console.error("Failed to load from Notion:", err)
        return []
      }
    } else {
      await new Promise(res => setTimeout(res, 300))
      return getLocalDb() || []
    }
  },

  addGame: async (gameData) => {
    const token = getToken()
    const dbId = getDbId()
    if (token && dbId) {
      const data = await fetchNotion('pages', 'POST', {
        parent: { database_id: dbId },
        properties: mapGameToProperties(gameData)
      })
      return mapPageToGame(data)
    } else {
      await new Promise(res => setTimeout(res, 300))
      const db = getLocalDb() || []
      const newGame = { id: uuidv4(), ...gameData }
      db.push(newGame)
      saveLocalDb(db)
      return newGame
    }
  },

  updateGameStatus: async (id, newStatus, newRating = null) => {
    const token = getToken()
    const dbId = getDbId()
    if (token && dbId) {
      const props = { 'Status': { select: { name: newStatus } } }
      if (newRating !== null) {
        props['Rating'] = { number: newRating }
      } else {
        props['Rating'] = { number: null }
      }
      const data = await fetchNotion(`pages/${id}`, 'PATCH', { properties: props })
      return mapPageToGame(data)
    } else {
      await new Promise(res => setTimeout(res, 300))
      const db = getLocalDb() || []
      const index = db.findIndex(g => g.id === id)
      if (index !== -1) {
        db[index].status = newStatus
        if (newRating !== null) db[index].rating = newRating
        saveLocalDb(db)
      }
      return db[index]
    }
  },
  updateGameCover: async (id, coverUrl) => {
    const token = getToken()
    const dbId = getDbId()
    if (token && dbId) {
      const data = await fetchNotion(`pages/${id}`, 'PATCH', {
        cover: {
          type: 'external',
          external: { url: coverUrl }
        }
      })
      return mapPageToGame(data)
    } else {
      await new Promise(res => setTimeout(res, 300))
      const db = getLocalDb() || []
      const index = db.findIndex(g => g.id === id)
      if (index !== -1) {
        db[index].coverUrl = coverUrl
        saveLocalDb(db)
      }
      return db[index]
    }
  },

  updateGame: async (id, gameData) => {
    const token = getToken()
    const dbId = getDbId()
    if (token && dbId) {
      const data = await fetchNotion(`pages/${id}`, 'PATCH', {
        properties: mapGameToProperties(gameData)
      })
      return mapPageToGame(data)
    } else {
      await new Promise(res => setTimeout(res, 300))
      const db = getLocalDb() || []
      const index = db.findIndex(g => g.id === id)
      if (index !== -1) {
        db[index] = { ...db[index], ...gameData }
        saveLocalDb(db)
      }
      return db[index]
    }
  },

  deleteGame: async (id) => {
    const token = getToken()
    const dbId = getDbId()
    if (token && dbId) {
      await fetchNotion(`pages/${id}`, 'PATCH', { archived: true })
      return { id, archived: true }
    } else {
      await new Promise(res => setTimeout(res, 300))
      let db = getLocalDb() || []
      db = db.filter(g => g.id !== id)
      saveLocalDb(db)
      return { id, archived: true }
    }
  }
}
