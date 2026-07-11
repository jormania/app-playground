import { useState, useEffect, useCallback, useMemo } from 'react';
import { SegmentedControl, NumberStepper, Button, StreakCounter, SettingsToggle } from '../ds';
import Journal from './Journal';
import Settings from './Settings';
import MementoMori from './components/MementoMori';
import FateGraph from './components/FateGraph';
import { getDayOfYear, getQuoteForDay, formatDateLabel } from './utils/date';
import { calculateStreak } from './utils/streak';
import { fetchRecentReflections, fetchDatabaseProperties, validateSchema, upsertReflection, ReflectionRecord } from './services/NotionService';
import { createIdbKv } from '../shared/notify/idbKv';
import { QUOTES } from './data/quotes';
import styles from './App.module.css';

function getDateFromDayOfYear(day: number): Date {
  const year = new Date().getFullYear();
  const date = new Date(year, 0, 1);
  date.setDate(day);
  return date;
}

export default function App() {
  const today = getDayOfYear();
  const [dayOfYear, setDayOfYear] = useState(today);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('daily-stoic:theme') as 'light' | 'dark' | 'system') || 'system';
  });

  const [activeTab, setActiveTab] = useState<'reflection' | 'memento' | 'enchiridion'>('reflection');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Credentials
  const [token, setToken] = useState(() => localStorage.getItem('daily-stoic:notion-token') || '');
  const [databaseId, setDatabaseId] = useState(() => localStorage.getItem('daily-stoic:notion-db') || '');
  const isNotionConfigured = !!token.trim() && !!databaseId.trim();

  // Perspective Birthdate
  const [birthDate, setBirthDate] = useState(() => localStorage.getItem('daily-stoic:birthdate') || '');

  // Habit metrics, schema validation, and search/philosophy states
  const [streak, setStreak] = useState(0);
  const [recentReflections, setRecentReflections] = useState<ReflectionRecord[]>([]);
  const [schemaErrors, setSchemaErrors] = useState<string[]>([]);
  const [philosophyView, setPhilosophyView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Toggling favorites loading indicator
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const loadCredentials = () => {
    setToken(localStorage.getItem('daily-stoic:notion-token') || '');
    setDatabaseId(localStorage.getItem('daily-stoic:notion-db') || '');
    setBirthDate(localStorage.getItem('daily-stoic:birthdate') || '');
  };

  const updateReminderIDB = useCallback(async (todayLogged: boolean) => {
    const enabled = localStorage.getItem('daily-stoic:reminder-enabled') === 'true';
    const time = localStorage.getItem('daily-stoic:reminder-time') || '08:00';
    const kv = createIdbKv('daily-stoic-reminders');
    await kv.set('state', {
      enabled,
      time,
      todayLogged,
    });
  }, []);

  const loadLocalStorageStreak = useCallback(async (todayVal: number) => {
    const days = new Set<number>();
    const records: ReflectionRecord[] = [];
    for (let i = 1; i <= 366; i++) {
      const val = localStorage.getItem(`daily-stoic:reflection-${i}`);
      const fateVal = localStorage.getItem(`daily-stoic:fate-input-${i}`);
      const favVal = localStorage.getItem(`daily-stoic:favorite-${i}`) === 'true';
      let tagsVal: string[] = [];
      try {
        tagsVal = JSON.parse(localStorage.getItem(`daily-stoic:acceptance-tags-${i}`) || '[]');
      } catch {
        tagsVal = [];
      }

      if (val || fateVal || tagsVal.length > 0 || favVal) {
        days.add(i);
        records.push({
          date: '',
          quoteId: i,
          text: val || '',
          fateInput: fateVal || '',
          acceptanceTags: tagsVal,
          favorite: favVal,
        });
      }
    }
    setRecentReflections(records);
    
    const currentStreak = calculateStreak(days, todayVal);
    setStreak(currentStreak);
    
    const todayLogged = days.has(todayVal);
    await updateReminderIDB(todayLogged);
  }, [updateReminderIDB]);

  const loadReflectionsAndCheckStreak = useCallback(async () => {
    const todayVal = getDayOfYear();
    
    if (token.trim() && databaseId.trim()) {
      try {
        const props = await fetchDatabaseProperties(token, databaseId);
        const errors = validateSchema(props);
        setSchemaErrors(errors);

        if (errors.length === 0) {
          const records = await fetchRecentReflections(token, databaseId);
          setRecentReflections(records);

          const days = new Set(records.map((r) => r.quoteId));
          const currentStreak = calculateStreak(days, todayVal);
          setStreak(currentStreak);

          const todayLogged = days.has(todayVal);
          await updateReminderIDB(todayLogged);
        } else {
          await loadLocalStorageStreak(todayVal);
        }
      } catch (err) {
        console.error('Failed to load reflections/schema from Notion:', err);
        setSchemaErrors(['Could not query Notion schema. Running in offline/fallback mode.']);
        await loadLocalStorageStreak(todayVal);
      }
    } else {
      setSchemaErrors([]);
      await loadLocalStorageStreak(todayVal);
    }
  }, [token, databaseId, loadLocalStorageStreak, updateReminderIDB]);

  // Load streak and validate schema on mount / credential change
  useEffect(() => {
    loadReflectionsAndCheckStreak();
  }, [loadReflectionsAndCheckStreak]);

  // Apply theme changes to document Element
  useEffect(() => {
    const root = document.documentElement;
    const metaTheme = document.querySelector('meta[name="theme-color"]');

    const updateTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        root.setAttribute('data-theme', 'dark');
        if (metaTheme) metaTheme.setAttribute('content', '#0e1115');
      } else {
        root.removeAttribute('data-theme');
        if (metaTheme) metaTheme.setAttribute('content', '#f4f5f7');
      }
    };

    updateTheme();
    localStorage.setItem('daily-stoic:theme', theme);

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', updateTheme);
      return () => media.removeEventListener('change', updateTheme);
    }
  }, [theme]);

  // Filter quote rotation based on search and Philosophy View
  const filteredQuotes = useMemo(() => {
    return QUOTES.filter((q) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        q.text.toLowerCase().includes(query) ||
        q.author.toLowerCase().includes(query) ||
        q.source.toLowerCase().includes(query) ||
        (q.tags || []).some((t) => t.toLowerCase().includes(query));

      if (philosophyView) {
        return matchesSearch && q.tags?.some((t) => ['Fate', 'Acceptance', 'Resistance'].includes(t));
      }
      return matchesSearch;
    });
  }, [searchQuery, philosophyView]);

  const quoteIndex = (dayOfYear - 1) % (filteredQuotes.length || 1);
  const quote = filteredQuotes[quoteIndex] || getQuoteForDay(dayOfYear);
  
  const currentDate = getDateFromDayOfYear(dayOfYear);

  // Find if current quote is favorited
  const isCurrentQuoteFavorited = useMemo(() => {
    const record = recentReflections.find((r) => r.quoteId === dayOfYear);
    if (record) return !!record.favorite;
    return localStorage.getItem(`daily-stoic:favorite-${dayOfYear}`) === 'true';
  }, [recentReflections, dayOfYear]);

  const handleToggleFavorite = async () => {
    setIsTogglingFavorite(true);
    const nextFavoriteState = !isCurrentQuoteFavorited;
    
    // Save to local storage cache
    localStorage.setItem(`daily-stoic:favorite-${dayOfYear}`, nextFavoriteState.toString());

    if (isNotionConfigured && schemaErrors.length === 0) {
      try {
        const record = recentReflections.find((r) => r.quoteId === dayOfYear);
        const year = new Date().getFullYear();
        const date = new Date(year, 0, 1);
        date.setDate(dayOfYear);
        const dateStr = date.toISOString().split('T')[0];

        await upsertReflection(
          token,
          databaseId,
          dayOfYear,
          record?.text || '',
          ['Stoic', 'Reflection'],
          dateStr,
          record?.date ? record.date : undefined,
          record?.fateInput || '',
          record?.acceptanceTags || [],
          nextFavoriteState
        );
        await loadReflectionsAndCheckStreak();
      } catch (err) {
        console.error('Failed to toggle favorite on Notion:', err);
      } finally {
        setIsTogglingFavorite(false);
      }
    } else {
      await loadLocalStorageStreak(today);
      setIsTogglingFavorite(false);
    }
  };

  // Compile favorited maxims list (Enchiridion)
  const favoritedMaxims = useMemo(() => {
    const favoritedIds = new Set<number>();
    
    // Check loaded reflections
    recentReflections.forEach((r) => {
      if (r.favorite) {
        favoritedIds.add(r.quoteId);
      }
    });

    // Check localStorage fallback
    for (let i = 1; i <= 366; i++) {
      if (localStorage.getItem(`daily-stoic:favorite-${i}`) === 'true') {
        favoritedIds.add(i);
      }
    }

    return QUOTES.filter((_, index) => favoritedIds.has(index + 1));
  }, [recentReflections]);

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  const tabOptions = [
    { value: 'reflection', label: 'Daily Reflection' },
    { value: 'memento', label: 'Memento Mori' },
    { value: 'enchiridion', label: 'Enchiridion' },
  ];

  return (
    <div className={styles.appShell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandEmoji} aria-hidden="true">🏛️</span>
          <h1 className={styles.brandTitle}>Daily Stoic</h1>
        </div>
        <div className={styles.headerActions}>
          {!isSettingsOpen && (
            <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(true)}>
              ⚙️ Settings
            </Button>
          )}
          <div className={styles.themeToggle}>
            <SegmentedControl
              options={themeOptions}
              value={theme}
              onChange={(val) => setTheme(val as 'light' | 'dark' | 'system')}
              size="sm"
            />
          </div>
        </div>
      </header>

      {isSettingsOpen ? (
        <main className={styles.mainContent}>
          <Settings
            onClose={() => {
              setIsSettingsOpen(false);
              loadCredentials();
              loadReflectionsAndCheckStreak();
            }}
          />
        </main>
      ) : (
        <main className={styles.mainContent}>
          <div className={styles.tabWrapper}>
            <SegmentedControl
              options={tabOptions}
              value={activeTab}
              onChange={(val) => setActiveTab(val as 'reflection' | 'memento' | 'enchiridion')}
            />
          </div>

          {schemaErrors.length > 0 && (
            <div className={styles.schemaWarningBox} role="alert">
              <span className={styles.statusIcon}>⚠️</span>
              <div className={styles.statusContent}>
                <p className={styles.statusText}>
                  <strong>Notion Database Schema Mismatch</strong>
                </p>
                {schemaErrors.map((err, idx) => (
                  <p key={idx} className={styles.schemaErrorDetail}>{err}</p>
                ))}
                <p className={styles.schemaWarningAction}>
                  Please correct these columns in your Notion database.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'reflection' && (
            <>
              <section className={styles.dashboardRow}>
                <div className={styles.dashboardSectionLeft}>
                  <NumberStepper
                    label="Day of Year"
                    value={dayOfYear}
                    min={1}
                    max={366}
                    onChange={(val) => setDayOfYear(val)}
                  />
                  {dayOfYear !== today && (
                    <Button variant="ghost" size="sm" onClick={() => setDayOfYear(today)}>
                      Back to Today
                    </Button>
                  )}
                </div>
                <div className={styles.dashboardSectionRight}>
                  <SettingsToggle
                    label="Philosophy View"
                    hint="Filter to Fate, Acceptance, or Resistance maxims"
                    checked={philosophyView}
                    onChange={(e) => setPhilosophyView(e.target.checked)}
                  />
                </div>
              </section>

              <div className={styles.searchRow}>
                <input
                  type="text"
                  placeholder="🔍 Search maxims by keyword (e.g. Anxiety, Gratitude, Seneca)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                    Clear
                  </Button>
                )}
              </div>

              <div className={styles.dashboardGrid}>
                <StreakCounter count={streak} />
                <FateGraph records={recentReflections} />
              </div>

              <section className={styles.dateDisplay}>
                <span className={styles.dateLabel}>{formatDateLabel(currentDate)}</span>
                <span className={styles.dayLabel}>Day {dayOfYear} of 366</span>
              </section>

              <blockquote className={styles.quoteBlock}>
                <div className={styles.quoteHeaderRow}>
                  <p className={styles.quoteText}>“{quote.text}”</p>
                  <button
                    onClick={handleToggleFavorite}
                    disabled={isTogglingFavorite}
                    className={`${styles.favoriteButton} ${isCurrentQuoteFavorited ? styles.favoriteActive : ''}`}
                    aria-label={isCurrentQuoteFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    ❤️
                  </button>
                </div>
                <cite className={styles.quoteCite}>
                  — {quote.author}, <span className={styles.quoteSource}>{quote.source}</span>
                </cite>
              </blockquote>

              <Journal
                dayOfYear={dayOfYear}
                token={token}
                databaseId={databaseId}
                onSaveComplete={loadReflectionsAndCheckStreak}
              />
            </>
          )}

          {activeTab === 'memento' && (
            <MementoMori
              birthDateString={birthDate}
              onGoToSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {activeTab === 'enchiridion' && (
            <div className={styles.enchiridionContainer}>
              <h2 className={styles.sectionTitle}>📓 The Enchiridion (Handbook)</h2>
              <p className={styles.sectionIntro}>
                A curated selection of favorited stoic maxims for rapid reference during high-stress moments.
              </p>

              {favoritedMaxims.length === 0 ? (
                <div className={styles.emptyEnchiridion}>
                  <p>Your handbook is currently empty.</p>
                  <p className={styles.emptyEnchiridionHint}>
                    Click the ❤️ icon next to any daily quote to add it to your Enchiridion.
                  </p>
                </div>
              ) : (
                <div className={styles.enchiridionList}>
                  {favoritedMaxims.map((q) => {
                    // Find day of year for this quote
                    const index = QUOTES.findIndex((val) => val.text === q.text) + 1;
                    return (
                      <div key={index} className={styles.enchiridionCard}>
                        <p className={styles.enchiridionQuote}>“{q.text}”</p>
                        <div className={styles.enchiridionFooter}>
                          <span className={styles.enchiridionCite}>— {q.author}, {q.source} (Day {index})</span>
                          <button
                            onClick={async () => {
                              // Fast local storage toggle
                              localStorage.setItem(`daily-stoic:favorite-${index}`, 'false');
                              if (isNotionConfigured && schemaErrors.length === 0) {
                                try {
                                  const record = recentReflections.find((r) => r.quoteId === index);
                                  const year = new Date().getFullYear();
                                  const date = new Date(year, 0, 1);
                                  date.setDate(index);
                                  const dateStr = date.toISOString().split('T')[0];

                                  await upsertReflection(
                                    token,
                                    databaseId,
                                    index,
                                    record?.text || '',
                                    ['Stoic', 'Reflection'],
                                    dateStr,
                                    record?.date ? record.date : undefined,
                                    record?.fateInput || '',
                                    record?.acceptanceTags || [],
                                    false
                                  );
                                  await loadReflectionsAndCheckStreak();
                                } catch (err) {
                                  console.error(err);
                                }
                              } else {
                                await loadLocalStorageStreak(today);
                              }
                            }}
                            className={styles.removeFavoriteButton}
                            aria-label="Remove favorite"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      <footer className={styles.footer}>
        <p>Stoic wisdom is in the public domain. Your reflections are stored locally.</p>
      </footer>
    </div>
  );
}
