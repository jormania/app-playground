import { useState } from 'react';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

export default function Settings({ config, onSave, onThemeChange, onDone }) {
  const [token, setToken] = useState(config.token || '');
  const [transactionsDb, setTransactionsDb] = useState(config.transactionsDb || '');
  const [categoriesDb, setCategoriesDb] = useState(config.categoriesDb || '');
  const [accountsDb, setAccountsDb] = useState(config.accountsDb || '');
  const [theme, setTheme] = useState(config.theme || 'dark');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [testing, setTesting] = useState(false);

  const extractNotionId = (input) => {
    if (!input) return '';
    const str = input.trim();
    const match = str.match(/([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}|[a-fA-F0-9]{32})/);
    return match ? match[1] : str;
  };

  const handleSave = async () => {
    setStatus({ type: '', msg: '' });

    if (!token.trim() && !transactionsDb && !categoriesDb && !accountsDb) {
      handleClear();
      return;
    }

    if (!token.trim() || !transactionsDb || !categoriesDb || !accountsDb) {
      setStatus({ type: 'error', msg: 'Please fill in all fields to connect to Notion.' });
      return;
    }

    setTesting(true);
    try {
      const { NotionClient } = await import('../lib/notionClient');
      const testClient = new NotionClient(token.trim(), {
        categories: extractNotionId(categoriesDb),
        accounts: extractNotionId(accountsDb),
        transactions: extractNotionId(transactionsDb)
      });
      
      // Test the connection by fetching one of the databases
      await testClient.fetchCategories();
      
      setStatus({ type: 'success', msg: 'Connection successful!' });
      
      onSave({ 
        token: token.trim(), 
        transactionsDb: extractNotionId(transactionsDb), 
        categoriesDb: extractNotionId(categoriesDb), 
        accountsDb: extractNotionId(accountsDb), 
        theme 
      });
      
      setTimeout(() => {
        if (onDone) onDone();
      }, 1000);
    } catch (e) {
      setStatus({ type: 'error', msg: 'Connection failed: Please check your Token and Database IDs.' });
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    onSave({ theme });
    setToken('');
    setTransactionsDb('');
    setCategoriesDb('');
    setAccountsDb('');
    if (onDone) onDone();
  };

  const handleThemeToggle = (newTheme) => {
    setTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  return (
    <div style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: 'var(--color-muted)', margin: 0 }}>Configure your Notion integration here.</p>
        <SegmentedControl
          value={theme}
          onChange={handleThemeToggle}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ]}
          size="sm"
        />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Field label="Notion Integration Token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ntn_..." />
        <Field label="Categories Database ID or Link" type="text" value={categoriesDb} onChange={e => setCategoriesDb(e.target.value)} />
        <Field label="Accounts Database ID or Link" type="text" value={accountsDb} onChange={e => setAccountsDb(e.target.value)} />
        <Field label="Transactions Database ID or Link" type="text" value={transactionsDb} onChange={e => setTransactionsDb(e.target.value)} />
      </div>

      {status.msg && (
        <div style={{ 
          padding: 'var(--space-sm)', 
          borderRadius: 'var(--radius-md)', 
          backgroundColor: status.type === 'error' ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 199, 89, 0.1)',
          color: status.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
          border: `1px solid ${status.type === 'error' ? 'rgba(255, 59, 48, 0.2)' : 'rgba(52, 199, 89, 0.2)'}`
        }}>
          {status.msg}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
        <Button variant="primary" onClick={handleSave} disabled={testing}>
          {testing ? 'Testing...' : 'Save Configuration'}
        </Button>
        <Button variant="secondary" onClick={handleClear} disabled={testing}>Clear / Demo Mode</Button>
      </div>
    </div>
  );
}
