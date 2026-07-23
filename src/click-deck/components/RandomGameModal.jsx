import React, { useState, useEffect } from 'react'
import { pickWeightedGame, COLD_START_MIN_RATED } from '../lib/randomWeighting'
import { hasReviewData } from '../lib/steamReviews'

export function RandomGameModal({ backlogGames, allGames = [], onClose, onUpdateStatus }) {
  const [selectedGame, setSelectedGame] = useState(null)
  const [isRolling, setIsRolling] = useState(true)
  // Settings → "Random pick weighting"; 'taste' (tag/studio affinity from
  // your rated history) is the R2 default — see randomWeighting.js's
  // COLD_START_MIN_RATED for the uniform fallback on a fresh collection.
  const weightMode = typeof localStorage !== 'undefined' ? (localStorage.getItem('cd_random_weight') || 'taste') : 'taste'
  // Only 'taste' mode reads this — the rated history to build tag/studio
  // affinity from, necessarily a different (mostly-Completed) pool than the
  // Backlog candidates being ranked.
  const ratedGames = allGames.filter(g => g.rating)

  const roll = () => {
    if (backlogGames.length === 0) return
    setIsRolling(true)
    let rolls = 0
    const maxRolls = 15
    const interval = setInterval(() => {
      setSelectedGame(pickWeightedGame(backlogGames, weightMode, Math.random, { ratedGames }))
      rolls++
      if (rolls >= maxRolls) {
        clearInterval(interval)
        setIsRolling(false)
      }
    }, 100)
  }

  // Intentionally mount-once: `roll` is re-created every render (it closes over
  // backlogGames), so including it would re-trigger the roll animation on every
  // parent re-render. [RE-ROLL] and the auto-roll-on-open both call the latest
  // closure directly, so staleness isn't a concern here.
  useEffect(() => {
    roll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (backlogGames.length === 0) {
    return (
      <div className="cd-modal-overlay cd-view-transition" onClick={onClose}>
        <div className="cd-modal" onClick={e => e.stopPropagation()}>
          <div className="cd-modal-header">
            <h2>SYSTEM DIRECTIVE</h2>
            <button className="cd-btn-icon" onClick={onClose} aria-label="Close">[X]</button>
          </div>
          <p className="cd-text-muted">NO GAMES FOUND IN BACKLOG. ADD GAMES OR CHANGE STATUS TO BEGIN.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cd-modal-overlay cd-view-transition" onClick={onClose}>
      <div className="cd-modal cd-random-modal" onClick={e => e.stopPropagation()}>
        <div className="cd-modal-header">
          <h2>
            <span className="cd-random-header-prefix">SYSTEM DIRECTIVE:</span><br/>
            NEXT PLAYTHROUGH
            {weightMode !== 'uniform' && (
              <span className="cd-random-weight-badge">
                {weightMode === 'oldest' ? 'FAVORING OLDEST BACKLOG'
                  : weightMode === 'cheapest' ? 'FAVORING CHEAPEST'
                  : weightMode === 'acclaimed'
                    ? (backlogGames.some(hasReviewData) ? 'FAVORING CRITICALLY ACCLAIMED' : 'FAVORING CRITICALLY ACCLAIMED (NO STEAM RATINGS CHECKED YET)')
                  : ratedGames.length < COLD_START_MIN_RATED ? 'FAVORING YOUR TASTE (COLD START — UNIFORM)'
                  : 'FAVORING YOUR TASTE'}
              </span>
            )}
          </h2>
          <button className="cd-btn-icon" onClick={onClose} aria-label="Close">[X]</button>
        </div>
        
        <div className="cd-random-content">
          {selectedGame ? (
            <div className={`cd-random-game ${isRolling ? 'rolling' : 'settled'}`}>
              {(() => {
                // A real <a> (rather than a div+onClick window.open()) so the link is a
                // genuine browser navigation — never popup-blocked, and works the same in
                // an installed PWA as in a regular tab. Plain div when there's no appId,
                // matching the timeline/analytics/discount covers.
                const CoverTag = selectedGame.appId ? 'a' : 'div'
                const linkProps = selectedGame.appId
                  ? { href: `https://store.steampowered.com/app/${selectedGame.appId}`, target: '_blank', rel: 'noopener noreferrer' }
                  : {}
                return (
                  <CoverTag className="cd-random-cover-wrapper" {...linkProps}>
                    {selectedGame.coverUrl ? (
                      <img
                        src={selectedGame.coverUrl}
                        alt={selectedGame.title}
                        className="cd-random-cover"
                      />
                    ) : (
                      <div className="cd-random-cover fallback-cover"></div>
                    )}
                    {selectedGame.isDiscounted && <div className="cd-sale-badge">SALE</div>}
                  </CoverTag>
                )
              })()}
              
              <h3 className="cd-random-title">{selectedGame.title}</h3>
              <p className="cd-developer cd-random-dev">{selectedGame.developer} | {selectedGame.year}</p>
              
              <div className="cd-random-tags">
                {selectedGame.tags.map(tag => (
                  <span key={tag} className="cd-tag">{tag}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="cd-random-placeholder">INITIALIZING SYSTEM LOGIC...</div>
          )}
        </div>

        <div className="cd-modal-actions cd-random-actions">
          <button 
            type="button" 
            className="cd-btn-outline" 
            onClick={roll} 
            disabled={isRolling}
          >
            [RE-ROLL]
          </button>
          <button 
            type="button" 
            className="cd-btn-primary" 
            disabled={isRolling || !selectedGame}
            onClick={() => {
              if (selectedGame) {
                // Preserve any existing rating rather than stamping a 0 onto a
                // 1–5 scale (backlog picks are simply unrated → null).
                onUpdateStatus(selectedGame.id, 'Playing', selectedGame.rating ?? null)
                onClose()
              }
            }}
          >
            [BEGIN PLAYTHROUGH]
          </button>
        </div>
      </div>
    </div>
  )
}
