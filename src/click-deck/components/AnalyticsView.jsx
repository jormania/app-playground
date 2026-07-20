import React, { useMemo } from 'react'

export function AnalyticsView({ games, filteredGames, activeTags, setActiveTags, searchQuery, setSearchQuery }) {
  
  // Calculate word cloud (tag frequencies)
  const tagCounts = useMemo(() => {
    const counts = {}
    games.forEach(g => {
      g.tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1
      })
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [games])

  const toggleTag = (tag) => {
    if (activeTags.includes(tag)) {
      setActiveTags(activeTags.filter(t => t !== tag))
    } else {
      setActiveTags([...activeTags, tag])
    }
  }

  return (
    <div className="cd-analytics">
      <div className="cd-filters cd-panel">
        <h3>SYS_QUERY_INTERFACE</h3>
        <input 
          type="text" 
          placeholder="SEARCH TITLE OR DEVELOPER..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="cd-search-input"
        />
        <div className="cd-active-filters">
          {activeTags.length > 0 && <span className="cd-filter-label">ACTIVE_TAGS:</span>}
          {activeTags.map(tag => (
            <button key={tag} className="cd-active-tag" onClick={() => toggleTag(tag)}>
              {tag} [X]
            </button>
          ))}
        </div>
      </div>

      <div className="cd-word-cloud cd-panel">
        <h3>GLOBAL_TAG_MATRIX</h3>
        <div className="cd-cloud-container">
          {tagCounts.map(([tag, count]) => {
            // Calculate a relative size class based on frequency
            const sizeClass = count > 5 ? 'cd-tag-xl' : count > 2 ? 'cd-tag-lg' : count > 1 ? 'cd-tag-md' : 'cd-tag-sm'
            const isActive = activeTags.includes(tag)
            return (
              <span 
                key={tag} 
                className={`cd-cloud-tag ${sizeClass} ${isActive ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag} <span className="cd-tag-count">({count})</span>
              </span>
            )
          })}
        </div>
      </div>
      
      <div className="cd-analytics-results">
        <p className="cd-results-count">MATCHING ENTRIES: {filteredGames.length}</p>
        {filteredGames.length === 0 && <p className="cd-text-muted">NO DATA FOUND MATCHING CURRENT PARAMETERS.</p>}
        {filteredGames.map(g => (
          <div key={g.id} className="cd-result-row">
            <span className="cd-result-year">{g.year}</span>
            <span className="cd-result-title">{g.title}</span>
            <span className="cd-result-status">[{g.status}]</span>
          </div>
        ))}
      </div>

      <style>{`
        .cd-analytics {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .cd-search-input {
          width: 100%;
          margin-bottom: 1rem;
          font-family: var(--cd-font-terminal);
          font-size: 1.2rem;
          padding: 0.8rem;
          text-transform: uppercase;
        }
        .cd-active-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        .cd-filter-label {
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-cyan);
        }
        .cd-active-tag {
          font-size: 0.8rem;
          background: var(--cd-accent-cyan-dim);
          border-color: var(--cd-accent-cyan);
          color: var(--cd-accent-cyan);
        }
        .cd-cloud-container {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: baseline;
          padding: 1rem;
          background: var(--cd-bg-dark);
          border: 1px inset var(--cd-border-color);
        }
        .cd-cloud-tag {
          cursor: pointer;
          font-family: var(--cd-font-sans);
          transition: all 0.2s ease;
          color: var(--cd-text-muted);
        }
        .cd-cloud-tag:hover {
          color: var(--cd-accent-cyan);
          text-shadow: 0 0 5px var(--cd-accent-cyan-glow);
        }
        .cd-cloud-tag.active {
          color: var(--cd-accent-amber);
          text-shadow: 0 0 5px var(--cd-accent-amber-glow);
          text-decoration: underline;
        }
        .cd-tag-count {
          font-size: 0.7em;
          opacity: 0.7;
        }
        .cd-tag-xl { font-size: 1.6rem; font-weight: bold; }
        .cd-tag-lg { font-size: 1.3rem; }
        .cd-tag-md { font-size: 1rem; }
        .cd-tag-sm { font-size: 0.8rem; }
        
        .cd-analytics-results {
          margin-top: 2rem;
        }
        .cd-results-count {
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-cyan);
          font-size: 1.2rem;
          border-bottom: 1px solid var(--cd-border-color);
          padding-bottom: 0.5rem;
        }
        .cd-result-row {
          display: flex;
          padding: 0.5rem;
          border-bottom: 1px dashed var(--cd-border-color);
          font-family: var(--cd-font-terminal);
          font-size: 1.1rem;
        }
        .cd-result-year {
          width: 4rem;
          color: var(--cd-text-muted);
        }
        .cd-result-title {
          flex: 1;
        }
        .cd-result-status {
          color: var(--cd-accent-cyan);
        }
      `}</style>
    </div>
  )
}
