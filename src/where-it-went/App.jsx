import { useState, useEffect, useMemo, useCallback } from 'react';
import { NotionClient } from './lib/notionClient';
import Dashboard from './components/Dashboard';
import TransactionsList from './components/TransactionsList';
import Settings from './components/Settings';
import InsightsView from './components/InsightsView';
import TransactionForm from './components/TransactionForm';
import { Button } from '../ds/components/Button';
import { Modal } from '../ds/components/Modal';
import { AlertModal } from '../ds';
import { useSubscriptionsEngine } from './lib/useSubscriptionsEngine';
import { readJson, writeJson } from './lib/storage';
import { defaultTheme } from './lib/theme';
import Navigation from './components/Navigation';
import UpcomingBanner from './components/UpcomingBanner';
import OfflineBanner from './components/OfflineBanner';
import SkeletonState from './components/SkeletonState';
import { getUpcomingBills, billsWithinLeadTime, DEFAULT_LEAD_DAYS } from './lib/upcoming';
import { writeReminderState } from './lib/reminders';
import {
  createOfflineClient, saveSnapshot, readSnapshot, readOutbox, readFailed,
  flushOutbox, isOnline, applyLocally,
} from './lib/outbox';
import PeriodSheet from './components/PeriodSheet';
import FilterSheet from './components/FilterSheet';
import { DEMO_CATEGORIES, DEMO_ACCOUNTS, DEMO_TRANSACTIONS, DEMO_SUBSCRIPTIONS, DEMO_TRIPS } from './models/demoData';
import { findDuplicateGroups, withoutDismissed, DUPE_DISMISS_KEY } from './lib/duplicates';

const EMPTY_DATA = { categories: [], accounts: [], transactions: [], subscriptions: [], trips: [] };

