import React, { useState, useEffect, useMemo } from 'react'
import { readReleaseStatus } from '../lib/releaseStatus'
import { StudiosConnector, tierBorderStyle } from '../lib/studios-connector'
import { getRecentlyReleasedGames, sortComingSoonSoonestFirst } from '../lib/releaseTracking'
import {
  refreshComingSoonGames, searchFollowedStudios, candidateToNewGame,
  candidateToIgnoredGame, unignoreGame, getIgnoredGames
} from '../lib/watchlistActions'

const STALE_DAYS = 180

// Cache the current search's candidates in sessionStorage so they survive a
// switch to another view (or a reload) within the same tab session — a
// "Find New Games" run is a real network round-trip you don't want to lose
// just by clicking [T] and back. Cleared on add (per candidate) and naturally
// gone when the tab closes.
function getCachedCandidates() {
  try {
    const data = sessionStorage.getItem('cd_watchlist_candidates')
    return data ? JSON.parse(data) : null
  } catch {
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
  } catch {
    // sessionStorage can throw (private mode / quota) — a lost cache is
    // harmless, the candidates still live in React state for this view.
  }
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

// Resolves what an unreleased game's expected-date line should say and how
// firm that date is — returns { label, kind } so the display string and its
// colour class stay decided in one place. `kind` drives only a colour shift
// on the line that's already there (no badges/icons): 'tba' muted, 'overdue'
// a warning red (the expected window already passed while it still sits
// Coming Soon — a delay Steam hasn't reflected, or a stale row), 'dated'
// the normal accent.
//
// A Steam "Coming soon" string is folded into the vague bucket alongside TBA
// and shown as just "Soon" — the section header already reads COMING SOON, so
// repeating it verbatim on every card is noise, and "soon" is no more
// concrete than TBA from a planning standpoint.
function formatExpected(game) {
  const raw = (game.releaseDate || '').trim().toLowerCase()
  if (!raw && !game.year) return { label: 'TBA', kind: 'tba' }
  if (raw === 'tba' || raw.includes('to be announced')) return { label: 'TBA', kind: 'tba' }
  if (raw === 'coming soon') return { label: 'Soon', kind: 'tba' }
  if (game.releaseDate) {
    // A bare 4-digit year ("2026") is one of the display strings Steam
    // returns when it only knows the year, not a specific date —
    // `new Date("2026")` silently parses that as January 1st, which then
    // reads as "overdue" the moment the calendar turns past New Year's Day
    // even though the actual expected window (the rest of that year)
    // hasn't passed. Treat a bare year the same as the year-only fallback
    // below: overdue only once the current year has moved past it, never
    // mid-year.
    if (/^\d{4}$/.test(game.releaseDate.trim())) {
      const year = parseInt(game.releaseDate.trim(), 10)
      return { label: game.releaseDate, kind: year < new Date().getFullYear() ? 'overdue' : 'dated' }
    }
    const parsed = new Date(game.releaseDate)
    if (!Number.isNaN(parsed.getTime())) {
      return { label: game.releaseDate, kind: parsed.getTime() < Date.now() ? 'overdue' : 'dated' }
    }
    return { label: game.releaseDate, kind: 'dated' }
  }
  return { label: String(game.year), kind: game.year < new Date().getFullYear() ? 'overdue' : 'dated' }
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Shared by the Coming Soon and Recently Released grids — a clickable cover
// (straight to the Steam store page, same as everywhere else in the app)
// with a hover overlay surfacing the Watchlist-specific data point that
// section cares about (expected vs. actual release date) rather than the
// price/rating overlay Analytics' gallery uses.
function WatchlistCover({ game, overlayLabel }) {
  const CoverTag = game.appId ? 'a' : 'div'
  const linkProps = game.appId
    ? { href: `https://store.steampowered.com/app/${game.appId}`, target: '_blank', rel: 'noopener noreferrer' }
    : {}
  return (
    <CoverTag className="cd-watchlist-cover-container" {...linkProps}>
      {game.coverUrl ? (
        <img
          className="cd-watchlist-card-cover"
          src={game.coverUrl}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.parentElement.classList.add('fallback-cover')
          }}
        />
      ) : (
        <div className="cd-watchlist-card-cover fallback-cover"></div>
      )}
      {game.appId && (
        <div className="cd-watchlist-cover-overlay">
          <span className="cd-watchlist-overlay-dev">{game.developer}</span>
          <span className="cd-watchlist-overlay-date">{overlayLabel}</span>
          <span className="cd-watchlist-overlay-cta">VIEW ON STEAM ↗</span>
        </div>
      )}
    </CoverTag>
  )
}

