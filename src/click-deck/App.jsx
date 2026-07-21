import React, { useState, useEffect, useMemo } from 'react'
import { McpConnector } from './lib/mcp-connector'
import { TimelineView } from './components/TimelineView'
import { AnalyticsView } from './components/AnalyticsView'
import { StatsView } from './components/StatsView'
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
  const [isLoading, setIsLoading] = useState(false)
  
  // Analytics filters
  const [activeTags, setActiveTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('timeline')

  const loadGames = async () => {
    setIsLoading(true)
    const data = await McpConnector.getGames()
    setGames(data)
    setIsLoading(false)
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

  const handleDeleteGame = async (id) => {
    await McpConnector.deleteGame(id)
    await loadGames()
    setIsEditorOpen(false)
    setEditingGame(null)
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
        <div className="cd-header-top">
          <h1>Click Deck</h1>
          <nav className="cd-nav">
            <button className={view === 'timeline' ? 'primary' : ''} onClick={() => setView('timeline')}>[T]</button>
            <button className={view === 'analytics' ? 'primary' : ''} onClick={() => setView('analytics')}>[A]</button>
            <button onClick={() => { setEditingGame(null); setIsEditorOpen(true) }}>+</button>
            <button onClick={() => {
              const backlogGames = games.filter(g => g.status === 'Backlog')
              if (backlogGames.length > 0) {
                const randomGame = backlogGames[Math.floor(Math.random() * backlogGames.length)]
                setEditingGame(randomGame)
                setIsEditorOpen(true)
              } else {
                alert('NO BACKLOG GAMES FOUND.')
              }
            }}>[R]</button>
            <button className={view === 'stats' ? 'primary' : ''} onClick={() => setView('stats')}>[S]</button>
            <button onClick={() => setIsSettingsOpen(true)}>⚙</button>
          </nav>
        </div>

        {isInitialized && (
          <div className="cd-header-controls">
            <input 
              type="text" 
              placeholder="SEARCH..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cd-search-input-slim"
            />
            {view === 'timeline' && (
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)}
                className="cd-sort-select-slim"
              >
                <option value="timeline">Timeline (By Year)</option>
                <option value="recent">Recently Added</option>
                <option value="status_backlog">Status: Backlog ({games.filter(g => g.status === 'Backlog').length})</option>
                <option value="status_playing">Status: Playing ({games.filter(g => g.status === 'Playing').length})</option>
                <option value="status_completed">Status: Completed ({games.filter(g => g.status === 'Completed').length})</option>
                <option value="status_abandoned">Status: Abandoned ({games.filter(g => g.status === 'Abandoned').length})</option>
              </select>
            )}
          </div>
        )}
        
        {isInitialized && activeTags.length > 0 && (
          <div className="cd-active-filters-slim">
            <span className="cd-filter-label">ACTIVE_TAGS:</span>
            {activeTags.map(tag => (
              <button key={tag} className="cd-active-tag" onClick={() => setActiveTags(activeTags.filter(t => t !== tag))}>
                {tag} [X]
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="cd-main">
        {!isInitialized ? (
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        ) : isLoading && games.length === 0 ? (
          <div className="cd-view-transition cd-empty-terminal cd-panel">
            <p className="cd-empty-line blink">&gt; QUERYING DATABASE...</p>
          </div>
        ) : (
          <div key={view} className="cd-view-transition">
            {view === 'timeline' && (
              <div className="cd-timeline-container">
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
            {view === 'stats' && (
              <div className="cd-timeline-container">
                <StatsView games={games} />
              </div>
            )}
          </div>
        )}
      </main>

      {isEditorOpen && (
        <GameEditorModal 
          game={editingGame} 
          onSave={handleSaveGame} 
          onDelete={handleDeleteGame}
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
          flex-direction: column;
          gap: 0.8rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--cd-border-color);
          padding-bottom: 0.8rem;
        }
        .cd-header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .cd-header h1 {
          margin: 0;
          line-height: 1;
          font-size: 1.8rem;
          letter-spacing: 2px;
        }
        .cd-header-controls {
          display: flex;
          gap: 0.5rem;
          width: 100%;
        }
        .cd-search-input-slim {
          flex: 1;
          font-family: var(--cd-font-terminal);
          font-size: 1rem;
          padding: 0.5rem 0.8rem;
          text-transform: uppercase;
          background: rgba(0, 0, 0, 0.2);
          color: var(--cd-text-primary);
          border: 1px solid var(--cd-border-color);
          outline: none;
        }
        .cd-search-input-slim:focus {
          border-color: var(--cd-accent-cyan);
        }
        .cd-sort-select-slim {
          background: var(--cd-bg-dark);
          color: var(--cd-accent-cyan);
          border: 1px solid var(--cd-border-color);
          padding: 0.5rem;
          outline: none;
          font-family: var(--cd-font-terminal);
          font-size: 0.9rem;
        }
        .cd-nav {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .cd-nav button {
          padding: 0.4rem 0.6rem;
          font-size: 0.9rem;
        }
        .cd-active-filters-slim {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          margin-top: 0.2rem;
        }
        .cd-filter-label {
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-cyan);
          font-size: 0.8rem;
        }
        .cd-active-tag {
          font-size: 0.7rem;
          background: var(--cd-accent-cyan-dim);
          border-color: var(--cd-accent-cyan);
          color: var(--cd-accent-cyan);
          padding: 0.2rem 0.4rem;
        }
        @media (max-width: 600px) {
          .cd-header-top {
            flex-direction: column;
            align-items: stretch;
          }
          .cd-header-controls {
            flex-direction: column;
          }
          .cd-nav {
            justify-content: space-between;
          }
          .cd-nav button {
            flex: 1;
            text-align: center;
          }
        }
      `}</style>
    </div>
  )
}
