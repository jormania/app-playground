import { useState, useEffect, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { Button } from './components/Button';
import Onboarding from './components/Onboarding';
import Journal from './Journal';
import Settings from './Settings';
import MementoMori from './components/MementoMori';
import { ToastContainer, showToast } from './components/Toast';
import { DichotomyOfControl } from './components/DichotomyOfControl';
import Stats from './components/Stats';
import PassionsAnalytics from './components/PassionsAnalytics';
import AmorFatiDashboard from './components/AmorFatiDashboard';
import { getQuoteForDay, getLocalTodayStr, getCycleDay } from './utils/date';
import { calculateStreak } from './utils/streak';
import { fetchRecentReflections, fetchDatabaseProperties, validateSchema, upgradeDatabaseSchema, upsertReflection, clearDatabaseEntries, ReflectionRecord } from './services/NotionService';
import { createIdbKv } from '../shared/notify/idbKv';
import { QUOTES } from './data/quotes';
import { triggerHaptic } from '../shared/haptics';

import { useHashRoute } from './lib/useHashRoute';
import { cn } from './lib/cn';
import {
  Settings as SettingsIcon,
  Heart as HeartIcon,
  Scale as ScaleIcon,
  BookOpen as BookOpenIcon,
  Skull as SkullIcon,
  Bookmark as BookmarkIcon,
  HelpCircle as HelpIcon,
  Flame as FlameIcon,
  LayoutDashboard as DashboardIcon,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';


export default function App() {
  const [cycleStartDate, setCycleStartDate] = useState(() => localStorage.getItem('daily-stoic:cycle-start-date') || '');
  const today = useMemo(() => getCycleDay(cycleStartDate), [cycleStartDate]);
  const dayOfYear = today;

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
  const [hasPassionsProperty, setHasPassionsProperty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Toggling favorites loading indicator
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [localFavoritesToggle, setLocalFavoritesToggle] = useState(0);

  const loadCredentials = () => {
    setToken(localStorage.getItem('daily-stoic:notion-token') || '');
    setDatabaseId(localStorage.getItem('daily-stoic:notion-db') || '');
    setBirthDate(localStorage.getItem('daily-stoic:birthdate') || '');
    setCycleStartDate(localStorage.getItem('daily-stoic:cycle-start-date') || '');
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
    for (let i = 1; i <= 365; i++) {
      const val = localStorage.getItem(`daily-stoic:reflection-${i}`);
      const fateVal = localStorage.getItem(`daily-stoic:fate-input-${i}`);
      const favVal = localStorage.getItem(`daily-stoic:favorite-${i}`) === 'true';
      let tagsVal: string[] = [];
      try {
        tagsVal = JSON.parse(localStorage.getItem(`daily-stoic:acceptance-tags-${i}`) || '[]');
      } catch {
        tagsVal = [];
      }
      
      let passionsVal: string[] = [];
      try {
        passionsVal = JSON.parse(localStorage.getItem(`daily-stoic:passions-${i}`) || '[]');
      } catch {
        passionsVal = [];
      }
      const createdTimeVal = localStorage.getItem(`daily-stoic:created-time-${i}`) || '';
      
      const estimatedDateStr = (() => {
        const y = new Date().getFullYear();
        const d = new Date(y, 0, 1);
        d.setDate(i);
        return d.toISOString().split('T')[0];
      })();

      if (val || fateVal || tagsVal.length > 0 || favVal || passionsVal.length > 0) {
        days.add(i);
        records.push({
          date: estimatedDateStr,
          quoteId: i,
          text: val || '',
          fateInput: fateVal || '',
          acceptanceTags: tagsVal,
          favorite: favVal,
          passions: passionsVal,
          createdTime: createdTimeVal || `${estimatedDateStr}T12:00:00Z`,
        });
      }
    }
    setRecentReflections(records);
    
    const currentStreak = calculateStreak(days, todayVal);
    setStreak(currentStreak);
    
    const todayLogged = days.has(todayVal);
    await updateReminderIDB(todayLogged);
  }, [updateReminderIDB]);

  const resetCycleData = useCallback(async () => {
    try {
      if (token.trim() && databaseId.trim()) {
        await clearDatabaseEntries(token, databaseId);
      }

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('daily-stoic:reflection-') ||
          key.startsWith('daily-stoic:fate-input-') ||
          key.startsWith('daily-stoic:acceptance-tags-') ||
          key.startsWith('daily-stoic:morning-intentions-') ||
          key.startsWith('daily-stoic:mood-') ||
          key.startsWith('daily-stoic:passions-') ||
          key.startsWith('daily-stoic:favorite-') ||
          key.startsWith('daily-stoic:retro-notes-') ||
          key.startsWith('daily-stoic:retro-rating-') ||
          key.startsWith('daily-stoic:focus-completed-') ||
          key.startsWith('daily-stoic:meditate-completed-') ||
          key.startsWith('daily-stoic:selected-virtue-')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('daily-stoic:dichotomy', '[]');

      const todayStr = getLocalTodayStr();
      localStorage.setItem('daily-stoic:cycle-start-date', todayStr);
      setCycleStartDate(todayStr);

      localStorage.removeItem('daily-stoic:simulate-celebration');

      // Reload credentials
      setToken(localStorage.getItem('daily-stoic:notion-token') || '');
      setDatabaseId(localStorage.getItem('daily-stoic:notion-db') || '');
      setBirthDate(localStorage.getItem('daily-stoic:birthdate') || '');
      
      const todayVal = getCycleDay(todayStr);

      // Reload reflections/schema
      if (token.trim() && databaseId.trim()) {
        const props = await fetchDatabaseProperties(token, databaseId);
        const errors = validateSchema(props);
        setSchemaErrors(errors);
        setHasPassionsProperty('Passions' in props);
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
      } else {
        setSchemaErrors([]);
        setHasPassionsProperty(false);
        await loadLocalStorageStreak(todayVal);
      }

      window.dispatchEvent(new Event('daily-stoic:settings-updated'));
      triggerHaptic('success');
    } catch (e: any) {
      throw new Error(e.message || e);
    }
  }, [token, databaseId, loadLocalStorageStreak, updateReminderIDB]);

  const loadReflectionsAndCheckStreak = useCallback(async () => {
    const todayVal = getCycleDay(cycleStartDate);

    if (token.trim() && databaseId.trim()) {
      try {
        const props = await fetchDatabaseProperties(token, databaseId);
        const errors = validateSchema(props);
        setSchemaErrors(errors);
        setHasPassionsProperty('Passions' in props);

        // Auto-upgrade schema if optional columns are missing so saves never fail silently
        const missingOptional = !('Passions' in props) || !('Dichotomy' in props) ||
          !('Mood' in props) || !('MorningIntentions' in props);
        if (missingOptional && errors.length === 0) {
          try {
            await upgradeDatabaseSchema(token, databaseId);
          } catch (upgradeErr) {
            console.warn('Auto-upgrade of optional schema columns failed:', upgradeErr);
          }
        }

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
        setHasPassionsProperty(false);
        await loadLocalStorageStreak(todayVal);
      }
    } else {
      setSchemaErrors([]);
      setHasPassionsProperty(false);
      await loadLocalStorageStreak(todayVal);
    }
  }, [token, databaseId, cycleStartDate, loadLocalStorageStreak, updateReminderIDB]);

  const isCycleCompleted = useMemo(() => {
    if (!cycleStartDate) return false;
    const start = new Date(cycleStartDate);
    const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const today = new Date();
    const todayD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = todayD.getTime() - startD.getTime();
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    return diffDays >= 365 || localStorage.getItem('daily-stoic:simulate-celebration') === 'true';
  }, [cycleStartDate]);

  useEffect(() => {
    if (isCycleCompleted) {
      setShowCelebration(true);
    }
  }, [isCycleCompleted]);

  // Compute Retrospective Insights
  const cycleReflections = useMemo(() => {
    if (!cycleStartDate) return recentReflections;
    const start = new Date(cycleStartDate);
    return recentReflections.filter((r) => {
      const d = new Date(r.date);
      return d.getTime() >= start.getTime();
    });
  }, [recentReflections, cycleStartDate]);

  const loggedCount = cycleReflections.length;
  const consistencyRate = Math.min(100, Math.round((loggedCount / 365) * 100));

  const reframingsCount = useMemo(() => {
    return cycleReflections.filter(r => r.fateInput && r.fateInput.trim()).length;
  }, [cycleReflections]);

  const passionsCount = useMemo(() => {
    let count = 0;
    cycleReflections.forEach((r) => {
      count += (r.passions || []).length;
    });
    return count;
  }, [cycleReflections]);

  const cycleWorriesStats = useMemo(() => {
    // When Notion is configured, derive worries from recentReflections (source of truth)
    // When offline, fall back to localStorage
    let allWorries: any[] = [];
    if (isNotionConfigured) {
      recentReflections.forEach((rec) => {
        if (rec.dichotomy) {
          try {
            const list: any[] = JSON.parse(rec.dichotomy);
            allWorries.push(...list);
          } catch {}
        }
      });
    } else {
      const saved = localStorage.getItem('daily-stoic:dichotomy');
      if (saved) {
        try {
          allWorries = JSON.parse(saved);
        } catch {}
      }
    }
    if (allWorries.length === 0) return { total: 0, resolved: 0, rate: 0 };
    const start = cycleStartDate ? new Date(cycleStartDate).getTime() : 0;
    const cycleList = allWorries.filter((w) => {
      if (!w.createdAt) return true;
      const d = new Date(w.createdAt).getTime();
      return d >= start;
    });
    const resolved = cycleList.filter((w) => w.isResolved).length;
    const total = cycleList.length;
    return {
      total,
      resolved,
      rate: total > 0 ? Math.round((resolved / total) * 100) : 0
    };
  }, [cycleStartDate, showCelebration, recentReflections, isNotionConfigured]);

  const [isSharingCelebration, setIsSharingCelebration] = useState(false);
  
  const handleShareCelebration = async () => {
    setIsSharingCelebration(true);
    triggerHaptic('light');
    try {
      const shareContainer = document.createElement('div');
      shareContainer.style.position = 'absolute';
      shareContainer.style.left = '-9999px';
      shareContainer.style.width = '800px';
      shareContainer.style.backgroundColor = '#121127';
      shareContainer.style.color = '#ECEBF8';
      shareContainer.style.padding = '60px';
      shareContainer.style.borderRadius = '24px';
      shareContainer.style.border = '2px solid #3B3770';
      shareContainer.style.fontFamily = "'Inter', system-ui, sans-serif";
      shareContainer.style.display = 'flex';
      shareContainer.style.flexDirection = 'column';
      shareContainer.style.gap = '35px';

      shareContainer.innerHTML = `
        <div style="text-align: center; border-bottom: 2px solid #28254C; padding-bottom: 20px;">
          <h2 style="font-family: 'Fraunces', Georgia, serif; font-size: 38px; color: #ECEBF8; margin: 0 0 10px;">🌟 A Year of Wisdom</h2>
          <p style="font-size: 18px; color: #A7A3D4; margin: 0;">My Annual Stoic Retrospective</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="background: #1B1940; border: 1px solid #28254C; padding: 25px; border-radius: 16px;">
            <span style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #A7A3D4;">Consistency Rate</span>
            <p style="font-size: 42px; font-weight: bold; color: #9A93F5; margin: 10px 0 0;">${consistencyRate}%</p>
            <p style="font-size: 15px; color: #7E7AB0; margin: 5px 0 0;">${loggedCount} of 365 days logged</p>
          </div>
          <div style="background: #1B1940; border: 1px solid #28254C; padding: 25px; border-radius: 16px;">
            <span style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #A7A3D4;">Amor Fati Reframes</span>
            <p style="font-size: 42px; font-weight: bold; color: #8E86FF; margin: 10px 0 0;">${reframingsCount}</p>
            <p style="font-size: 15px; color: #7E7AB0; margin: 5px 0 0;">Frictions converted to fuel</p>
          </div>
          <div style="background: #1B1940; border: 1px solid #28254C; padding: 25px; border-radius: 16px;">
            <span style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #A7A3D4;">Concerns Resolved</span>
            <p style="font-size: 42px; font-weight: bold; color: #4FB89A; margin: 10px 0 0;">${cycleWorriesStats.rate}%</p>
            <p style="font-size: 15px; color: #7E7AB0; margin: 5px 0 0;">${cycleWorriesStats.resolved} of ${cycleWorriesStats.total} worries cleared</p>
          </div>
          <div style="background: #1B1940; border: 1px solid #28254C; padding: 25px; border-radius: 16px;">
            <span style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #A7A3D4;">Citadel Vigilance</span>
            <p style="font-size: 42px; font-weight: bold; color: #ECEBF8; margin: 10px 0 0;">${passionsCount}</p>
            <p style="font-size: 15px; color: #7E7AB0; margin: 5px 0 0;">Dysfunctional passions tamed</p>
          </div>
        </div>

        <div style="background: #1B1940; border: 1px solid #28254C; padding: 25px; border-radius: 16px; font-style: italic; font-size: 18px; color: #A7A3D4; line-height: 1.6; text-align: center;">
          "True happiness is to enjoy the present, without anxious dependence upon the future, not to amuse ourselves with either hopes or fears but to rest satisfied with what we have."
          <span style="display: block; font-size: 15px; font-weight: 600; color: #ECEBF8; font-style: normal; margin-top: 15px;">— Seneca</span>
        </div>

        <div style="text-align: center; font-size: 16px; color: #7E7AB0; border-top: 2px solid #28254C; padding-top: 20px;">
          Created with the <strong>Daily Stoic</strong> Companion PWA
        </div>
      `;

      document.body.appendChild(shareContainer);

      const canvas = await html2canvas(shareContainer, {
        scale: 2,
        backgroundColor: '#121127',
        useCORS: true,
        logging: false
      });

      const link = document.createElement('a');
      link.download = 'daily-stoic-annual-retrospective.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      document.body.removeChild(shareContainer);
      triggerHaptic('success');
    } catch (e) {
      console.error('Failed to generate sharing image', e);
      alert('Failed to generate sharing image: ' + e);
    } finally {
      setIsSharingCelebration(false);
    }
  };

  const handleCompleteCelebrationAndReset = async () => {
    try {
      await resetCycleData();
      setShowCelebration(false);
      showToast("Happy New Cycle! Day 1 begins today.", "success");
    } catch (e: any) {
      showToast(e.message || e, "error");
    }
  };

  // Load streak, credentials, and validate schema on route changes
  useEffect(() => {
    loadCredentials();
    loadReflectionsAndCheckStreak();
  }, [route, loadReflectionsAndCheckStreak]);



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
    if (isNotionConfigured) {
      const record = recentReflections.find((r) => r.quoteId === dayOfYear);
      return !!record?.favorite;
    }
    return localStorage.getItem(`daily-stoic:favorite-${dayOfYear}`) === 'true';
  }, [dayOfYear, recentReflections, isNotionConfigured]);

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
    triggerHaptic('light');
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
          record?.id || undefined, // real page UUID for PATCH
          record?.fateInput || '',
          record?.acceptanceTags || [],
          nextFavoriteState,
          record?.mood || '',
          record?.morningIntentions || '',
          record?.passions || [],
          record?.dichotomy || '',
          record?.virtue || ''
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
    for (let i = 1; i <= 365; i++) {
      if (localStorage.getItem(`daily-stoic:favorite-${i}`) === 'true') {
        favoritedIds.add(i);
      }
    }

    return QUOTES.filter((q) => favoritedIds.has(q.day));
  }, [recentReflections, localFavoritesToggle]);

  interface Worry {
    id: string;
    text: string;
    category: 'unassigned' | 'up-to-me' | 'not-up-to-me';
    isResolved?: boolean;
    createdAt?: string;
  }

  const worries = useMemo<Worry[]>(() => {
    if (token.trim() && databaseId.trim()) {
      const parsedWorries: Worry[] = [];
      const seenIds = new Set<string>();
      recentReflections.forEach((rec) => {
        if (rec.dichotomy) {
          try {
            const list: Worry[] = JSON.parse(rec.dichotomy);
            list.forEach((w) => {
              if (w && w.id && !seenIds.has(w.id)) {
                seenIds.add(w.id);
                parsedWorries.push(w);
              }
            });
          } catch {}
        }
      });
      return parsedWorries;
    } else {
      const saved = localStorage.getItem('daily-stoic:dichotomy');
      try {
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
  }, [recentReflections, token, databaseId]);




  const tabOptions: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: 'Daily Reflection', value: '', Icon: BookOpenIcon },
    { label: 'Memento Mori', value: 'memento', Icon: SkullIcon },
    { label: 'Enchiridion', value: 'enchiridion', Icon: BookmarkIcon },
  ];

  const dashboardOptions: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: 'Spheres of Choice', value: 'dichotomy', Icon: ScaleIcon },
    { label: 'Passions & Judgments', value: 'passions', Icon: FlameIcon },
    { label: 'Amor Fati', value: 'amorfati', Icon: HeartIcon },
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
      <header className="sticky top-0 z-50 border-b border-tertiary bg-background-secondary px-4 py-3 sm:px-6 sm:py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 mr-4 sm:mr-8 shrink-0">
            <svg viewBox="0 0 64 64" className="w-5 h-5 sm:w-6 sm:h-6 text-accent" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" aria-hidden="true">
              <path d="M 10 12 L 54 12" />
              <path d="M 14 18 L 50 18" />
              <line x1="20" y1="18" x2="20" y2="46" />
              <line x1="26" y1="18" x2="26" y2="46" />
              <line x1="32" y1="18" x2="32" y2="46" />
              <line x1="38" y1="18" x2="38" y2="46" />
              <line x1="44" y1="18" x2="44" y2="46" />
              <path d="M 14 46 L 50 46" />
              <path d="M 10 52 L 54 52" />
            </svg>
            <h1 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-text-primary">
              Daily Stoic
            </h1>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0 relative">
            {/* Main Navigation */}
            {tabOptions.map((tab) => {
              const Icon = tab.Icon;
              const isActive = route === `/${tab.value}` || (route === '' && tab.value === '') || (route === '/' && tab.value === '');
              return (
                <button
                  key={tab.value}
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate(tab.value === '' ? '/' : `/${tab.value}`);
                  }}
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

            {/* Desktop Only Dashboard Navigation */}
            <div className="hidden sm:flex items-center gap-0.5 sm:gap-1.5">
              {dashboardOptions.map((tab) => {
                const Icon = tab.Icon;
                const isActive = route === `/${tab.value}`;
                return (
                  <button
                    key={tab.value}
                    onClick={() => navigate(`/${tab.value}`)}
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

              <div className="w-px h-5 bg-tertiary shrink-0 mx-1" aria-hidden="true" />

              <button
                onClick={() => navigate('/stats')}
                className={cn(
                  "rounded-md p-1.5 sm:p-2 transition-colors flex items-center justify-center shrink-0",
                  route === '/stats'
                    ? "bg-accent/10 text-accent"
                    : "text-text-secondary hover:bg-background-tertiary hover:text-text-primary"
                )}
                title="Stats & Progress"
              >
                <svg width="18" height="18" className="sm:w-[20px] sm:h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </button>
            </div>

            {/* Mobile Dropdown Collapsible Menu */}
            <div className="sm:hidden relative">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setDropdownOpen(!dropdownOpen);
                }}
                className={cn(
                  "rounded-md p-1.5 transition-colors flex items-center justify-center",
                  dropdownOpen || ['/dichotomy', '/passions', '/amorfati', '/stats'].includes(route)
                    ? "bg-accent/10 text-accent"
                    : "text-text-secondary hover:bg-background-tertiary"
                )}
                title="More Dashboards"
                aria-label="Toggle dashboards menu"
              >
                <DashboardIcon size={18} />
              </button>
              
              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 z-50 w-48 rounded-lg border border-tertiary bg-background-secondary p-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-text-secondary/70 border-b border-tertiary mb-1">
                      Stoic Dashboards
                    </div>
                    {dashboardOptions.map((tab) => {
                      const Icon = tab.Icon;
                      const isActive = route === `/${tab.value}`;
                      return (
                        <button
                          key={tab.value}
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate(`/${tab.value}`);
                          }}
                          className={cn(
                            "w-full rounded px-3 py-2 text-left text-xs font-medium transition-colors flex items-center gap-2.5",
                            isActive
                              ? "bg-accent/15 text-accent font-semibold"
                              : "text-text-secondary hover:bg-background-tertiary hover:text-text-primary"
                          )}
                        >
                          <Icon size={14} />
                          {tab.label}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate('/stats');
                      }}
                      className={cn(
                        "w-full rounded px-3 py-2 text-left text-xs font-medium transition-colors flex items-center gap-2.5 border-t border-tertiary mt-1 pt-2",
                        route === '/stats'
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-text-secondary hover:bg-background-tertiary hover:text-text-primary"
                      )}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                      </svg>
                      Stats & Progress
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-5 bg-tertiary shrink-0" aria-hidden="true" />

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
              onClick={() => {
                setDropdownOpen(false);
                navigate('/settings');
              }}
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
            onResetCycle={resetCycleData}
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
              hasPassionsProperty={hasPassionsProperty}
              worries={worries}
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
          <DichotomyOfControl onClose={() => navigate('/')} worries={worries} />
        )}

        {route === '/enchiridion' && (
          <div className="mx-auto max-w-4xl rounded-xl bg-background-secondary border border-tertiary p-6 sm:p-8 animate-in fade-in duration-500">
            <div className="mb-8 text-center">
              <h3 className="mb-3 font-display text-3xl text-text-primary flex items-center justify-center gap-3">
                <BookmarkIcon size={28} className="text-text-secondary" />
                The Enchiridion
              </h3>
              <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
                "Don’t explain your philosophy. Embody it." — Epictetus
              </p>
            </div>

            <div className="mb-8 rounded-xl border border-accent/25 bg-accent-soft p-5 sm:p-6 text-center max-w-2xl mx-auto shadow-sm animate-in fade-in zoom-in-95 duration-300">
              <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-accent/80 block">Stoic Ready-at-Hand Handbook</span>
              <h4 className="font-display text-xl sm:text-2xl text-text-primary mt-1">
                Your handbook contains <span className="text-accent font-bold underline decoration-2 decoration-accent/40 underline-offset-4">{favoritedMaxims.length}</span> principles.
              </h4>
              <p className="text-sm text-text-secondary mt-3 leading-relaxed max-w-md mx-auto italic">
                Epictetus's original Enchiridion translates to "handbook" or "ready at hand." Keep your favorited maxims here for rapid reference during high-stress moments.
              </p>
            </div>

            {favoritedMaxims.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary/50 mt-8 max-w-2xl mx-auto">
                <img src="/daily-stoic-empty-state.png" alt="Empty handbook" className="w-32 h-32 mb-4 object-contain opacity-80" />
                <h3 className="font-display text-xl text-text-primary mb-2">Your handbook is empty</h3>
                <p className="text-sm text-text-secondary max-w-sm">
                  Heart quotes on the Daily Reflection page to save them here for rapid reference.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {favoritedMaxims.map((q) => {
                  const index = q.day;
                  return (
                    <div key={index} className="rounded-xl bg-background-tertiary p-6 border border-tertiary flex flex-col justify-between hover:shadow-md transition-all duration-300 relative group">
                      <div className="mb-4">
                        <span className="text-[10px] font-mono text-text-secondary/60 block mb-2">DAY {index}</span>
                        <p className="font-display text-base text-text-primary leading-relaxed">“{q.quote}”</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-tertiary/60 pt-4 text-xs text-text-secondary mt-auto">
                        <span className="italic font-medium">— {q.author}, {q.source}</span>
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
                          className="flex items-center gap-1 text-energy hover:text-energy/80 font-medium transition-colors p-1"
                          aria-label="Remove favorite"
                        >
                          <HeartIcon size={14} className="fill-energy text-energy" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {route === '/passions' && (
          <PassionsAnalytics
            recentReflections={recentReflections}
            onClose={() => navigate('/')}
          />
        )}

        {route === '/amorfati' && (
          <AmorFatiDashboard
            recentReflections={recentReflections}
            onClose={() => navigate('/')}
          />
        )}
      </main>

      {showCelebration && (
        <div className="fixed inset-0 z-50 bg-background-primary/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" role="dialog">
          <div 
            id="annual-insights-card" 
            className="max-w-xl w-full bg-background-secondary border border-secondary rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300"
          >
            <div className="space-y-2">
              <Sparkles className="text-accent mx-auto w-12 h-12 animate-pulse" />
              <h2 className="font-display text-2xl sm:text-3xl text-text-primary">
                🌟 A Year of Wisdom
              </h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                You have completed your 365-day Stoic journey cycle. Here is a retrospective of your training in virtue and tranquility.
              </p>
            </div>
            
            {/* Insights Stats Grid */}
            <div className="grid grid-cols-2 gap-3.5 text-left pt-2">
              <div className="p-4 rounded-xl border border-tertiary bg-background-tertiary">
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">Consistency Rate</span>
                <p className="text-2xl font-semibold text-accent mt-0.5">{consistencyRate}%</p>
                <p className="text-[11px] text-text-secondary mt-1">{loggedCount} of 365 days logged</p>
              </div>
              
              <div className="p-4 rounded-xl border border-tertiary bg-background-tertiary">
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">Amor Fati Reframes</span>
                <p className="text-2xl font-semibold text-energy mt-0.5">{reframingsCount}</p>
                <p className="text-[11px] text-text-secondary mt-1">Frictions converted to fuel</p>
              </div>
              
              <div className="p-4 rounded-xl border border-tertiary bg-background-tertiary">
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">Concerns Resolved</span>
                <p className="text-2xl font-semibold text-success mt-0.5">{cycleWorriesStats.rate}%</p>
                <p className="text-[11px] text-text-secondary mt-1">{cycleWorriesStats.resolved} of {cycleWorriesStats.total} worries cleared</p>
              </div>

              <div className="p-4 rounded-xl border border-tertiary bg-background-tertiary">
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">Citadel Vigilance</span>
                <p className="text-2xl font-semibold text-text-primary mt-0.5">{passionsCount}</p>
                <p className="text-[11px] text-text-secondary mt-1">Dysfunctional passions tamed</p>
              </div>
            </div>

            {/* Virtues summary quote */}
            <blockquote className="text-xs text-text-secondary italic bg-background-tertiary p-3 rounded-lg border border-tertiary leading-relaxed text-center">
              "True happiness is to enjoy the present, without anxious dependence upon the future, not to amuse ourselves with either hopes or fears but to rest satisfied with what we have." 
              <span className="block text-[10px] font-semibold text-text-primary mt-1">— Seneca</span>
            </blockquote>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-2">
              <Button 
                onClick={handleShareCelebration} 
                variant="secondary" 
                className="w-full sm:w-auto flex items-center justify-center gap-2"
                disabled={isSharingCelebration}
              >
                {isSharingCelebration ? 'Generating...' : '📥 Share Insights'}
              </Button>
              
              <Button 
                onClick={handleCompleteCelebrationAndReset} 
                variant="primary" 
                className="w-full sm:w-auto font-semibold"
              >
                Begin New Cycle & Day 1
              </Button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
