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

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [data, setData] = useState({ categories: [], accounts: [], transactions: [], subscriptions: [] });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

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
  }, [config.token, config.categoriesDb, config.accountsDb, config.transactionsDb, config.subscriptionsDb]);

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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-md)' }}>
      <header style={{ 
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', 
        justifyContent: 'space-between', alignItems: 'center', 
        marginBottom: 'var(--space-xl)',
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: 'color-mix(in srgb, var(--color-bg) 75%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: 'var(--space-md)',
        margin: '0 calc(-1 * var(--space-md)) var(--space-xl) calc(-1 * var(--space-md))',
        borderBottom: '1px solid color-mix(in srgb, var(--color-border) 40%, transparent)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <h1 style={{ color: 'var(--color-accent)', margin: 0 }}>WhereItWent</h1>
          <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)}>+ Add</Button>
        </div>
        <SegmentedControl
          size="sm"
          value={activeTab}
          onChange={handleTabChange}
          options={[
            { value: 'dashboard', label: 'Dashboard' },
            { value: 'transactions', label: 'Transactions' },
            { value: 'insights', label: 'Insights' },
            { value: 'settings', label: 'Settings' }
          ]}
        />
      </header>

      <Modal
        isOpen={showAddForm}
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
            {activeTab === 'dashboard' && <Dashboard data={data} client={client} onDataChange={loadData} onNavigate={handleTabChange} />}
            {activeTab === 'transactions' && <TransactionsList data={data} client={client} onDataChange={loadData} />}
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
  );
}
