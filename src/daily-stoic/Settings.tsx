import { useState, useReducer } from 'react';
import { Field } from './components/Field';
import { Button } from './components/Button';
import { Switch as SettingsToggle } from './components/Switch';
import { probeConnection, fetchDatabaseProperties, validateSchema, fetchRecentReflections, upgradeDatabaseSchema } from './services/NotionService';
import { getCycleDay } from './utils/date';
import { createIdbKv } from '../shared/notify/idbKv';
import { registerPeriodicSync, unregisterPeriodicSync } from '../shared/notify/periodicSync';
import { requestPermission, capabilities } from '../shared/notify/permission';
import { gatherDiagnostics, NotifyDiagnostics } from '../shared/notify/diagnostics';
import { useDiagnosticsReveal } from '../shared/notify/useDiagnosticsReveal';
import { useTheme } from './lib/themeContext';
import { triggerHaptic } from '../shared/haptics';
import { cn } from './lib/cn';
import { showToast } from './components/Toast';

interface SettingsProps {
  onClose: () => void;
  onResetCycle: () => Promise<void>;
}

export default function Settings({ onClose, onResetCycle }: SettingsProps) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const [token, setToken] = useState(() => localStorage.getItem('daily-stoic:notion-token') || '');
  const [database, setDatabase] = useState(() => localStorage.getItem('daily-stoic:notion-db') || '');
  const { current, cycle } = useTheme();
  
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
    const cycleStartDate = localStorage.getItem('daily-stoic:cycle-start-date') || '';
    const today = getCycleDay(cycleStartDate);
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
        showToast('Notification permissions are required to enable reminders. Please grant permission in your browser.', 'warning');
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
      try {
        await upgradeDatabaseSchema(token, database);
      } catch (err) {
        console.warn('Failed to upgrade database schema automatically:', err);
      }
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

  const [isResetting, setIsResetting] = useState(false);

  const handleResetCycle = async () => {
    const confirmMsg = 
      "Warning: This will permanently delete all local reflections, mood logs, and passions data, " +
      "and archive (delete) all reflections on your connected Notion database. " +
      "This action is destructive and cannot be undone.\n\n" +
      "Notion credentials will be kept.\n\n" +
      "Are you sure you want to proceed?";
    
    if (!window.confirm(confirmMsg)) return;

    setIsResetting(true);
    triggerHaptic('heavy');

    try {
      await onResetCycle();
      showToast("Cycle reset successfully! Day 1 of the new 365-day cycle begins today.", "success");
      onClose();
    } catch (err: any) {
      showToast("Error resetting cycle: " + (err.message || err), "error");
    } finally {
      setIsResetting(false);
    }
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
    <div className="mx-auto max-w-lg pb-20 px-4">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-tertiary">
        <h2 className="font-display text-xl sm:text-2xl text-text-primary" onClick={triggerDiagnosticsReveal} style={{ cursor: 'pointer' }}>
          Settings
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕ Close
        </Button>
      </div>

      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-4 sm:p-6">
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
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-4 sm:p-6">
          <h3 className="font-display text-lg text-text-primary">Notion Sync Settings</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Configure your Bring-Your-Own-Key Notion connection. Your credentials are saved locally.
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

          <div className="flex items-center gap-3 mt-2">
            <Button onClick={handleTestConnection} disabled={status === 'testing'}>
              {status === 'testing' ? 'Testing...' : 'Test & Save Connection'}
            </Button>

            {status === 'connected' && (
              <Button variant="ghost" onClick={handleDisconnect}>
                Disconnect
              </Button>
            )}
          </div>

          {status === 'error' && (
            <div className="rounded-lg bg-background-secondary border border-caution/40 p-4 flex items-start gap-3 text-caution text-sm" role="alert">
              <span>⚠️</span>
              <div>
                {errors.map((err, idx) => (
                  <p key={idx}>{err}</p>
                ))}
              </div>
            </div>
          )}

          {status === 'connected' && successMsg && (
            <div className="rounded-lg bg-background-secondary border border-success/40 p-4 flex items-start gap-3 text-success text-sm" role="status">
              <span>✓</span>
              <p>{successMsg}</p>
            </div>
          )}

          {status === 'connected' && !successMsg && (
            <div className="rounded-lg bg-background-secondary border border-success/40 p-4 flex items-start gap-3 text-success text-sm" role="status">
              <span>✓</span>
              <p>Connected. Reflections are syncing to Notion.</p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-4 sm:p-6">
          <h3 className="font-display text-lg text-text-primary">Appearance</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Customize the visual style of the application. The theme cycles through four light and four dark presets.
          </p>
          <div className="flex items-center justify-between border border-tertiary bg-background-tertiary rounded-lg p-3">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-text-secondary font-mono">Current Palette</span>
              <span className="text-sm font-medium text-text-primary mt-0.5">{current.name}</span>
            </div>
            <Button onClick={() => { cycle(); triggerHaptic('light'); }} variant="secondary" size="sm">
              Cycle Palette ◐
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-4 sm:p-6">
          <h3 className="font-display text-lg text-text-primary">User Experience</h3>
          <SettingsToggle
            label="Show Gentle Concept Guides"
            description="Display twisties with concept details beside reflection forms."
            checked={localStorage.getItem('daily-stoic:show-guides') !== 'false'}
            onCheckedChange={(checked) => {
              localStorage.setItem('daily-stoic:show-guides', checked.toString());
              window.dispatchEvent(new Event('daily-stoic:settings-updated'));
              triggerHaptic('light');
              forceUpdate();
            }}
          />
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-4 sm:p-6">
          <h3 className="font-display text-lg text-text-primary">Habit Reminders</h3>
          <SettingsToggle
            label="Morning & Evening Nudges"
            description={
              !caps.periodicSync
                ? 'Local reminders are only supported when the PWA is installed on Chrome/Edge.'
                : 'Receive local notifications to reflect on today\'s principle.'
            }
            checked={reminderEnabled}
            onCheckedChange={handleToggleReminder}
          />

          {reminderEnabled && (
            <div className="flex flex-col gap-4 mt-2 pl-3 border-l-2 border-accent">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Morning Prep Time</label>
                <input
                  type="time"
                  value={morningTime}
                  onChange={handleMorningTimeChange}
                  className="w-full sm:w-auto rounded-md bg-background-tertiary border border-tertiary px-3 py-2 text-text-primary focus:border-accent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Evening Review Time</label>
                <input
                  type="time"
                  value={eveningTime}
                  onChange={handleEveningTimeChange}
                  className="w-full sm:w-auto rounded-md bg-background-tertiary border border-tertiary px-3 py-2 text-text-primary focus:border-accent outline-none"
                />
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-caution/30 bg-background-secondary p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <h3 className="font-display text-lg text-caution flex items-center gap-2">
            <span>⚠️</span> Destructive Actions
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Resetting your cycle starts the Stoic handbook fresh at Day 1. This permanently deletes your local journal database and archives all synced reflection records on your connected Notion workspace (credentials are kept).
          </p>
          <div className="mt-2">
            <button
              onClick={handleResetCycle}
              disabled={isResetting}
              className={cn(
                "rounded-lg px-4 py-2.5 text-sm font-semibold tracking-wide border transition-all duration-200",
                isResetting
                  ? "bg-caution/20 text-caution border-caution/20 cursor-not-allowed"
                  : "bg-caution text-background-primary border-caution hover:bg-caution/90 hover:shadow-md active:translate-y-0"
              )}
            >
              {isResetting ? 'Resetting Cycle...' : 'Reset 365-Day Cycle'}
            </button>
          </div>
        </section>

        {isDiagnosticsVisible && diagnostics && (
          <div className="rounded-lg border border-tertiary p-4 bg-background-secondary text-xs font-mono text-text-secondary overflow-auto" role="dialog">
            <h4 className="font-medium mb-2">Notification Diagnostics</h4>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsDiagnosticsVisible(false)}>
                Hide Diagnostics
              </Button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('daily-stoic:simulate-celebration', 'true');
                  showToast('Celebration simulation activated! Go back to the reflections dashboard to see it.', 'info');
                  onClose();
                }}
                className="rounded px-2.5 py-1.5 text-xs font-medium border border-tertiary bg-background-tertiary text-text-primary hover:border-accent transition-all duration-200"
              >
                🧪 Simulate Year Completion
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