export default function App() {
  const [uiState] = useState(() => readJson('whereItWent_ui_state', {}));

  const [activeTab, setActiveTab] = useState(uiState.activeTab || 'dashboard');
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  // Set only by "Repeat" on a ledger row — carries a past transaction's
  // details into a fresh Add form (never an edit: no id, no notes, no tags).
  // Cleared on every close so a plain "+ Add" right after never reuses it.
  const [repeatDraft, setRepeatDraft] = useState(null);

  // Lifted (not owned by DuplicateReview) so the Transactions nav-tab dot
  // updates the instant a group is dismissed, not just on the next reload.
  const [dismissedDuplicates, setDismissedDuplicates] = useState(() => readJson(DUPE_DISMISS_KEY, []));

  // One-shot target for "View this trip in Insights" — set right before
  // switching tabs, consumed (and cleared) by InsightsView on mount.
  const [jumpToTripFilter, setJumpToTripFilter] = useState(null);
  const handleViewTripInInsights = (tripId) => {
    setJumpToTripFilter(tripId);
    handleTabChange('insights');
  };

  // Same one-shot pattern for the Upcoming banner → Dashboard's agenda card.
  const [scrollToUpcoming, setScrollToUpcoming] = useState(false);

  // Lifted global states for Navigation
  const [period, setPeriod] = useState(uiState.period || 'this_month');
  const [filterType, setFilterType] = useState(uiState.filterType || 'All');
  const [categoryFilter, setCategoryFilter] = useState(uiState.categoryFilter || 'All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    writeJson('whereItWent_ui_state', { activeTab, period, filterType, categoryFilter });
  }, [activeTab, period, filterType, categoryFilter]);

  // Sheet visibility states
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const handleTabChange = (newTab) => {
    if (newTab === 'settings' && activeTab !== 'settings') {
      setPreviousTab(activeTab);
    }
    setActiveTab(newTab);
  };

  const [config, setConfig] = useState(() => readJson('whereItWent_config', {}));

  // Stable identity: a fresh client on every render re-triggered every effect that
  // depends on it (notably the subscriptions engine).
  const [staleAt, setStaleAt] = useState(null);
  const [pendingCount, setPendingCount] = useState(() => readOutbox().length);
  const [failedCount, setFailedCount] = useState(() => readFailed().length);

  // Demo mode deliberately hands the client no token. `loadData` already serves
  // the fixtures, but the client was still built with the real token, so every
  // *write* went to live Notion carrying a fixture id — which is why merging a
  // demo duplicate failed with "page_id should be a valid uuid, instead was
  // demo_tx_271". Without a token every write method takes its in-memory demo
  // path instead, and live data can't be touched from demo mode at all.
  const baseClient = useMemo(() => new NotionClient(config.demoMode ? '' : config.token, {
    categories: config.categoriesDb,
    accounts: config.accountsDb,
    transactions: config.transactionsDb,
    subscriptions: config.subscriptionsDb,
    trips: config.tripsDb
  }), [config.demoMode, config.token, config.categoriesDb, config.accountsDb, config.transactionsDb, config.subscriptionsDb, config.tripsDb]);

  // Every existing call site keeps using `client` unchanged; the wrapper only
  // intercepts transaction writes and diverts them to the outbox when the
  // network can't take them.
  const client = useMemo(() => createOfflineClient(baseClient), [baseClient]);

  // Likewise: an inline object literal here busted InsightsView's useMemo on every
  // render, re-running the whole analytics engine each time.
  const filterProps = useMemo(
    () => ({ filterType, categoryFilter, searchQuery }),
    [filterType, categoryFilter, searchQuery]
  );

  // Off by default — most people don't need to track internal account-to-account
  // moves. Toggled in Settings → Feature Toggles.
  const allowTransfer = config?.features?.transfers === true;

  // Two ways to end up looking at the fixture: the explicit demo flag, or simply
  // never having connected Notion (the client falls back to samples with no
  // token). Both need saying out loud.
  const hasNotionConfig = !!config.token && !!config.transactionsDb;
  const showingSampleData = !!config.demoMode || !hasNotionConfig;

  // On by default (unlike Transfers): the subscriptions engine has always been
  // able to post a charge without ever having warned it was coming, and this is
  // the fix for that. `!== false` so existing configs, saved before this key
  // existed, opt in without a migration.
  const showUpcoming = config?.features?.upcoming !== false;
  const leadDays = Number(config?.upcomingLeadDays) > 0
    ? Number(config.upcomingLeadDays)
    : DEFAULT_LEAD_DAYS;

  const categoriesById = useMemo(
    () => new Map((data.categories || []).map(c => [c.id, c])),
    [data.categories],
  );

  // Surfaces the review card's count on the Transactions tab itself, so it's
  // discoverable without having to already be on that screen.
  const duplicateCount = useMemo(
    () => withoutDismissed(findDuplicateGroups(data.transactions), dismissedDuplicates).length,
    [data.transactions, dismissedDuplicates],
  );

  const dueSoon = useMemo(() => {
    if (!showUpcoming) return [];
    // Look only as far as the lead time — the 30-day agenda lives on the
    // Dashboard; the banner is strictly about what needs attention now.
    const bills = getUpcomingBills(data.subscriptions, data.transactions, { horizonDays: leadDays });
    return billsWithinLeadTime(bills, leadDays);
  }, [showUpcoming, data.subscriptions, data.transactions, leadDays]);

  // Mirror what the service worker needs into IndexedDB whenever the data or
  // the settings behind it change. The worker can't read localStorage, and it
  // can't import the ES module that does the date maths, so this snapshot is
  // the only channel between them.
  useEffect(() => {
    // Deliberately still writes in demo mode, with `enabled: false`, rather than
    // returning early: bailing out would leave the *previous* snapshot in place,
    // so disconnecting from Notion would keep firing notifications about bills
    // in a workspace you just disconnected from.
    //
    // The feature toggle counts too. Turning Upcoming Bills off also hides the
    // reminder controls, so without this the notifications kept arriving with
    // no visible way to stop them.
    const remindersOn = !config.demoMode
      && showUpcoming
      && readJson('whereItWent_reminders_enabled', false);
    writeReminderState(data, { enabled: remindersOn, leadDays });
  }, [data, leadDays, config.demoMode, showUpcoming]);

  /**
   * Lay any still-queued writes over a dataset.
   *
   * Without this the "optimistic" writes were not optimistic at all: an offline
   * save enqueued the change and then called `loadData`, which failed and fell
   * back to a snapshot that predated it — so the transaction the user had just
   * typed disappeared from the screen entirely until the next successful sync.
   */
  const withPendingWrites = useCallback((dataset) => {
    const queue = readOutbox();
    if (queue.length === 0) return dataset;
    let transactions = dataset.transactions || [];
    for (const item of queue) transactions = applyLocally(transactions, item);
    return { ...dataset, transactions };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (config.demoMode) {
      setData({
        categories: [...DEMO_CATEGORIES],
        accounts: [...DEMO_ACCOUNTS],
        transactions: [...DEMO_TRANSACTIONS],
        subscriptions: [...DEMO_SUBSCRIPTIONS],
        trips: [...DEMO_TRIPS]
      });
      setLoading(false);
      return;
    }

    // Paint the mirrored copy straight away rather than a skeleton, then
    // revalidate behind it.
    const snapshot = readSnapshot();
    if (snapshot) {
      setData(withPendingWrites(snapshot.data));
      setLoading(false);
    }

    try {
      // Anything written while offline goes first, so the refresh below sees a
      // ledger that already includes it.
      if (isOnline() && readOutbox().length > 0) {
        await flushOutbox(baseClient);
        setPendingCount(readOutbox().length);
        setFailedCount(readFailed().length);
      }

      const [categories, accounts, transactions, subscriptions, trips] = await Promise.all([
        client.fetchCategories(),
        client.fetchAccounts(),
        client.fetchTransactions(),
        client.fetchSubscriptions(),
        client.fetchTrips()
      ]);
      const fresh = { categories, accounts, transactions, subscriptions, trips };
      // Snapshot the server truth, but *show* it with anything still queued on
      // top — a partially-failed flush leaves items behind that must stay visible.
      saveSnapshot(fresh);
      setData(withPendingWrites(fresh));
      setStaleAt(null);
    } catch (e) {
      console.error('Failed to fetch data:', e);
      if (snapshot) {
        // Showing the ledger you downloaded an hour ago beats an error card
        // that pretends the data never existed — as long as it says so.
        setData(withPendingWrites(snapshot.data));
        setStaleAt(snapshot.savedAt);
      } else {
        setLoadError(e.message || 'Failed to load data from Notion.');
      }
    }
    setLoading(false);
  }, [client, baseClient, config.demoMode, withPendingWrites]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme || defaultTheme());
  }, [config.theme]);

  // Keep the pending counter honest after any write the wrapper diverted.
  useEffect(() => {
    setPendingCount(readOutbox().length);
    setFailedCount(readFailed().length);
  }, [data]);

  // Flush as soon as the network comes back, without waiting for a reload.
  useEffect(() => {
    const onOnline = async () => {
      if (readOutbox().length === 0) return;
      await flushOutbox(baseClient);
      setPendingCount(readOutbox().length);
      setFailedCount(readFailed().length);
      loadData();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [baseClient, loadData]);

  // Auto-post missed subscription charges — never against the demo fixture.
  //
  // Root cause of a real duplicate-posting bug: this used to check only the
  // *explicit* `config.demoMode` flag, not `showingSampleData` (which is also
  // true for a brand-new install that has never connected Notion at all —
  // see `hasNotionConfig` above). A session with no token was showing sample
  // data everywhere else in the UI while this gate still considered the
  // engine "safe" to run against it, because `config.demoMode` was simply
  // `undefined` rather than `true`. Every reload re-mounted the engine fresh
  // (its own `hasRun` guard is per-mount, not global) and posted the same
  // occurrence again each time — not specific to any one subscription's
  // currency or frequency, since the bug was in whether the engine should be
  // running at all, not in what it computed once running.
  //
  // Also never while offline, while showing a stale snapshot, or with writes
  // still queued. The engine decides what to post by checking the ledger for an
  // existing charge; run it against data that predates the queue and that check
  // reads a ledger missing those rows, so it posts every one of them a second
  // time. This is the sharpest edge in the whole offline feature.
  const engineSafe = !showingSampleData && isOnline() && staleAt === null && pendingCount === 0;
  useSubscriptionsEngine({ data, client, onDataChange: loadData, enabled: engineSafe });

  const handleConfigSave = (newConfig) => {
    writeJson('whereItWent_config', newConfig);
    setConfig(newConfig);
    // Turning Transfers off shouldn't leave the ledger stuck on a filter that's
    // no longer offered anywhere in the UI — the Filter Sheet only shows the
    // Transfers option while it's either enabled or already the active filter,
    // so clearing it here is what actually makes "off" mean "off" right away.
    if (newConfig?.features?.transfers !== true && filterType === 'Transfer') {
      setFilterType('All');
    }
  };

  const handleThemeChange = (newTheme) => {
    handleConfigSave({ ...config, theme: newTheme });
  };

  /**
   * TransactionForm always calls `onSave(id, txData)` — `id` is null when adding.
   * This handler used to take a single `tx` argument, so it received that null and
   * every "+ Add" ended in a TypeError with the modal still open and nothing saved.
   */
  const handleAddTransaction = async (_id, tx) => {
    try {
      await client.addTransaction(tx);
      await loadData();
      setShowAddForm(false);
      setRepeatDraft(null);
    } catch (e) {
      console.error('Failed to add transaction:', e);
      setSaveError(e.message || 'Could not save the transaction to Notion.');
      throw e; // let the form clear its saving state and stay open
    }
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setRepeatDraft(null);
  };

  /** "Repeat" on a ledger row — reopens Add loaded with that transaction's
   * details. Explicit field list rather than a spread: id/notes/tags must
   * never carry over (a fresh Add, not an edit of the original row), and this
   * can't silently pick up a future field nobody meant to repeat. */
  const handleRepeatTransaction = (tx) => {
    if (!tx) return;
    setRepeatDraft({
      type: tx.type,
      description: tx.description,
      amount: tx.amount,
      categoryId: tx.categoryId,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId,
      tripId: tx.tripId,
      originalAmount: tx.originalAmount,
      originalCurrency: tx.originalCurrency,
    });
    setShowAddForm(true);
  };

  const flairClasses = [
    (config?.features?.flairMaster !== false && config?.features?.flairAmbientGlow) ? 'flair-ambient' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairGlass) ? 'flair-glass' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairStagger) ? 'flair-stagger' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairHover) ? 'flair-hover' : '',
    config?.features?.flairModernLayout ? 'layout-modern' : '',
    config?.features?.flairCompactDensity ? 'density-compact' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairTactile !== false) ? 'flair-tactile' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairPulse !== false) ? 'flair-pulse' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairEmpty !== false) ? 'flair-empty' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairBudget !== false) ? 'flair-budget' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairTheme !== false) ? 'flair-theme' : '',
    (config?.features?.flairMaster !== false && config?.features?.flairTab !== false) ? 'flair-tab' : ''
  ].filter(Boolean).join(' ');
  return (
    <div className={flairClasses} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Shown whenever the figures on screen are samples — which includes a
          brand-new install that has never been configured, not just the explicit
          demo flag. Previously a first-run user saw a full ledger of invented
          transactions with nothing saying they weren't real. */}
      {showingSampleData && (
        <div style={{ backgroundColor: 'var(--color-warning)', color: 'var(--color-bg)', padding: 'var(--space-sm) var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)', position: 'relative', zIndex: 100, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
            Sample data — nothing here is yours, and nothing you change is saved to Notion.
          </span>
          <button
            style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', background: 'var(--color-bg)', color: 'var(--color-ink)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 'var(--weight-bold)', flex: 'none' }}
            onClick={() => (hasNotionConfig
              ? handleConfigSave({ ...config, demoMode: false })
              : handleTabChange('settings'))}
          >
            {/* With no Notion connection there is nothing to switch back *to*,
                so offering "Stop Demo" would be a button that does nothing. */}
            {hasNotionConfig ? 'Use my Notion data' : 'Connect Notion'}
          </button>
        </div>
      )}
      <div className="app-layout-container" style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
        <Navigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onAddClick={() => { setRepeatDraft(null); setShowAddForm(true); }}
          period={period}
          onPeriodClick={() => setShowPeriodSheet(true)}
          onFilterClick={() => setShowFilterSheet(true)}
          filtersActive={filterType !== 'All' || categoryFilter !== 'All' || searchQuery.trim() !== ''}
          duplicateCount={duplicateCount}
        />

        <div className="main-content-wrapper" style={{ maxWidth: '800px', width: '100%', margin: '0 auto', padding: '0 var(--space-md) var(--space-md)' }}>

      {/* One banner slot, shared. Offline/pending state outranks the upcoming
          reminder — a queued write is more urgent than something due in 3
          days, and stacking two strips would eat the top of every screen.
          The upcoming reminder itself is scoped to the Transactions screen
          only — it clicks through to the Dashboard's Next 30 Days card for
          the full detail, but the interrupt lives where the ledger is. */}
      {(staleAt !== null || pendingCount > 0 || failedCount > 0) ? (
        <OfflineBanner
          staleAt={staleAt}
          pendingCount={pendingCount}
          failedCount={failedCount}
          onOpenSettings={() => handleTabChange('settings')}
        />
      ) : activeTab === 'transactions' && (
        <UpcomingBanner
          bills={dueSoon}
          leadDays={leadDays}
          categoriesById={categoriesById}
          onView={() => { setScrollToUpcoming(true); handleTabChange('dashboard'); }}
        />
      )}

      <PeriodSheet
        isOpen={showPeriodSheet}
        onClose={() => setShowPeriodSheet(false)}
        period={period}
        onPeriodChange={setPeriod}
      />

      <FilterSheet
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        categories={data.categories}
        filterType={filterType}
        categoryFilter={categoryFilter}
        searchQuery={searchQuery}
        allowTransfer={allowTransfer}
        onApply={({ filterType: ft, categoryFilter: cf, searchQuery: sq }) => {
          setFilterType(ft);
          setCategoryFilter(cf);
          setSearchQuery(sq);
        }}
      />

      <Modal
        open={showAddForm}
        onClose={closeAddForm}
        title={repeatDraft ? 'Repeat Transaction' : 'New Transaction'}
      >
        <TransactionForm
          categories={data.categories}
          accounts={data.accounts}
          trips={data.trips}
          allowTransfer={allowTransfer}
          prefill={repeatDraft}
          onSave={handleAddTransaction}
          onCancel={closeAddForm}
        />
      </Modal>

      <AlertModal
        isOpen={!!saveError}
        title="Could not save"
        message={saveError || ''}
        onClose={() => setSaveError(null)}
      />

      <main>
        {loading ? (
          <SkeletonState activeTab={activeTab} />
        ) : loadError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', marginTop: 'var(--space-xl)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>⚠️</div>
            <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-danger)' }}>Could Not Load Data</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)', maxWidth: '400px' }}>
              {loadError} — Check your Notion token and database IDs in Settings.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button variant="primary" onClick={loadData}>↻ Retry</Button>
              <Button variant="ghost" onClick={() => handleTabChange('settings')}>Open Settings</Button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                data={data} client={client} onDataChange={loadData} onNavigate={handleTabChange}
                config={config} period={period} filterProps={filterProps}
                onViewTripInInsights={handleViewTripInInsights}
                scrollToUpcoming={scrollToUpcoming}
                onConsumeScrollToUpcoming={() => setScrollToUpcoming(false)}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionsList
                data={data} client={client} onDataChange={loadData} filterProps={filterProps}
                period={period} allowTransfer={allowTransfer} onRepeat={handleRepeatTransaction}
                dismissedDuplicates={dismissedDuplicates} onDismissedDuplicatesChange={setDismissedDuplicates}
                onViewTripInInsights={handleViewTripInInsights}
              />
            )}
            {activeTab === 'insights' && (
              <InsightsView
                data={data} period={period} filterProps={filterProps} config={config}
                initialTripFilter={jumpToTripFilter}
                onConsumeInitialTripFilter={() => setJumpToTripFilter(null)}
              />
            )}
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
      </div>
    </div>
  );
}
