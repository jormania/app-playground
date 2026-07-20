import React from 'react'

export function GameCard({ game, onEdit, onUpdateStatus }) {
  const statusColors = {
    'Backlog': 'var(--cd-text-muted)',
    'Playing': 'var(--cd-accent-cyan)',
    'Completed': 'var(--cd-accent-amber)',
    'Abandoned': '#d9381e'
  }

  const getStatusColor = (status) => statusColors[status] || 'var(--cd-text-muted)'

  return (
    <div className="cd-panel cd-game-card">
      <div className="cd-game-header">
        <h3 className="cd-game-title">{game.title}</h3>
        <div className="cd-game-actions">
          <button className="cd-btn-icon" onClick={() => onEdit(game)}>[E]DIT</button>
        </div>
      </div>
      <div className="cd-game-meta">
        <span className="cd-developer">{game.developer}</span>
        <span className="cd-separator">|</span>
        <span className="cd-status" style={{ color: getStatusColor(game.status) }}>
          [{game.status}]
        </span>
        {game.status === 'Completed' && game.rating && (
          <>
            <span className="cd-separator">|</span>
            <span className="cd-rating">{'★'.repeat(game.rating)}{'☆'.repeat(5 - game.rating)}</span>
          </>
        )}
      </div>
      
      <div className="cd-tags">
        {game.tags.map(tag => (
          <span key={tag} className="cd-tag">{tag}</span>
        ))}
      </div>

      {game.journal && (
        <div className="cd-journal">
          <p>{game.journal}</p>
        </div>
      )}

      {/* Quick Status Update */}
      <div className="cd-quick-update">
        {['Backlog', 'Playing', 'Completed', 'Abandoned'].map(s => (
          <button 
            key={s} 
            className={`cd-quick-btn ${game.status === s ? 'active' : ''}`}
            onClick={() => onUpdateStatus(game.id, s, game.rating)}
          >
            {s}
          </button>
        ))}
      </div>

      <style>{`
        .cd-game-card {
          margin-bottom: 1rem;
          position: relative;
        }
        .cd-game-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        .cd-game-title {
          margin: 0;
          font-size: 1.8rem;
          line-height: 1.1;
        }
        .cd-btn-icon {
          font-size: 0.9rem;
          padding: 0.2rem 0.5rem;
          background: transparent;
          border: 1px solid var(--cd-border-color);
        }
        .cd-game-meta {
          font-family: var(--cd-font-terminal);
          color: var(--cd-text-muted);
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }
        .cd-separator {
          margin: 0 0.5rem;
          color: var(--cd-border-color);
        }
        .cd-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .cd-tag {
          font-size: 0.8rem;
          text-transform: uppercase;
          border: 1px solid var(--cd-border-accent);
          padding: 0.2rem 0.4rem;
          color: var(--cd-text-primary);
          background: rgba(0, 229, 255, 0.05);
        }
        .cd-journal {
          border-left: 2px solid var(--cd-accent-amber);
          padding-left: 1rem;
          margin-bottom: 1rem;
          color: var(--cd-text-muted);
          font-style: italic;
        }
        .cd-quick-update {
          display: flex;
          gap: 0.5rem;
          border-top: 1px solid var(--cd-border-color);
          padding-top: 0.8rem;
        }
        .cd-quick-btn {
          font-size: 0.8rem;
          padding: 0.2rem 0.5rem;
          background: transparent;
          color: var(--cd-text-muted);
        }
        .cd-quick-btn.active {
          color: var(--cd-accent-cyan);
          border-color: var(--cd-accent-cyan);
        }
      `}</style>
    </div>
  )
}
