import { useState, useEffect, useMemo, useCallback } from 'react';
import { NotionClient } from './lib/notionClient';
import Dashboard from './components/Dashboard';
import TransactionsList from './components/TransactionsList';
import Settings from './components/Settings';
import InsightsView from './components/InsightsView';
import TransactionForm from './components/TransactionForm';
import { Button } from '../ds/components/Button';
import { Modal } from '../ds/components/Modal';
import { AlertModal } from '../ds';
import { useSubscriptionsEngine } from './lib/useSubscriptionsEngine';
import { readJson, writeJson } from './lib/storage';
import Navigation from './components/Navigation';
import PeriodSheet from './components/PeriodSheet';
import FilterSheet from './components/FilterSheet';
import { DEMO_CATEGORIES, DEMO_ACCOUNTS, DEMO_TRANSACTIONS, DEMO_SUBSCRIPTIONS, DEMO_TRIPS } from './models/demoData';

const EMPTY_DATA = { categories: [], accounts: [], transactions: [], subscriptions: [], trips: [] };

export default function App() {
  const [uiState] = useState(() => readJson('whereItWent_ui_state', {}));

  const [activeTab, setActiveTab] = useState(uiState.activeTab || 'dashboard');
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Lifted global states for Navigation
  const [period, setPeriod] = useState(uiState.period || 'this_month');
  const [filterType, setFilterType] = useState(uiState.filterType || 'All');
  const [categoryFilter, setCategoryFilter] = useState(uiState.categoryFilter || 'All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    writeJson('whereItWent_ui_state', { activeTab, period, filterType, categoryFilter });
  }, [activeTab, period, filterType, categoryFilter]);

  // Sheet visibility states
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const handleTabChange = (newTab) => {
    if (newTab === 'settings' && activeTab !== 'settings') {
      setPreviousTab(activeTab);
    }
    setActiveTab(newTab);
  };

  const [config, setConfig] = useState(() => readJson('whereItWent_config', {}));

  // Stable identity: a fresh client on every render re-triggered every effect that
  // depends on it (notably the subscriptions engine).
  const client = useMemo(() => new NotionClient(config.token, {
    categories: config.categoriesDb,
    accounts: config.accountsDb,
    transactions: config.transactionsDb,
    subscriptions: config.subscriptionsDb,
    trips: config.tripsDb
  }), [config.token, config.categoriesDb, config.accountsDb, config.transactionsDb, config.subscriptionsDb, config.tripsDb]);

  // Likewise: an inline object literal here busted InsightsView's useMemo on every
  // render, re-running the whole analytics engine each time.
  const filterProps = useMemo(
    () => ({ filterType, categoryFilter, searchQuery }),
    [filterType, categoryFilter, searchQuery]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (config.demoMode) {
      setData({
        categories: [...DEMO_CATEGORIES],
        accounts: [...DEMO_ACCOUNTS],
        transactions: [...DEMO_TRANSACTIONS],
        subscriptions: [...DEMO_SUBSCRIPTIONS],
        trips: [...DEMO_TRIPS]
      });
      setLoading(false);
      return;
    }

    try {
      const [categories, accounts, transactions, subscriptions, trips] = await Promise.all([
        client.fetchCategories(),
        client.fetchAccounts(),
        client.fetchTransactions(),
        client.fetchSubscriptions(),
        client.fetchTrips()
      ]);
      setData({ categories, accounts, transactions, subscriptions, trips });
    } catch (e) {
      console.error('Failed to fetch data:', e);
      setLoadError(e.message || 'Failed to load data from Notion.');
    }
    setLoading(false);
  }, [client, config.demoMode]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme || 'dark');
  }, [config.theme]);

  // Auto-post missed subscription charges — never against the demo fixture.
  useSubscriptionsEngine({ data, client, onDataChange: loadData, enabled: !config.demoMode });

  const handleConfigSave = (newConfig) => {
    writeJson('whereItWent_config', newConfig);
    setConfig(newConfig);
  };

  const handleThemeChange = (newTheme) => {
    handleConfigSave({ ...config, theme: newTheme });
  };

  /**
   * TransactionForm always calls `onSave(id, txData)` — `id` is null when adding.
   * This handler used to take a single `tx` argument, so it received that null and
   * every "+ Add" ended in a TypeError with the modal still open and nothing saved.
   */
  const handleAddTransaction = async (_id, tx) => {
    try {
      await client.addTransaction(tx);
      await loadData();
      setShowAddForm(false);
    } catch (e) {
      console.error('Failed to add transaction:', e);
      setSaveError(e.message || 'Could not save the transaction to Notion.');
      throw e; // let the form clear its saving state and stay open
    }
  };

  return (
    <>
      {config.demoMode && (
        <div style={{ backgroundColor: 'var(--color-danger)', color: 'white', padding: 'var(--space-sm) var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 100 }}>
          <span style={{ fontWeight: 'bold' }}>DEMO MODE ACTIVE</span>
          <button
            style={{ padding: '4px 8px', fontSize: '12px', background: 'white', color: 'var(--color-danger)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => handleConfigSave({ ...config, demoMode: false })}
          >
            Stop Demo
          </button>
        </div>
      )}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-md)' }}>
      <Navigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAddClick={() => setShowAddForm(true)}
        period={period}
        onPeriodClick={() => setShowPeriodSheet(true)}
        onFilterClick={() => setShowFilterSheet(true)}
        filtersActive={filterType !== 'All' || categoryFilter !== 'All' || searchQuery.trim() !== ''}
      />

      <PeriodSheet
        isOpen={showPeriodSheet}
        onClose={() => setShowPeriodSheet(false)}
        period={period}
        onPeriodChange={setPeriod}
      />

      <FilterSheet
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        categories={data.categories}
        filterType={filterType}
        categoryFilter={categoryFilter}
        searchQuery={searchQuery}
        onApply={({ filterType: ft, categoryFilter: cf, searchQuery: sq }) => {
          setFilterType(ft);
          setCategoryFilter(cf);
          setSearchQuery(sq);
        }}
      />

      <Modal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="New Transaction"
      >
        <TransactionForm
          categories={data.categories}
          accounts={data.accounts}
          trips={data.trips}
          onSave={handleAddTransaction}
          onCancel={() => setShowAddForm(false)}
        />
      </Modal>

      <AlertModal
        isOpen={!!saveError}
        title="Could not save"
        message={saveError || ''}
        onClose={() => setSaveError(null)}
      />

      <main>
        {loading ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }} className="skeleton-kpi-grid">
              {[1, 2, 3].map(i => (
                <div key={i} className="shimmer-bg" style={{ height: '90px', borderRadius: 'var(--radius-lg)' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
              <div className="shimmer-bg" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
              <div className="shimmer-bg" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
            </div>
          </div>
        ) : loadError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', marginTop: 'var(--space-xl)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>⚠️</div>
            <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-danger)' }}>Could Not Load Data</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)', maxWidth: '400px' }}>
              {loadError} — Check your Notion token and database IDs in Settings.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button variant="primary" onClick={loadData}>↻ Retry</Button>
              <Button variant="ghost" onClick={() => handleTabChange('settings')}>Open Settings</Button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard data={data} client={client} onDataChange={loadData} onNavigate={handleTabChange} config={config} period={period} filterProps={filterProps} />}
            {activeTab === 'transactions' && <TransactionsList data={data} client={client} onDataChange={loadData} filterProps={filterProps} period={period} />}
            {activeTab === 'insights' && <InsightsView data={data} period={period} filterProps={filterProps} />}
            {activeTab === 'settings' && (
              <Settings
                config={config}
                onSave={handleConfigSave}
                onThemeChange={handleThemeChange}
                onDone={() => handleTabChange(previousTab)}
                data={data}
                client={client}
                onDataChange={loadData}
              />
            )}
          </>
        )}
      </main>
    </div>
    </>
  );
}
