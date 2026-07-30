import { useState } from 'react';
import { SettingsToggle } from '../../ds/components/SettingsToggle';
import { Button } from '../../ds/components/Button';
import { readJson, writeJson } from '../lib/storage';
import {
  enableReminders, unregisterPeriodicSync, capabilities, notificationPermission,
  writeReminderState, REMINDERS_DB, REMINDERS_STORE, STATE_KEY, SENT_KEY,
} from '../lib/reminders';
import { gatherDiagnostics } from '../../shared/notify/diagnostics';
import { useDiagnosticsReveal } from '../../shared/notify/useDiagnosticsReveal';

const ENABLED_KEY = 'whereItWent_reminders_enabled';

/**
 * The opt-in for background reminders about upcoming recurring transactions
 * (a subscription charge or income you collect, like rent), plus the
 * tap-to-reveal diagnostics panel every app on this foundation carries.
 *
 * Honesty is the point here: background delivery only works in an installed PWA
 * on Chromium, and Periodic Background Sync timing is a lower bound rather than
 * a promise. Saying so up front beats a toggle that looks broken on iOS.
 */
export default function ReminderSettings({ data, leadDays }) {
  const [enabled, setEnabled] = useState(() => readJson(ENABLED_KEY, false));
  const [permission, setPermission] = useState(() => notificationPermission());
  const [busy, setBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);

  const caps = capabilities();
  // Seven quick taps on the heading, same gesture the other notify-based apps
  // use — the only way to see why a background reminder went quiet without
  // attaching devtools to a phone.
  const [revealed, setRevealed] = useState(false);
  const onHeadingTap = useDiagnosticsReveal(() => setRevealed(true));

  const handleToggle = async (next) => {
    setBusy(true);
    try {
      let on = false;
      if (next) {
        const result = await enableReminders();
        setPermission(result);
        // Only claim it's on if permission actually came back granted —
        // otherwise the toggle would sit "on" while nothing could ever fire.
        on = result === 'granted';
      } else {
        await unregisterPeriodicSync();
      }
      setEnabled(on);
      writeJson(ENABLED_KEY, on);

      // Re-mirror immediately. App's snapshot effect keys off the *data*, which
      // this toggle doesn't touch — so without this the worker would keep
      // reading `enabled: false` until the next reload, and nothing would fire.
      await writeReminderState(data, { enabled: on, leadDays });
    } finally {
      setBusy(false);
    }
  };

  const showDiagnostics = async () => {
    setDiagnostics({ status: 'gathering…' });
    // `gatherDiagnostics` awaits `navigator.serviceWorker.ready`, which never
    // settles when no worker has been registered — and registration is
    // production-only (see CLAUDE.md). Without this race the button silently
    // does nothing forever in dev, which is the exact opposite of what a
    // diagnostics panel is for.
    const timeout = new Promise(resolve => setTimeout(() => resolve({
      unavailable: 'Timed out waiting for the service worker. Expected in dev, where the worker is deliberately not registered; on the deployed app this should return data.',
      permission: notificationPermission(),
    }), 3000));

    try {
      setDiagnostics(await Promise.race([
        gatherDiagnostics({ dbName: REMINDERS_DB, storeName: REMINDERS_STORE, keys: [STATE_KEY, SENT_KEY] }),
        timeout,
      ]));
    } catch (e) {
      setDiagnostics({ error: e?.message || String(e) });
    }
  };

  let statusNote = null;
  if (!caps.notifications) {
    statusNote = 'This browser cannot show notifications, so reminders stay in-app only.';
  } else if (permission === 'denied') {
    statusNote = 'Notifications are blocked for this site — allow them in your browser settings, then try again.';
  } else if (!caps.periodicSync) {
    statusNote = 'Background wake-ups need an installed app on Chromium. Reminders will still appear the next time you open WhereItWent.';
  }

  return (
    <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-xl)', borderTop: '1px solid var(--color-border)' }}>
      <h2
        style={{ margin: '0 0 var(--space-xs) 0', fontSize: 'var(--text-lg)', color: 'var(--color-ink)', cursor: 'default' }}
        onClick={onHeadingTap}
      >
        Recurring Reminders
      </h2>
      <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
        Get a notification when a recurring transaction is about to happen — a subscription
        charge or income you collect, like rent — even with the app closed. Uses your lead time
        above. Everything happens on this device — nothing is sent anywhere.
      </p>

      <SettingsToggle
        label="Notify me about upcoming transactions"
        checked={enabled}
        disabled={busy || !caps.notifications}
        onChange={e => handleToggle(e.target.checked)}
      />

      {statusNote && (
        <p style={{ marginTop: 'var(--space-sm)', marginBottom: 0, fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontStyle: 'italic' }}>
          {statusNote}
        </p>
      )}

      {revealed && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <Button size="sm" variant="ghost" onClick={showDiagnostics}>Run diagnostics</Button>
          {diagnostics && (
            <pre style={{
              marginTop: 'var(--space-sm)', padding: 'var(--space-sm)',
              backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-xs)', color: 'var(--color-muted)',
              overflowX: 'auto', maxWidth: '100%', boxSizing: 'border-box'
            }}>
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
