import { useState, useReducer } from 'react';
import { Field } from './components/Field';
import { Button } from './components/Button';
import { Switch as SettingsToggle } from './components/Switch';
import { probeConnection, fetchDatabaseProperties, validateSchema, fetchRecentReflections } from './services/NotionService';
import { getDayOfYear } from './utils/date';
import { createIdbKv } from '../shared/notify/idbKv';
import { registerPeriodicSync, unregisterPeriodicSync } from '../shared/notify/periodicSync';
import { requestPermission, capabilities } from '../shared/notify/permission';
import { gatherDiagnostics, NotifyDiagnostics } from '../shared/notify/diagnostics';
import { useDiagnosticsReveal } from '../shared/notify/useDiagnosticsReveal';
import { triggerHaptic } from '../shared/haptics';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
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
  const [morningTime, setMorningTime] = useState(() => localStorage.getItem('daily-stoic:morning-time') || '07:00');
  const [eveningTime, setEveningTime] = useState(() => localStorage.getItem('daily-stoic:evening-time') || '20:00');
  
  // Profile State
  const [birthDate, setBirthDate] = useState(() => localStorage.getItem('daily-stoic:birthdate') || '');

  // Diagnostics State
  const [isDiagnosticsVisible, setIsDiagnosticsVisible] = useState(false);
  const [diagnostics, setDiagnostics] = useState<NotifyDiagnostics | null>(null);

  const caps = capabilities();

  const syncIdb = async (enabledVal: boolean) => {
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
      morningTime: morningTime,
      eveningTime: eveningTime,
      todayLogged,
    });
  };

  const handleToggleReminder = async (checked: boolean) => {
    if (checked) {
      const perm = await requestPermission();
      if (perm !== 'granted') {
        alert('Notification permissions are required to enable reminders. Please grant permission in your browser.');
        return;
      }
      localStorage.setItem('daily-stoic:reminder-enabled', 'true');
      setReminderEnabled(true);
      void registerPeriodicSync('daily-stoic-reminders', 43200000);
      await syncIdb(true);
    } else {
      localStorage.setItem('daily-stoic:reminder-enabled', 'false');
      setReminderEnabled(false);
      void unregisterPeriodicSync('daily-stoic-reminders');
      await syncIdb(false);
    }
  };

  const handleMorningTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    localStorage.setItem('daily-stoic:morning-time', newTime);
    setMorningTime(newTime);
    await syncIdb(reminderEnabled);
  };

  const handleEveningTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    localStorage.setItem('daily-stoic:evening-time', newTime);
    setEveningTime(newTime);
    await syncIdb(reminderEnabled);
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
    <div className="mx-auto max-w-2xl pb-16">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-tertiary">
        <h2 className="font-display text-2xl text-text-primary" onClick={triggerDiagnosticsReveal} style={{ cursor: 'pointer' }}>
          Settings
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕ Close
        </Button>
      </div>

      <div className="flex flex-col gap-8 mb-12">
        <h3 className="font-display text-lg text-text-primary">Profile & Perspective</h3>
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

        <hr className="border-t border-tertiary my-10" />

        <h3 className="font-display text-lg text-text-primary">Notion Sync Settings</h3>
        <p className="text-text-secondary">
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

        <div className="flex items-center gap-3 mt-4">
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
          <div className="mt-4 rounded-lg bg-background-secondary border border-caution/40 p-4 flex items-start gap-3 text-caution" role="alert">
            <span>⚠️</span>
            <div>
              {errors.map((err, idx) => (
                <p key={idx}>{err}</p>
              ))}
            </div>
          </div>
        )}

        {status === 'connected' && successMsg && (
          <div className="mt-4 rounded-lg bg-background-secondary border border-success/40 p-4 flex items-start gap-3 text-success" role="status">
            <span>✓</span>
            <p>{successMsg}</p>
          </div>
        )}

        {status === 'connected' && !successMsg && (
          <div className="mt-4 rounded-lg bg-background-secondary border border-success/40 p-4 flex items-start gap-3 text-success" role="status">
            <span>✓</span>
            <p>Connected. Your reflections are currently syncing to Notion.</p>
          </div>
        )}

        <hr className="border-t border-tertiary my-10" />

        <div className="flex flex-col gap-8">
          <h3 className="font-display text-lg text-text-primary">User Experience</h3>
          <SettingsToggle
            label="Show In-Page Guides"
            hint="Display helpful tooltips (twisties) to explain Stoic concepts like Amor Fati and Memento Mori."
            checked={localStorage.getItem('daily-stoic:show-guides') !== 'false'}
            onChange={(checked) => {
              localStorage.setItem('daily-stoic:show-guides', checked.toString());
              window.dispatchEvent(new Event('daily-stoic:settings-updated'));
              triggerHaptic('light');
              forceUpdate();
            }}
          />
        </div>

        <hr className="border-t border-tertiary my-10" />

        <div className="flex flex-col gap-8">
          <h3 className="font-display text-lg text-text-primary">Habit Reminders</h3>
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
            <div className="flex flex-col gap-4 mt-6 pl-2 border-l-2 border-tertiary">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-4">Morning Prep Time (Premeditatio Malorum)</label>
                    <input
                      type="time"
                      value={morningTime}
                      onChange={handleMorningTimeChange}
                      className="w-full sm:w-auto rounded-md bg-background-tertiary border border-tertiary px-3 py-2 text-text-primary focus:border-accent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-4">Evening Review Time (Reflection)</label>
                    <input
                      type="time"
                      value={eveningTime}
                      onChange={handleEveningTimeChange}
                      className="w-full sm:w-auto rounded-md bg-background-tertiary border border-tertiary px-3 py-2 text-text-primary focus:border-accent outline-none"
                    />
                  </div>
                </div>
          )}
        </div>

        {isDiagnosticsVisible && diagnostics && (
          <div className="mt-10 rounded-lg border border-tertiary p-4 bg-background-secondary text-xs font-mono text-text-secondary overflow-auto" role="dialog">
            <h4 className="font-medium mb-2">Notification Diagnostics</h4>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={() => setIsDiagnosticsVisible(false)}>
                Hide Diagnostics
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
