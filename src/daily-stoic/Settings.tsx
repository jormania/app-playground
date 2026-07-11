import { useState } from 'react';
import { Field, Button } from '../ds';
import { probeConnection, fetchDatabaseProperties, validateSchema } from './services/NotionService';
import styles from './App.module.css';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [token, setToken] = useState(() => localStorage.getItem('daily-stoic:notion-token') || '');
  const [database, setDatabase] = useState(() => localStorage.getItem('daily-stoic:notion-db') || '');
  
  const [status, setStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>((() => {
    const hasToken = !!localStorage.getItem('daily-stoic:notion-token');
    const hasDb = !!localStorage.getItem('daily-stoic:notion-db');
    return (hasToken && hasDb) ? 'connected' : 'idle';
  })());

  const [errors, setErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState('');

  const handleTestConnection = async () => {
    if (!token.trim()) {
      setStatus('error');
      setErrors(['Please enter a Notion Integration Token.']);
      return;
    }
    if (!database.trim()) {
      setStatus('error');
      setErrors(['Please enter a Notion Database Link or ID.']);
      return;
    }

    setStatus('testing');
    setErrors([]);
    setSuccessMsg('');

    try {
      // 1. Probe basic connection
      await probeConnection(token, database);
      
      // 2. Fetch schema and validate
      const props = await fetchDatabaseProperties(token, database);
      const schemaErrors = validateSchema(props);

      if (schemaErrors.length > 0) {
        setStatus('error');
        setErrors([
          'Connected to Notion, but the database schema does not match the playbook requirements:',
          ...schemaErrors,
        ]);
        return;
      }

      // Save to localStorage
      localStorage.setItem('daily-stoic:notion-token', token.trim());
      localStorage.setItem('daily-stoic:notion-db', database.trim());
      
      setStatus('connected');
      setSuccessMsg('Successfully connected and verified! Your reflections will now sync to Notion.');
    } catch (err: any) {
      setStatus('error');
      setErrors([err.message || 'Failed to connect to Notion.']);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('daily-stoic:notion-token');
    localStorage.removeItem('daily-stoic:notion-db');
    setToken('');
    setDatabase('');
    setStatus('idle');
    setErrors([]);
    setSuccessMsg('');
  };

  return (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <h2 className={styles.settingsTitle}>Notion Sync Settings</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕ Close
        </Button>
      </div>

      <div className={styles.settingsForm}>
        <p className={styles.settingsIntro}>
          Configure your Bring-Your-Own-Key Notion connection. Your token and database link are saved locally on this device and are never sent to a server (other than as a secure request header to the Notion API relay).
        </p>

        <Field
          label="Notion Integration Token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="secret_..."
          hint="Create an integration in your Notion workspace integrations page."
        />

        <Field
          label="Notion Database Link or ID"
          type="text"
          value={database}
          onChange={(e) => setDatabase(e.target.value)}
          placeholder="https://www.notion.so/workspace/My-Database-..."
          hint="Paste the URL of your duplicated Starter Template database."
        />

        <div className={styles.settingsActions}>
          <Button onClick={handleTestConnection} disabled={status === 'testing'}>
            {status === 'testing' ? 'Testing...' : 'Test & Save Connection'}
          </Button>

          {status === 'connected' && (
            <Button variant="ghost" onClick={handleDisconnect}>
              Disconnect Database
            </Button>
          )}
        </div>

        {status === 'error' && (
          <div className={styles.statusBoxError} role="alert">
            <span className={styles.statusIcon}>⚠️</span>
            <div className={styles.statusContent}>
              {errors.map((err, idx) => (
                <p key={idx} className={styles.statusText}>{err}</p>
              ))}
            </div>
          </div>
        )}

        {status === 'connected' && successMsg && (
          <div className={styles.statusBoxSuccess} role="status">
            <span className={styles.statusIcon}>✓</span>
            <p className={styles.statusText}>{successMsg}</p>
          </div>
        )}

        {status === 'connected' && !successMsg && (
          <div className={styles.statusBoxSuccess} role="status">
            <span className={styles.statusIcon}>✓</span>
            <p className={styles.statusText}>Connected. Your reflections are currently syncing to Notion.</p>
          </div>
        )}
      </div>
    </div>
  );
}
