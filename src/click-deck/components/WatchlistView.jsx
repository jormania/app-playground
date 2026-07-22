import React, { useState, useEffect, useMemo } from 'react'
import { readReleaseStatus } from '../lib/releaseStatus'
import { StudiosConnector } from '../lib/studios-connector'
import { getRecentlyReleasedGames } from '../lib/releaseTracking'
import { refreshComingSoonGames, searchFollowedStudios, candidateToNewGame } from '../lib/watchlistActions'

const STALE_DAYS = 180

function getCachedCandidates() {
  try {
    const data = sessionStorage.getItem('cd_watchlist_candidates')
    return data ? JSON.parse(data) : null
  } catch (e) {
    return null
  }
}

function setCachedCandidates(data) {
  try {
    if (data) {
      sessionStorage.setItem('cd_watchlist_candidates', JSON.stringify(data))
    } else {
      sessionStorage.removeItem('cd_watchlist_candidates')
    }
  } catch (e) {}
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

function formatAge(days) {
  if (days === null) return 'never'
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

// Soonest-expected first: parsed year (nulls last), then the raw Steam date
// string as a tiebreak, then when it was added to the watchlist.
function sortComingSoon(games) {
  return [...games].sort((a, b) => {
    const yearA = a.year || Infinity
    const yearB = b.year || Infinity
    if (yearA !== yearB) return yearA - yearB
    const dateA = a.releaseDate || ''
    const dateB = b.releaseDate || ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return new Date(a.createdTime) - new Date(b.createdTime)
  })
}

export function WatchlistView({ games, onEdit, onApplyGameUpdates, onAddGame, onToast }) {
  const [studios, setStudios] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [candidates, setCandidates] = useState(getCachedCandidates) // null = not searched yet this session
  const [addingAppId, setAddingAppId] = useState(null)

  useEffect(() => {
    StudiosConnector.getStudios().then(setStudios).catch(() => setStudios([]))
  }, [])

  const comingSoon = useMemo(
    () => sortComingSoon(games.filter(g => readReleaseStatus(g) === 'Coming Soon')),
    [games]
  )
  const recentlyReleased = useMemo(() => getRecentlyReleasedGames(games), [games])

  const expectedThisYear = comingSoon.filter(g => g.year === new Date().getFullYear()).length

  const handleFindNewGames = async () => {
    if (studios.length === 0) {
      onToast('No followed studios yet — add some in Settings first.')
      return
    }
    setIsSearching(true)
    try {
      const result = await searchFollowedStudios(studios, games)
      setCachedCandidates(result)
      setCandidates(result)
      const total = result.notYetReleased.length + result.alreadyReleased.length
      onToast(total > 0 ? `Found ${total} candidate${total === 1 ? '' : 's'}.` : 'No new candidates found this time.')
    } catch (err) {
      onToast(`Search failed: ${err.message}`)
    }
    setIsSearching(false)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const { checked, flipped, updated } = await refreshComingSoonGames(games)
      if (updated.length > 0) onApplyGameUpdates(updated)
      if (checked === 0) {
        onToast('Nothing in Coming Soon to check.')
      } else if (flipped.length > 0) {
        onToast(`🎉 ${flipped.length} just released! Checked ${checked} total.`)
      } else {
        onToast(`Checked ${checked} — still coming soon.`)
      }
    } catch (err) {
      onToast(`Refresh failed: ${err.message}`)
    }
    setIsRefreshing(false)
  }

  const handleAddCandidate = async (candidate) => {
    setAddingAppId(candidate.appId)
    try {
      await onAddGame(candidateToNewGame(candidate))
      // Remove it from the local candidate list so it can't be added twice
      // in the same session without a fresh search.
      setCandidates(prev => {
        const next = prev && {
          notYetReleased: prev.notYetReleased.filter(c => c.appId !== candidate.appId),
          alreadyReleased: prev.alreadyReleased.filter(c => c.appId !== candidate.appId)
        }
        setCachedCandidates(next)
        return next
      })
    } catch (err) {
      onToast(`Add failed: ${err.message}`)
    }
    setAddingAppId(null)
  }

  const renderCandidateRow = (candidate) => {
    const isDup = candidate.duplicate
    const isExactDup = isDup?.kind === 'exact'
    return (
      <div key={candidate.appId} className={`cd-candidate-row ${isExactDup ? 'is-dup' : ''}`}>
        <img
          className="cd-candidate-cover"
          src={candidate.headerImage}
          alt=""
          loading="lazy"
          onError={(e) => { e.target.style.visibility = 'hidden' }}
        />
        <div className="cd-candidate-info">
          <a
            className="cd-candidate-title"
            href={`https://store.steampowered.com/app/${candidate.appId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {candidate.title}
          </a>
          <span className="cd-candidate-meta">
            {candidate.matchedStudio}
            {candidate.releaseDateString ? ` · ${candidate.releaseDateString}` : ''}
            {candidate.price !== null ? ` · $${candidate.price.toFixed(2)}` : ''}
          </span>
          {isDup && (
            <span className={`cd-dup-flag ${isExactDup ? 'exact' : 'possible'}`}>
              {isExactDup ? `✓ ALREADY IN YOUR DB (${isDup.match.title})` : `⚠ POSSIBLE DUPLICATE — "${isDup.match.title}"?`}
            </span>
          )}
        </div>
        <button
          type="button"
          className="cd-btn-icon"
          disabled={isExactDup || addingAppId === candidate.appId}
          onClick={() => {
            if (isDup && !isExactDup) {
              if (!window.confirm(`This looks similar to "${isDup.match.title}" already in your collection. Add anyway?`)) return
            }
            handleAddCandidate(candidate)
          }}
        >
          {addingAppId === candidate.appId ? 'ADDING...' : isExactDup ? 'IN DB' : '+ ADD'}
        </button>
      </div>
    )
  }

  return (
    <div className="cd-watchlist">
      <div className="cd-panel cd-watchlist-header">
        <p className="cd-watchlist-stat-line">
          <strong>{comingSoon.length}</strong> tracked ·{' '}
          <strong>{expectedThisYear}</strong> expected this year ·{' '}
          <strong>{recentlyReleased.length}</strong> just released
        </p>
        <div className="cd-watchlist-actions">
          <div className="cd-watchlist-action">
            <button type="button" onClick={handleFindNewGames} disabled={isSearching}>
              {isSearching ? 'SEARCHING...' : '🔭 FIND NEW GAMES'}
            </button>
            <span className="cd-watchlist-action-hint">Search followed studios for titles not yet in your collection.</span>
          </div>
          <div className="cd-watchlist-action">
            <button type="button" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? 'CHECKING...' : '🔄 REFRESH RELEASE DATES'}
            </button>
            <span className="cd-watchlist-action-hint">Re-check Steam for anything that has launched.</span>
          </div>
        </div>
      </div>

      {candidates && (candidates.notYetReleased.length > 0 || candidates.alreadyReleased.length > 0) && (
        <div className="cd-panel cd-watchlist-section">
          <h3>NEW CANDIDATES</h3>
          {candidates.notYetReleased.length > 0 && (
            <>
              <h4 className="cd-watchlist-subheading">NOT YET RELEASED</h4>
              <div className="cd-candidate-list">{candidates.notYetReleased.map(renderCandidateRow)}</div>
            </>
          )}
          {candidates.alreadyReleased.length > 0 && (
            <>
              <h4 className="cd-watchlist-subheading">ALREADY RELEASED, NOT IN YOUR COLLECTION</h4>
              <div className="cd-candidate-list">{candidates.alreadyReleased.map(renderCandidateRow)}</div>
            </>
          )}
        </div>
      )}
      {candidates && candidates.notYetReleased.length === 0 && candidates.alreadyReleased.length === 0 && (
        <div className="cd-panel cd-watchlist-section">
          <p className="cd-text-muted">No candidates found from your followed studios this time.</p>
        </div>
      )}

      <div className="cd-panel cd-watchlist-section">
        <h3>COMING SOON</h3>
        {comingSoon.length === 0 ? (
          <p className="cd-text-muted">Nothing tracked yet — add unreleased titles via "Find New Games" above, or the editor's Release Status field.</p>
        ) : (
          <div className="cd-watchlist-grid">
            {comingSoon.map(game => {
              const age = daysSince(game.priceUpdatedAt)
              const isStale = age !== null && age > STALE_DAYS
              return (
                <div key={game.id} className="cd-watchlist-card cd-panel">
                  {game.coverUrl && <img className="cd-watchlist-card-cover" src={game.coverUrl} alt="" loading="lazy" />}
                  <div className="cd-watchlist-card-body">
                    <h4>{game.title}</h4>
                    <p className="cd-watchlist-expected">🔭 EXPECTED: {game.releaseDate || (game.year ? String(game.year) : 'TBA')}</p>
                    <p className={`cd-watchlist-checked ${isStale ? 'stale' : ''}`}>
                      last checked: {formatAge(age)}{isStale ? ' — still unreleased' : ''}
                    </p>
                    <button type="button" className="cd-btn-icon" onClick={() => onEdit(game)}>[E]DIT</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="cd-panel cd-watchlist-section">
        <h3>RECENTLY RELEASED</h3>
        {recentlyReleased.length === 0 ? (
          <p className="cd-text-muted">Nothing has flipped from Coming Soon to Released in the last 365 days yet.</p>
        ) : (
          <div className="cd-watchlist-grid">
            {recentlyReleased.map(game => (
              <div key={game.id} className="cd-watchlist-card cd-panel">
                {game.coverUrl && <img className="cd-watchlist-card-cover" src={game.coverUrl} alt="" loading="lazy" />}
                <div className="cd-watchlist-card-body">
                  <h4>{game.title}</h4>
                  <p className="cd-watchlist-released">✓ RELEASED: {game.releaseDate || new Date(game.releasedAt).toLocaleDateString()}</p>
                  <button type="button" className="cd-btn-icon" onClick={() => onEdit(game)}>[E]DIT</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .cd-watchlist {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .cd-watchlist-header {
          background: rgba(0, 0, 0, 0.2);
        }
        .cd-watchlist-stat-line {
          font-family: var(--cd-font-terminal);
          color: var(--cd-text-primary);
          margin: 0 0 1rem;
        }
        .cd-watchlist-stat-line strong {
          color: var(--cd-accent-cyan);
        }
        .cd-watchlist-actions {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .cd-watchlist-action {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .cd-watchlist-action-hint {
          font-size: 0.8rem;
          color: var(--cd-text-muted);
        }
        .cd-watchlist-section h3 {
          margin-top: 0;
          border-bottom: 1px dashed var(--cd-border-color);
          padding-bottom: 0.5rem;
        }
        .cd-watchlist-subheading {
          color: var(--cd-accent-cyan);
          font-size: 0.85rem;
          margin: 1rem 0 0.5rem;
        }
        .cd-candidate-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .cd-candidate-row {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.5rem;
          border: 1px solid var(--cd-border-color);
          background: var(--cd-bg-dark);
        }
        .cd-candidate-row.is-dup {
          opacity: 0.7;
        }
        .cd-candidate-cover {
          width: 80px;
          height: 38px;
          object-fit: cover;
          flex-shrink: 0;
          background: var(--cd-bg-steel);
        }
        .cd-candidate-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .cd-candidate-title {
          color: var(--cd-accent-cyan);
          text-decoration: none;
          font-weight: bold;
        }
        .cd-candidate-title:hover {
          text-decoration: underline;
        }
        .cd-candidate-meta {
          font-size: 0.8rem;
          color: var(--cd-text-muted);
        }
        .cd-dup-flag {
          font-size: 0.75rem;
        }
        .cd-dup-flag.exact {
          color: var(--cd-accent-amber);
        }
        .cd-dup-flag.possible {
          color: var(--cd-status-abandoned);
        }
        .cd-watchlist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 1rem;
        }
        .cd-watchlist-card {
          padding: 0;
          overflow: hidden;
        }
        .cd-watchlist-card-cover {
          width: 100%;
          height: 90px;
          object-fit: cover;
          display: block;
        }
        .cd-watchlist-card-body {
          padding: 0.8rem;
        }
        .cd-watchlist-card-body h4 {
          margin: 0 0 0.4rem;
          color: var(--cd-text-primary);
          font-family: var(--cd-font-sans);
          font-size: 1rem;
        }
        .cd-watchlist-expected {
          color: var(--cd-accent-cyan);
          font-family: var(--cd-font-terminal);
          font-size: 0.85rem;
          margin: 0 0 0.3rem;
        }
        .cd-watchlist-released {
          color: var(--cd-accent-amber);
          font-family: var(--cd-font-terminal);
          font-size: 0.85rem;
          margin: 0 0 0.3rem;
        }
        .cd-watchlist-checked {
          font-size: 0.75rem;
          color: var(--cd-text-muted);
          margin: 0 0 0.6rem;
        }
        .cd-watchlist-checked.stale {
          color: var(--cd-accent-amber);
        }
      `}</style>
    </div>
  )
}
