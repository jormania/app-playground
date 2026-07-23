import React, { useState, useEffect, useMemo, useRef } from 'react'
import { McpConnector } from './lib/mcp-connector'
import { readReleaseStatus, isIgnored as isIgnoredStatus, isActiveCollectionGame } from './lib/releaseStatus'
import { TimelineView } from './components/TimelineView'
import { AnalyticsView } from './components/AnalyticsView'
import { StatsView } from './components/StatsView'
import { WatchlistView } from './components/WatchlistView'
import { OnboardingWizard } from './components/OnboardingWizard'
import { GameEditorModal } from './components/GameEditorModal'
import { SettingsModal } from './components/SettingsModal'
import { DiscountModal } from './components/DiscountModal'
import { RandomGameModal } from './components/RandomGameModal'
import {
  isDiscountBannerSnoozed, snoozeDiscountBanner, detectPriceDrops,
  isDiscountBannerPersistent
} from './lib/priceTracking'
import {
  isReleaseBannerSnoozed, snoozeReleaseBanner, isReleaseBannerPersistent,
  getRecentlyReleasedGames, takeUnnudgedRecentlyReleased
} from './lib/releaseTracking'

const SORT_OPTIONS = [
  { value: 'timeline', label: 'Timeline', group: 'TIME' },
  { value: 'recent', label: 'Recently Added', group: 'TIME' },
  { value: 'rating', label: 'Highest Rated', group: 'METRICS' },
  { value: 'alpha', label: 'Alphabetical', group: 'METRICS' },
  { value: 'longest', label: 'Longest', group: 'METRICS' },
  { value: 'shortest', label: 'Shortest', group: 'METRICS' }
]
const STATUS_FILTERS = ['All', 'Backlog', 'Playing', 'Completed', 'Abandoned']

// Rating is a final verdict on a game you're actually done with — either
// played it through (Completed) or given up on it for good (Abandoned;
// "not my cup of tea" is itself a rating-worthy verdict). Moving OUT of
// both of those into Backlog/Playing clears a stale rating the same way
// leaving Completed clears Completed At, rather than silently carrying
// last time's rating onto a game that isn't actually judged anymore.
// Moving BETWEEN Completed and Abandoned keeps the rating — both are
// final-verdict states. Shared by handleUpdateStatus (GameCard's status
// pills, which always pass the game's own current rating unchanged) and
// handleSaveGame (the Editor, whose rating field just gets hidden — not
// cleared — once the picked status moves out of a final-verdict state).
const FINAL_VERDICT_STATUSES = new Set(['Completed', 'Abandoned'])
function resolveRatingOnStatusChange(prevStatus, nextStatus, requestedRating) {
  const wasFinalVerdict = FINAL_VERDICT_STATUSES.has(prevStatus)
  const isFinalVerdict = FINAL_VERDICT_STATUSES.has(nextStatus)
  return (wasFinalVerdict && !isFinalVerdict) ? null : requestedRating
}

