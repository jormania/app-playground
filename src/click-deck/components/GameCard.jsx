import React from 'react'
import ReactMarkdown from 'react-markdown'

export function GameCard({ game, onEdit, onUpdateStatus }) {
  const statusColors = {
    'Backlog': 'var(--cd-text-muted)',
    'Playing': 'var(--cd-accent-cyan)',
    'Completed': 'var(--cd-accent-amber)',
    'Abandoned': '#d9381e'
  }

  const getStatusColor = (status) => statusColors[status] || 'var(--cd-text-muted)'

  const renderNotionRichText = (richTextArray) => {
    if (!Array.isArray(richTextArray) || richTextArray.length === 0) return null;
    
    // Check if it's just a single unformatted string (which is what we create on local edit)
    // If so, fall back to ReactMarkdown so that manually typed markdown works.
    if (richTextArray.length === 1 && Object.keys(richTextArray[0].annotations).every(k => richTextArray[0].annotations[k] === false || richTextArray[0].annotations[k] === 'default')) {
      return <ReactMarkdown>{richTextArray[0].plain_text}</ReactMarkdown>;
    }

    return richTextArray.map((rt, i) => {
      let classes = [];
      let style = {};
      if (rt.annotations.bold) classes.push('cd-rt-bold');
      if (rt.annotations.italic) classes.push('cd-rt-italic');
      if (rt.annotations.strikethrough) classes.push('cd-rt-strike');
      if (rt.annotations.underline) classes.push('cd-rt-underline');
      if (rt.annotations.code) classes.push('cd-rt-code');
      
      if (rt.annotations.color && rt.annotations.color !== 'default') {
        const colorMap = {
          orange: '#d97736', purple: '#9065b0', red: '#e03e3e',
          blue: '#337ea9', yellow: '#d9971c', green: '#448361',
          brown: '#8f6e30', gray: '#9b9a97', pink: '#c14c8a'
        };
        style.color = colorMap[rt.annotations.color] || rt.annotations.color;
      }

      const Tag = rt.href ? 'a' : 'span';
      const props = { key: i, className: classes.join(' ') || undefined, style: Object.keys(style).length ? style : undefined };
      if (rt.href) {
        props.href = rt.href;
        props.target = '_blank';
        props.rel = 'noreferrer';
      }

      return React.createElement(Tag, props, rt.plain_text);
    });
  }

  return (
    <div className="cd-panel cd-game-card">
      {game.coverUrl ? (
        <div className="cd-game-cover">
          <img 
            src={game.coverUrl} 
            alt={game.title} 
            loading="lazy" 
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.classList.add('fallback-cover');
            }} 
          />
        </div>
      ) : (
        <div className="cd-game-cover fallback-cover"></div>
      )}
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
        {game.status === 'Completed' && (
          <>
            <span className="cd-separator">|</span>
            <span className="cd-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <span 
                  key={star} 
                  style={{ cursor: 'pointer', color: game.rating >= star ? 'inherit' : 'var(--cd-text-muted)' }}
                  onClick={() => onUpdateStatus(game.id, game.status, star)}
                >
                  {game.rating >= star ? '★' : '☆'}
                </span>
              ))}
            </span>
          </>
        )}
        {game.price !== null && game.price !== undefined && (
          <>
            <span className="cd-separator">|</span>
            <span className="cd-price" style={{ color: game.price === 0 ? 'var(--cd-accent-cyan)' : 'var(--cd-accent-amber)' }}>
              {game.price === 0 ? 'FREE' : `$${game.price.toFixed(2)}`}
            </span>
          </>
        )}
      </div>
      
      <div className="cd-tags">
        {game.tags.map(tag => (
          <span key={tag} className="cd-tag">{tag}</span>
        ))}
      </div>

      {game.journalRich && game.journalRich.length > 0 ? (
        <div className="cd-journal cd-journal-rich">
          {renderNotionRichText(game.journalRich)}
        </div>
      ) : game.journal && (
        <div className="cd-journal">
          <ReactMarkdown>{game.journal}</ReactMarkdown>
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
        .cd-game-cover {
          height: 180px;
          margin: -1rem -1rem 1rem -1rem;
          border-bottom: 1px solid var(--cd-border-accent);
          position: relative;
          overflow: hidden;
          background: var(--cd-bg-dark);
        }
        .cd-game-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .fallback-cover {
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
          font-size: 1.5rem;
          letter-spacing: 4px;
          opacity: 0.5;
        }
        .cd-game-cover::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent 0%, var(--cd-bg-panel) 100%);
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
        }
        .cd-journal p {
          margin-top: 0;
          font-style: italic;
        }
        .cd-journal strong {
          color: var(--cd-accent-amber);
        }
        .cd-journal-rich {
          white-space: pre-wrap;
        }
        .cd-rt-bold { font-weight: bold; }
        .cd-rt-italic { font-style: italic; }
        .cd-rt-strike { text-decoration: line-through; }
        .cd-rt-underline { text-decoration: underline; }
        .cd-rt-code {
          font-family: var(--cd-font-terminal);
          background: rgba(0, 0, 0, 0.4);
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
        }
        .cd-quick-update {
          display: flex;
          flex-wrap: wrap;
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
