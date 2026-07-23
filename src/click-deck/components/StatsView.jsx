import React, { useMemo } from 'react'
import { readReleaseStatus, isIgnored } from '../lib/releaseStatus'
import { getRecentlyReleasedGames, sortComingSoonSoonestFirst } from '../lib/releaseTracking'
import { isCompletedWithinDays, countUndatedCompleted, COMPLETION_WINDOWS } from '../lib/completionTracking'
import { lengthBucketOf, LENGTH_BUCKETS } from '../lib/lengthBuckets'
import { hasReviewData, steamReviewScore } from '../lib/steamReviews'
import { DrumRollIcon } from './WatchlistView'

// `games` here is already Coming-Soon/Ignored-filtered by App.jsx (every
// stat below should only ever reflect your active, played-or-playable
// collection) — `watchlistGames` is deliberately the separate, unfiltered
// array so this component can compute its own Watchlist-specific numbers
// from it without those numbers leaking into any of the collection stats.
export function StatsView({ games, watchlistGames = [] }) {
  const watchlistStats = useMemo(() => {
    const comingSoon = sortComingSoonSoonestFirst(watchlistGames.filter(g => readReleaseStatus(g) === 'Coming Soon'))
    const recentlyReleased = getRecentlyReleasedGames(watchlistGames)
    const ignoredCount = watchlistGames.filter(isIgnored).length
    const expectedThisYear = comingSoon.filter(g => g.year === new Date().getFullYear()).length
    return {
      comingSoonCount: comingSoon.length,
      expectedThisYear,
      recentlyReleasedCount: recentlyReleased.length,
      nextUp: comingSoon[0] || null,
      ignoredCount
    }
  }, [watchlistGames])

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

    // 5. Financials — whole dollars only, no cents, so the stat boxes don't
    // overflow their fixed width at higher totals.
    const gamesWithPrice = games.filter(g => g.price !== null && g.price !== undefined);
    const totalSpent = Math.round(gamesWithPrice.reduce((sum, g) => sum + g.price, 0));
    const backlogValue = Math.round(gamesWithPrice.filter(g => g.status === 'Backlog').reduce((sum, g) => sum + g.price, 0));
    const completedValue = Math.round(gamesWithPrice.filter(g => g.status === 'Completed').reduce((sum, g) => sum + g.price, 0));
    const avgPrice = gamesWithPrice.length > 0 ? Math.round(gamesWithPrice.reduce((sum, g) => sum + g.price, 0) / gamesWithPrice.length) : 'N/A';

    // The most recent nightly-cron sync across the whole collection — with no
    // indicator of this anywhere, there's no way to tell whether prices are
    // current or the cron silently stopped running.
    const syncTimestamps = games.map(g => g.priceUpdatedAt).filter(Boolean).map(d => new Date(d).getTime());
    const lastPriceSync = syncTimestamps.length > 0 ? new Date(Math.max(...syncTimestamps)) : null;

    // 6. Completion Velocity — how many Completed games fall inside each
    // trailing window. Undated Completed entries (pre-R2, or a game marked
    // Completed before the schema patch) still count toward ALL-TIME but can
    // never match a window — surfaced separately rather than silently
    // under-counting the windows.
    const velocity = {
      m1: games.filter(g => isCompletedWithinDays(g, COMPLETION_WINDOWS['1mo'])).length,
      m3: games.filter(g => isCompletedWithinDays(g, COMPLETION_WINDOWS['3mo'])).length,
      m6: games.filter(g => isCompletedWithinDays(g, COMPLETION_WINDOWS['6mo'])).length,
      m12: games.filter(g => isCompletedWithinDays(g, COMPLETION_WINDOWS['12mo'])).length,
      allTime: completed,
      undatedCount: countUndatedCompleted(games)
    };

    // 7. Playtime Analysis — HLTB "Main + Sides" length, backlog/completed
    // hours as an honest "hours ahead of you" / "hours behind you" pair,
    // rather than folding them into one meaningless total.
    const gamesWithLength = games.filter(g => g.lengthHours !== null && g.lengthHours !== undefined);
    const backlogHours = Math.round(games.filter(g => g.status === 'Backlog').reduce((sum, g) => sum + (g.lengthHours || 0), 0));
    const completedHours = Math.round(games.filter(g => g.status === 'Completed').reduce((sum, g) => sum + (g.lengthHours || 0), 0));
    const avgLength = gamesWithLength.length > 0
      ? (gamesWithLength.reduce((sum, g) => sum + g.lengthHours, 0) / gamesWithLength.length).toFixed(1)
      : 'N/A';
    const longestGame = gamesWithLength.length > 0 ? gamesWithLength.reduce((a, b) => b.lengthHours > a.lengthHours ? b : a) : null;
    const shortestGame = gamesWithLength.length > 0 ? gamesWithLength.reduce((a, b) => b.lengthHours < a.lengthHours ? b : a) : null;
    const lengthBucketCounts = Object.keys(LENGTH_BUCKETS).map(bucket => [
      bucket, gamesWithLength.filter(g => lengthBucketOf(g.lengthHours) === bucket).length
    ]);
    const playtime = {
      backlogHours, completedHours, avgLength, longestGame, shortestGame,
      lengthBucketCounts, trackedCount: gamesWithLength.length
    };

    // 8. Steam Review Consensus — a separate signal from your own 1-5★
    // rating above, never conflated with it. "Most acclaimed" ranks by the
    // same Wilson-adjusted score [R]'s weighting and [T]'s sort use (not
    // raw %), so a 3-review fluke can't take the top spot. The agreement
    // line compares your rating against Steam's on the same games (both
    // normalized to a 0-100 scale) rather than claiming a real statistical
    // correlation — an honest average gap, not an overclaimed metric.
    const gamesWithReviewData = games.filter(hasReviewData);
    const avgSteamPercent = gamesWithReviewData.length > 0
      ? (gamesWithReviewData.reduce((sum, g) => sum + g.steamReviewPercent, 0) / gamesWithReviewData.length).toFixed(1)
      : 'N/A';
    const mostAcclaimed = gamesWithReviewData.length > 0
      ? gamesWithReviewData.reduce((best, g) => steamReviewScore(g) > steamReviewScore(best) ? g : best)
      : null;
    const comparableGames = gamesWithReviewData.filter(g => g.rating !== null && g.rating !== undefined);
    let agreementGap = null;
    if (comparableGames.length > 0) {
      const avgYours = comparableGames.reduce((sum, g) => sum + (g.rating / 5) * 100, 0) / comparableGames.length;
      const avgSteam = comparableGames.reduce((sum, g) => sum + g.steamReviewPercent, 0) / comparableGames.length;
      agreementGap = { diff: avgYours - avgSteam, count: comparableGames.length };
    }
    const steamConsensus = { checkedCount: gamesWithReviewData.length, avgPercent: avgSteamPercent, mostAcclaimed, agreementGap };

    return {
      totalGames, completed, backlog, playing, abandoned, avgRating,
      oldest, newest, sortedDecades,
      topDevs, highestRatedDevs,
      topTags, highestRatedTags,
      totalSpent, backlogValue, completedValue, avgPrice, gamesWithPriceCount: gamesWithPrice.length,
      lastPriceSync, velocity, playtime, steamConsensus
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
            {/* Not part of the count above (this panel is scoped to your
                active collection) — a single at-a-glance pointer to the
                dedicated WATCHLIST panel for the rest of the detail. */}
            <li><span className="label">COMING SOON</span> <span className="val">{watchlistStats.comingSoonCount}</span></li>
          </ul>
        </div>

        {/* Completion Velocity */}
        <div className="cd-panel">
          <h3>COMPLETION_VELOCITY</h3>
          <ul className="cd-stat-list">
            <li><span className="label">LAST 30D</span> <span className="val">{stats.velocity.m1}</span></li>
            <li><span className="label">LAST 3MO</span> <span className="val">{stats.velocity.m3}</span></li>
            <li><span className="label">LAST 6MO</span> <span className="val">{stats.velocity.m6}</span></li>
            <li><span className="label">LAST 12MO</span> <span className="val">{stats.velocity.m12}</span></li>
            <li><span className="label">ALL-TIME</span> <span className="val">{stats.velocity.allTime}</span></li>
          </ul>
          {stats.velocity.undatedCount > 0 && (
            <p className="cd-price-sync-note">
              * {stats.velocity.undatedCount} completed {stats.velocity.undatedCount === 1 ? 'entry has' : 'entries have'} no Completed At date — counted in ALL-TIME only.
            </p>
          )}
        </div>

        {/* Watchlist — deliberately its own panel with its own numbers, not
            folded into the collection stats above (see the StatsView props
            comment for why the two arrays are kept separate). */}
        <div className="cd-panel">
          <h3>WATCHLIST</h3>
          <ul className="cd-stat-list">
            <li><span className="label">TRACKED</span> <span className="val">{watchlistStats.comingSoonCount}</span></li>
            <li><span className="label">EXPECTED THIS YEAR</span> <span className="val">{watchlistStats.expectedThisYear}</span></li>
            <li><span className="label">RECENTLY RELEASED (365D)</span> <span className="val">{watchlistStats.recentlyReleasedCount}</span></li>
            <li><span className="label">IGNORED</span> <span className="val">{watchlistStats.ignoredCount}</span></li>
          </ul>
          {watchlistStats.nextUp && (
            <div className="cd-watchlist-next-up">
              <DrumRollIcon className="cd-drum-roll-icon" />
              <div>
                <h4>NEXT UP</h4>
                <p className="cd-next-up-title">{watchlistStats.nextUp.title}</p>
                <p className="cd-next-up-date">{watchlistStats.nextUp.releaseDate || (watchlistStats.nextUp.year ? String(watchlistStats.nextUp.year) : 'TBA')}</p>
              </div>
            </div>
          )}
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

        {/* Steam Review Consensus — a separate signal from your own 1-5★
            rating panel above; never merged into it. */}
        <div className="cd-panel">
          <h3>STEAM_CONSENSUS</h3>
          <ul className="cd-stat-list">
            <li><span className="label">CHECKED</span> <span className="val">{stats.steamConsensus.checkedCount}</span></li>
            <li><span className="label">AVG STEAM RATING</span> <span className="val">{stats.steamConsensus.avgPercent}{stats.steamConsensus.avgPercent !== 'N/A' ? '%' : ''}</span></li>
          </ul>
          {stats.steamConsensus.mostAcclaimed && (
            <p className="cd-price-sync-note">
              MOST ACCLAIMED: {stats.steamConsensus.mostAcclaimed.title} ({stats.steamConsensus.mostAcclaimed.steamReviewDesc}, {Math.round(stats.steamConsensus.mostAcclaimed.steamReviewPercent)}%)
            </p>
          )}
          {stats.steamConsensus.agreementGap ? (
            <p className="cd-price-sync-note">
              {Math.abs(stats.steamConsensus.agreementGap.diff) < 1
                ? `OVER ${stats.steamConsensus.agreementGap.count} GAMES YOU'VE RATED, YOUR SCORE (★ ×20) TRACKS STEAM'S % CLOSELY`
                : `OVER ${stats.steamConsensus.agreementGap.count} GAMES YOU'VE RATED, YOUR SCORE (★ ×20) AVERAGES ${Math.abs(stats.steamConsensus.agreementGap.diff).toFixed(0)} PTS ${stats.steamConsensus.agreementGap.diff > 0 ? 'HIGHER' : 'LOWER'} THAN STEAM'S %`}
            </p>
          ) : (
            <p className="cd-price-sync-note">NO OVERLAP YET BETWEEN YOUR RATINGS AND CHECKED STEAM REVIEWS.</p>
          )}
        </div>

        {/* Playtime Analysis — HLTB "Main + Sides" length */}
        <div className="cd-panel">
          <h3>PLAYTIME_ANALYSIS</h3>
          <ul className="cd-stat-list">
            <li><span className="label">BACKLOG HOURS</span> <span className="val">{stats.playtime.backlogHours}h</span></li>
            <li><span className="label">COMPLETED HOURS</span> <span className="val">{stats.playtime.completedHours}h</span></li>
            <li><span className="label">AVG LENGTH</span> <span className="val">{stats.playtime.avgLength}{stats.playtime.avgLength !== 'N/A' ? 'h' : ''}</span></li>
            {stats.playtime.longestGame && (
              <li><span className="label">LONGEST</span> <span className="val">{stats.playtime.longestGame.title} ({stats.playtime.longestGame.lengthHours}h)</span></li>
            )}
            {stats.playtime.shortestGame && (
              <li><span className="label">SHORTEST</span> <span className="val">{stats.playtime.shortestGame.title} ({stats.playtime.shortestGame.lengthHours}h)</span></li>
            )}
          </ul>
          {stats.playtime.trackedCount > 0 ? (
            <div className="cd-bar-chart">
              {stats.playtime.lengthBucketCounts.map(([bucket, count]) => {
                const maxCount = Math.max(...stats.playtime.lengthBucketCounts.map(b => b[1]), 1);
                const width = (count / maxCount) * 100;
                return (
                  <div key={bucket} className="cd-bar-row">
                    <span className="cd-bar-label" style={{ width: '60px' }}>{bucket.toUpperCase()}</span>
                    <div className="cd-bar-track">
                      <div className="cd-bar-fill" style={{ width: `${width}%` }}></div>
                    </div>
                    <span className="cd-bar-val">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="cd-price-sync-note">NO LENGTH DATA YET — FETCH HLTB FROM THE EDITOR.</p>
          )}
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
            <h4>HIGHEST RATED</h4>
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
            <h4>HIGHEST RATED</h4>
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
        .cd-watchlist-next-up {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px dashed var(--cd-border-color);
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .cd-watchlist-next-up h4 {
          margin: 0 0 0.2rem 0;
          font-size: 0.75rem;
          color: var(--cd-accent-cyan);
          opacity: 0.8;
        }
        .cd-next-up-title {
          margin: 0;
          color: var(--cd-text-primary);
          font-weight: bold;
        }
        .cd-next-up-date {
          margin: 0.1rem 0 0;
          font-family: var(--cd-font-terminal);
          font-size: 0.85rem;
          color: var(--cd-accent-cyan);
        }
        .cd-drum-roll-icon {
          flex-shrink: 0;
          color: var(--cd-accent-amber);
          animation: drumRoll 0.6s ease-in-out infinite alternate;
        }
        @keyframes drumRoll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-3px); }
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
