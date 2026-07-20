import React, { useEffect, useRef } from 'react'
import { GameCard } from './GameCard'

export function TimelineView({ games, onEdit, onUpdateStatus }) {
  const timelineRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
          } else {
            entry.target.classList.remove('in-view')
          }
        })
      },
      { threshold: 0.1, rootMargin: '-10% 0px -20% 0px' }
    )

    if (timelineRef.current) {
      const nodes = timelineRef.current.querySelectorAll('.cd-timeline-node')
      nodes.forEach(node => observer.observe(node))
    }

    return () => observer.disconnect()
  }, [games])

  if (games.length === 0) {
    return (
      <div className="cd-empty-terminal cd-panel">
        <p className="cd-empty-line">&gt; QUERY EXECUTED...</p>
        <p className="cd-empty-line blink">&gt; 0 RECORDS FOUND. WAITING FOR INPUT_</p>
      </div>
    )
  }

  // Group by year or just render sequentially
  return (
    <div className="cd-timeline" ref={timelineRef}>
      <div className="cd-timeline-line">
        <div className="cd-timeline-glow"></div>
      </div>
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
          left: 5rem;
          width: 2px;
          background: var(--cd-border-color);
          overflow: hidden;
        }
        .cd-timeline-glow {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 15vh;
          background: linear-gradient(to bottom, transparent, var(--cd-accent-cyan), transparent);
          animation: scan 4s linear infinite;
        }
        @keyframes scan {
          0% { top: -20%; }
          100% { top: 120%; }
        }
        .cd-timeline-node {
          display: flex;
          align-items: flex-start;
          margin-bottom: 2rem;
          position: relative;
          opacity: 0.5;
          transform: translateX(-10px);
          transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .cd-timeline-node.in-view {
          opacity: 1;
          transform: translateX(0);
        }
        .cd-timeline-year {
          width: 5rem;
          font-family: var(--cd-font-terminal);
          font-size: 1.5rem;
          color: var(--cd-text-muted);
          text-align: right;
          padding-right: 2rem;
          position: relative;
          transition: color 0.5s ease;
        }
        .cd-timeline-node.in-view .cd-timeline-year {
          color: var(--cd-accent-cyan);
          text-shadow: 0 0 8px var(--cd-accent-cyan-glow);
        }
        .cd-timeline-year::after {
          content: '';
          position: absolute;
          right: -5px;
          top: 0.5rem;
          width: 12px;
          height: 12px;
          background: var(--cd-bg-dark);
          border: 2px solid var(--cd-border-color);
          z-index: 1;
          transition: all 0.5s ease;
        }
        .cd-timeline-node.in-view .cd-timeline-year::after {
          border-color: var(--cd-accent-cyan);
          background: var(--cd-accent-cyan-dim);
          box-shadow: 0 0 10px var(--cd-accent-cyan-glow);
          transform: scale(1.2);
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
            left: 3.5rem;
          }
          .cd-timeline-year {
            width: 3.5rem;
            font-size: 1.2rem;
            padding-right: 1.5rem;
          }
          .cd-timeline-year::after {
            right: -5px;
            top: 0.25rem;
            width: 10px;
            height: 10px;
          }
          .cd-timeline-content {
            padding-left: 1rem;
            width: calc(100% - 3rem); /* Ensure content doesn't overflow */
          }
        }
        .cd-empty-terminal {
          padding: 3rem;
          text-align: center;
          font-family: var(--cd-font-terminal);
          color: var(--cd-accent-amber);
          background: rgba(255, 179, 0, 0.05);
          border-color: var(--cd-accent-amber);
        }
        .cd-empty-line {
          margin: 0.5rem 0;
          font-size: 1.2rem;
        }
        .blink {
          animation: blink-cursor 1s step-end infinite;
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
