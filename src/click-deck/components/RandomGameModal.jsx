import React, { useState, useEffect } from 'react'

export function RandomGameModal({ backlogGames, onClose, onUpdateStatus }) {
  const [selectedGame, setSelectedGame] = useState(null)
  const [isRolling, setIsRolling] = useState(true)

  const roll = () => {
    if (backlogGames.length === 0) return
    setIsRolling(true)
    let rolls = 0
    const maxRolls = 15
    const interval = setInterval(() => {
      setSelectedGame(backlogGames[Math.floor(Math.random() * backlogGames.length)])
      rolls++
      if (rolls >= maxRolls) {
        clearInterval(interval)
        setIsRolling(false)
      }
    }, 100)
  }

  useEffect(() => {
    roll()
  }, [])

  if (backlogGames.length === 0) {
    return (
      <div className="cd-modal-overlay cd-view-transition" onClick={onClose}>
        <div className="cd-modal" onClick={e => e.stopPropagation()}>
          <div className="cd-modal-header">
            <h2>SYSTEM DIRECTIVE</h2>
            <button className="cd-btn-icon" onClick={onClose}>[X]</button>
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
          <h2>SYSTEM DIRECTIVE: NEXT PLAYTHROUGH</h2>
          <button className="cd-btn-icon" onClick={onClose}>[X]</button>
        </div>
        
        <div className="cd-random-content">
          {selectedGame ? (
            <div className={`cd-random-game ${isRolling ? 'rolling' : 'settled'}`}>
              <div className="cd-random-cover-wrapper">
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
              </div>
              
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
                onUpdateStatus(selectedGame.id, 'Playing', 0)
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
