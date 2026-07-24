import { useState, useEffect } from 'react';
import { NotionClient } from './lib/notionClient';
import Dashboard from './components/Dashboard';
import TransactionsList from './components/TransactionsList';
import Settings from './components/Settings';
import { SegmentedControl } from '../ds/components/SegmentedControl';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [data, setData] = useState({ categories: [], accounts: [], transactions: [] });
  const [loading, setLoading] = useState(true);

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
    transactions: config.transactionsDb
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [categories, accounts, transactions] = await Promise.all([
        client.fetchCategories(),
        client.fetchAccounts(),
        client.fetchTransactions()
      ]);
      setData({ categories, accounts, transactions });
    } catch (e) {
      console.error("Failed to fetch data:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [config.token, config.categoriesDb, config.accountsDb, config.transactionsDb]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme || 'dark');
  }, [config.theme]);

  const handleConfigSave = (newConfig) => {
    localStorage.setItem('whereItWent_config', JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  const handleThemeChange = (newTheme) => {
    const updated = { ...config, theme: newTheme };
    handleConfigSave(updated);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-md)' }}>
      <header style={{ 
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', 
        justifyContent: 'space-between', alignItems: 'center', 
        marginBottom: 'var(--space-xl)',
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: 'var(--color-bg)',
        padding: 'var(--space-sm) 0',
        margin: '0 calc(-1 * var(--space-md)) var(--space-xl) calc(-1 * var(--space-md))',
        paddingLeft: 'var(--space-md)', paddingRight: 'var(--space-md)'
      }}>
        <h1 style={{ color: 'var(--color-accent)', margin: 0 }}>WhereItWent</h1>
        <SegmentedControl
          value={activeTab}
          onChange={handleTabChange}
          options={[
            { value: 'dashboard', label: 'Dashboard' },
            { value: 'transactions', label: 'Transactions' },
            { value: 'settings', label: 'Settings' }
          ]}
        />
      </header>

      <main>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard data={data} />}
            {activeTab === 'transactions' && <TransactionsList data={data} client={client} onDataChange={loadData} />}
            {activeTab === 'settings' && <Settings config={config} onSave={handleConfigSave} onThemeChange={handleThemeChange} onDone={() => setActiveTab(previousTab)} />}
          </>
        )}
      </main>
    </div>
  );
}
