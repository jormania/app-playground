import React, { useState, useEffect, useMemo } from 'react'
import { McpConnector } from './lib/mcp-connector'
import { TimelineView } from './components/TimelineView'
import { AnalyticsView } from './components/AnalyticsView'
import { OnboardingWizard } from './components/OnboardingWizard'
import { GameEditorModal } from './components/GameEditorModal'
import { SettingsModal } from './components/SettingsModal'

export function App() {
  const [isInitialized, setIsInitialized] = useState(McpConnector.isInitialized())
  const [games, setGames] = useState([])
  const [view, setView] = useState('timeline') // 'timeline', 'analytics'
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  
  // Analytics filters
  const [activeTags, setActiveTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('timeline')

  const loadGames = async () => {
    const data = await McpConnector.getGames()
    setGames(data)
  }

  useEffect(() => {
    const savedTheme = typeof localStorage !== 'undefined' ? (localStorage.getItem('cd_theme') || 'union') : 'union'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  useEffect(() => {
    if (isInitialized) {
      loadGames()
    }
  }, [isInitialized])

  const handleOnboardingComplete = () => {
    McpConnector.initializeMockData()
    setIsInitialized(true)
  }

  const handleSaveGame = async (gameData) => {
    if (gameData.id) {
      await McpConnector.updateGame(gameData.id, gameData)
      if (gameData.coverUrl !== undefined) {
        await McpConnector.updateGameCover(gameData.id, gameData.coverUrl)
      }
    } else {
      const added = await McpConnector.addGame(gameData)
      if (gameData.coverUrl) {
        await McpConnector.updateGameCover(added.id, gameData.coverUrl)
      }
    }
    await loadGames()
    setIsEditorOpen(false)
    setEditingGame(null)
  }

  const handleUpdateStatus = async (id, status, rating) => {
    await McpConnector.updateGameStatus(id, status, rating)
    await loadGames()
  }
  
  const resetDb = () => {
    McpConnector.clearData()
    setIsInitialized(false)
    setGames([])
  }



  const filteredGames = useMemo(() => {
    let result = [...games]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(g => 
        g.title.toLowerCase().includes(q) || 
        g.developer.toLowerCase().includes(q)
      )
    }
    if (activeTags.length > 0) {
      result = result.filter(g => 
        activeTags.every(t => g.tags.includes(t))
      )
    }
    if (sortBy.startsWith('status_')) {
      const targetStatus = sortBy.split('_')[1]
      result = result.filter(g => g.status.toLowerCase() === targetStatus)
      result.sort((a, b) => a.year - b.year)
    } else if (sortBy === 'timeline') {
      result.sort((a, b) => a.year - b.year)
    } else if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
    }
    return result
  }, [games, searchQuery, activeTags, sortBy])

  return (
    <div className="cd-app-container">
      <header className="cd-header">
        <h1>Click Deck</h1>
        <nav className="cd-nav">
          <button 
            className={view === 'timeline' ? 'primary' : ''} 
            onClick={() => setView('timeline')}
          >
            Timeline
          </button>
          <button 
            className={view === 'analytics' ? 'primary' : ''} 
            onClick={() => setView('analytics')}
          >
            Analytics
          </button>
          <button onClick={() => {
            setEditingGame(null)
            setIsEditorOpen(true)
          }}>
            +
          </button>
          <button onClick={() => {
            const backlogGames = games.filter(g => g.status === 'Backlog')
            if (backlogGames.length > 0) {
              const randomGame = backlogGames[Math.floor(Math.random() * backlogGames.length)]
              setEditingGame(randomGame)
              setIsEditorOpen(true)
            }
          }}>
            [R]ANDOM
          </button>
          <button onClick={() => setIsSettingsOpen(true)}>⚙</button>
        </nav>
      </header>

      {isInitialized && (
        <div className="cd-global-toolbar cd-panel">
          <input 
            type="text" 
            placeholder="SEARCH DATABASE..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cd-search-input"
          />
          <div className="cd-active-filters">
            {activeTags.length > 0 && <span className="cd-filter-label">ACTIVE_TAGS:</span>}
            {activeTags.map(tag => (
              <button key={tag} className="cd-active-tag" onClick={() => setActiveTags(activeTags.filter(t => t !== tag))}>
                {tag} [X]
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="cd-main">
        {!isInitialized ? (
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        ) : (
          <>
            {view === 'timeline' && (
              <div className="cd-timeline-container">
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem', borderBottom: '1px solid var(--cd-border-color)' }}>
                  <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value)}
                    style={{ background: 'var(--cd-bg-panel)', color: 'var(--cd-accent-cyan)', border: '1px solid var(--cd-border-color)', padding: '0.5rem', outline: 'none', fontFamily: 'var(--cd-font-terminal)' }}
                  >
                    <option value="timeline">Timeline (By Year)</option>
                    <option value="recent">Recently Added</option>
                    <option value="status_backlog">Status: Backlog ({games.filter(g => g.status === 'Backlog').length})</option>
                    <option value="status_playing">Status: Playing ({games.filter(g => g.status === 'Playing').length})</option>
                    <option value="status_completed">Status: Completed ({games.filter(g => g.status === 'Completed').length})</option>
                    <option value="status_abandoned">Status: Abandoned ({games.filter(g => g.status === 'Abandoned').length})</option>
                  </select>
                </div>
                <TimelineView 
                  games={filteredGames} 
                  onEdit={(g) => { setEditingGame(g); setIsEditorOpen(true) }}
                  onUpdateStatus={handleUpdateStatus}
                />
              </div>
            )}
            {view === 'analytics' && (
              <AnalyticsView 
                games={games} 
                filteredGames={filteredGames}
                activeTags={activeTags}
                setActiveTags={setActiveTags}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
          </>
        )}
      </main>

      {isEditorOpen && (
        <GameEditorModal 
          game={editingGame} 
          onSave={handleSaveGame} 
          onClose={() => { setIsEditorOpen(false); setEditingGame(null) }} 
        />
      )}

      {isSettingsOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)} 
          onResetDb={() => { setIsSettingsOpen(false); resetDb(); }}
        />
      )}

      <style>{`
        .cd-app-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }
        .cd-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          border-bottom: 2px solid var(--cd-border-color);
          padding-bottom: 1rem;
        }
        .cd-global-toolbar {
          margin-bottom: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .cd-search-input {
          width: 100%;
          font-family: var(--cd-font-terminal);
          font-size: 1.2rem;
          padding: 0.8rem;
          text-transform: uppercase;
        }
        .cd-active-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        .cd-filter-label {
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-cyan);
        }
        .cd-active-tag {
          font-size: 0.8rem;
          background: var(--cd-accent-cyan-dim);
          border-color: var(--cd-accent-cyan);
          color: var(--cd-accent-cyan);
        }
        .cd-header h1 {
          margin: 0;
          line-height: 1;
        }
        .cd-nav {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        @media (max-width: 768px) {
          .cd-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .cd-nav {
            flex-wrap: wrap;
            width: 100%;
          }
          .cd-nav button {
            flex: 1;
            font-size: 1rem;
            padding: 0.5rem;
            text-align: center;
          }
        }
      `}</style>
    </div>
  )
}
