import { useState, useEffect, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '../ds';
import Onboarding from './components/Onboarding';
import Journal from './Journal';
import Settings from './Settings';
import MementoMori from './components/MementoMori';
import { ToastContainer, showToast } from './components/Toast';
import { DichotomyOfControl } from './components/DichotomyOfControl';
import Stats from './components/Stats';
import PassionsAnalytics from './components/PassionsAnalytics';
import AmorFatiDashboard from './components/AmorFatiDashboard';
import CycleRetrospectiveCard from './components/CycleRetrospectiveCard';
import DigestDashboard from './components/DigestDashboard';
import CommitmentsDashboard from './components/CommitmentsDashboard';
import Council from './components/Council';
import PauseDrill from './components/PauseDrill';
import Ornament from './components/Ornament';
import { getQuoteForDay, getLocalTodayStr, getCycleDay, cycleDayToDateStr, getCycleInfo, mostRecentMonday } from './utils/date';
import { calculateStreak } from './utils/streak';
import { fetchReflectionsForStreak, fetchAllReflections, fetchDatabaseProperties, validateSchema, upgradeDatabaseSchema, getMissingOptionalColumns, upsertReflection, clearDatabaseEntries, ReflectionRecord } from './services/NotionService';
import { computeCycleRetrospective, extractWorriesFromReflections, Worry } from './utils/retrospective';
import { createIdbKv } from '../shared/notify/idbKv';
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
  History as HistoryIcon,
  Handshake as HandshakeIcon,
  Users as UsersIcon,
  Wind as WindIcon,
  type LucideIcon,
} from 'lucide-react';

// Screens that need the full, unbounded Notion history rather than the
// ~100-record window (see the effect below that fetches it).
const FULL_HISTORY_ROUTES = ['/digest', '/stats', '/passions', '/amorfati', '/dichotomy', '/commitments', '/council'];

