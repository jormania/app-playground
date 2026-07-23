import React, { useMemo, useState } from 'react'
import { readReleaseStatus } from '../lib/releaseStatus'
import { isCompletedWithinDays, COMPLETION_WINDOWS } from '../lib/completionTracking'
import { isInLengthBucket } from '../lib/lengthBuckets'
import { isInReviewBucket, REVIEW_BUCKETS } from '../lib/steamReviews'

export function AnalyticsView({ filteredGames, activeTags, setActiveTags }) {

  const [priceFilter, setPriceFilter] = useState('All')
  const [ratingFilter, setRatingFilter] = useState('All')
  const [eraFilter, setEraFilter] = useState('All')
  // Surfaces entries that fall outside the collection's documented 5-7 tag
  // policy (CLICK_DECK.md), so drifted entries are easy to find and fix.
  const [tagCountFilter, setTagCountFilter] = useState('All')
  const [activeDevs, setActiveDevs] = useState([])
  // Defaults to hiding Coming Soon games — same instinct as Timeline's hard
  // exclusion, just not hard-coded here since Analytics is explicitly the
  // one view allowed to include them on request.
  const [releaseFilter, setReleaseFilter] = useState('Released')
  // How recently a game was marked Completed — 'Any' applies no filter at
  // all (so it doesn't hide non-Completed games or undated Completed ones).
  const [completedFilter, setCompletedFilter] = useState('Any')
  // HLTB "Main + Sides" length buckets — 'All' applies no filter (so it
  // doesn't hide games with no recorded length).
  const [lengthFilter, setLengthFilter] = useState('All')
  // Steam review buckets (raw percentage, not the Wilson-adjusted rank
  // score — this matches what the [T] badge actually displays, so filtering
  // lines up with what's on screen) — 'All' applies no filter.
  const [steamFilter, setSteamFilter] = useState('All')

  const matrixFilteredGames = useMemo(() => {
    let result = [...filteredGames]

    if (releaseFilter !== 'All') {
      result = result.filter(g => readReleaseStatus(g) === releaseFilter)
    }

    if (eraFilter !== 'All') {
      result = result.filter(g => {
        if (!g.year) return false
        const year = g.year
        if (eraFilter === '80s') return year >= 1980 && year < 1990
        if (eraFilter === '90s') return year >= 1990 && year < 2000
        if (eraFilter === '00s') return year >= 2000 && year < 2010
        if (eraFilter === '10s') return year >= 2010 && year < 2020
        if (eraFilter === '20s') return year >= 2020 && year < 2030
        return false
      })
    }

    if (ratingFilter !== 'All') {
      result = result.filter(g => g.rating === parseInt(ratingFilter))
    }

    if (priceFilter !== 'All') {
      result = result.filter(g => {
        if (g.price === null || g.price === undefined) return false
        if (priceFilter === 'Free') return g.price === 0
        if (priceFilter === '<$10') return g.price < 10
        if (priceFilter === '$10-$30') return g.price >= 10 && g.price <= 30
        if (priceFilter === '$30+') return g.price >= 30
        return false
      })
    }

    if (tagCountFilter !== 'All') {
      result = result.filter(g => {
        // An unplayed Coming Soon entry deliberately ships with no tags —
        // the 5-7 policy is for played/owned games, so it would otherwise
        // permanently show as a false-positive "Under 5" data-quality issue.
        if (readReleaseStatus(g) === 'Coming Soon') return false
        const count = g.tags?.length || 0
        if (tagCountFilter === 'Under 5') return count < 5
        if (tagCountFilter === 'Over 7') return count > 7
        return true
      })
    }
    if (completedFilter !== 'Any') {
      result = result.filter(g => isCompletedWithinDays(g, COMPLETION_WINDOWS[completedFilter]))
    }

    if (lengthFilter !== 'All') {
      result = result.filter(g => isInLengthBucket(g, lengthFilter))
    }

    if (steamFilter !== 'All') {
      result = result.filter(g => isInReviewBucket(g, steamFilter))
    }

    return result
  }, [filteredGames, eraFilter, ratingFilter, priceFilter, tagCountFilter, releaseFilter, completedFilter, lengthFilter, steamFilter])

  // Calculate tag frequencies based on currently filtered games
  const tagCounts = useMemo(() => {
    const counts = {}
    matrixFilteredGames.forEach(g => {
      g.tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1
      })
    })
    activeTags.forEach(t => {
      if (counts[t] === undefined) counts[t] = 0
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [matrixFilteredGames, activeTags])

  const devCounts = useMemo(() => {
    const counts = {}
    matrixFilteredGames.forEach(g => {
      if (g.developer) {
        counts[g.developer] = (counts[g.developer] || 0) + 1
      }
    })
    activeDevs.forEach(d => {
      if (counts[d] === undefined) counts[d] = 0
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [matrixFilteredGames, activeDevs])

  const deepFilteredGames = useMemo(() => {
    let result = [...matrixFilteredGames]
    
    if (activeDevs.length > 0) {
      result = result.filter(g => activeDevs.includes(g.developer))
    }

    return result
  }, [matrixFilteredGames, activeDevs])

  const toggleTag = (tag) => {
    if (activeTags.includes(tag)) {
      setActiveTags(activeTags.filter(t => t !== tag))
    } else {
      setActiveTags([...activeTags, tag])
    }
  }

  const toggleDev = (dev) => {
    if (activeDevs.includes(dev)) {
      setActiveDevs(activeDevs.filter(d => d !== dev))
    } else {
      setActiveDevs([...activeDevs, dev])
    }
  }

  const downloadBlob = (content, mimeType, filename) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // A plain-data backup of the currently filtered entries — useful for the BYO-token
  // model, where "your data isn't locked in" should mean an actual portable export,
  // not just a human-readable report.
  const handleExportJson = () => {
    const data = deepFilteredGames.map(g => ({
      title: g.title,
      year: g.year,
      developer: g.developer,
      status: g.status,
      rating: g.rating,
      tags: g.tags,
      journal: g.journal,
      coverUrl: g.coverUrl,
      price: g.price,
      initialPrice: g.initialPrice,
      discountPercent: g.discountPercent,
      appId: g.appId,
      createdTime: g.createdTime,
      completedAt: g.completedAt,
      lengthHours: g.lengthHours
    }));
    downloadBlob(JSON.stringify(data, null, 2), 'application/json', 'click_deck_export.json');
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
              <th>Rating</th>
              <th>Price</th>
              <th>Length</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            ${deepFilteredGames.map(g => `
              <tr>
                <td>${g.title}</td>
                <td>${g.year || 'N/A'}</td>
                <td>${g.developer || 'N/A'}</td>
                <td>${g.status}</td>
                <td>${g.rating ? g.rating + '★' : 'N/A'}</td>
                <td>${g.price !== null && g.price !== undefined ? (g.price === 0 ? 'FREE' : '$'+g.price.toFixed(2)) : 'N/A'}</td>
                <td>${g.lengthHours !== null && g.lengthHours !== undefined ? g.lengthHours + 'h' : 'N/A'}</td>
                <td>${g.completedAt || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    downloadBlob(htmlContent, 'text/html', 'click_deck_export.html');
  }

  return (
    <div className="cd-analytics">
      {/* Global filters have been extracted to App.jsx */}

      <div className="cd-analytics-filters cd-panel">
        <div className="cd-filter-row">
          <span className="cd-filter-label">PRICE:</span>
          {['All', 'Free', '<$10', '$10-$30', '$30+'].map(p => (
            <button key={p} className={`cd-filter-btn ${priceFilter === p ? 'active' : ''}`} onClick={() => setPriceFilter(p)}>{p}</button>
          ))}
        </div>
        <div className="cd-filter-row">
          <span className="cd-filter-label">RATING:</span>
          {['All', '5', '4', '3', '2', '1'].map(r => (
            <button key={r} className={`cd-filter-btn ${ratingFilter === r ? 'active' : ''}`} onClick={() => setRatingFilter(r)}>{r === 'All' ? 'All' : r + '★'}</button>
          ))}
        </div>
        <div className="cd-filter-row">
          <span className="cd-filter-label">ERA:</span>
          {['All', '80s', '90s', '00s', '10s', '20s'].map(e => (
            <button key={e} className={`cd-filter-btn ${eraFilter === e ? 'active' : ''}`} onClick={() => setEraFilter(e)}>{e}</button>
          ))}
        </div>
        <div className="cd-filter-row">
          <span className="cd-filter-label">TAGS:</span>
          {['All', 'Under 5', 'Over 7'].map(t => (
            <button key={t} className={`cd-filter-btn ${tagCountFilter === t ? 'active' : ''}`} onClick={() => setTagCountFilter(t)}>{t}</button>
          ))}
        </div>
        <div className="cd-filter-row">
          <span className="cd-filter-label">RELEASE:</span>
          {['All', 'Released', 'Coming Soon'].map(r => (
            <button key={r} className={`cd-filter-btn ${releaseFilter === r ? 'active' : ''}`} onClick={() => setReleaseFilter(r)}>{r}</button>
          ))}
        </div>
        <div className="cd-filter-row">
          <span className="cd-filter-label">COMPLETED:</span>
          {['Any', '1mo', '3mo', '6mo', '12mo'].map(c => (
            <button key={c} className={`cd-filter-btn ${completedFilter === c ? 'active' : ''}`} onClick={() => setCompletedFilter(c)}>{c === 'Any' ? 'Any' : c.toUpperCase()}</button>
          ))}
        </div>
        <div className="cd-filter-row">
          <span className="cd-filter-label">LENGTH:</span>
          {['All', 'Short', 'Medium', 'Long', 'Epic'].map(l => (
            <button key={l} className={`cd-filter-btn ${lengthFilter === l ? 'active' : ''}`} onClick={() => setLengthFilter(l)}>{l}</button>
          ))}
        </div>
        <div className="cd-filter-row">
          <span className="cd-filter-label">STEAM:</span>
          {['All', ...Object.keys(REVIEW_BUCKETS)].map(s => (
            <button key={s} className={`cd-filter-btn ${steamFilter === s ? 'active' : ''}`} onClick={() => setSteamFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="cd-clouds-container">
        <div className="cd-word-cloud cd-panel">
          <h3>TAG_MATRIX</h3>
          <div className="cd-cloud-wrapper">
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
        
        <div className="cd-word-cloud cd-panel">
          <h3>STUDIO_MATRIX</h3>
          <div className="cd-cloud-wrapper">
            {devCounts.map(([dev, count]) => {
              const isActive = activeDevs.includes(dev)
              const style = isActive ? {} : { opacity: count === 1 ? 0.7 : 1 }
              return (
                <span 
                  key={dev} 
                  className={`cd-cloud-tag ${isActive ? 'active' : ''}`}
                  style={style}
                  onClick={() => toggleDev(dev)}
                >
                  {dev} <span className="cd-tag-count">({count})</span>
                </span>
              )
            })}
          </div>
        </div>
      </div>
      
      <div className="cd-analytics-results">
        <div className="cd-results-header">
          <p className="cd-results-count">MATCHING ENTRIES: {deepFilteredGames.length}</p>
          <div className="cd-export-buttons">
            <button className="cd-btn-icon" onClick={handleExportHtml}>[EXPORT HTML]</button>
            <button className="cd-btn-icon" onClick={handleExportJson}>[EXPORT JSON]</button>
          </div>
        </div>
        {deepFilteredGames.length === 0 && <p className="cd-text-muted">NO DATA FOUND MATCHING CURRENT PARAMETERS.</p>}
        <div className="cd-gallery-grid">
          {deepFilteredGames.map(g => {
            // A real <a> (rather than a div+onClick window.open()) so the link is a
            // genuine browser navigation — never popup-blocked, and works the same in
            // an installed PWA as in a regular tab. Plain div when there's no appId.
            const GalleryTag = g.appId ? 'a' : 'div'
            const linkProps = g.appId
              ? { href: `https://store.steampowered.com/app/${g.appId}`, target: '_blank', rel: 'noopener noreferrer' }
              : {}
            return (
            <GalleryTag key={g.id} className="cd-gallery-item" {...linkProps}>
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
              {g.isDiscounted && <div className="cd-sale-badge">%</div>}
              <div className="cd-gallery-overlay">
                <h4>{g.title}</h4>
                <div className="cd-gallery-meta">
                  <span className="cd-gallery-status" style={{ color: `var(--cd-status-${(g.status || 'Backlog').toLowerCase()})` }}>
                    [{g.status}]
                  </span>
                  {g.year && <span className="cd-gallery-year">{g.year}</span>}
                </div>
                <div className="cd-gallery-meta-bottom">
                  {g.rating ? <span className="cd-gallery-rating">{g.rating}★</span> : <span></span>}
                  {g.price !== null && g.price !== undefined && (
                    <span className="cd-gallery-price" style={{ color: g.price === 0 ? 'var(--cd-accent-cyan)' : 'var(--cd-accent-amber)' }}>
                      {g.price === 0 ? 'FREE' : `$${g.price.toFixed(2)}`}
                    </span>
                  )}
                </div>
              </div>
            </GalleryTag>
            )
          })}
        </div>
      </div>

      <style>{`
        .cd-analytics {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .cd-clouds-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 800px) {
          .cd-clouds-container {
            grid-template-columns: 1fr;
          }
        }
        .cd-cloud-wrapper {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          padding: 1rem;
          background: var(--cd-bg-dark);
          border: 1px inset var(--cd-border-color);
          max-height: 250px;
          overflow-y: auto;
        }
        .cd-analytics-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          background: rgba(0, 0, 0, 0.2);
        }
        .cd-filter-row {
          display: flex;
          align-items: center;
          flex-wrap: nowrap;
          gap: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .cd-filter-row::-webkit-scrollbar {
          display: none;
        }
        .cd-filter-label {
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-cyan);
          font-size: 0.8rem;
          min-width: 60px;
          flex-shrink: 0;
        }
        .cd-filter-btn {
          font-family: var(--cd-font-terminal);
          font-size: 0.8rem;
          background: transparent;
          border: 1px solid var(--cd-border-color);
          color: var(--cd-text-muted);
          padding: 0.2rem 0.5rem;
          cursor: pointer;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .cd-filter-btn:hover {
          color: var(--cd-accent-cyan);
          border-color: var(--cd-accent-cyan);
        }
        .cd-filter-btn.active {
          color: var(--cd-accent-amber);
          border-color: var(--cd-accent-amber);
          background: rgba(255, 171, 0, 0.1);
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
        .cd-export-buttons {
          display: flex;
          gap: 0.5rem;
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
          display: block;
          position: relative;
          height: 100px;
          border: 1px solid var(--cd-border-accent);
          overflow: hidden;
          background: var(--cd-bg-dark);
          cursor: default;
        }
        a.cd-gallery-item {
          cursor: pointer;
        }
        .cd-gallery-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
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
        .cd-gallery-meta {
          display: flex;
          gap: 0.5rem;
          font-family: var(--cd-font-terminal);
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
        }
        .cd-gallery-meta-bottom {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-family: var(--cd-font-terminal);
          font-size: 0.85rem;
          padding: 0 1rem;
        }
        .cd-gallery-year {
          color: var(--cd-text-muted);
        }
        .cd-gallery-rating {
          color: var(--cd-accent-amber);
        }
        @media (max-width: 600px) {
          .cd-results-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }
          .cd-export-buttons {
            flex-direction: column;
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
