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
  const [theme, setTheme] = useState(config.theme || 'dark');
  // Transfers default OFF — most people don't need to track internal
  // account-to-account moves, so the feature stays invisible until asked for.
  const [features, setFeatures] = useState(config.features || { budgeting: true, cashFlow: true, transfers: false });
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [showScrubPrompt, setShowScrubPrompt] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
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
    onSave({ ...EMPTY_CONFIG_FIELDS, theme, features });
    setStatus({ type: 'success', msg: 'Configuration cleared. You are now in demo mode.' });
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
          <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: 'var(--text-sm)' }}>Configure your Notion integration here.</p>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Field label="Notion Integration Token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ntn_..." />
        <Field label="Categories Database ID or Link" type="text" value={categoriesDb} onChange={e => setCategoriesDb(e.target.value)} />
        <Field label="Accounts Database ID or Link" type="text" value={accountsDb} onChange={e => setAccountsDb(e.target.value)} />
        <Field label="Transactions Database ID or Link" type="text" value={transactionsDb} onChange={e => setTransactionsDb(e.target.value)} />
        <Field label="Subscriptions Database ID or Link" type="text" value={subscriptionsDb} onChange={e => setSubscriptionsDb(e.target.value)} />
        <Field label="Trips Database ID or Link (Optional)" type="text" value={tripsDb} onChange={e => setTripsDb(e.target.value)} />
      </div>

      {/* Feature Toggles Section */}
      <div style={{ marginTop: 'var(--space-xl)', marginBottom: 'var(--space-xl)', paddingTop: 'var(--space-xl)', borderTop: '1px solid var(--color-border)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-ink)', marginBottom: 'var(--space-md)' }}>Feature Toggles</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <SettingsToggle
            label="Budgeting Features"
            checked={features.budgeting}
            onChange={e => setFeatures(f => ({ ...f, budgeting: e.target.checked }))}
          />
          <SettingsToggle
            label="Cash Flow Trend"
            checked={features.cashFlow}
            onChange={e => setFeatures(f => ({ ...f, cashFlow: e.target.checked }))}
          />
          <SettingsToggle
            label="Transfers"
            checked={features.transfers === true}
            onChange={e => setFeatures(f => ({ ...f, transfers: e.target.checked }))}
          />
        </div>
      </div>

      {status.msg && (
        <div role="status" style={{
          padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)',
          backgroundColor: status.type === 'error' ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 199, 89, 0.1)',
          color: status.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
          border: `1px solid ${status.type === 'error' ? 'rgba(255, 59, 48, 0.2)' : 'rgba(52, 199, 89, 0.2)'}`
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
          Scrub Live Data & Demo Mode
        </Button>
      </div>

      {/* Subscriptions Management Section */}
      {data?.subscriptions && (
        <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-xl)', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-ink)' }}>Recurring Subscriptions</h2>
            <Button variant="secondary" onClick={() => setIsAddingSub(true)}>+ Add Subscription</Button>
          </div>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
            Manage recurring payments here. The app will automatically generate transactions for these on the specified day of each month.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {data.subscriptions.length === 0 ? (
              <div style={{ color: 'var(--color-muted)', fontStyle: 'italic', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                No subscriptions set up.
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
        </div>
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
        <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-xl)', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-ink)' }}>Trips Management</h2>
            <Button variant="secondary" onClick={() => setIsAddingTrip(true)}>+ Add Trip</Button>
          </div>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
            Manage travel projects and trips. Tag travel transactions with a trip to analyze spending across flights, hotels, and on-the-ground expenses.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {data.trips.length === 0 ? (
              <div style={{ color: 'var(--color-muted)', fontStyle: 'italic', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                No trips configured.
              </div>
            ) : (
              data.trips.map(trip => {
                const statusColor = trip.status === 'Active'
                  ? 'var(--color-success)'
                  : trip.status === 'Completed'
                    ? 'var(--color-muted)'
                    : 'var(--color-primary)';
                const statusBg = trip.status === 'Active'
                  ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                  : trip.status === 'Completed'
                    ? 'color-mix(in srgb, var(--color-muted) 15%, transparent)'
                    : 'color-mix(in srgb, var(--color-primary) 15%, transparent)';

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
        </div>
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
        message="WARNING: This is a DESTRUCTIVE action that archives every Transaction, Subscription and Trip in your live Notion databases to start fresh. Archived pages are recoverable from Notion's trash, but the app itself has no undo."
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
