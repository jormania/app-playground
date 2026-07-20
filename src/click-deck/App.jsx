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

  const loadGames = async () => {
    const data = await McpConnector.getGames()
    setGames(data)
  }

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
    } else {
      await McpConnector.addGame(gameData)
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
    // Sort chronologically
    result.sort((a, b) => a.year - b.year)
    return result
  }, [games, searchQuery, activeTags])

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
            [+] Add Game
          </button>
          <button onClick={() => setIsSettingsOpen(true)}>⚙ Settings</button>
          <button onClick={resetDb}>Reset DB</button>
        </nav>
      </header>

      <main className="cd-main">
        {!isInitialized ? (
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        ) : (
          <>
            {view === 'timeline' && (
              <TimelineView 
                games={filteredGames} 
                onEdit={(g) => { setEditingGame(g); setIsEditorOpen(true) }}
                onUpdateStatus={handleUpdateStatus}
              />
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
