import { useState, useEffect, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { Button } from './components/Button';
import AppGuideNote from './components/AppGuideNote';
import Onboarding from './components/Onboarding';
import Journal from './Journal';
import Settings from './Settings';
import MementoMori from './components/MementoMori';
import { DichotomyOfControl } from './components/DichotomyOfControl';
import Stats from './components/Stats';
import { getDayOfYear, getQuoteForDay } from './utils/date';
import { calculateStreak } from './utils/streak';
import { fetchRecentReflections, fetchDatabaseProperties, validateSchema, upsertReflection, ReflectionRecord } from './services/NotionService';
import { createIdbKv } from '../shared/notify/idbKv';
import { QUOTES } from './data/quotes';
import { triggerHaptic } from '../shared/haptics';

import { useHashRoute } from './lib/useHashRoute';
import { cn } from './lib/cn';
import {
  Settings as SettingsIcon,
  Share2 as ShareIcon,
  Heart as HeartIcon,
  Scale as ScaleIcon,
  BookOpen as BookOpenIcon,
  Skull as SkullIcon,
  Bookmark as BookmarkIcon,
  HelpCircle as HelpIcon,
  type LucideIcon,
} from 'lucide-react';


export default function App() {
  const today = getDayOfYear();
  const [dayOfYear, setDayOfYear] = useState(today);

  const { route, navigate } = useHashRoute();
  
  // Credentials
  const [token, setToken] = useState(() => localStorage.getItem('daily-stoic:notion-token') || '');
  const [databaseId, setDatabaseId] = useState(() => localStorage.getItem('daily-stoic:notion-db') || '');
  const isNotionConfigured = !!token.trim() && !!databaseId.trim();

  // Onboarding
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('daily-stoic:onboarded') === 'true');

  // Perspective Birthdate
  const [birthDate, setBirthDate] = useState(() => localStorage.getItem('daily-stoic:birthdate') || '');

  // Habit metrics, schema validation, and search/philosophy states
  const [streak, setStreak] = useState(0);
  const [recentReflections, setRecentReflections] = useState<ReflectionRecord[]>([]);
  const [schemaErrors, setSchemaErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Toggling favorites loading indicator
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [localFavoritesToggle, setLocalFavoritesToggle] = useState(0);

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
      } catch (err: any) {
        console.error('Failed to load reflections/schema from cloud:', err);
        setSchemaErrors(['Could not query database schema. Running in offline/fallback mode.']);
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



  const filteredQuotes = useMemo(() => {
    return QUOTES.filter((q) => {
      const query = searchQuery.toLowerCase().trim();
      return (
        !query ||
        q.quote.toLowerCase().includes(query) ||
        q.author.toLowerCase().includes(query) ||
        q.source.toLowerCase().includes(query) ||
        (q.theme || []).some((t) => t.toLowerCase().includes(query))
      );
    });
  }, [searchQuery]);

  const quoteIndex = (dayOfYear - 1) % (filteredQuotes.length || 1);
  const quote = filteredQuotes[quoteIndex] || getQuoteForDay(dayOfYear);
  const isCurrentQuoteFavorited = useMemo(() => {
    return localStorage.getItem(`daily-stoic:favorite-${dayOfYear}`) === 'true' && localFavoritesToggle !== undefined;
  }, [dayOfYear, localFavoritesToggle]);

  const [isSharing, setIsSharing] = useState(false);
  const handleShareQuote = async () => {
    setIsSharing(true);
    triggerHaptic('light');
    try {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '1080px';
      container.style.height = '1080px';
      container.style.backgroundColor = '#18181b'; // dark bg
      container.style.color = '#f4f4f5'; // light text
      container.style.padding = '100px';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.justifyContent = 'center';
      
      // We use Fraunces font for the quote
      container.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: left; border-left: 12px solid #c2b5f5; padding-left: 60px;">
          <p style="font-family: 'Fraunces Variable', Fraunces, serif; font-size: 52px; line-height: 1.4; margin-bottom: 40px; text-wrap: balance;">“${quote.quote}”</p>
          <p style="font-family: 'Inter Variable', Inter, sans-serif; font-size: 28px; color: #a1a1aa; font-weight: 500;">— ${quote.author}, <i style="font-style: italic; font-weight: 400;">${quote.source}</i></p>
        </div>
        <div style="margin-top: 60px; display: flex; align-items: center; justify-content: space-between; font-family: 'Inter Variable', Inter, sans-serif; color: #a1a1aa; border-top: 2px solid #27272a; padding-top: 40px;">
          <span style="font-size: 28px; font-weight: 600; font-family: 'Fraunces Variable', Fraunces, serif; color: #f4f4f5;">Daily Stoic</span>
          <span style="font-size: 22px; font-weight: 500;">Take a moment.</span>
        </div>
      `;
      
      document.body.appendChild(container);
      
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#18181b',
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `daily-stoic-${quote.author.replace(/\s+/g, '-').toLowerCase()}-${dayOfYear}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      triggerHaptic('success');
      document.body.removeChild(container);
    } catch (e) {
      console.error('Failed to generate image', e);
    } finally {
      setIsSharing(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    
    const nextFavoriteState = !isCurrentQuoteFavorited;
    
    // Save to local storage cache
    localStorage.setItem(`daily-stoic:favorite-${dayOfYear}`, nextFavoriteState.toString());
    setLocalFavoritesToggle((prev) => prev + 1);

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
            console.error('Failed to toggle favorite on cloud:', err);
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
    if (localFavoritesToggle < 0) return []; // reactivity dummy
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

    return QUOTES.filter((q) => favoritedIds.has(q.day));
  }, [recentReflections, localFavoritesToggle]);



  const tabOptions: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: 'Daily Reflection', value: '', Icon: BookOpenIcon },
    { label: 'Memento Mori', value: 'memento', Icon: SkullIcon },
    { label: 'Enchiridion', value: 'enchiridion', Icon: BookmarkIcon },
    { label: 'Dichotomy', value: 'dichotomy', Icon: ScaleIcon },
  ];

  if (!onboarded) {
    return (
      <div className="flex min-h-screen flex-col bg-background-primary text-text-primary">
        <Onboarding onComplete={() => {
          localStorage.setItem('daily-stoic:onboarded', 'true');
          setOnboarded(true);
          loadCredentials(); // Make sure to load birth date if entered
        }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-primary text-text-primary">
      <header className="border-b border-tertiary bg-background-secondary px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3 mr-4 sm:mr-8 shrink-0">
            <h1 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-text-primary">
              Daily Stoic
            </h1>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0">
            {/* Main Navigation */}
            {tabOptions.map((tab) => {
              const Icon = tab.Icon;
              const isActive = route === `/${tab.value}` || (route === '' && tab.value === '') || (route === '/' && tab.value === '');
              return (
                <button
                  key={tab.value}
                  onClick={() => navigate(tab.value === '' ? '/' : `/${tab.value}`)}
                  title={tab.label}
                  aria-label={tab.label}
                  className={cn(
                    "rounded-md p-1.5 sm:p-2 transition-colors flex items-center justify-center",
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:bg-background-tertiary hover:text-text-primary"
                  )}
                >
                  <Icon size={18} className="sm:w-[20px] sm:h-[20px]" />
                </button>
              );
            })}

            <div className="w-px h-5 bg-tertiary shrink-0" aria-hidden="true" />

            <button
              onClick={() => navigate('/stats')}
              className="rounded-md p-1.5 sm:p-2 text-text-secondary hover:bg-background-tertiary hover:text-text-primary transition-colors flex items-center justify-center shrink-0"
              title="Stats & Progress"
            >
              <svg width="18" height="18" className="sm:w-[20px] sm:h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </button>

            <a
              href="/daily-stoic-guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 sm:p-2 text-text-secondary hover:bg-background-tertiary hover:text-text-primary transition-colors flex items-center justify-center shrink-0"
              title="Field Guide"
              aria-label="Open Field Guide in new tab"
            >
              <HelpIcon size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
            </a>

            <button
              onClick={() => navigate('/settings')}
              className="rounded-md p-1.5 sm:p-2 text-text-secondary hover:bg-background-tertiary hover:text-text-primary transition-colors flex items-center justify-center shrink-0"
              title="Settings"
            >
              <SettingsIcon size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
        {route === '/settings' && (
          <Settings
            onClose={() => {
              navigate('/');
              loadCredentials();
              loadReflectionsAndCheckStreak();
            }}
          />
        )}

        {route === '/stats' && (
          <Stats
            streak={streak}
            recentReflections={recentReflections}
            onClose={() => navigate('/')}
          />
        )}

        {(route === '' || route === '/') && (
          <div className="flex flex-col gap-4 sm:gap-6">
            {schemaErrors.length > 0 && (
              <div className="rounded-lg bg-background-secondary border border-caution/40 p-4" role="alert">
                <div className="flex gap-3">
                  <span className="text-caution">⚠️</span>
                  <div>
                    <p className="font-medium text-text-primary">Database Schema Mismatch</p>
                    {schemaErrors.map((err, idx) => (
                      <p key={idx} className="text-sm text-text-secondary mt-1">{err}</p>
                    ))}
                    <p className="text-sm font-medium mt-3 text-text-primary">
                      Please correct these columns in your cloud database.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-background-secondary p-4 border border-tertiary">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-text-secondary">Day of Year</span>
                <div className="flex items-center rounded-lg bg-background-tertiary border border-tertiary">
                  <button
                    onClick={() => setDayOfYear(Math.max(1, dayOfYear - 1))}
                    disabled={dayOfYear <= 1}
                    className="px-3 py-1.5 text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
                  >
                    −
                  </button>
                  <span className="w-10 text-center font-medium font-mono text-text-primary">
                    {dayOfYear}
                  </span>
                  <button
                    onClick={() => setDayOfYear(Math.min(366, dayOfYear + 1))}
                    disabled={dayOfYear >= 366}
                    className="px-3 py-1.5 text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              {dayOfYear !== today && (
                <Button variant="ghost" size="sm" onClick={() => setDayOfYear(today)}>
                  Back to Today
                </Button>
              )}
            </section>

            <Journal
              dayOfYear={dayOfYear}
              token={token}
              databaseId={databaseId}
              onSaveComplete={loadReflectionsAndCheckStreak}
              birthDate={birthDate}
              favoritedMaxims={favoritedMaxims}
              onGoToSettings={() => navigate('/settings')}
              onNavigateToTab={(tab: string) => navigate(tab)}
              quote={quote}
              isCurrentQuoteFavorited={isCurrentQuoteFavorited}
              handleToggleFavorite={handleToggleFavorite}
              handleShareQuote={handleShareQuote}
              isSharing={isSharing}
              isTogglingFavorite={isTogglingFavorite}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>
        )}

        {route === '/memento' && (
          <MementoMori
            birthDateString={birthDate}
            onGoToSettings={() => navigate('/settings')}
          />
        )}

        {route === '/dichotomy' && (
          <DichotomyOfControl />
        )}

        {route === '/enchiridion' && (
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-2 font-display text-2xl text-text-primary">📓 The Enchiridion (Handbook)</h2>
            <p className="mb-6 text-text-secondary">
              A curated selection of favorited stoic maxims for rapid reference during high-stress moments.
            </p>
            
            <div className="mb-6">
              <AppGuideNote summary="What is the Enchiridion?">
                <p>
                  Epictetus's original <em>Enchiridion</em> translates to "handbook" or "ready at hand." 
                  It was designed to be kept close, a quick reference for stressful moments. By favoriting quotes, 
                  you are building your own personal handbook of principles that resonate with you most.
                </p>
              </AppGuideNote>
            </div>

            {favoritedMaxims.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary mt-8">
                <img src="/daily-stoic-empty-state.png" alt="Empty handbook" className="w-32 h-32 mb-4 object-contain opacity-80" />
                <h3 className="font-display text-xl text-text-primary mb-2">Your handbook is empty</h3>
                <p className="text-text-secondary">
                  Heart quotes on the Daily Reflection page to save them here for rapid reference during high-stress moments.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {favoritedMaxims.map((q) => {
                  const index = q.day;
                  return (
                    <div key={index} className="rounded-lg bg-background-secondary p-5 border border-tertiary">
                      <p className="mb-3 font-display text-lg text-text-primary">“{q.quote}”</p>
                      <div className="flex items-center justify-between text-sm text-text-secondary">
                        <span>— {q.author}, {q.source} (Day {index})</span>
                        <button
                          onClick={async () => {
                            triggerHaptic('light');
                            localStorage.setItem(`daily-stoic:favorite-${index}`, 'false');
                            setLocalFavoritesToggle(prev => prev + 1);
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
                          className="text-caution hover:underline"
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

    </div>
  );
}
