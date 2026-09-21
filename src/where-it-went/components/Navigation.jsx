import { Calendar, ChartNoAxesColumn, Filter, LayoutGrid, List, Plus, Settings } from 'lucide-react';
import { Button } from '../../ds/components/Button';
import { formatPeriodLabel } from '../lib/period';

// lucide, at the 20px the nav has always drawn these at. The app already
// imports the library in seven other files; these were pasted Feather markup.
const Icons = {
  dashboard: <LayoutGrid size={20} />,
  transactions: <List size={20} />,
  insights: <ChartNoAxesColumn size={20} />,
  settings: <Settings size={20} />,
  filter: <Filter size={20} />,
  calendar: <Calendar size={20} />
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
        <h1 className="nav-logo" style={{ color: 'var(--color-accent)', margin: 0, cursor: 'pointer', marginRight: 'var(--space-md)' }} onClick={() => onTabChange('dashboard')}>
          <span className="nav-logo-short">WiW</span>
          <span className="nav-logo-full">WhereItWent</span>
        </h1>
        <Button variant="primary" size="sm" onClick={onAddClick} style={{ padding: '4px 12px' }} className="nav-add-btn nav-add-btn-classic">
          <span className="nav-add-icon">
            <Plus size={20} />
          </span>
          <span className="nav-add-text">Add</span>
        </Button>
        <Button variant="primary" size="sm" onClick={onAddClick} style={{ padding: '4px 12px' }} className="nav-add-btn nav-add-btn-modern">
          <span className="nav-add-icon">
            <Plus size={20} />
          </span>
          <span className="nav-add-text">Add Transaction</span>
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
          const btn = (
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
          
          if (tab === 'settings') {
            const filterBtn = (
              <button
                key="modern-filter"
                className="nav-tab-btn nav-controls-modern"
                onClick={onFilterClick}
                title={filtersActive ? 'Filters active — tap to change' : 'Filter'}
                aria-label={filtersActive ? 'Filters active — tap to change' : 'Filter'}
                style={filtersActive ? { position: 'relative' } : undefined}
              >
                {Icons.filter}
                <span className="nav-tab-text">Filter</span>
                {filtersActive && (
                  <span aria-hidden style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--color-accent)', border: '1px solid var(--color-bg)' }} />
                )}
              </button>
            );
            
            const periodBtn = (
              <button
                key="modern-period"
                className="nav-tab-btn nav-controls-modern"
                onClick={onPeriodClick}
                title={periodLabel}
                aria-label={`Change period, currently ${periodLabel}`}
              >
                {Icons.calendar}
                <span className="nav-tab-text">Select</span>
              </button>
            );
            
            return [filterBtn, periodBtn, btn];
          }
          
          return btn;
        })}
      </div>

      <div className="nav-controls" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginLeft: 'var(--space-xs)' }}>
        <button
          className="nav-filter-btn"
          onClick={onFilterClick}
          title={filtersActive ? 'Filters active — tap to change' : 'Filter'}
          aria-label={filtersActive ? 'Filters active — tap to change' : 'Filter'}
          style={filtersActive ? { position: 'relative' } : undefined}
        >
          {Icons.filter}
          {filtersActive && (
            <span aria-hidden style={{ position: 'absolute', top: 0, right: -2, width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-accent)', border: '2px solid var(--color-bg)' }} />
          )}
        </button>

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
