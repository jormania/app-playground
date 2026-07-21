import React, { useMemo } from 'react'

export function StatsView({ games }) {
  const stats = useMemo(() => {
    if (!games || games.length === 0) return null;

    // 1. Global Overview
    const totalGames = games.length;
    const completed = games.filter(g => g.status === 'Completed').length;
    const backlog = games.filter(g => g.status === 'Backlog').length;
    const playing = games.filter(g => g.status === 'Playing').length;
    const abandoned = games.filter(g => g.status === 'Abandoned').length;
    
    const ratedGames = games.filter(g => g.rating !== null && g.rating !== undefined);
    const avgRating = ratedGames.length > 0 
      ? (ratedGames.reduce((acc, g) => acc + g.rating, 0) / ratedGames.length).toFixed(2)
      : 'N/A';

    // 2. Era Breakdown
    const validYears = games.filter(g => g.year).map(g => g.year);
    const oldest = validYears.length > 0 ? Math.min(...validYears) : 'N/A';
    const newest = validYears.length > 0 ? Math.max(...validYears) : 'N/A';
    
    const decades = games.reduce((acc, g) => {
      if (!g.year) return acc;
      const decade = Math.floor(g.year / 10) * 10;
      acc[`${decade}s`] = (acc[`${decade}s`] || 0) + 1;
      return acc;
    }, {});
    const sortedDecades = Object.entries(decades).sort((a, b) => a[0].localeCompare(b[0]));

    // 3. Developer Insights
    const devMap = {};
    games.forEach(g => {
      if (!g.developer) return;
      if (!devMap[g.developer]) devMap[g.developer] = { count: 0, sumRating: 0, ratedCount: 0 };
      devMap[g.developer].count += 1;
      if (g.rating) {
        devMap[g.developer].sumRating += g.rating;
        devMap[g.developer].ratedCount += 1;
      }
    });
    
    const devs = Object.entries(devMap).map(([name, data]) => ({
      name, 
      count: data.count, 
      avgRating: data.ratedCount > 0 ? (data.sumRating / data.ratedCount) : 0,
      ratedCount: data.ratedCount
    }));
    
    const topDevs = [...devs].sort((a, b) => b.count - a.count).slice(0, 5);
    const highestRatedDevs = [...devs]
      .filter(d => d.ratedCount >= 2)
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 5);

    // 4. Genre & Vibe Analytics
    const tagMap = {};
    games.forEach(g => {
      if (!g.tags) return;
      g.tags.forEach(tag => {
        if (!tagMap[tag]) tagMap[tag] = { count: 0, sumRating: 0, ratedCount: 0 };
        tagMap[tag].count += 1;
        if (g.rating) {
          tagMap[tag].sumRating += g.rating;
          tagMap[tag].ratedCount += 1;
        }
      });
    });

    const tags = Object.entries(tagMap).map(([name, data]) => ({
      name,
      count: data.count,
      avgRating: data.ratedCount > 0 ? (data.sumRating / data.ratedCount) : 0,
      ratedCount: data.ratedCount
    }));

    const topTags = [...tags].sort((a, b) => b.count - a.count).slice(0, 5);
    const highestRatedTags = [...tags]
      .filter(t => t.ratedCount >= 3) // min 3 ratings to be meaningful
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 5);

    // 5. Financials
    const gamesWithPrice = games.filter(g => g.price !== null && g.price !== undefined);
    const totalSpent = gamesWithPrice.reduce((sum, g) => sum + g.price, 0).toFixed(2);
    const backlogValue = gamesWithPrice.filter(g => g.status === 'Backlog').reduce((sum, g) => sum + g.price, 0).toFixed(2);
    const completedValue = gamesWithPrice.filter(g => g.status === 'Completed').reduce((sum, g) => sum + g.price, 0).toFixed(2);
    const avgPrice = gamesWithPrice.length > 0 ? (gamesWithPrice.reduce((sum, g) => sum + g.price, 0) / gamesWithPrice.length).toFixed(2) : 'N/A';

    // The most recent nightly-cron sync across the whole collection — with no
    // indicator of this anywhere, there's no way to tell whether prices are
    // current or the cron silently stopped running.
    const syncTimestamps = games.map(g => g.priceUpdatedAt).filter(Boolean).map(d => new Date(d).getTime());
    const lastPriceSync = syncTimestamps.length > 0 ? new Date(Math.max(...syncTimestamps)) : null;

    return {
      totalGames, completed, backlog, playing, abandoned, avgRating,
      oldest, newest, sortedDecades,
      topDevs, highestRatedDevs,
      topTags, highestRatedTags,
      totalSpent, backlogValue, completedValue, avgPrice, gamesWithPriceCount: gamesWithPrice.length,
      lastPriceSync
    };
  }, [games]);

  if (!stats) {
    return (
      <div className="cd-panel">
        <p className="cd-text-muted">INSUFFICIENT DATA TO COMPILE STATISTICS.</p>
      </div>
    );
  }

  const toPercent = (num, total) => ((num / total) * 100).toFixed(1) + '%';

  return (
    <div className="cd-stats-container">
      <div className="cd-stats-header">
        <h2>DATABANK_ANALYTICS</h2>
        <div className="cd-stats-summary">
          <div className="cd-stat-box primary">
            <span className="cd-stat-val">{stats.totalGames}</span>
            <span className="cd-stat-label">TOTAL ENTRIES</span>
          </div>
          <div className="cd-stat-box">
            <span className="cd-stat-val">{stats.avgRating}</span>
            <span className="cd-stat-label">AVG RATING</span>
          </div>
          <div className="cd-stat-box">
            <span className="cd-stat-val">{toPercent(stats.completed, stats.totalGames)}</span>
            <span className="cd-stat-label">COMPLETION RATE</span>
          </div>
          <div className="cd-stat-box">
            <span className="cd-stat-val" style={{ color: 'var(--cd-accent-amber)' }}>${stats.totalSpent}</span>
            <span className="cd-stat-label">TOTAL VALUE</span>
          </div>
        </div>
      </div>

      <div className="cd-stats-grid">
        {/* Status Breakdown */}
        <div className="cd-panel">
          <h3>STATUS_MATRIX</h3>
          <ul className="cd-stat-list">
            <li><span className="label">COMPLETED</span> <span className="val">{stats.completed}</span></li>
            <li><span className="label">PLAYING</span> <span className="val">{stats.playing}</span></li>
            <li><span className="label">BACKLOG</span> <span className="val">{stats.backlog}</span></li>
            <li><span className="label">ABANDONED</span> <span className="val">{stats.abandoned}</span></li>
          </ul>
        </div>

        {/* Financials Breakdown */}
        <div className="cd-panel">
          <h3>FINANCIAL_OVERVIEW</h3>
          <ul className="cd-stat-list">
            <li><span className="label">BACKLOG VALUE</span> <span className="val">${stats.backlogValue}</span></li>
            <li><span className="label">COMPLETED VALUE</span> <span className="val">${stats.completedValue}</span></li>
            <li><span className="label">AVG PRICE</span> <span className="val">${stats.avgPrice}</span></li>
            <li><span className="label">PRICED GAMES</span> <span className="val">{stats.gamesWithPriceCount}</span></li>
          </ul>
          <p className="cd-price-sync-note">
            {stats.lastPriceSync
              ? `PRICES LAST SYNCED: ${stats.lastPriceSync.toLocaleDateString()}`
              : 'PRICES LAST SYNCED: NEVER'}
          </p>
        </div>

        {/* Timeline Breakdown */}
        <div className="cd-panel">
          <h3>TEMPORAL_DISTRIBUTION</h3>
          <ul className="cd-stat-list">
            <li><span className="label">OLDEST FILE</span> <span className="val">{stats.oldest}</span></li>
            <li><span className="label">NEWEST FILE</span> <span className="val">{stats.newest}</span></li>
          </ul>
          <div className="cd-bar-chart">
            {stats.sortedDecades.map(([decade, count]) => {
              const maxCount = Math.max(...stats.sortedDecades.map(d => d[1]));
              const width = (count / maxCount) * 100;
              return (
                <div key={decade} className="cd-bar-row">
                  <span className="cd-bar-label">{decade}</span>
                  <div className="cd-bar-track">
                    <div className="cd-bar-fill" style={{ width: `${width}%` }}></div>
                  </div>
                  <span className="cd-bar-val">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Developer Insights */}
        <div className="cd-panel">
          <h3>STUDIO_PROFILES</h3>
          <div className="cd-sub-panel">
            <h4>MOST FREQUENT</h4>
            <ul className="cd-stat-list slim">
              {stats.topDevs.map((d, i) => (
                <li key={i}><span className="label">{d.name}</span> <span className="val">{d.count}</span></li>
              ))}
            </ul>
          </div>
          <div className="cd-sub-panel">
            <h4>HIGHEST RATED (MIN 2)</h4>
            <ul className="cd-stat-list slim">
              {stats.highestRatedDevs.map((d, i) => (
                <li key={i}><span className="label">{d.name}</span> <span className="val">{d.avgRating.toFixed(1)} ★</span></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Genre Analytics */}
        <div className="cd-panel">
          <h3>TAG_CORRELATIONS</h3>
          <div className="cd-sub-panel">
            <h4>MOST FREQUENT</h4>
            <ul className="cd-stat-list slim">
              {stats.topTags.map((t, i) => (
                <li key={i}><span className="label">{t.name}</span> <span className="val">{t.count}</span></li>
              ))}
            </ul>
          </div>
          <div className="cd-sub-panel">
            <h4>HIGHEST RATED (MIN 3)</h4>
            <ul className="cd-stat-list slim">
              {stats.highestRatedTags.map((t, i) => (
                <li key={i}><span className="label">{t.name}</span> <span className="val">{t.avgRating.toFixed(1)} ★</span></li>
              ))}
            </ul>
          </div>
        </div>

        </div>
      <style>{`
        .cd-stats-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .cd-stats-header {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .cd-stats-header h2 {
          margin: 0;
          color: var(--cd-accent-cyan);
          letter-spacing: 2px;
          border-bottom: 2px solid var(--cd-accent-cyan);
          display: inline-block;
          padding-bottom: 0.5rem;
          width: fit-content;
        }
        .cd-stats-summary {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .cd-stat-box {
          background: var(--cd-bg-dark);
          border: 1px solid var(--cd-border-color);
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 150px;
          flex: 1;
        }
        .cd-stat-box.primary {
          border-color: var(--cd-accent-cyan);
          box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.1);
        }
        .cd-stat-box.primary .cd-stat-val {
          color: var(--cd-accent-cyan);
          text-shadow: 0 0 8px var(--cd-accent-cyan-glow);
        }
        .cd-stat-val {
          font-size: 2.5rem;
          font-weight: bold;
          font-family: var(--cd-font-sans);
          color: var(--cd-text-primary);
        }
        .cd-stat-label {
          font-size: 0.8rem;
          color: var(--cd-text-muted);
          letter-spacing: 1px;
          margin-top: 0.5rem;
        }
        .cd-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .cd-stats-grid.extremes {
          grid-template-columns: 1fr;
        }
        @media (min-width: 800px) {
          .cd-stats-grid.extremes {
            grid-template-columns: 1fr 1fr;
          }
        }
        .cd-panel h3 {
          margin-top: 0;
          margin-bottom: 1rem;
          color: var(--cd-text-muted);
          font-size: 1.1rem;
          border-bottom: 1px dashed var(--cd-border-color);
          padding-bottom: 0.5rem;
        }
        .cd-sub-panel {
          margin-top: 1rem;
        }
        .cd-sub-panel h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.85rem;
          color: var(--cd-accent-cyan);
          opacity: 0.8;
        }
        .cd-price-sync-note {
          margin: 1rem 0 0;
          font-size: 0.75rem;
          color: var(--cd-text-muted);
          letter-spacing: 0.5px;
        }
        .cd-stat-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .cd-stat-list li {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 0.2rem;
        }
        .cd-stat-list.slim li {
          font-size: 0.9rem;
        }
        .cd-stat-list li .label {
          color: var(--cd-text-primary);
        }
        .cd-stat-list li .val {
          color: var(--cd-accent-amber);
          font-weight: bold;
        }
        
        /* Bar Chart */
        .cd-bar-chart {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .cd-bar-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .cd-bar-label {
          width: 40px;
          font-size: 0.8rem;
          color: var(--cd-text-muted);
        }
        .cd-bar-track {
          flex: 1;
          height: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--cd-border-color);
        }
        .cd-bar-fill {
          height: 100%;
          background: var(--cd-accent-cyan);
          box-shadow: 0 0 5px var(--cd-accent-cyan-glow);
        }
        .cd-bar-val {
          width: 20px;
          font-size: 0.8rem;
          text-align: right;
          color: var(--cd-text-primary);
        }
      `}</style>
    </div>
  )
}