export function App() {
  const [isInitialized, setIsInitialized] = useState(McpConnector.isInitialized())
  const [games, setGames] = useState([])
  const [view, setView] = useState('timeline') // 'timeline' | 'analytics' | 'stats' | 'watchlist'
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDiscountOpen, setIsDiscountOpen] = useState(false)
  const [isRandomOpen, setIsRandomOpen] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Analytics filters
  const [activeTags, setActiveTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  // Sort/status filter survive a reload (theme and CRT mode already did) —
  // guarded against a corrupted/stale localStorage value falling outside the
  // known option set.
  const [sortBy, setSortBy] = useState(() => {
    const saved = localStorage.getItem('cd_sort_by')
    return SORT_OPTIONS.some(o => o.value === saved) ? saved : 'timeline'
  })
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = localStorage.getItem('cd_status_filter')
    return STATUS_FILTERS.includes(saved) ? saved : 'All'
  })
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const sortMenuRef = useRef(null)
  const sortTriggerRef = useRef(null)

  const [toastMessage, setToastMessage] = useState(null)
  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const [isBannerSnoozed, setIsBannerSnoozed] = useState(() => isDiscountBannerSnoozed())
  const [isBannerPersistent, setIsBannerPersistent] = useState(() => isDiscountBannerPersistent())
  const dismissDiscountBanner = () => {
    snoozeDiscountBanner(24)
    setIsBannerSnoozed(true)
  }

  const [isReleaseSnoozed, setIsReleaseSnoozed] = useState(() => isReleaseBannerSnoozed())
  const [isReleasePersistent, setIsReleasePersistent] = useState(() => isReleaseBannerPersistent())
  const dismissReleaseBanner = () => {
    snoozeReleaseBanner(24)
    setIsReleaseSnoozed(true)
  }

  const [syncError, setSyncError] = useState(null)

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
        setIsRandomOpen(false)
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

  useEffect(() => { localStorage.setItem('cd_sort_by', sortBy) }, [sortBy])
  useEffect(() => { localStorage.setItem('cd_status_filter', statusFilter) }, [statusFilter])

  const selectSort = (value) => {
    setSortBy(value)
    setIsSortMenuOpen(false)
    // The button that was focused inside the menu is about to unmount —
    // move focus back to the trigger rather than letting it fall to <body>.
    sortTriggerRef.current?.focus()
  }

  const openSortMenu = () => {
    setIsSortMenuOpen(true)
    // Menu options render on the next tick; focus the currently-active one
    // (or the first) so arrow keys immediately have something to move from.
    requestAnimationFrame(() => {
      const buttons = sortMenuRef.current?.querySelectorAll('.cd-sort-option')
      if (!buttons || buttons.length === 0) return
      const activeIndex = SORT_OPTIONS.findIndex(o => o.value === sortBy)
      buttons[activeIndex >= 0 ? activeIndex : 0]?.focus()
    })
  }

  const handleSortTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openSortMenu()
    }
  }

  const handleSortMenuKeyDown = (e) => {
    const buttons = Array.from(sortMenuRef.current?.querySelectorAll('.cd-sort-option') || [])
    if (buttons.length === 0) return
    const currentIndex = buttons.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      buttons[(currentIndex + 1) % buttons.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      buttons[(currentIndex - 1 + buttons.length) % buttons.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      buttons[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      buttons[buttons.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsSortMenuOpen(false)
      sortTriggerRef.current?.focus()
    }
  }

  const loadGames = async () => {
    setIsLoading(true)
    try {
      const data = await McpConnector.getGames()
      setGames(data)
      setSyncError(null)

      // Compare against prices we've seen before (e.g. after last night's pricing
      // cron ran) and surface any drops — the cron itself has no way to reach an
      // open browser tab, so this is the client-side equivalent of a push.
      const drops = detectPriceDrops(data)
      if (drops.length > 0) {
        const label = drops.length === 1 ? drops[0].title : `${drops.length} GAMES`
        showToast(`PRICE DROP: ${label}`)
      }

      // One-time nudge per game the first time we see it as recently
      // released — closes the empty-tags/journal gap a Watchlist add leaves
      // behind, right when it's most relevant to fill in.
      const freshlyReleased = takeUnnudgedRecentlyReleased(data)
      if (freshlyReleased.length > 0) {
        const label = freshlyReleased.length === 1
          ? `🎉 ${freshlyReleased[0].title} just released — add tags & notes?`
          : `🎉 ${freshlyReleased.length} games just released — check [W] to add tags & notes.`
        showToast(label)
      }
    } catch (err) {
      // Distinct from "0 records found" — a bad token or a rate-limit previously
      // looked identical to a genuinely empty collection.
      setSyncError(err.message || 'Failed to reach Notion.')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    const savedTheme = typeof localStorage !== 'undefined' ? (localStorage.getItem('cd_theme') || 'union') : 'union'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  const [crtEffect, setCrtEffect] = useState(() => localStorage.getItem('cd_crt_effect') === 'true')
  useEffect(() => {
    document.documentElement.setAttribute('data-crt', crtEffect ? 'true' : 'false')
  }, [crtEffect])

  useEffect(() => {
    if (isInitialized) {
      loadGames()
    }
  }, [isInitialized])

  const handleOnboardingComplete = () => {
    McpConnector.initializeMockData()
    setIsInitialized(true)
  }

  // These three mutations used to end with a full loadGames() re-fetch of the
  // entire (paginated) collection just to reflect one edit — slow, and a visible
  // flicker as every card re-rendered. They now update local state immediately
  // and roll back with a toast if the underlying write actually fails.
  const handleSaveGame = async (gameData) => {
    const isNew = !gameData.id
    const previousGames = games
    const oldGame = !isNew ? previousGames.find(g => g.id === gameData.id) : null
    // The Editor's rating field is only hidden (not cleared) once the
    // picked status moves out of a final-verdict state — see
    // resolveRatingOnStatusChange's header comment. Without this, a save
    // that changes status away from Completed/Abandoned while the form
    // still holds the old rating value would silently carry it forward.
    // No-ops for a brand-new add (no oldGame to have "left" a status from).
    gameData = { ...gameData, rating: resolveRatingOnStatusChange(oldGame?.status, gameData.status, gameData.rating) }
    if (!isNew) {
      setGames(prev => prev.map(g => g.id === gameData.id ? { ...g, ...gameData } : g))
    }
    setIsEditorOpen(false)
    setEditingGame(null)
    try {
      if (!isNew) {
        await McpConnector.updateGame(gameData.id, gameData)
        // Only rewrite the page cover when it actually changed — otherwise a
        // routine edit (status, rating, tags) would needlessly re-PATCH the
        // cover on every save.
        if (gameData.coverUrl !== undefined && gameData.coverUrl !== oldGame?.coverUrl) {
          await McpConnector.updateGameCover(gameData.id, gameData.coverUrl)
        }
      } else {
        // addGame now sets the page cover in the creation payload itself, so
        // no separate updateGameCover round-trip is needed here. Guarantee the
        // cover is present in local state regardless of what Notion echoes back.
        const added = await McpConnector.addGame(gameData)
        setGames(prev => [...prev, { ...gameData, ...added, coverUrl: gameData.coverUrl || added.coverUrl || '' }])
      }
    } catch (err) {
      setGames(previousGames)
      showToast(`SAVE FAILED: ${err.message || 'unknown error'}`)
    }
  }

  const handleUpdateStatus = async (id, status, rating) => {
    const previousGames = games
    const prevGame = previousGames.find(g => g.id === id)
    const wasCompleted = prevGame?.status === 'Completed'
    const isCompleted = status === 'Completed'

    // Completed At is only ever stamped on an *observed* transition through
    // this exact code path — never on a direct add or Editor save of an
    // already-Completed game (same rule as Released At in
    // watchlistResolver.js). `undefined` means "leave it alone": only a
    // genuine Backlog/Playing/Abandoned <-> Completed flip writes anything,
    // and only once the schema patch is present (prevGame.completedAt !== undefined).
    let completedAt
    if (prevGame && prevGame.completedAt !== undefined) {
      if (!wasCompleted && isCompleted) completedAt = new Date().toISOString().slice(0, 10)
      else if (wasCompleted && !isCompleted) completedAt = null
    }

    // See resolveRatingOnStatusChange's header comment. GameCard's
    // status-pill buttons always pass the game's own current rating
    // unchanged, so without this a rating set once would linger forever;
    // the star-rating buttons never trigger the clearing branch — they
    // always pass the game's own current status.
    const nextRating = resolveRatingOnStatusChange(prevGame?.status, status, rating)

    setGames(prev => prev.map(g => g.id === id ? { ...g, status, rating: nextRating, ...(completedAt !== undefined ? { completedAt } : {}) } : g))
    try {
      await McpConnector.updateGameStatus(id, status, nextRating, completedAt)
    } catch (err) {
      setGames(previousGames)
      showToast(`UPDATE FAILED: ${err.message || 'unknown error'}`)
    }
  }

  const handleDeleteGame = async (id) => {
    const previousGames = games
    setGames(prev => prev.filter(g => g.id !== id))
    setIsEditorOpen(false)
    setEditingGame(null)
    try {
      await McpConnector.deleteGame(id)
    } catch (err) {
      setGames(previousGames)
      showToast(`DELETE FAILED: ${err.message || 'unknown error'}`)
    }
  }
  
  // Merges a batch of already-written game updates (from [W]'s "Refresh
  // Release Dates") into local state by id — the writes themselves already
  // happened in watchlistActions.js via the normal McpConnector.updateGame
  // path, this just avoids a full reload to reflect them.
  const handleApplyGameUpdates = (updatedGames) => {
    setGames(prev => {
      const byId = new Map(updatedGames.map(g => [g.id, g]))
      return prev.map(g => byId.has(g.id) ? { ...g, ...byId.get(g.id) } : g)
    })
  }



  // Ignored games (declined from [W]'s New Candidates) are hard-excluded here,
  // upstream of both Timeline and Analytics, so neither view can surface them
  // under any filter combination — unlike Coming Soon, which Analytics is
  // still allowed to optionally include via its own RELEASE: filter.
  const baseFilteredGames = useMemo(() => {
    let result = games.filter(g => !isIgnoredStatus(g))
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(g =>
        g.title.toLowerCase().includes(q) ||
        (g.developer && g.developer.toLowerCase().includes(q)) ||
        (g.tags && g.tags.some(t => t.toLowerCase().includes(q))) ||
        (g.journal && g.journal.toLowerCase().includes(q))
      )
    }
    if (activeTags.length > 0) {
      result = result.filter(g => 
        activeTags.every(t => g.tags.includes(t))
      )
    }
    return result
  }, [games, searchQuery, activeTags])

  const filteredGames = useMemo(() => {
    let result = [...baseFilteredGames]

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
    } else if (sortBy === 'longest') {
      // A game with no recorded length sorts last, not first — treating
      // "unknown" as if it were the longest would be misleading.
      result.sort((a, b) => (b.lengthHours ?? -1) - (a.lengthHours ?? -1))
    } else if (sortBy === 'shortest') {
      // Same "unknown sorts last" rule, mirrored for ascending order —
      // matches randomWeighting.js's convention of treating a missing value
      // as least-favored rather than excluding it outright.
      result.sort((a, b) => (a.lengthHours ?? Infinity) - (b.lengthHours ?? Infinity))
    }
    return result
  }, [baseFilteredGames, sortBy, statusFilter])

  // Timeline permanently excludes Coming Soon games — no toggle, a hard
  // rule (see project memory "click-deck-watchlist-plan"). [W] is the
  // dedicated home for anything not yet released; Analytics keeps its own
  // independent RELEASE: filter and is deliberately NOT restricted here, so
  // it can still optionally include Coming Soon in its queries.
  const timelineEligibleGames = useMemo(
    () => baseFilteredGames.filter(g => readReleaseStatus(g) !== 'Coming Soon'),
    [baseFilteredGames]
  )
  const timelineGames = useMemo(
    () => filteredGames.filter(g => readReleaseStatus(g) !== 'Coming Soon'),
    [filteredGames]
  )

  const discountedGames = useMemo(() => {
    return games.filter(g => g.status === 'Backlog' && g.discountPercent > 0)
  }, [games])

  const recentlyReleasedGames = useMemo(() => getRecentlyReleasedGames(games), [games])

  // Whether the Watchlist schema patch has been applied — a database-level
  // property, so if any loaded game carries the key, all of them do. Gates
  // whether the Editor offers the Release Status control at all (see its
  // own comment for why this matters for unpatched-schema safety).
  const watchlistSchemaReady = useMemo(() => games.some(g => g.releaseStatus !== undefined), [games])

  // Same database-level-property check as watchlistSchemaReady above, gating
  // whether the Editor offers the Completed At control at all.
  const completedAtSchemaReady = useMemo(() => games.some(g => g.completedAt !== undefined), [games])

  // Same check for the R2 Length (hrs) field.
  const lengthHoursSchemaReady = useMemo(() => games.some(g => g.lengthHours !== undefined), [games])

  return (
    <div className="cd-app-container">
      <header className="cd-header">
        <div className="cd-header-top">
          <div className="cd-header-title">
            <img src="/click-deck-logo.svg" alt="" className="cd-logo-icon" />
            <h1>Click Deck</h1>
          </div>
          <nav className="cd-nav">
            <button aria-label="Timeline view" className={view === 'timeline' ? 'primary' : ''} onClick={() => setView('timeline')}>[T]</button>
            <button aria-label="Analytics view" className={view === 'analytics' ? 'primary' : ''} onClick={() => setView('analytics')}>[A]</button>
            <button aria-label="Watchlist view" className={view === 'watchlist' ? 'primary' : ''} onClick={() => setView('watchlist')}>[W]</button>
            <button aria-label="Add new game" onClick={() => { setEditingGame(null); setIsEditorOpen(true) }}>+</button>
            <button aria-label="Random game from backlog" onClick={() => setIsRandomOpen(true)}>[R]</button>
            <button aria-label="Stats view" className={view === 'stats' ? 'primary' : ''} onClick={() => setView('stats')}>[S]</button>
            <button aria-label="Settings" onClick={() => setIsSettingsOpen(true)}>⚙</button>
          </nav>
        </div>

        {isInitialized && view !== 'stats' && view !== 'watchlist' && (
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
                  ref={sortTriggerRef}
                  className="cd-sort-select-btn"
                  aria-haspopup="menu"
                  aria-expanded={isSortMenuOpen}
                  onClick={() => (isSortMenuOpen ? setIsSortMenuOpen(false) : openSortMenu())}
                  onKeyDown={handleSortTriggerKeyDown}
                >
                  {SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Timeline'}
                  <span className="cd-chevron">▼</span>
                </button>
                {isSortMenuOpen && (
                  <div className="cd-sort-menu cd-panel" role="menu" ref={sortMenuRef} onKeyDown={handleSortMenuKeyDown}>
                    {['TIME', 'METRICS'].map(group => (
                      <React.Fragment key={group}>
                        <div className="cd-sort-group">--- {group} ---</div>
                        {SORT_OPTIONS.filter(o => o.group === group).map(opt => (
                          <button
                            key={opt.value}
                            role="menuitemradio"
                            aria-checked={sortBy === opt.value}
                            className={`cd-sort-option ${sortBy === opt.value ? 'active' : ''}`}
                            onClick={() => selectSort(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isInitialized && view === 'timeline' && (
          <div className="cd-status-filters-row">
            {STATUS_FILTERS.map(s => (
              <button 
                key={s} 
                className={`cd-status-chip ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'All' ? '[ALL]' : `[${s.toUpperCase()}]`}
                {s !== 'All' && <span className="cd-status-count">({timelineEligibleGames.filter(g => g.status === s).length})</span>}
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

      {discountedGames.length > 0 && (isBannerPersistent || !isBannerSnoozed) && view === 'timeline' && (
        <div className="cd-discount-banner">
          <span className="cd-banner-icon">🔥</span>
          <span className="cd-banner-text" onClick={() => setIsDiscountOpen(true)}>
            {discountedGames.length} {discountedGames.length === 1 ? 'GAME' : 'GAMES'} ON SALE!
          </span>
          <span className="cd-banner-cta" onClick={() => setIsDiscountOpen(true)}>[VIEW]</span>
          {/* Nothing to dismiss in persistent mode — hiding this avoids a button
              that would appear to do nothing (the banner just reappears). */}
          {!isBannerPersistent && (
            <button
              type="button"
              className="cd-banner-dismiss"
              onClick={(e) => { e.stopPropagation(); dismissDiscountBanner() }}
              aria-label="Dismiss for 24 hours"
            >
              [X]
            </button>
          )}
        </div>
      )}

      {recentlyReleasedGames.length > 0 && (isReleasePersistent || !isReleaseSnoozed) && view === 'timeline' && (
        <div className="cd-release-banner">
          <span className="cd-banner-icon">🎉</span>
          <span className="cd-banner-text cd-release-banner-text" onClick={() => setView('watchlist')}>
            {recentlyReleasedGames.length} {recentlyReleasedGames.length === 1 ? 'GAME' : 'GAMES'} JUST RELEASED!
          </span>
          <span className="cd-banner-cta cd-release-banner-cta" onClick={() => setView('watchlist')}>[VIEW]</span>
          {!isReleasePersistent && (
            <button
              type="button"
              className="cd-banner-dismiss cd-release-banner-dismiss"
              onClick={(e) => { e.stopPropagation(); dismissReleaseBanner() }}
              aria-label="Dismiss for 24 hours"
            >
              [X]
            </button>
          )}
        </div>
      )}

      {isInitialized && syncError && (
        // Distinct from "0 records found" — a bad token, a revoked integration,
        // or a rate-limit previously looked identical to a genuinely empty
        // collection. Shown as a banner (not a full-view replacement) so any
        // already-loaded data stays visible and usable underneath.
        <div className="cd-sync-error-banner cd-panel">
          <span className="cd-sync-error-icon">⚠</span>
          <span className="cd-sync-error-text">SYNC FAILED: {syncError} — check your token/database in Settings.</span>
          <button type="button" className="cd-btn-icon" onClick={loadGames}>[RETRY]</button>
        </div>
      )}

      <main className="cd-main">
        {!isInitialized ? (
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        ) : isLoading && games.length === 0 ? (
          <div className="cd-view-transition cd-empty-terminal cd-panel">
            <p className="cd-empty-line blink">&gt; QUERYING DATABASE...</p>
          </div>
        ) : syncError && games.length === 0 ? (
          // Nothing to fall back on — rendering the normal (empty) view here would
          // show "0 RECORDS FOUND", which reads as "your collection is empty"
          // rather than "the sync failed", directly contradicting the banner above.
          null
        ) : (
          <div key={view} className="cd-view-transition">
            {view === 'timeline' && (
              <div className="cd-timeline-container">
                <TimelineView
                  games={timelineGames}
                  onEdit={(g) => { setEditingGame(g); setIsEditorOpen(true) }}
                  onUpdateStatus={handleUpdateStatus}
                />
              </div>
            )}
            {view === 'analytics' && (
              <AnalyticsView
                filteredGames={filteredGames}
                activeTags={activeTags}
                setActiveTags={setActiveTags}
              />
            )}
            {view === 'watchlist' && (
              <WatchlistView
                games={games}
                onEdit={(g) => { setEditingGame(g); setIsEditorOpen(true) }}
                onApplyGameUpdates={handleApplyGameUpdates}
                onAddGame={handleSaveGame}
                onToast={showToast}
              />
            )}
            {view === 'stats' && (
              <div className="cd-timeline-container">
                {/* Coming Soon games have no real price and can't be played, and
                    Ignored games were explicitly declined — both excluded from
                    every stat here, same as Random Game below. */}
                <StatsView games={games.filter(isActiveCollectionGame)} watchlistGames={games} />
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
          watchlistSchemaReady={watchlistSchemaReady}
          completedAtSchemaReady={completedAtSchemaReady}
          lengthHoursSchemaReady={lengthHoursSchemaReady}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSaveToken={() => {
            // Credentials may have just been added/changed — re-evaluate whether
            // we're connected and pull fresh data so it takes effect without a reload.
            if (McpConnector.isInitialized()) {
              setIsInitialized(true)
              loadGames()
            }
            setIsBannerPersistent(isDiscountBannerPersistent())
            setIsReleasePersistent(isReleaseBannerPersistent())
            setCrtEffect(localStorage.getItem('cd_crt_effect') === 'true')
          }}
          onShowBannerNow={() => setIsBannerSnoozed(false)}
          onShowReleaseBannerNow={() => setIsReleaseSnoozed(false)}
        />
      )}

      {isDiscountOpen && (
        <DiscountModal 
          games={discountedGames} 
          onClose={() => setIsDiscountOpen(false)} 
        />
      )}

      {isRandomOpen && (
        <RandomGameModal
          backlogGames={games.filter(g => g.status === 'Backlog' && isActiveCollectionGame(g))}
          allGames={games}
          onClose={() => setIsRandomOpen(false)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {toastMessage && <div className="cd-toast">[{toastMessage}]</div>}

      {crtEffect && <div className="cd-crt-overlay" aria-hidden="true"></div>}

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
        
        .cd-sync-error-banner {
          background: rgba(217, 56, 30, 0.1);
          border-color: #d9381e;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .cd-sync-error-icon {
          font-size: 1.2rem;
          color: #d9381e;
        }
        .cd-sync-error-text {
          font-family: var(--cd-font-terminal);
          color: #d9381e;
          font-size: 0.9rem;
          flex: 1;
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
          transition: all 0.2s ease;
          animation: pulseBanner 2s infinite alternate;
        }
        .cd-banner-text, .cd-banner-cta {
          cursor: pointer;
        }
        .cd-banner-dismiss {
          background: transparent;
          border: 1px solid transparent;
          color: #a4d007;
          font-family: var(--cd-font-terminal);
          font-size: 0.8rem;
          padding: 0.1rem 0.4rem;
          opacity: 0.7;
        }
        .cd-banner-dismiss:hover {
          opacity: 1;
          border-color: #a4d007;
          color: #a4d007;
          box-shadow: none;
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
        @media (max-width: 600px) {
          .cd-discount-banner {
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
          }
          .cd-banner-icon {
            font-size: 1rem;
          }
          .cd-banner-text {
            font-size: 0.75rem;
            letter-spacing: 0.5px;
          }
          .cd-banner-cta {
            font-size: 0.7rem;
          }
        }

        @keyframes pulseBanner {
          0% { box-shadow: 0 0 5px rgba(164, 208, 7, 0.1); }
          100% { box-shadow: 0 0 15px rgba(164, 208, 7, 0.4); }
        }

        /* Release banner — same structure/animation as the discount banner
           above, but its own accent color and icon (🎉 vs 🔥) so the two are
           never visually confused, per feedback: "keep these 2 in sync from
           a styling perspective but use different SVGs and colours." */
        .cd-release-banner {
          background: linear-gradient(90deg, rgba(0, 229, 255, 0.25), rgba(0, 0, 0, 0.6));
          border: 1px solid var(--cd-accent-cyan);
          border-radius: 4px;
          padding: 0.5rem 1rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s ease;
          animation: pulseReleaseBanner 2s infinite alternate;
        }
        .cd-release-banner:hover {
          background: linear-gradient(90deg, rgba(0, 229, 255, 0.4), rgba(0, 0, 0, 0.8));
          box-shadow: 0 0 15px var(--cd-accent-cyan-glow);
          transform: translateY(-2px);
        }
        .cd-release-banner-text, .cd-release-banner-cta {
          color: var(--cd-accent-cyan);
        }
        .cd-release-banner-text {
          font-family: var(--cd-font-terminal);
          font-weight: bold;
          font-size: 1rem;
          letter-spacing: 1px;
          flex: 1;
          cursor: pointer;
        }
        .cd-release-banner-cta {
          font-family: var(--cd-font-terminal);
          font-size: 0.8rem;
          border-bottom: 1px dashed var(--cd-accent-cyan);
          cursor: pointer;
        }
        .cd-release-banner-dismiss {
          color: var(--cd-accent-cyan);
        }
        .cd-release-banner-dismiss:hover {
          border-color: var(--cd-accent-cyan);
          color: var(--cd-accent-cyan);
        }
        @keyframes pulseReleaseBanner {
          0% { box-shadow: 0 0 5px rgba(0, 229, 255, 0.1); }
          100% { box-shadow: 0 0 15px rgba(0, 229, 255, 0.4); }
        }
        @media (max-width: 600px) {
          .cd-release-banner {
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
          }
          .cd-release-banner-text {
            font-size: 0.75rem;
            letter-spacing: 0.5px;
          }
          .cd-release-banner-cta {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  )
}