// The two [W] header actions are now small, quiet icon buttons — the daily
// cron does the real work, so discovery and a manual re-check are both
// optional nudges that shouldn't compete with the stat line. A magnifier
// (find new games) and a circular-arrows refresh (re-check Steam) read
// intuitively enough that they carry no label; the accessible name lives in
// aria-label/title instead.
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  )
}

// A small flourish for the Stats screen's "next up" watchlist metric —
// three dice-like pips that give the number a bit of anticipation without
// pulling in an icon library for one glyph.
export function DrumRollIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 20" width="48" height="20" aria-hidden="true">
      <circle cx="8" cy="10" r="6" fill="currentColor" opacity="0.4" />
      <circle cx="24" cy="10" r="7" fill="currentColor" opacity="0.7" />
      <circle cx="40" cy="10" r="6" fill="currentColor" />
    </svg>
  )
}

export function WatchlistView({ games, onEdit, onApplyGameUpdates, onAddGame, onToast }) {
  const [studios, setStudios] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [candidates, setCandidates] = useState(getCachedCandidates) // null = not searched yet this session
  const [addingAppId, setAddingAppId] = useState(null)
  const [ignoringAppId, setIgnoringAppId] = useState(null)
  const [unignoringId, setUnignoringId] = useState(null)
  const [showIgnored, setShowIgnored] = useState(false)

  useEffect(() => {
    StudiosConnector.getStudios().then(setStudios).catch(() => setStudios([]))
  }, [])

  const comingSoon = useMemo(
    () => sortComingSoonSoonestFirst(games.filter(g => readReleaseStatus(g) === 'Coming Soon')),
    [games]
  )
  const recentlyReleased = useMemo(() => getRecentlyReleasedGames(games), [games])
  const ignoredGames = useMemo(() => getIgnoredGames(games), [games])

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

  // Removes a candidate from both the local list and its sessionStorage cache
  // once it's been turned into a real DB row (added or ignored) — shared by
  // both handlers below so they can't drift on how that bookkeeping works.
  const dropCandidate = (appId) => {
    setCandidates(prev => {
      const next = prev && {
        notYetReleased: prev.notYetReleased.filter(c => c.appId !== appId),
        alreadyReleased: prev.alreadyReleased.filter(c => c.appId !== appId)
      }
      setCachedCandidates(next)
      return next
    })
  }

  const handleAddCandidate = async (candidate) => {
    setAddingAppId(candidate.appId)
    try {
      await onAddGame(candidateToNewGame(candidate))
      // The candidate already carries its cover, price, tags and (for
      // already-released titles) a description straight from the discovery
      // search, and the nightly pricing cron keeps price/cover current from
      // there — so no post-add enrichment step is needed. (An earlier
      // approach fired a serverless endpoint that shelled out to the Python
      // maintenance scripts; that never actually ran on Vercel, where a
      // function is frozen the moment it responds, and one of the scripts it
      // referenced isn't even deployed.)
      dropCandidate(candidate.appId)
    } catch (err) {
      onToast(`Add failed: ${err.message}`)
    }
    setAddingAppId(null)
  }

  const handleIgnoreCandidate = async (candidate) => {
    setIgnoringAppId(candidate.appId)
    try {
      await onAddGame(candidateToIgnoredGame(candidate))
      dropCandidate(candidate.appId)
      onToast(`Ignored "${candidate.title}" — it won't be suggested again, but you can still add it later from the IGNORED list below.`)
    } catch (err) {
      onToast(`Ignore failed: ${err.message}`)
    }
    setIgnoringAppId(null)
  }

  const handleUnignore = async (game) => {
    setUnignoringId(game.id)
    try {
      const updated = await unignoreGame(game)
      onApplyGameUpdates([updated])
      onToast(`"${game.title}" is back — now ${updated.releaseStatus === 'Coming Soon' ? 'tracked as Coming Soon' : 'in your collection'}.`)
    } catch (err) {
      onToast(`Couldn't restore "${game.title}": ${err.message}`)
    }
    setUnignoringId(null)
  }

  const handleExportIgnored = () => {
    const data = ignoredGames.map(g => ({
      title: g.title,
      developer: g.developer,
      appId: g.appId,
      releaseDate: g.releaseDate,
      year: g.year,
      ignoredAround: g.createdTime
    }))
    downloadBlob(JSON.stringify(data, null, 2), 'application/json', 'click_deck_ignored.json')
  }

  const renderCandidateRow = (candidate) => {
    const isDup = candidate.duplicate
    const isExactDup = isDup?.kind === 'exact'
    const isBusy = addingAppId === candidate.appId || ignoringAppId === candidate.appId
    return (
      <div
        key={candidate.appId}
        className={`cd-candidate-row ${isExactDup ? 'is-dup' : ''}`}
        style={tierBorderStyle(candidate.studioTier)}
        title={typeof candidate.studioTier === 'number' ? `${candidate.matchedStudio} — Personal Value Tier ${candidate.studioTier}` : undefined}
      >
        <div className="cd-candidate-cover-container">
          {candidate.headerImage ? (
            <img
              className="cd-candidate-cover"
              src={candidate.headerImage}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.classList.add('fallback-cover');
              }}
            />
          ) : (
            <div className="cd-candidate-cover fallback-cover"></div>
          )}
        </div>
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
            {/* `!= null` (not `!== null`) so a candidate with no price field at
                all — undefined, not just null — doesn't crash on .toFixed. */}
            {candidate.price != null ? ` · $${candidate.price.toFixed(2)}` : ''}
          </span>
          {isDup && (
            <span className={`cd-dup-flag ${isExactDup ? 'exact' : 'possible'}`}>
              {isExactDup ? `✓ ALREADY IN YOUR DB (${isDup.match.title})` : `⚠ POSSIBLE DUPLICATE — "${isDup.match.title}"?`}
            </span>
          )}
        </div>
        <div className="cd-candidate-actions">
          <button
            type="button"
            className="cd-btn-icon"
            disabled={isExactDup || isBusy}
            onClick={() => {
              if (isDup && !isExactDup) {
                if (!window.confirm(`This looks similar to "${isDup.match.title}" already in your collection. Add anyway?`)) return
              }
              handleAddCandidate(candidate)
            }}
          >
            {addingAppId === candidate.appId ? 'ADDING...' : isExactDup ? 'IN DB' : '+ ADD'}
          </button>
          {!isExactDup && (
            <button
              type="button"
              className="cd-btn-icon cd-btn-ignore"
              disabled={isBusy}
              onClick={() => handleIgnoreCandidate(candidate)}
            >
              {ignoringAppId === candidate.appId ? 'IGNORING...' : '− IGNORE'}
            </button>
          )}
        </div>
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
          <button
            type="button"
            className={`cd-watchlist-icon-btn ${isSearching ? 'is-busy' : ''}`}
            onClick={handleFindNewGames}
            disabled={isSearching}
            aria-label="Find new games from followed studios"
            title="Find new games"
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            className={`cd-watchlist-icon-btn ${isRefreshing ? 'is-busy' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh release dates"
            title="Refresh release dates"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {candidates && (candidates.notYetReleased.length > 0 || candidates.alreadyReleased.length > 0) && (
        <div className="cd-panel cd-watchlist-section">
          <h3>NEW CANDIDATES</h3>
          {candidates.notYetReleased.length > 0 && (
            <div className="cd-candidate-group">
              <h4 className="cd-watchlist-subheading">NOT YET RELEASED</h4>
              <div className="cd-candidate-list">{candidates.notYetReleased.map(renderCandidateRow)}</div>
            </div>
          )}
          {candidates.alreadyReleased.length > 0 && (
            <div className="cd-candidate-group cd-candidate-group-divided">
              <h4 className="cd-watchlist-subheading">ALREADY RELEASED, NOT IN YOUR COLLECTION</h4>
              <div className="cd-candidate-list">{candidates.alreadyReleased.map(renderCandidateRow)}</div>
            </div>
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
              const { label: expected, kind: dateKind } = formatExpected(game)
              return (
                <div key={game.id} className="cd-watchlist-card cd-panel">
                  <WatchlistCover game={game} overlayLabel={`🔭 ${expected}`} />
                  <div className="cd-watchlist-card-body">
                    <h4>{game.title}</h4>
                    <p className={`cd-watchlist-expected cd-expected-${dateKind}`}>
                      🔭 EXPECTED: {expected}{dateKind === 'overdue' && ' ⚠ (OVERDUE)'}
                    </p>
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
            {recentlyReleased.map(game => {
              const released = game.releaseDate || new Date(game.releasedAt).toLocaleDateString()
              return (
                <div key={game.id} className="cd-watchlist-card cd-panel">
                  <WatchlistCover game={game} overlayLabel={`✓ ${released}`} />
                  <div className="cd-watchlist-card-body">
                    <h4>{game.title}</h4>
                    <p className="cd-watchlist-released">✓ RELEASED: {released}</p>
                    <button type="button" className="cd-btn-icon" onClick={() => onEdit(game)}>[E]DIT</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="cd-panel cd-watchlist-section">
        <button
          type="button"
          className="cd-watchlist-ignored-toggle"
          onClick={() => setShowIgnored(v => !v)}
          aria-expanded={showIgnored}
        >
          <h3>{showIgnored ? '[−]' : '[+]'} IGNORED ({ignoredGames.length})</h3>
        </button>
        {showIgnored && (
          <>
            <p className="cd-text-muted">
              Games you declined from New Candidates. They stay out of future "Find New Games" results and out of the rest of the app, but never disappear — restore one any time.
            </p>
            {ignoredGames.length === 0 ? (
              <p className="cd-text-muted">Nothing ignored yet.</p>
            ) : (
              <>
                <div className="cd-candidate-list">
                  {ignoredGames.map(game => (
                    <div key={game.id} className="cd-candidate-row">
                      <div className="cd-candidate-cover-container">
                        {game.coverUrl ? (
                          <img className="cd-candidate-cover" src={game.coverUrl} alt="" loading="lazy"
                            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.classList.add('fallback-cover') }} />
                        ) : (
                          <div className="cd-candidate-cover fallback-cover"></div>
                        )}
                      </div>
                      <div className="cd-candidate-info">
                        <a
                          className="cd-candidate-title"
                          href={`https://store.steampowered.com/app/${game.appId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {game.title}
                        </a>
                        <span className="cd-candidate-meta">
                          {game.developer}{game.releaseDate ? ` · ${game.releaseDate}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="cd-btn-icon"
                        disabled={unignoringId === game.id}
                        onClick={() => handleUnignore(game)}
                      >
                        {unignoringId === game.id ? 'CHECKING...' : 'UN-IGNORE'}
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="cd-btn-icon" style={{ marginTop: '1rem' }} onClick={handleExportIgnored}>
                  [EXPORT IGNORED JSON]
                </button>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        .cd-watchlist {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        /* Stat line and the two optional action icons share one row — the
           numbers lead, the actions sit quietly at the far end. */
        .cd-watchlist-header {
          background: rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .cd-watchlist-stat-line {
          font-family: var(--cd-font-terminal);
          color: var(--cd-text-primary);
          margin: 0;
        }
        .cd-watchlist-stat-line strong {
          color: var(--cd-accent-cyan);
        }
        .cd-watchlist-actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        /* Deliberately understated: muted, borderless, no uppercase label —
           they should read as small utilities, not primary buttons. The
           global button styles are overridden here to strip the chrome. */
        .cd-watchlist-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.4rem;
          min-width: 0;
          border: 1px solid transparent;
          background: transparent;
          color: var(--cd-text-muted);
          box-shadow: none;
          cursor: pointer;
        }
        .cd-watchlist-icon-btn:hover:not(:disabled),
        .cd-watchlist-icon-btn:focus-visible {
          color: var(--cd-accent-cyan);
          border-color: var(--cd-border-color);
          box-shadow: none;
        }
        .cd-watchlist-icon-btn:disabled {
          cursor: default;
          opacity: 0.6;
        }
        .cd-watchlist-icon-btn.is-busy {
          color: var(--cd-accent-cyan);
        }
        .cd-watchlist-icon-btn.is-busy svg {
          animation: cdIconSpin 0.9s linear infinite;
        }
        @keyframes cdIconSpin {
          to { transform: rotate(360deg); }
        }
        .cd-watchlist-section h3 {
          margin-top: 0;
          border-bottom: 1px dashed var(--cd-border-color);
          padding-bottom: 0.5rem;
        }
        .cd-watchlist-subheading {
          color: var(--cd-accent-cyan);
          font-size: 0.85rem;
          margin: 0 0 0.5rem;
        }
        .cd-candidate-group + .cd-candidate-group-divided {
          margin-top: 1.75rem;
          padding-top: 1.5rem;
          border-top: 1px dashed var(--cd-border-color);
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
        .cd-candidate-cover-container {
          width: 80px;
          height: 38px;
          flex-shrink: 0;
          background: var(--cd-bg-steel);
        }
        .cd-candidate-cover-container.fallback-cover::before {
          font-size: 0.5rem;
          letter-spacing: 1px;
        }
        .cd-candidate-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
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
        .cd-candidate-actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        /* Deliberately NOT amber/cyan (those already mean "primary action" /
           "caution" elsewhere) and not --cd-status-abandoned (that's the
           possible-duplicate warning above) — a muted neutral by default,
           since declining a candidate isn't a success or a danger, then a
           themed red on hover/focus to signal "this removes it from view". */
        .cd-btn-ignore {
          color: var(--cd-text-muted);
          border-color: var(--cd-border-color);
        }
        .cd-btn-ignore:hover:not(:disabled), .cd-btn-ignore:focus-visible {
          color: var(--cd-status-abandoned);
          border-color: var(--cd-status-abandoned);
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
        .cd-watchlist-cover-container {
          display: block;
          position: relative;
          width: 100%;
          height: 90px;
          background: var(--cd-bg-steel);
          cursor: default;
        }
        a.cd-watchlist-cover-container {
          cursor: pointer;
        }
        .cd-watchlist-cover-container.fallback-cover::before {
          font-size: 1rem;
          letter-spacing: 2px;
        }
        .cd-watchlist-card-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cd-watchlist-cover-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 0.2rem;
          padding: 0.5rem;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        a.cd-watchlist-cover-container:hover .cd-watchlist-cover-overlay,
        a.cd-watchlist-cover-container:focus-visible .cd-watchlist-cover-overlay {
          opacity: 1;
        }
        .cd-watchlist-overlay-dev {
          font-size: 0.75rem;
          color: var(--cd-text-muted);
        }
        .cd-watchlist-overlay-date {
          font-family: var(--cd-font-terminal);
          font-size: 0.85rem;
          color: var(--cd-text-primary);
        }
        .cd-watchlist-overlay-cta {
          font-family: var(--cd-font-terminal);
          font-size: 0.7rem;
          color: var(--cd-accent-cyan);
          border-bottom: 1px dashed var(--cd-accent-cyan);
          margin-top: 0.2rem;
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
        .cd-expected-tba {
          color: var(--cd-text-muted);
        }
        .cd-expected-overdue {
          color: var(--cd-status-abandoned);
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
        .cd-watchlist-ignored-toggle {
          background: none;
          border: none;
          box-shadow: none;
          padding: 0;
          width: 100%;
          text-align: left;
          cursor: pointer;
        }
        .cd-watchlist-ignored-toggle h3 {
          margin: 0;
        }
      `}</style>
    </div>
  )
}
