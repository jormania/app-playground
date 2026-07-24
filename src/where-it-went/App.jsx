import { useState, useEffect } from 'react';
import { NotionClient } from './lib/notionClient';
import Dashboard from './components/Dashboard';
import TransactionsList from './components/TransactionsList';
import Settings from './components/Settings';
import InsightsView from './components/InsightsView';
import TransactionForm from './components/TransactionForm';
import { SegmentedControl } from '../ds/components/SegmentedControl';
import { Button } from '../ds/components/Button';
import { Modal } from '../ds/components/Modal';
import { useSubscriptionsEngine } from './lib/useSubscriptionsEngine';
import Navigation from './components/Navigation';
import PeriodSheet from './components/PeriodSheet';
import FilterSheet from './components/FilterSheet';
import { DEMO_CATEGORIES, DEMO_ACCOUNTS, DEMO_TRANSACTIONS, DEMO_SUBSCRIPTIONS } from './models/demoData';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [data, setData] = useState({ categories: [], accounts: [], transactions: [], subscriptions: [] });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Lifted global states for Navigation
  const [period, setPeriod] = useState('this_month');
  const [filterType, setFilterType] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sheet visibility states
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const handleTabChange = (newTab) => {
    if (newTab === 'settings' && activeTab !== 'settings') {
      setPreviousTab(activeTab);
    }
    setActiveTab(newTab);
  };
  
  const [config, setConfig] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('whereItWent_config')) || {};
    } catch {
      return {};
    }
  });

  const client = new NotionClient(config.token, {
    categories: config.categoriesDb,
    accounts: config.accountsDb,
    transactions: config.transactionsDb,
    subscriptions: config.subscriptionsDb
  });

  const loadData = async () => {
    setLoading(true);
    
    if (config.demoMode) {
      setData({
        categories: [...DEMO_CATEGORIES],
        accounts: [...DEMO_ACCOUNTS],
        transactions: [...DEMO_TRANSACTIONS],
        subscriptions: [...DEMO_SUBSCRIPTIONS]
      });
      setLoading(false);
      return;
    }
    
    try {
      const [categories, accounts, transactions, subscriptions] = await Promise.all([
        client.fetchCategories(),
        client.fetchAccounts(),
        client.fetchTransactions(),
        client.fetchSubscriptions()
      ]);
      setData({ categories, accounts, transactions, subscriptions });
    } catch (e) {
      console.error("Failed to fetch data:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [config.token, config.categoriesDb, config.accountsDb, config.transactionsDb, config.subscriptionsDb, config.demoMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme || 'dark');
  }, [config.theme]);

  // Run the subscription engine
  useSubscriptionsEngine({ data, client, onDataChange: loadData });

  const handleConfigSave = (newConfig) => {
    localStorage.setItem('whereItWent_config', JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  const handleThemeChange = (newTheme) => {
    const updated = { ...config, theme: newTheme };
    handleConfigSave(updated);
  };

  const handleAddTransaction = async (tx) => {
    await client.addTransaction(tx);
    loadData();
    setShowAddForm(false);
  };

  return (
    <>
      {config.demoMode && (
        <div style={{ backgroundColor: 'var(--color-danger)', color: 'white', padding: 'var(--space-sm) var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
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
          onSave={handleAddTransaction} 
          onCancel={() => setShowAddForm(false)} 
        />
      </Modal>

      <main>
        {loading ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="shimmer-bg" style={{ height: '100px', borderRadius: 'var(--radius-lg)' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
              <div className="shimmer-bg" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
              <div className="shimmer-bg" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard data={data} client={client} onDataChange={loadData} onNavigate={handleTabChange} config={config} period={period} filterProps={{ filterType, categoryFilter, searchQuery }} />}
            {activeTab === 'transactions' && <TransactionsList data={data} client={client} onDataChange={loadData} filterProps={{ filterType, categoryFilter, searchQuery }} period={period} />}
            {activeTab === 'insights' && <InsightsView data={data} />}
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
