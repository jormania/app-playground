import React from 'react'
import { GameCard } from './GameCard'

export function TimelineView({ games, onEdit, onUpdateStatus }) {
  if (games.length === 0) {
    return <div className="cd-empty">No entries found. Adjust your filters or add a game.</div>
  }

  // Group by year or just render sequentially
  return (
    <div className="cd-timeline">
      <div className="cd-timeline-line"></div>
      {games.map((game, index) => (
        <div key={game.id} className="cd-timeline-node">
          <div className="cd-timeline-year">{game.year}</div>
          <div className="cd-timeline-content">
            <GameCard game={game} onEdit={onEdit} onUpdateStatus={onUpdateStatus} />
          </div>
        </div>
      ))}

      <style>{`
        .cd-timeline {
          position: relative;
          padding: 2rem 0;
        }
        .cd-timeline-line {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 4rem;
          width: 2px;
          background: var(--cd-border-color);
        }
        .cd-timeline-node {
          display: flex;
          align-items: flex-start;
          margin-bottom: 2rem;
          position: relative;
        }
        .cd-timeline-year {
          width: 4rem;
          font-family: var(--cd-font-terminal);
          font-size: 1.5rem;
          color: var(--cd-accent-cyan);
          text-align: right;
          padding-right: 1.5rem;
          position: relative;
        }
        .cd-timeline-year::after {
          content: '';
          position: absolute;
          right: -4px;
          top: 0.5rem;
          width: 10px;
          height: 10px;
          background: var(--cd-bg-dark);
          border: 2px solid var(--cd-accent-cyan);
          z-index: 1;
        }
        .cd-timeline-content {
          flex: 1;
          padding-left: 2rem;
        }
        .cd-empty {
          padding: 2rem;
          text-align: center;
          font-family: var(--cd-font-terminal);
          color: var(--cd-text-muted);
          font-size: 1.2rem;
        }

        @media (max-width: 600px) {
          .cd-timeline-line {
            left: 3rem;
          }
          .cd-timeline-year {
            width: 3rem;
            font-size: 1.2rem;
            padding-right: 1rem;
          }
          .cd-timeline-year::after {
            right: -4px;
            top: 0.25rem;
            width: 8px;
            height: 8px;
          }
          .cd-timeline-content {
            padding-left: 1rem;
            width: calc(100% - 3rem); /* Ensure content doesn't overflow */
          }
        }
      `}</style>
    </div>
  )
}
