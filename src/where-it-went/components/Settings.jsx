import { useState } from 'react';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { SettingsToggle } from '../../ds/components/SettingsToggle';
import { PromptModal } from '../../ds';
import { NotionClient } from '../lib/notionClient';
import SubscriptionEditorModal from './SubscriptionEditorModal';
import TripEditorModal from './TripEditorModal';
import { getCategoryColor } from '../lib/colors';
import { formatCurrency } from '../lib/currency';
import { ordinal } from '../lib/period';
import { DEFAULT_LEAD_DAYS } from '../lib/upcoming';
import { readFailed, discardFailed, retryFailed } from '../lib/outbox';
import { defaultTheme } from '../lib/theme';
import { readJson, writeJson } from '../lib/storage';
import ReminderSettings from './ReminderSettings';

/**
 * A named, persistently-collapsible chunk of Settings.
 *
 * Notion config, feature toggles, upcoming-activity reminders, subscriptions and trips
 * used to be one uninterrupted scroll — fine with a couple of subscriptions
 * and trips, unwieldy with a dozen+ of either. Every section defaults open
 * (nothing changes for anyone who never touches this), but a collapsed choice
 * is remembered per device, so putting a section away is a one-time action,
 * not something you redo on every visit to Settings.
 */
function CollapsibleSection({ id, title, action, children }) {
  const storageKey = `whereItWent_settings_section_${id}`;
  const [open, setOpen] = useState(() => readJson(storageKey, true));

  return (
    <details
      open={open}
      onToggle={e => {
        const next = e.currentTarget.open;
        setOpen(next);
        writeJson(storageKey, next);
      }}
      style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-xl)', borderTop: '1px solid var(--color-border)' }}
    >
      <summary
        className="wiw-settings-summary"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 'var(--space-sm)' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <span aria-hidden style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'inline-block', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{title}</span>
        </span>
        {/* Buttons ("+ Add Subscription" etc.) live in the summary row itself
            but must not toggle the section when clicked. */}
        {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
      </summary>
      <div style={{ marginTop: 'var(--space-md)' }}>{children}</div>
    </details>
  );
}

const EMPTY_CONFIG_FIELDS = {
  token: '', transactionsDb: '', categoriesDb: '', accountsDb: '', subscriptionsDb: '', tripsDb: ''
};

function extractNotionId(input) {
  if (!input) return '';
  const str = input.trim();
  const match = str.match(/([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}|[a-fA-F0-9]{32})/);
  return match ? match[1] : str;
}