export default function App() {
  const [cycleStartDate, setCycleStartDate] = useState(() => localStorage.getItem('daily-stoic:cycle-start-date') || '');

  // The calendar date driving `today` below. A plain `new Date()` read once at
  // mount would freeze the app on whatever day it happened to be opened —
  // installed as a PWA and left running (or backgrounded) across midnight, it
  // would keep showing yesterday's quote and writing into yesterday's
  // day-slot until force-closed. Refreshed on refocus/visibility (the common
  // "came back to the app" case) and via a precise timeout at the next local
  // midnight (the "left it open and focused straight through midnight" case).
  const [todayDate, setTodayDate] = useState(() => new Date());
  const refreshTodayDate = useCallback(() => {
    setTodayDate((prev) => (getLocalTodayStr(new Date()) === getLocalTodayStr(prev) ? prev : new Date()));
  }, []);
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') refreshTodayDate();
    }
    window.addEventListener('focus', refreshTodayDate);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refreshTodayDate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshTodayDate]);
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const id = setTimeout(refreshTodayDate, nextMidnight.getTime() - now.getTime());
    return () => clearTimeout(id);
  }, [todayDate, refreshTodayDate]);

  const today = useMemo(() => getCycleDay(cycleStartDate, todayDate), [cycleStartDate, todayDate]);
  const dayOfYear = today;
  const cycleInfo = useMemo(() => getCycleInfo(today), [today]);

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
  const [notionFullReflections, setNotionFullReflections] = useState<ReflectionRecord[]>([]);
  const [fullReflectionsLoading, setFullReflectionsLoading] = useState(false);
  // Offline, there's nothing to fetch — recentReflections already holds the
  // complete unbounded local history — so this just passes it through. See
  // the effect further below that populates notionFullReflections; it
  // deliberately doesn't depend on recentReflections (that would double-fire
  // the fetch the moment recentReflections updates a beat after route entry).
  const fullReflections = useMemo(
    () => (isNotionConfigured ? notionFullReflections : recentReflections),
    [isNotionConfigured, notionFullReflections, recentReflections]
  );
  const [schemaErrors, setSchemaErrors] = useState<string[]>([]);
  const [hasPassionsProperty, setHasPassionsProperty] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCelebratedCycle, setLastCelebratedCycle] = useState(() =>
    parseInt(localStorage.getItem('daily-stoic:last-celebrated-cycle') || '0', 10)
  );

  // Toggling favorites loading indicator
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [localFavoritesToggle, setLocalFavoritesToggle] = useState(0);

  // Enhance 3 — the in-the-moment Pause drill (a 60-second reset for when a
  // passion flares in real life). Reachable from the header on any screen.
  const [showPause, setShowPause] = useState(false);

  const loadCredentials = () => {
    setToken(localStorage.getItem('daily-stoic:notion-token') || '');
    setDatabaseId(localStorage.getItem('daily-stoic:notion-db') || '');
    setBirthDate(localStorage.getItem('daily-stoic:birthdate') || '');
    setCycleStartDate(localStorage.getItem('daily-stoic:cycle-start-date') || '');
  };

  const updateReminderIDB = useCallback(async (todayLogged: boolean) => {
    // Must write the exact shape the service worker reads (morningTime /
    // eveningTime / todayLogged — see public/daily-stoic-sw.js) and the exact
    // localStorage keys Settings writes, or this refresh-on-every-route-change
    // would clobber the user's custom reminder times back to the SW defaults.
    const enabled = localStorage.getItem('daily-stoic:reminder-enabled') === 'true';
    const morningTime = localStorage.getItem('daily-stoic:morning-time') || '07:00';
    const eveningTime = localStorage.getItem('daily-stoic:evening-time') || '20:00';
    const kv = createIdbKv('daily-stoic-reminders');
    await kv.set('state', {
      enabled,
      morningTime,
      eveningTime,
      todayLogged,
    });
  }, []);

  const loadLocalStorageStreak = useCallback(async (todayVal: number) => {
    const days = new Set<number>();
    const records: ReflectionRecord[] = [];
    // Day numbers are unbounded now (see utils/date.ts's getCycleDay), not
    // capped at 365 — loop through every day that could actually exist so
    // offline history past a year doesn't silently vanish from every
    // dashboard, including the new Digest archive.
    for (let i = 1; i <= todayVal; i++) {
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
      const moodVal = localStorage.getItem(`daily-stoic:mood-${i}`) || '';
      const createdTimeVal = localStorage.getItem(`daily-stoic:created-time-${i}`) || '';
      const morningIntentionsVal = localStorage.getItem(`daily-stoic:morning-intentions-${i}`) || '';
      const virtueVal = localStorage.getItem(`daily-stoic:selected-virtue-${i}`) || '';

      const estimatedDateStr = cycleDayToDateStr(i, cycleStartDate);

      if (val || fateVal || tagsVal.length > 0 || favVal || passionsVal.length > 0 || moodVal || morningIntentionsVal) {
        days.add(i);
        records.push({
          date: estimatedDateStr,
          quoteId: i,
          text: val || '',
          fateInput: fateVal || '',
          acceptanceTags: tagsVal,
          favorite: favVal,
          passions: passionsVal,
          mood: moodVal,
          morningIntentions: morningIntentionsVal,
          virtue: virtueVal,
          createdTime: createdTimeVal || `${estimatedDateStr}T12:00:00Z`,
        });
      }
    }
    setRecentReflections(records);
    
    const currentStreak = calculateStreak(days, todayVal);
    setStreak(currentStreak);
    
    const todayLogged = days.has(todayVal);
    await updateReminderIDB(todayLogged);
  }, [updateReminderIDB, cycleStartDate]);

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
      // The Commitments ledger is practice history too — wipe it for a clean
      // Cycle 1 (the mentor's API key/enable flag are kept, like Notion creds).
      localStorage.removeItem('daily-stoic:commitments');
      window.dispatchEvent(new Event('daily-stoic:commitments-updated'));

      // Cycles always start on a Monday (so week boundaries land on real
      // Mondays) — the automatic 28-day rollover preserves this on its own,
      // but a manual reset can happen on any day, so snap back to the most
      // recent Monday rather than "today" directly.
      const todayStr = getLocalTodayStr(mostRecentMonday());
      localStorage.setItem('daily-stoic:cycle-start-date', todayStr);
      setCycleStartDate(todayStr);

      localStorage.setItem('daily-stoic:last-celebrated-cycle', '0');
      setLastCelebratedCycle(0);
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
        if (getMissingOptionalColumns(props).length > 0 && errors.length === 0) {
          try {
            await upgradeDatabaseSchema(token, databaseId);
          } catch (upgradeErr) {
            console.warn('Auto-upgrade of optional schema columns failed:', upgradeErr);
          }
        }
        if (errors.length === 0) {
          const { records, streak: currentStreak } = await fetchReflectionsForStreak(token, databaseId, todayVal);
          setRecentReflections(records);
          setStreak(currentStreak);
          const todayLogged = records.some((r) => r.quoteId === todayVal);
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

        // Auto-upgrade schema if any optional column is missing so saves never fail silently
        if (getMissingOptionalColumns(props).length > 0 && errors.length === 0) {
          try {
            await upgradeDatabaseSchema(token, databaseId);
          } catch (upgradeErr) {
            console.warn('Auto-upgrade of optional schema columns failed:', upgradeErr);
          }
        }

        if (errors.length === 0) {
          const { records, streak: currentStreak } = await fetchReflectionsForStreak(token, databaseId, todayVal);
          setRecentReflections(records);
          setStreak(currentStreak);

          const todayLogged = records.some((r) => r.quoteId === todayVal);
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

  // The most recently fully-completed cycle, if any (0 before Cycle 1 finishes).
  // Cycle rollover itself is automatic and non-destructive — this only tracks
  // whether that most recent completion has been shown to the user yet, so
  // the celebration fires exactly once per cycle no matter when they next
  // open the app (not just if they happen to open it on the exact day a new
  // cycle begins). Kept separate from displayCycleNumber below: this is the
  // only value ever written to "last-celebrated-cycle" bookkeeping, so a
  // simulated preview (before any cycle has really finished) can never mark
  // a cycle as seen that hasn't actually completed.
  const worries = useMemo<Worry[]>(() => {
    if (token.trim() && databaseId.trim()) {
      return extractWorriesFromReflections(recentReflections);
    } else {
      const saved = localStorage.getItem('daily-stoic:dichotomy');
      try {
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
  }, [recentReflections, token, databaseId]);

  // Same as `worries`, but derived from the full (unbounded) history rather
  // than the ~100-record window — for Spheres of Choice and Digest, which
  // both need every worry ever logged, not just the recent ones. Offline,
  // there's no windowing to begin with (a single localStorage key already
  // holds everything), so it's identical to `worries`.
  const fullWorries = useMemo<Worry[]>(() => {
    if (token.trim() && databaseId.trim()) {
      return extractWorriesFromReflections(fullReflections);
    }
    return worries;
  }, [fullReflections, token, databaseId, worries]);

  const completedCycleNumber = cycleInfo.cycle - 1;

  // What to show in the celebration UI: the real completed cycle once one
  // exists, or the in-progress cycle when previewing via the Settings
  // diagnostics "Simulate Cycle Completion" toggle before that's happened —
  // otherwise the preview would nonsensically read "Cycle 0 Complete".
  const displayCycleNumber = completedCycleNumber >= 1 ? completedCycleNumber : cycleInfo.cycle;

  const isCycleCompleted = useMemo(() => {
    return (
      (completedCycleNumber >= 1 && completedCycleNumber > lastCelebratedCycle) ||
      localStorage.getItem('daily-stoic:simulate-celebration') === 'true'
    );
  }, [completedCycleNumber, lastCelebratedCycle]);

  useEffect(() => {
    if (isCycleCompleted) {
      setShowCelebration(true);
    }
  }, [isCycleCompleted]);

  // The celebrated cycle's own 28-day date range (not all-time —
  // cycleStartDate itself never moves under the new non-destructive
  // rollover, so "since cycleStartDate" would otherwise mean "since the
  // beginning of time").
  const retrospective = useMemo(
    () => computeCycleRetrospective(displayCycleNumber, cycleStartDate, recentReflections, worries),
    [displayCycleNumber, cycleStartDate, recentReflections, worries]
  );
  const { loggedCount, consistencyRate, reframingsCount, passionsCount } = retrospective;
  const cycleWorriesStats = retrospective.worriesStats;

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
          <h2 style="font-family: 'Fraunces', Georgia, serif; font-size: 38px; color: #ECEBF8; margin: 0 0 10px;">🌟 Cycle ${displayCycleNumber} Complete</h2>
          <p style="font-size: 18px; color: #A7A3D4; margin: 0;">My 28-Day Stoic Retrospective</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="background: #1B1940; border: 1px solid #28254C; padding: 25px; border-radius: 16px;">
            <span style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #A7A3D4;">Consistency Rate</span>
            <p style="font-size: 42px; font-weight: bold; color: #9A93F5; margin: 10px 0 0;">${consistencyRate}%</p>
            <p style="font-size: 15px; color: #7E7AB0; margin: 5px 0 0;">${loggedCount} of 28 days logged</p>
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
    } catch (e: any) {
      console.error('Failed to generate sharing image', e);
      showToast(e?.message || 'Failed to generate the sharing image.', 'error');
    } finally {
      setIsSharingCelebration(false);
    }
  };

  const handleAcknowledgeCelebration = () => {
    // Cycle rollover already happened automatically and non-destructively —
    // this just marks the completed cycle as seen so the celebration doesn't
    // fire again, and keeps every prior day's history intact.
    localStorage.setItem('daily-stoic:last-celebrated-cycle', String(completedCycleNumber));
    setLastCelebratedCycle(completedCycleNumber);
    localStorage.removeItem('daily-stoic:simulate-celebration');
    setShowCelebration(false);
    triggerHaptic('success');
  };

  // Load streak, credentials, and validate schema on route changes — and
  // again whenever the day itself rolls over (todayDate), so the streak and
  // schema state are recomputed against the new day rather than lingering
  // from whichever day the app was last actually loaded on.
  useEffect(() => {
    loadCredentials();
    loadReflectionsAndCheckStreak();
  }, [route, todayDate, loadReflectionsAndCheckStreak]);

  // Every dashboard (Digest, Stats, Amor Fati, Passions & Judgments, Spheres
  // of Choice) needs the FULL Notion history, not the ~100-record window the
  // main wizard fetches by default (fetchReflectionsForStreak only pages
  // past that when a long unbroken streak actually requires it) — a "Year"
  // or "All" filter would otherwise silently under-report. Fetch it lazily
  // only when one of those routes is actually opened. Deliberately does NOT
  // depend on recentReflections —
  // that value gets set a moment later by the route-change effect above, and
  // depending on it here would re-fire this fetch a second time right after
  // the first one finishes (the "double load" this is guarding against).
  // Offline, there's nothing to fetch at all — recentReflections already
  // holds the complete unbounded local history (see loadLocalStorageStreak
  // above), so the derived fullReflections below just reads it directly.
  useEffect(() => {
    if (!FULL_HISTORY_ROUTES.includes(route) || !isNotionConfigured) return;
    let cancelled = false;
    setFullReflectionsLoading(true);
    fetchAllReflections(token, databaseId)
      .then((records) => {
        if (!cancelled) setNotionFullReflections(records);
      })
      .catch((err) => {
        console.error('Failed to load full reflection history:', err);
        showToast('Could not load your full history.', 'error');
      })
      .finally(() => {
        if (!cancelled) setFullReflectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [route, isNotionConfigured, token, databaseId]);

  const quote = getQuoteForDay(dayOfYear);
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
    } catch (e: any) {
      console.error('Failed to generate image', e);
      showToast(e?.message || 'Failed to generate the quote image.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  // Shared by the heart toggle on the current day's quote and the Enchiridion's
  // "Remove favorite" button, so there is exactly one place that knows how to
  // persist a favorite change — one bug fixed here fixes both call sites.
  const setFavoriteForDay = useCallback(async (index: number, nextFavoriteState: boolean) => {
    localStorage.setItem(`daily-stoic:favorite-${index}`, nextFavoriteState.toString());
    setLocalFavoritesToggle((prev) => prev + 1);

    if (isNotionConfigured && schemaErrors.length === 0) {
      try {
        const record = recentReflections.find((r) => r.quoteId === index);
        const dateStr = cycleDayToDateStr(index, cycleStartDate);

        await upsertReflection(
          token,
          databaseId,
          index,
          record?.text || '',
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
      } catch (err: any) {
        console.error('Failed to toggle favorite on cloud:', err);
        showToast(
          (err?.message ? err.message + ' ' : '') + 'Saved on this device, but it did not sync to Notion.',
          'error'
        );
      }
    } else {
      await loadLocalStorageStreak(today);
    }
  }, [isNotionConfigured, schemaErrors, recentReflections, token, databaseId, cycleStartDate, loadReflectionsAndCheckStreak, loadLocalStorageStreak, today]);

  const handleToggleFavorite = async () => {
    if (isTogglingFavorite) return;
    triggerHaptic('light');
    setIsTogglingFavorite(true);
    try {
      await setFavoriteForDay(dayOfYear, !isCurrentQuoteFavorited);
    } finally {
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

    // Check localStorage fallback (unbounded day count — see loadLocalStorageStreak above)
    for (let i = 1; i <= today; i++) {
      if (localStorage.getItem(`daily-stoic:favorite-${i}`) === 'true') {
        favoritedIds.add(i);
      }
    }

    // Day numbers are unbounded (they keep counting past QUOTES.length), but
    // each maps to a quote via the same modulo getQuoteForDay uses — filtering
    // QUOTES by q.day directly would silently drop any favorite made after the
    // first 366 days. Keep the favorited day as `day` so the card label and the
    // Remove button both keep addressing the day the favorite was actually
    // stored under.
    return Array.from(favoritedIds)
      .sort((a, b) => a - b)
      .map((id) => ({ ...getQuoteForDay(id), day: id }));
  }, [recentReflections, localFavoritesToggle, today]);


  const tabOptions: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: 'Daily Reflection', value: '', Icon: BookOpenIcon },
    { label: 'Memento Mori', value: 'memento', Icon: SkullIcon },
    { label: 'Enchiridion', value: 'enchiridion', Icon: BookmarkIcon },
  ];

  const dashboardOptions: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: 'Commitments', value: 'commitments', Icon: HandshakeIcon },
    { label: 'The Council', value: 'council', Icon: UsersIcon },
    { label: 'Spheres of Choice', value: 'dichotomy', Icon: ScaleIcon },
    { label: 'Passions & Judgments', value: 'passions', Icon: FlameIcon },
    { label: 'Amor Fati', value: 'amorfati', Icon: HeartIcon },
    { label: 'Digest', value: 'digest', Icon: HistoryIcon },
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
      <header className="safe-top sticky top-0 z-50 border-b border-tertiary bg-background-secondary px-4 pb-3 sm:px-6 sm:pb-4 shadow-sm">
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
            <h1 className="font-display text-lg sm:text-2xl font-semibold tracking-[0.02em] text-text-primary">
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
                  dropdownOpen || ['/commitments', '/council', '/dichotomy', '/passions', '/amorfati', '/digest', '/stats'].includes(route)
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

            <button
              onClick={() => {
                triggerHaptic('light');
                setShowPause(true);
              }}
              className="rounded-md p-1.5 sm:p-2 text-text-secondary hover:bg-background-tertiary hover:text-accent transition-colors flex items-center justify-center shrink-0"
              title="Pause — a 60-second reset when a passion flares"
              aria-label="Open the Pause drill"
            >
              <WindIcon size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
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

      <main className="safe-bottom mx-auto w-full max-w-3xl p-4 sm:p-8">
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
            today={today}
            cycleStartDate={cycleStartDate}
            reflections={fullReflections}
            loading={fullReflectionsLoading}
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
          <DichotomyOfControl
            today={today}
            cycleStartDate={cycleStartDate}
            onClose={() => navigate('/')}
            worries={fullWorries}
            loading={fullReflectionsLoading}
          />
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
              <Ornament className="mt-5" />
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
                        <p className="font-display text-base text-text-primary leading-relaxed" style={{ letterSpacing: '-0.01em' }}>“{q.quote}”</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-tertiary/60 pt-4 text-xs text-text-secondary mt-auto">
                        <span className="almanac-cite font-medium">— {q.author}, {q.source}</span>
                        <button
                          onClick={async () => {
                            triggerHaptic('light');
                            await setFavoriteForDay(index, false);
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
            reflections={fullReflections}
            loading={fullReflectionsLoading}
            today={today}
            cycleStartDate={cycleStartDate}
            onClose={() => navigate('/')}
          />
        )}

        {route === '/amorfati' && (
          <AmorFatiDashboard
            reflections={fullReflections}
            loading={fullReflectionsLoading}
            today={today}
            cycleStartDate={cycleStartDate}
            onClose={() => navigate('/')}
          />
        )}

        {route === '/digest' && (
          <DigestDashboard
            today={today}
            cycleStartDate={cycleStartDate}
            reflections={fullReflections}
            worries={fullWorries}
            loading={fullReflectionsLoading}
            onClose={() => navigate('/')}
          />
        )}

        {route === '/commitments' && (
          <CommitmentsDashboard
            today={today}
            cycleStartDate={cycleStartDate}
            reflections={fullReflections}
            onClose={() => navigate('/')}
            onGoToSettings={() => navigate('/settings')}
          />
        )}

        {route === '/council' && (
          <Council
            today={today}
            cycleStartDate={cycleStartDate}
            reflections={fullReflections}
            loading={fullReflectionsLoading}
            onClose={() => navigate('/')}
            onGoToSettings={() => navigate('/settings')}
          />
        )}
      </main>

      {showCelebration && (
        <div className="fixed inset-0 z-50 bg-background-primary/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" role="dialog">
          <div
            id="cycle-insights-card"
            className="max-w-xl w-full bg-background-secondary border border-secondary rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300"
          >
            <div className="space-y-2">
              <Sparkles className="text-accent mx-auto w-12 h-12 animate-pulse" />
              <h2 className="font-display text-2xl sm:text-3xl text-text-primary">
                🌟 Cycle {displayCycleNumber} Complete
              </h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                You've completed a 28-day cycle through all Four Cardinal Virtues. Cycle {cycleInfo.cycle} has already begun — here's a retrospective of the one you just finished.
              </p>
              <Ornament className="pt-2" />
            </div>

            {/* Insights Stats Grid */}
            <div className="pt-2">
              <CycleRetrospectiveCard retrospective={retrospective} />
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
                onClick={handleAcknowledgeCelebration}
                variant="primary"
                className="w-full sm:w-auto font-semibold"
              >
                Continue to Cycle {cycleInfo.cycle}
              </Button>
            </div>
          </div>
        </div>
      )}

      <PauseDrill open={showPause} onClose={() => setShowPause(false)} />

      <ToastContainer />
    </div>
  );
}
