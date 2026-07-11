import { useState } from 'react';
import { Field, Button, SettingsToggle } from '../ds';
import { probeConnection, fetchDatabaseProperties, validateSchema, fetchRecentReflections } from './services/NotionService';
import { getDayOfYear } from './utils/date';
import { createIdbKv } from '../shared/notify/idbKv';
import { registerPeriodicSync, unregisterPeriodicSync } from '../shared/notify/periodicSync';
import { requestPermission, capabilities } from '../shared/notify/permission';
import { gatherDiagnostics, NotifyDiagnostics } from '../shared/notify/diagnostics';
import { useDiagnosticsReveal } from '../shared/notify/useDiagnosticsReveal';
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

  // Reminders State
  const [reminderEnabled, setReminderEnabled] = useState(() => localStorage.getItem('daily-stoic:reminder-enabled') === 'true');
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem('daily-stoic:reminder-time') || '08:00');
  
  // Profile State
  const [birthDate, setBirthDate] = useState(() => localStorage.getItem('daily-stoic:birthdate') || '');

  // Diagnostics State
  const [isDiagnosticsVisible, setIsDiagnosticsVisible] = useState(false);
  const [diagnostics, setDiagnostics] = useState<NotifyDiagnostics | null>(null);

  const caps = capabilities();

  const syncIdb = async (enabledVal: boolean, timeVal: string) => {
    const today = getDayOfYear();
    let todayLogged = false;

    if (token.trim() && database.trim()) {
      try {
        const records = await fetchRecentReflections(token, database);
        todayLogged = records.some((r) => r.quoteId === today);
      } catch {
        /* ignore */
      }
    } else {
      const val = localStorage.getItem(`daily-stoic:reflection-${today}`);
      todayLogged = !!val && val.trim() !== '';
    }

    const kv = createIdbKv('daily-stoic-reminders');
    await kv.set('state', {
      enabled: enabledVal,
      time: timeVal,
      todayLogged,
    });
  };

  const handleToggleReminder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      const perm = await requestPermission();
      if (perm !== 'granted') {
        alert('Notification permissions are required to enable reminders. Please grant permission in your browser.');
        return;
      }
      localStorage.setItem('daily-stoic:reminder-enabled', 'true');
      setReminderEnabled(true);
      void registerPeriodicSync('daily-stoic-reminders', 43200000);
      await syncIdb(true, reminderTime);
    } else {
      localStorage.setItem('daily-stoic:reminder-enabled', 'false');
      setReminderEnabled(false);
      void unregisterPeriodicSync('daily-stoic-reminders');
      await syncIdb(false, reminderTime);
    }
  };

  const handleTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    localStorage.setItem('daily-stoic:reminder-time', newTime);
    setReminderTime(newTime);
    await syncIdb(reminderEnabled, newTime);
  };

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
      await probeConnection(token, database);
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

  const triggerDiagnosticsReveal = useDiagnosticsReveal(async () => {
    const data = await gatherDiagnostics({
      dbName: 'daily-stoic-reminders',
      keys: ['state', 'lastNudgeSent'],
    });
    setDiagnostics(data);
    setIsDiagnosticsVisible(true);
  });

  return (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <h2 className={styles.settingsTitle} onClick={triggerDiagnosticsReveal} style={{ cursor: 'pointer' }}>
          Settings
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕ Close
        </Button>
      </div>

      <div className={styles.settingsForm}>
        <h3 className={styles.sectionTitle}>Profile & Perspective</h3>
        <Field
          label="Birth Date"
          type="date"
          value={birthDate}
          onChange={(e) => {
            localStorage.setItem('daily-stoic:birthdate', e.target.value);
            setBirthDate(e.target.value);
          }}
          hint="Required to calculate the Memento Mori life progress grid."
        />

        <hr className={styles.settingsDivider} />

        <h3 className={styles.sectionTitle}>Notion Sync Settings</h3>
        <p className={styles.settingsIntro}>
          Configure your Bring-Your-Own-Key Notion connection. Your token and database link are saved locally on this device.
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

        <hr className={styles.settingsDivider} />

        <div className={styles.settingsForm}>
          <h3 className={styles.sectionTitle}>User Experience</h3>
          <SettingsToggle
            label="Show In-Page Guides"
            hint="Display helpful tooltips (twisties) to explain Stoic concepts like Amor Fati and Memento Mori."
            checked={localStorage.getItem('daily-stoic:show-guides') !== 'false'}
            onChange={(e) => {
              localStorage.setItem('daily-stoic:show-guides', e.target.checked.toString());
              window.dispatchEvent(new Event('daily-stoic:settings-updated'));
              triggerHaptic('light');
              forceUpdate();
            }}
          />
        </div>

        <hr className={styles.settingsDivider} />

        <div className={styles.reminderSection}>
          <h3 className={styles.sectionTitle}>Habit Reminders</h3>
          <SettingsToggle
            label="Morning Reminder"
            hint={
              !caps.periodicSync
                ? 'Local reminders are only supported when the PWA is installed on Chrome/Edge.'
                : 'Receive a local notification to reflect on today\'s principle.'
            }
            checked={reminderEnabled}
            onChange={handleToggleReminder}
          />

          {reminderEnabled && (
            <div className={styles.reminderTimeRow}>
              <label className={styles.timeLabel}>Reminder Time</label>
              <input
                type="time"
                value={reminderTime}
                onChange={handleTimeChange}
                className={styles.timeInput}
              />
            </div>
          )}
        </div>

        {isDiagnosticsVisible && diagnostics && (
          <div className={styles.diagnosticsPanel} role="dialog">
            <h4 className={styles.diagnosticsTitle}>Notification Diagnostics</h4>
            <pre className={styles.diagnosticsDump}>
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
            <Button variant="ghost" size="sm" onClick={() => setIsDiagnosticsVisible(false)}>
              Hide Diagnostics
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
