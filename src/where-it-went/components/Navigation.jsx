import { Button } from '../../ds/components/Button';
import { formatPeriodLabel } from '../lib/period';

// SVG Icons
const Icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
  ),
  transactions: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
  ),
  insights: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
  ),
  filter: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
  )
};

export default function Navigation({ activeTab, onTabChange, onAddClick, period, onPeriodClick, onFilterClick, filtersActive, duplicateCount = 0 }) {
  const tabs = ['dashboard', 'transactions', 'insights', 'settings'];
  const periodLabel = formatPeriodLabel(period, new Date(), { short: true });

  return (
    <header className="mobile-nav-header" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      padding: 'var(--space-sm) var(--space-md)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      backgroundColor: 'color-mix(in srgb, var(--color-bg) 85%, transparent)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid color-mix(in srgb, var(--color-border) 40%, transparent)',
      // Rendered outside the 800px reading column now, so it spans the window
      // on its own — no negative margins needed to escape the padding.
      marginBottom: 'var(--space-md)'
    }}>
      <div className="nav-brand-container" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
        <h1 className="nav-logo" style={{ color: 'var(--color-accent)', margin: 0, cursor: 'pointer' }} onClick={() => onTabChange('dashboard')}>
          W<span className="nav-logo-text">hereItWent</span>
        </h1>
        <Button variant="primary" size="sm" onClick={onAddClick} style={{ padding: '4px 12px' }} className="nav-add-btn nav-add-btn-classic">
          <span className="nav-add-icon">+</span>
          <span className="nav-add-text">&nbsp;Add</span>
        </Button>
      </div>

      <div className="nav-spacer" style={{ flex: 1 }} />

      <div className="nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab;
          // Surfaces the ledger's duplicate-review count where it can actually
          // be noticed, rather than only after already opening Transactions —
          // same dot the filter button uses, in warning tone since it's
          // "something to look at" rather than "a filter is on".
          const showDupeDot = tab === 'transactions' && duplicateCount > 0;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              title={showDupeDot ? `${duplicateCount} possible duplicate${duplicateCount === 1 ? '' : 's'} to review` : tab}
              aria-current={isActive ? 'page' : undefined}
              style={showDupeDot ? { position: 'relative' } : undefined}
            >
              {Icons[tab]}
              <span className="nav-tab-text">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              {showDupeDot && (
                <span aria-hidden style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--color-warning)', border: '1px solid var(--color-bg)' }} />
              )}
            </button>
          );
        })}
      </div>

      <div className="nav-controls" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginLeft: 'var(--space-xs)' }}>
        <Button variant="primary" size="sm" onClick={onAddClick} style={{ padding: '4px 12px' }} className="nav-add-btn nav-add-btn-modern">
          <span className="nav-add-icon">+</span>
          <span className="nav-add-text">&nbsp;Add</span>
        </Button>

        {['transactions', 'dashboard', 'insights'].includes(activeTab) && (
          <button
            className="nav-filter-btn"
            onClick={onFilterClick}
            title={filtersActive ? 'Filters active — tap to change' : 'Filter'}
            aria-label={filtersActive ? 'Filters active — tap to change' : 'Filter'}
            style={filtersActive ? { position: 'relative' } : undefined}
          >
            {Icons.filter}
            {filtersActive && (
              <span aria-hidden style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--color-accent)', border: '1px solid var(--color-bg)' }} />
            )}
          </button>
        )}

        <button
          className="nav-period-btn"
          onClick={onPeriodClick}
          title={periodLabel}
          aria-label={`Change period, currently ${periodLabel}`}
        >
          {Icons.calendar}
        </button>
      </div>
    </header>
  );
}