export default function Settings({ config, onSave, onThemeChange, onDone, data, client, onDataChange }) {
  const [token, setToken] = useState(config.token || '');
  const [transactionsDb, setTransactionsDb] = useState(config.transactionsDb || '');
  const [categoriesDb, setCategoriesDb] = useState(config.categoriesDb || '');
  const [accountsDb, setAccountsDb] = useState(config.accountsDb || '');
  const [subscriptionsDb, setSubscriptionsDb] = useState(config.subscriptionsDb || '');
  const [tripsDb, setTripsDb] = useState(config.tripsDb || '');
  const [theme, setTheme] = useState(config.theme || defaultTheme());
  // Transfers default OFF — most people don't need to track internal
  // account-to-account moves, so the feature stays invisible until asked for.
  const [features, setFeatures] = useState(config.features || { budgeting: true, cashFlow: true, transfers: false, upcoming: true });
  const [upcomingLeadDays, setUpcomingLeadDays] = useState(config.upcomingLeadDays ?? DEFAULT_LEAD_DAYS);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [showScrubPrompt, setShowScrubPrompt] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [failedJobs, setFailedJobs] = useState(() => readFailed());
  const [isAddingTrip, setIsAddingTrip] = useState(false);

  const buildConfig = (extra = {}) => ({
    token: token.trim(),
    transactionsDb: extractNotionId(transactionsDb),
    categoriesDb: extractNotionId(categoriesDb),
    accountsDb: extractNotionId(accountsDb),
    subscriptionsDb: extractNotionId(subscriptionsDb),
    tripsDb: extractNotionId(tripsDb),
    theme,
    features,
    upcomingLeadDays: Number(upcomingLeadDays) > 0 ? Number(upcomingLeadDays) : DEFAULT_LEAD_DAYS,
    ...extra
  });

  /**
   * Emptying every field and pressing Save is the documented way to disconnect —
   * it used to call a function (`handleClear`) that didn't exist anywhere in this
   * file, throwing a ReferenceError and leaving the form stuck.
   */
  const handleClear = () => {
    setToken('');
    setTransactionsDb('');
    setCategoriesDb('');
    setAccountsDb('');
    setSubscriptionsDb('');
    setTripsDb('');
    // `demoMode: true` is not decoration — it is what the success message below
    // has always claimed. Without it the app served fixture data while the flag
    // read false, so the DEMO MODE banner stayed hidden *and* the subscriptions
    // engine, the reminder snapshot and the offline outbox all treated sample
    // data as real.
    onSave({
      ...EMPTY_CONFIG_FIELDS, theme, features, demoMode: true,
      upcomingLeadDays: Number(upcomingLeadDays) || DEFAULT_LEAD_DAYS,
    });
    setStatus({ type: 'success', msg: 'Disconnected from Notion. You are now in demo mode, exploring sample data — nothing you change here touches your Notion workspace.' });
  };

  const handleSave = async () => {
    setStatus({ type: '', msg: '' });

    if (!token.trim() && !transactionsDb && !categoriesDb && !accountsDb) {
      handleClear();
      return;
    }

    if (!token.trim() || !transactionsDb || !categoriesDb || !accountsDb) {
      setStatus({ type: 'error', msg: 'Please fill in the Token, Categories, Accounts and Transactions fields to connect to Notion.' });
      return;
    }

    setTesting(true);
    try {
      const testClient = new NotionClient(token.trim(), {
        categories: extractNotionId(categoriesDb),
        accounts: extractNotionId(accountsDb),
        transactions: extractNotionId(transactionsDb),
        subscriptions: extractNotionId(subscriptionsDb),
        trips: extractNotionId(tripsDb)
      });

      // Test every configured database, not just Categories — a typo'd Transactions
      // ID used to save cleanly and only surface as the generic load-error screen.
      const checks = [testClient.fetchCategories(), testClient.fetchAccounts(), testClient.fetchTransactions()];
      if (subscriptionsDb) checks.push(testClient.fetchSubscriptions());
      if (tripsDb) checks.push(testClient.fetchTrips());
      await Promise.all(checks);

      setStatus({ type: 'success', msg: 'Connection successful!' });
      onSave(buildConfig());
      setTimeout(() => { if (onDone) onDone(); }, 1000);
    } catch (e) {
      console.error('Notion connection test failed:', e);
      setStatus({ type: 'error', msg: e.message ? `Connection failed: ${e.message}` : 'Connection failed: please check your Token and Database IDs.' });
    } finally {
      setTesting(false);
    }
  };

  const handleScrub = async () => {
    if (!token.trim() || !transactionsDb) {
      onSave(buildConfig({ demoMode: true }));
      if (onDone) onDone();
      return;
    }
    setShowScrubPrompt(true);
  };

  const executeScrub = async () => {
    setShowScrubPrompt(false);
    setTesting(true);
    setScrubProgress({ done: 0, total: null });
    setStatus({ type: '', msg: 'Scrubbing databases... this may take a moment.' });
    try {
      const liveClient = new NotionClient(token.trim(), {
        categories: extractNotionId(categoriesDb),
        accounts: extractNotionId(accountsDb),
        transactions: extractNotionId(transactionsDb),
        subscriptions: extractNotionId(subscriptionsDb),
        trips: extractNotionId(tripsDb)
      });
      const result = await liveClient.scrubTransactionsAndSubscriptions({
        onProgress: (done, total) => setScrubProgress({ done, total })
      });

      onSave(buildConfig({ demoMode: true }));
      setStatus({ type: 'success', msg: `Scrub complete — archived ${result.archived} record${result.archived === 1 ? '' : 's'} in Notion (recoverable from its trash). Entered Demo Mode.` });
      setTimeout(() => { if (onDone) onDone(); }, 1500);
    } catch (e) {
      console.error('Scrub failed:', e);
      setStatus({ type: 'error', msg: e.message ? `Scrub failed partway through: ${e.message}. Some records may already be archived.` : 'Failed to scrub databases.' });
    } finally {
      setTesting(false);
      setScrubProgress(null);
    }
  };

  const handleThemeToggle = (newTheme) => {
    setTheme(newTheme);
    if (onThemeChange) onThemeChange(newTheme);
  };

  return (
    <div style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-ink)', marginBottom: '4px' }}>Notion Integration</h2>
          <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: 'var(--text-sm)' }}>
            Connect your own Notion databases. Leave these empty to explore with sample data instead.
          </p>
        </div>
        <button
          onClick={() => handleThemeToggle(theme === 'dark' ? 'light' : 'dark')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
            color: 'var(--color-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', backgroundColor: 'var(--color-surface)'
          }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>
      </div>

      <CollapsibleSection id="connection" title="Connection Details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Field label="Notion Integration Token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ntn_..." hint="Stored only on this device and sent straight to Notion — never to us." />
          <Field label="Categories Database ID or Link" type="text" value={categoriesDb} onChange={e => setCategoriesDb(e.target.value)} />
          <Field label="Accounts Database ID or Link" type="text" value={accountsDb} onChange={e => setAccountsDb(e.target.value)} />
          <Field label="Transactions Database ID or Link" type="text" value={transactionsDb} onChange={e => setTransactionsDb(e.target.value)} />
          <Field label="Subscriptions Database ID or Link" type="text" value={subscriptionsDb} onChange={e => setSubscriptionsDb(e.target.value)} />
          <Field label="Trips Database ID or Link (Optional)" type="text" value={tripsDb} onChange={e => setTripsDb(e.target.value)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="features" title="Feature Toggles">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Every switch says what it actually changes. Four unlabelled toggles
              are four things you have to turn on and off to find out. */}
          <SettingsToggle
            label="Budget limits"
            hint="Show spending limits per category on the Dashboard, with progress bars."
            checked={features.budgeting}
            onChange={e => setFeatures(f => ({ ...f, budgeting: e.target.checked }))}
          />
          <SettingsToggle
            label="Cash flow"
            hint="Show the income-vs-expenses chart, and the 90-day projection in Insights."
            checked={features.cashFlow}
            onChange={e => setFeatures(f => ({ ...f, cashFlow: e.target.checked }))}
          />
          <SettingsToggle
            label="Transfers"
            hint="Adds a third transaction type for moving money between your own accounts. Transfers are never counted as income or spending."
            checked={features.transfers === true}
            onChange={e => setFeatures(f => ({ ...f, transfers: e.target.checked }))}
          />
          {/* On by default — `!== false` so a config saved before this key
              existed opts in without needing a migration. Named "activity"
              rather than "bills": a recurring subscription can be a charge
              (Spotify) or a payment you collect (rent from a tenant), and
              "bill" only fits one of those. */}
          <SettingsToggle
            label="Upcoming activity"
            hint="Warn you before a recurring transaction happens, on the Dashboard and in a bar at the top."
            checked={features.upcoming !== false}
            onChange={e => setFeatures(f => ({ ...f, upcoming: e.target.checked }))}
          />
        </div>
      </CollapsibleSection>

      {status.msg && (
        <div role="status" style={{
          padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)',
          // Token-derived, not hardcoded rgba: the old literal red/green ignored
          // the theme entirely and would have stayed iOS-red on any repalette.
          backgroundColor: `color-mix(in srgb, ${status.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)'} 12%, transparent)`,
          color: status.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
          border: `1px solid color-mix(in srgb, ${status.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)'} 30%, transparent)`
        }}>
          {status.msg}
          {scrubProgress && scrubProgress.total ? ` (${scrubProgress.done}/${scrubProgress.total})` : ''}
        </div>
      )}

      <div className="settings-action-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
        <Button variant="primary" onClick={handleSave} disabled={testing}>
          {testing ? 'Testing...' : 'Save Configuration'}
        </Button>
        <Button variant="danger" onClick={handleScrub} disabled={testing}>
          Erase Notion data & use samples
        </Button>
      </div>

      {features.upcoming !== false && (
        <ReminderSettings data={data} leadDays={Number(upcomingLeadDays) || DEFAULT_LEAD_DAYS} />
      )}

      {/* Rejected offline writes — surfaced with the real error rather than
          dropped, which is the whole point of the outbox having a dead-letter
          list instead of retrying a malformed write forever. */}
      {failedJobs.length > 0 && (
        <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-xl)', borderTop: '1px solid var(--color-border)' }}>
          <h2 style={{ margin: '0 0 var(--space-xs) 0', fontSize: 'var(--text-lg)', color: 'var(--color-danger)' }}>
            Changes Notion rejected
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
            These were saved on your device while offline, but Notion refused them. Retry once
            you have fixed the cause, or discard them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {failedJobs.map(job => (
              <div key={job.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap',
                padding: 'var(--space-sm)', backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', minWidth: 0
              }}>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                    {job.op === 'add' ? 'Add' : job.op === 'update' ? 'Edit' : 'Delete'}
                    {job.payload?.description ? ` — ${job.payload.description}` : ''}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>{job.lastError}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => { retryFailed(job.id); setFailedJobs(readFailed()); }}>
                  Retry
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { discardFailed(job.id); setFailedJobs(readFailed()); }}>
                  Discard
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions Management Section */}
      {data?.subscriptions && (
        <CollapsibleSection
          id="subscriptions"
          title="Recurring Subscriptions"
          action={<Button variant="secondary" onClick={() => setIsAddingSub(true)}>+ Add Subscription</Button>}
        >
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
            Anything that recurs on the same day each month — an expense like streaming or the
            gym, or income like a salary or rent you collect as a landlord. WhereItWent adds each
            one to your ledger automatically on its day, and warns you a few days beforehand so
            nothing lands unexpectedly.
          </p>

          {features.upcoming !== false && (
            <div style={{ maxWidth: '220px', marginBottom: 'var(--space-md)' }}>
              <Field
                label="Warn me this many days ahead"
                type="number" min="1" max="31"
                value={upcomingLeadDays}
                onChange={e => setUpcomingLeadDays(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {data.subscriptions.length === 0 ? (
              <div style={{ color: 'var(--color-muted)', fontStyle: 'italic', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                Nothing recurring yet. Add your rent or a streaming plan and it will be
                logged for you each month.
              </div>
            ) : (
              data.subscriptions.map(sub => {
                const catName = data.categories?.find(c => c.id === sub.categoryId)?.name || 'Unknown';
                const catColor = getCategoryColor(catName);
                return (
                  <div
                    key={sub.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingSub(sub)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingSub(sub); } }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                      borderLeft: `4px solid ${catColor}`, cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                  >
                    <div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{sub.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginTop: '4px' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                          Every {ordinal(sub.dayOfMonth)} of the month
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 'var(--weight-bold)', padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: sub.active !== false ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'color-mix(in srgb, var(--color-muted) 15%, transparent)',
                          color: sub.active !== false ? 'var(--color-success)' : 'var(--color-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                          {sub.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: sub.type === 'Income' ? 'var(--color-success)' : 'var(--color-ink)' }}>
                        {sub.type === 'Income' ? '+' : '-'}{formatCurrency(sub.amount)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleSection>
      )}

      {(isAddingSub || editingSub) && (
        <SubscriptionEditorModal
          isOpen={isAddingSub || !!editingSub}
          onClose={() => { setIsAddingSub(false); setEditingSub(null); }}
          sub={editingSub}
          data={data}
          onSave={async (id, subData) => {
            if (id) await client.updateSubscription(id, subData);
            else await client.addSubscription(subData);
            if (onDataChange) onDataChange();
          }}
          onDelete={async (id) => {
            await client.deleteSubscription(id);
            if (onDataChange) onDataChange();
          }}
        />
      )}

      {/* Trips Management Section */}
      {data?.trips && (
        <CollapsibleSection
          id="trips"
          title="Trips Management"
          action={<Button variant="secondary" onClick={() => setIsAddingTrip(true)}>+ Add Trip</Button>}
        >
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
            Group travel spending under a named trip. Anything you tag to it is totalled
            separately in Insights — flights, hotels and day-to-day costs — and the trip's
            currency becomes the default for those transactions.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {data.trips.length === 0 ? (
              <div style={{ color: 'var(--color-muted)', fontStyle: 'italic', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                No trips yet. Add one before you travel and you can tag spending to it as
                you go.
              </div>
            ) : (
              data.trips.map(trip => {
                const statusColor = trip.status === 'Active'
                  ? 'var(--color-success)'
                  : trip.status === 'Completed'
                    ? 'var(--color-muted)'
                    : 'var(--color-accent)';
                const statusBg = trip.status === 'Active'
                  ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                  : trip.status === 'Completed'
                    ? 'color-mix(in srgb, var(--color-muted) 15%, transparent)'
                    : 'color-mix(in srgb, var(--color-accent) 15%, transparent)';

                return (
                  <div
                    key={trip.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingTrip(trip)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingTrip(trip); } }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                      borderLeft: `4px solid ${statusColor}`, cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                  >
                    <div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{trip.name}</div>
                      {trip.destination && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                          📍 {trip.destination}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginTop: '6px' }}>
                        {trip.startDate && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                            📅 {trip.startDate}{trip.endDate ? ` → ${trip.endDate}` : ''}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 'var(--weight-bold)', padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)', backgroundColor: statusBg, color: statusColor,
                          textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                          {trip.status || 'Planned'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleSection>
      )}

      {(isAddingTrip || editingTrip) && (
        <TripEditorModal
          isOpen={isAddingTrip || !!editingTrip}
          onClose={() => { setIsAddingTrip(false); setEditingTrip(null); }}
          trip={editingTrip}
          onSave={async (id, tripData) => {
            if (id) await client.updateTrip(id, tripData);
            else await client.addTrip(tripData);
            if (onDataChange) onDataChange();
          }}
          onDelete={async (id) => {
            await client.deleteTrip(id);
            if (onDataChange) onDataChange();
          }}
        />
      )}

      <PromptModal
        isOpen={showScrubPrompt}
        title="Scrub Databases?"
        message="This empties your real Notion workspace: every Transaction, Subscription and Trip is archived, and the app then switches to sample data. Notion keeps archived pages in its trash for 30 days, so they can be restored from there — but WhereItWent itself cannot undo this. Type the word below to confirm."
        expectedValue="delete"
        confirmText="Scrub & Save"
        onConfirm={executeScrub}
        onCancel={() => {
          setShowScrubPrompt(false);
          setStatus({ type: 'error', msg: 'Scrub cancelled.' });
        }}
      />
    </div>
  );
}
