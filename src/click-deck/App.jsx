import React, { useState, useEffect, useMemo } from 'react'
import { McpConnector } from './lib/mcp-connector'
import { TimelineView } from './components/TimelineView'
import { AnalyticsView } from './components/AnalyticsView'
import { StatsView } from './components/StatsView'
import { OnboardingWizard } from './components/OnboardingWizard'
import { GameEditorModal } from './components/GameEditorModal'
import { SettingsModal } from './components/SettingsModal'
import { DiscountModal } from './components/DiscountModal'

export function App() {
  const [isInitialized, setIsInitialized] = useState(McpConnector.isInitialized())
  const [games, setGames] = useState([])
  const [view, setView] = useState('timeline') // 'timeline', 'analytics'
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDiscountOpen, setIsDiscountOpen] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Analytics filters
  const [activeTags, setActiveTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('timeline')
  const [statusFilter, setStatusFilter] = useState('All')
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)

  const [toastMessage, setToastMessage] = useState(null)
  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          setIsEditorOpen(false)
          setIsSettingsOpen(false)
        }
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        document.querySelector('.cd-search-input-slim')?.focus()
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setEditingGame(null)
        setIsEditorOpen(true)
      } else if (e.key === 'Escape') {
        setIsEditorOpen(false)
        setIsSettingsOpen(false)
        setIsSortMenuOpen(false)
        setIsDiscountOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isSortMenuOpen && !e.target.closest('.cd-custom-select-container')) {
        setIsSortMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isSortMenuOpen])

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

    if (statusFilter !== 'All') {
      result = result.filter(g => g.status === statusFilter)
    }

    if (sortBy === 'timeline') {
      result.sort((a, b) => a.year - b.year)
    } else if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
    } else if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    } else if (sortBy === 'alpha') {
      result.sort((a, b) => a.title.localeCompare(b.title))
    }
    return result
  }, [games, searchQuery, activeTags, sortBy, statusFilter])

  const discountedGames = useMemo(() => {
    return games.filter(g => g.status === 'Backlog' && g.discountPercent > 0)
  }, [games])

  return (
    <div className="cd-app-container">
      <header className="cd-header">
        <div className="cd-header-top">
          <div className="cd-header-title">
            <img src="/click-deck-icon-192.png" alt="" className="cd-logo-icon" />
            <h1>Click Deck</h1>
          </div>
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
                showToast('NO BACKLOG GAMES FOUND.')
              }
            }}>[R]</button>
            <button className={view === 'stats' ? 'primary' : ''} onClick={() => setView('stats')}>[S]</button>
            <button onClick={() => setIsSettingsOpen(true)}>⚙</button>
          </nav>
        </div>

        {isInitialized && view !== 'stats' && (
          <div className="cd-header-controls">
            <input 
              type="text" 
              placeholder="SEARCH..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cd-search-input-slim"
            />
            {view === 'timeline' && (
              <div className="cd-custom-select-container">
                <button 
                  className="cd-sort-select-btn" 
                  onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                >
                  {sortBy === 'timeline' ? 'Timeline' : 
                   sortBy === 'recent' ? 'Recently Added' : 
                   sortBy === 'rating' ? 'Highest Rated' : 'Alphabetical'}
                  <span className="cd-chevron">▼</span>
                </button>
                {isSortMenuOpen && (
                  <div className="cd-sort-menu cd-panel">
                    <div className="cd-sort-group">--- TIME ---</div>
                    <button className={`cd-sort-option ${sortBy === 'timeline' ? 'active' : ''}`} onClick={() => { setSortBy('timeline'); setIsSortMenuOpen(false) }}>Timeline</button>
                    <button className={`cd-sort-option ${sortBy === 'recent' ? 'active' : ''}`} onClick={() => { setSortBy('recent'); setIsSortMenuOpen(false) }}>Recently Added</button>
                    
                    <div className="cd-sort-group">--- METRICS ---</div>
                    <button className={`cd-sort-option ${sortBy === 'rating' ? 'active' : ''}`} onClick={() => { setSortBy('rating'); setIsSortMenuOpen(false) }}>Highest Rated</button>
                    <button className={`cd-sort-option ${sortBy === 'alpha' ? 'active' : ''}`} onClick={() => { setSortBy('alpha'); setIsSortMenuOpen(false) }}>Alphabetical</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isInitialized && view === 'timeline' && (
          <div className="cd-status-filters-row">
            {['All', 'Backlog', 'Playing', 'Completed', 'Abandoned'].map(s => (
              <button 
                key={s} 
                className={`cd-status-chip ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'All' ? '[ALL]' : `[${s.toUpperCase()}]`}
                {s !== 'All' && <span className="cd-status-count">({games.filter(g => g.status === s).length})</span>}
              </button>
            ))}
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

      {discountedGames.length > 0 && view === 'timeline' && (
        <div className="cd-discount-banner" onClick={() => setIsDiscountOpen(true)}>
          <span className="cd-banner-icon">🔥</span>
          <span className="cd-banner-text">
            {discountedGames.length} {discountedGames.length === 1 ? 'GAME' : 'GAMES'} ON SALE!
          </span>
          <span className="cd-banner-cta">[VIEW DISCOUNTS]</span>
        </div>
      )}

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
          onToast={showToast}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)} 
          onResetDb={() => { setIsSettingsOpen(false); resetDb(); }}
        />
      )}

      {isDiscountOpen && (
        <DiscountModal 
          games={discountedGames} 
          onClose={() => setIsDiscountOpen(false)} 
        />
      )}

      {toastMessage && <div className="cd-toast">[{toastMessage}]</div>}

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
          margin-bottom: 1rem;
        }
        .cd-header-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .cd-logo-icon {
          width: 36px;
          height: 36px;
          border-radius: 6px;
        }
        .cd-header h1 {
          margin: 0;
          line-height: 1;
          font-size: 1.5rem;
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
        .cd-custom-select-container {
          position: relative;
          flex: 1;
          min-width: 0;
          width: auto;
        }
        .cd-sort-select-btn {
          background: var(--cd-bg-dark);
          color: var(--cd-accent-cyan);
          border: 1px solid var(--cd-border-color);
          padding: 0.5rem;
          outline: none;
          font-family: var(--cd-font-terminal);
          font-size: 0.9rem;
          width: 100%;
          text-align: left;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }
        .cd-sort-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--cd-bg-panel);
          border: 1px solid var(--cd-accent-cyan);
          z-index: 1000;
          margin-top: 4px;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .cd-sort-group {
          font-size: 0.75rem;
          color: var(--cd-text-muted);
          margin-top: 0.5rem;
          margin-bottom: 0.2rem;
        }
        .cd-sort-group:first-child {
          margin-top: 0;
        }
        .cd-sort-option {
          background: transparent;
          color: var(--cd-text-primary);
          border: none;
          padding: 0.4rem;
          text-align: left;
          font-family: var(--cd-font-terminal);
          font-size: 0.9rem;
          cursor: pointer;
          width: 100%;
        }
        .cd-sort-option:hover {
          background: rgba(0, 229, 255, 0.1);
        }
        .cd-sort-option.active {
          color: var(--cd-accent-cyan);
          background: rgba(0, 229, 255, 0.05);
        }
        .cd-status-filters-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.2rem;
        }
        .cd-status-chip {
          background: transparent;
          border: 1px solid var(--cd-border-color);
          color: var(--cd-text-muted);
          padding: 0.3rem 0.6rem;
          font-family: var(--cd-font-terminal);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .cd-status-chip:hover {
          color: var(--cd-accent-cyan);
          border-color: var(--cd-accent-cyan);
        }
        .cd-status-chip.active {
          background: rgba(0, 229, 255, 0.1);
          border-color: var(--cd-accent-cyan);
          color: var(--cd-accent-cyan);
        }
        .cd-status-count {
          margin-left: 0.3rem;
          opacity: 0.6;
        }
        .cd-nav {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .cd-nav button {
          padding: 0.3rem 0.5rem;
          font-size: 0.8rem;
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
            flex-direction: row;
            flex-wrap: nowrap;
          }
          .cd-search-input-slim,
          .cd-custom-select-container {
            flex: 1;
            width: 50%;
            min-width: 0;
          }
          .cd-nav {
            justify-content: space-between;
          }
          .cd-nav button {
            flex: 1;
            text-align: center;
          }
        }
        .cd-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: var(--cd-bg-panel);
          border: 1px solid var(--cd-accent-cyan);
          color: var(--cd-accent-cyan);
          padding: 1rem 1.5rem;
          font-family: var(--cd-font-terminal);
          z-index: 9999;
          box-shadow: 0 0 15px rgba(0, 229, 255, 0.2);
          animation: slideIn 0.3s ease-out forwards;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .cd-discount-banner {
          background: linear-gradient(90deg, rgba(76, 107, 34, 0.8), rgba(0, 0, 0, 0.6));
          border: 1px solid #a4d007;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          animation: pulseBanner 2s infinite alternate;
        }
        .cd-discount-banner:hover {
          background: linear-gradient(90deg, rgba(76, 107, 34, 1), rgba(0, 0, 0, 0.8));
          box-shadow: 0 0 15px rgba(164, 208, 7, 0.3);
          transform: translateY(-2px);
        }
        .cd-banner-icon {
          font-size: 1.2rem;
        }
        .cd-banner-text {
          font-family: var(--cd-font-terminal);
          color: #a4d007;
          font-weight: bold;
          font-size: 1rem;
          letter-spacing: 1px;
          flex: 1;
        }
        .cd-banner-cta {
          font-family: var(--cd-font-terminal);
          color: #a4d007;
          font-size: 0.8rem;
          border-bottom: 1px dashed #a4d007;
        }
        
        @keyframes pulseBanner {
          0% { box-shadow: 0 0 5px rgba(164, 208, 7, 0.1); }
          100% { box-shadow: 0 0 15px rgba(164, 208, 7, 0.4); }
        }
      `}</style>
    </div>
  )
}
