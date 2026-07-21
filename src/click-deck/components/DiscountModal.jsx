import React from 'react'

export function DiscountModal({ games, onClose }) {
  return (
    <div className="cd-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cd-modal-content cd-discount-modal cd-panel">
        <button className="cd-modal-close" onClick={onClose}>[X]</button>
        
        <h2 className="cd-modal-title">ACTIVE_STEAM_DISCOUNTS</h2>
        <p className="cd-text-muted">The following items from your backlog are currently on sale.</p>

        <div className="cd-discount-grid">
          {games.map(g => (
            <div key={g.id} className="cd-discount-card">
              <div className="cd-discount-cover">
                {g.coverUrl ? (
                  <img src={g.coverUrl} alt={g.title} />
                ) : (
                  <div className="fallback-cover">NO SIGNAL</div>
                )}
                {g.discountPercent > 0 && (
                  <div className="cd-discount-badge">
                    -{Math.round(g.discountPercent * 100)}%
                  </div>
                )}
              </div>
              <div className="cd-discount-info">
                <h4>{g.title}</h4>
                <div className="cd-discount-pricing">
                  {g.initialPrice !== null && g.initialPrice !== undefined && g.initialPrice > g.price && (
                    <span className="cd-price-original">${g.initialPrice.toFixed(2)}</span>
                  )}
                  <span className="cd-price-final">
                    {g.price === 0 ? 'FREE' : `$${g.price?.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .cd-discount-modal {
          max-width: 800px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .cd-discount-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }
        .cd-discount-card {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--cd-border-color);
          display: flex;
          flex-direction: column;
          transition: all 0.2s ease;
        }
        .cd-discount-card:hover {
          border-color: var(--cd-accent-cyan);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 229, 255, 0.1);
        }
        .cd-discount-cover {
          position: relative;
          height: 120px;
          width: 100%;
          border-bottom: 1px solid var(--cd-border-accent);
          overflow: hidden;
        }
        .cd-discount-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cd-discount-cover .fallback-cover {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: repeating-linear-gradient(0deg, #111, #111 2px, #222 2px, #222 4px);
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-amber);
          opacity: 0.5;
        }
        .cd-discount-badge {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: #4c6b22;
          color: #a4d007;
          font-family: var(--cd-font-terminal);
          font-weight: bold;
          font-size: 0.9rem;
          padding: 0.2rem 0.4rem;
          box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        .cd-discount-info {
          padding: 0.8rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .cd-discount-info h4 {
          margin: 0;
          font-family: var(--cd-font-sans);
          font-size: 0.95rem;
          color: var(--cd-text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cd-discount-pricing {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: auto;
        }
        .cd-price-original {
          text-decoration: line-through;
          color: var(--cd-text-muted);
          font-family: var(--cd-font-terminal);
          font-size: 0.8rem;
          opacity: 0.7;
        }
        .cd-price-final {
          color: var(--cd-accent-cyan);
          font-family: var(--cd-font-terminal);
          font-weight: bold;
          font-size: 1.1rem;
          text-shadow: 0 0 5px var(--cd-accent-cyan-glow);
        }
      `}</style>
    </div>
  )
}
