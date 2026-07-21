import React, { useMemo } from 'react'

export function AnalyticsView({ games, filteredGames, activeTags, setActiveTags, searchQuery, setSearchQuery }) {
  
  // Calculate tag frequencies based on currently filtered games
  const tagCounts = useMemo(() => {
    const counts = {}
    filteredGames.forEach(g => {
      g.tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1
      })
    })
    // Ensure active tags are always rendered so they can be un-toggled
    activeTags.forEach(t => {
      if (counts[t] === undefined) counts[t] = 0
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [filteredGames, activeTags])

  const toggleTag = (tag) => {
    if (activeTags.includes(tag)) {
      setActiveTags(activeTags.filter(t => t !== tag))
    } else {
      setActiveTags([...activeTags, tag])
    }
  }

  const handleExportHtml = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Click Deck Export</title>
        <style>
          body { font-family: monospace; background: #111; color: #00e5ff; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #00e5ff; padding: 8px; text-align: left; }
          th { background: rgba(0, 229, 255, 0.2); }
        </style>
      </head>
      <body>
        <h2>Click Deck - Filtered Export</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Year</th>
              <th>Studio</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredGames.map(g => `
              <tr>
                <td>${g.title}</td>
                <td>${g.year || 'N/A'}</td>
                <td>${g.developer || 'N/A'}</td>
                <td>${g.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'click_deck_export.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="cd-analytics">
      {/* Global filters have been extracted to App.jsx */}

      <div className="cd-word-cloud cd-panel">
        <h3>TAG_MATRIX</h3>
        <div className="cd-cloud-container">
          {tagCounts.map(([tag, count]) => {
            const isActive = activeTags.includes(tag)
            const style = isActive ? {} : { opacity: count === 1 ? 0.7 : 1 }
            return (
              <span 
                key={tag} 
                className={`cd-cloud-tag ${isActive ? 'active' : ''}`}
                style={style}
                onClick={() => toggleTag(tag)}
              >
                {tag} <span className="cd-tag-count">({count})</span>
              </span>
            )
          })}
        </div>
      </div>
      
      <div className="cd-analytics-results">
        <div className="cd-results-header">
          <p className="cd-results-count">MATCHING ENTRIES: {filteredGames.length}</p>
          <button className="cd-btn-icon" onClick={handleExportHtml}>[EXPORT HTML]</button>
        </div>
        {filteredGames.length === 0 && <p className="cd-text-muted">NO DATA FOUND MATCHING CURRENT PARAMETERS.</p>}
        <div className="cd-gallery-grid">
          {filteredGames.map(g => (
            <div key={g.id} className="cd-gallery-item">
              {g.coverUrl ? (
                <img 
                  src={g.coverUrl} 
                  alt={g.title} 
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.classList.add('fallback-cover');
                  }} 
                />
              ) : (
                <div className="fallback-cover"></div>
              )}
              <div className="cd-gallery-overlay">
                <h4>{g.title}</h4>
                <span className="cd-gallery-status" style={{ color: `var(--cd-accent-${g.status === 'Completed' ? 'amber' : g.status === 'Playing' ? 'cyan' : g.status === 'Abandoned' ? 'red' : 'muted'})`}}>
                  [{g.status}]
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .cd-analytics {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .cd-cloud-container {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          padding: 1rem;
          background: var(--cd-bg-dark);
          border: 1px inset var(--cd-border-color);
          max-height: 250px;
          overflow-y: auto;
        }
        .cd-cloud-tag {
          cursor: pointer;
          font-family: var(--cd-font-terminal);
          font-size: 0.9rem;
          transition: all 0.2s ease;
          color: var(--cd-text-muted);
          background: rgba(0, 229, 255, 0.05);
          border: 1px solid var(--cd-border-color);
          padding: 0.3rem 0.6rem;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }
        .cd-cloud-tag:hover {
          color: var(--cd-accent-cyan);
          border-color: var(--cd-accent-cyan);
          background: rgba(0, 229, 255, 0.1);
        }
        .cd-cloud-tag.active {
          color: var(--cd-bg-panel);
          background: var(--cd-accent-amber);
          border-color: var(--cd-accent-amber);
          text-shadow: none;
          text-decoration: none;
        }
        .cd-tag-count {
          font-size: 0.8em;
          opacity: 0.8;
        }
        
        .cd-analytics-results {
          margin-top: 0.5rem;
        }
        .cd-results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--cd-border-color);
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        .cd-results-count {
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-cyan);
          font-size: 1.2rem;
          margin: 0;
        }
        .cd-btn-icon {
          font-family: var(--cd-font-terminal);
          background: transparent;
          color: var(--cd-accent-cyan);
          border: 1px solid var(--cd-accent-cyan);
          padding: 0.3rem 0.6rem;
          cursor: pointer;
        }
        .cd-btn-icon:hover {
          background: rgba(0, 229, 255, 0.1);
        }
        .cd-gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }
        .cd-gallery-item {
          position: relative;
          height: 100px;
          border: 1px solid var(--cd-border-accent);
          overflow: hidden;
          background: var(--cd-bg-dark);
        }
        .cd-gallery-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.3s ease;
        }
        .fallback-cover {
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(
            0deg,
            #111,
            #111 2px,
            #222 2px,
            #222 4px
          );
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fallback-cover::before {
          content: 'NO SIGNAL';
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-amber);
          font-size: 1rem;
          letter-spacing: 2px;
          opacity: 0.5;
        }
        .cd-gallery-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 0.5rem;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .cd-gallery-item:hover .cd-gallery-overlay {
          opacity: 1;
        }
        .cd-gallery-item:hover img {
          transform: scale(1.05);
        }
        .cd-gallery-overlay h4 {
          margin: 0 0 0.5rem 0;
          font-family: var(--cd-font-sans);
          font-size: 0.9rem;
          color: var(--cd-text-primary);
        }
        .cd-gallery-status {
          font-family: var(--cd-font-terminal);
          font-size: 0.8rem;
        }
        @media (max-width: 600px) {
          .cd-results-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }
          .cd-results-header .cd-btn-icon {
            width: 100%;
            text-align: center;
            padding: 0.6rem;
          }
        }
      `}</style>
    </div>
  )
}
