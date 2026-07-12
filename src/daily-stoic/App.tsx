import { useState, useEffect, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { StreakCounter } from './components/StreakCounter';
import { Button } from './components/Button';
import { Switch as SettingsToggle } from './components/Switch';
import AppGuideNote from './components/AppGuideNote';
import Onboarding from './components/Onboarding';
import Journal from './Journal';
import Settings from './Settings';
import MementoMori from './components/MementoMori';
import { DichotomyOfControl } from './components/DichotomyOfControl';
import FateGraph from './components/FateGraph';
import MoodGraph from './components/MoodGraph';
import Stats from './components/Stats';
import { getDayOfYear, getQuoteForDay, formatDateLabel } from './utils/date';
import { calculateStreak } from './utils/streak';
import { fetchRecentReflections, fetchDatabaseProperties, validateSchema, upsertReflection, ReflectionRecord } from './services/NotionService';
import { createIdbKv } from '../shared/notify/idbKv';
import { QUOTES } from './data/quotes';
import { triggerHaptic } from '../shared/haptics';

import { useHashRoute } from './lib/useHashRoute';
import { useTheme } from './lib/themeContext';
import { Logo } from './components/Logo';
import { cn } from './lib/cn';
import {
  Sun as PracticeIcon,
  BookOpen as MaximsIcon,
  Hourglass as MementoIcon,
  Settings as SettingsIcon,
  Moon as DarkIcon,
  SunMedium as LightIcon,
  Share2 as ShareIcon,
  Heart as HeartIcon,
  Scale as ScaleIcon,
  BookOpen as BookOpenIcon,
  Skull as SkullIcon,
  Bookmark as BookmarkIcon,
  type LucideIcon,
} from 'lucide-react';

function ThemeToggle() {
  const { mode, cycle, current } = useTheme()
  const dark = mode === 'dark'
  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${current.name}. Tap to cycle to the next palette.`}
      title={`${current.name} — tap to cycle`}
      className="rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-background-secondary"
    >
      {dark ? <LightIcon size={18} aria-hidden /> : <DarkIcon size={18} aria-hidden />}
    </button>
  )
}

function NavLink({
  current,
  to,
  label,
  onClick,
  icon: Icon,
  iconOnly = false,
}: {
  current: string
  to: string
  label: string
  onClick: (to: string) => void
  icon: LucideIcon
  iconOnly?: boolean
}) {
  const activeRoute = current === to || (to === '/' && current === '')
  return (
    <button
      onClick={() => onClick(to)}
      aria-current={activeRoute ? 'page' : undefined}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-md font-sans text-sm transition-colors duration-fast',
        iconOnly ? 'p-2' : 'p-2 sm:px-3 sm:py-1.5',
        activeRoute ? 'bg-accent-soft text-accent' : 'text-text-secondary hover:bg-background-secondary',
      )}
    >
      {iconOnly ? (
        <Icon size={18} aria-hidden />
      ) : (
        <>
          <Icon size={18} aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{label}</span>
        </>
      )}
    </button>
  )
}


function getDateFromDayOfYear(day: number): Date {
  const year = new Date().getFullYear();
  const date = new Date(year, 0, 1);
  date.setDate(day);
  return date;
}

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
  const [philosophyView, setPhilosophyView] = useState(false);
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



  // Filter quote rotation based on search and Philosophy View
  const filteredQuotes = useMemo(() => {
    return QUOTES.filter((q) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        q.quote.toLowerCase().includes(query) ||
        q.author.toLowerCase().includes(query) ||
        q.source.toLowerCase().includes(query) ||
        (q.theme || []).some((t) => t.toLowerCase().includes(query));

      if (philosophyView) {
        return matchesSearch && q.theme?.some((t) => ['Fate', 'Acceptance', 'Resistance'].includes(t));
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
    return localStorage.getItem(`daily-stoic:favorite-${dayOfYear}`) === 'true';
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

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

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
      <header className="border-b border-tertiary bg-background-secondary px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
              Daily Stoic
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
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
                    "rounded-md p-2 transition-colors flex items-center justify-center",
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:bg-background-tertiary hover:text-text-primary"
                  )}
                >
                  <Icon size={20} strokeWidth={2} />
                </button>
              );
            })}

            <div className="w-px h-6 bg-tertiary mx-1 sm:mx-2" aria-hidden="true" />

            <button
              onClick={() => navigate('/stats')}
              className="rounded-md p-2 text-text-secondary hover:bg-background-tertiary hover:text-text-primary transition-colors flex items-center justify-center"
              title="Stats & Progress"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="rounded-md p-2 text-text-secondary hover:bg-background-tertiary hover:text-text-primary transition-colors flex items-center justify-center"
              title="Settings"
            >
              <SettingsIcon size={20} strokeWidth={2} />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl p-4 sm:p-5">
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
          <>
            {schemaErrors.length > 0 && (
              <div className="mb-6 rounded-lg bg-background-secondary border border-caution/40 p-4" role="alert">
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

            <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-background-secondary p-4 border border-tertiary">
              <div className="flex items-center gap-3">
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
              </div>
              <div>
                <SettingsToggle
                  label="Philosophy View"
                  description="Filter to Fate, Acceptance, or Resistance maxims"
                  checked={philosophyView}
                  onCheckedChange={(next) => setPhilosophyView(next)}
                />
              </div>
            </section>

            <div className="mb-8 flex items-center gap-2">
              <input
                type="text"
                placeholder="🔍 Search maxims by keyword (e.g. Anxiety, Gratitude, Seneca)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded-md border border-secondary bg-background-secondary px-3 py-2 text-text-primary outline-none focus-visible:border-accent"
              />
              {searchQuery && (
                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                  Clear
                </Button>
              )}
            </div>

            <blockquote className="mb-8 rounded-lg bg-background-secondary p-6 border-l-4 border-l-accent shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <p className="font-display text-2xl text-text-primary mb-4">“{quote.quote}”</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleShareQuote}
                    disabled={isSharing}
                    className="rounded-full p-2 text-text-secondary hover:text-text-primary hover:bg-background-tertiary transition-all"
                    title="Share Quote Card"
                    aria-label="Share quote as image"
                  >
                    <ShareIcon size={20} strokeWidth={2} />
                  </button>
                  <button
                    onClick={handleToggleFavorite}
                    disabled={isTogglingFavorite}
                    className={cn(
                      "rounded-full p-2 transition-all flex items-center justify-center",
                      isCurrentQuoteFavorited ? "scale-110 opacity-100" : "opacity-40 hover:opacity-100 hover:bg-background-tertiary"
                    )}
                    aria-label={isCurrentQuoteFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <HeartIcon 
                      size={20} 
                      strokeWidth={2} 
                      fill={isCurrentQuoteFavorited ? "currentColor" : "none"}
                      className={cn(
                        isCurrentQuoteFavorited ? "text-accent" : "text-text-secondary"
                      )}
                    />
                  </button>
                </div>
              </div>
              <cite className="block text-text-secondary font-medium">
                — {quote.author}, <span className="italic">{quote.source}</span>
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
                <span className="text-4xl mb-4" role="img" aria-label="book">📖</span>
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
