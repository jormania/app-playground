import { useState, useEffect, useMemo } from 'react';
import { Button } from './components/Button';
import AppGuideNote from './components/AppGuideNote';
import { fetchReflectionForDay, upsertReflection } from './services/NotionService';
import { getLocalTodayStr } from './utils/date';
import AmorFatiControl from './components/AmorFatiControl';
import { triggerHaptic } from '../shared/haptics';
import { cn } from './lib/cn';
import { 
  SmilePlus, 
  Smile, 
  Meh, 
  Frown, 
  Angry, 
  Skull, 
  BookOpen, 
  Sun, 
  Moon, 
  Scale, 
  Check, 
  Heart, 
  Share2, 
  Shield
} from 'lucide-react';

interface JournalProps {
  dayOfYear: number;
  token: string;
  databaseId: string;
  onSaveComplete?: () => void;
  birthDate: string;
  favoritedMaxims: any[];
  onGoToSettings: () => void;
  onNavigateToTab: (tab: string) => void;
  quote: any;
  isCurrentQuoteFavorited: boolean;
  handleToggleFavorite: () => Promise<void>;
  handleShareQuote: () => Promise<void>;
  isSharing: boolean;
  isTogglingFavorite: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hasPassionsProperty?: boolean;
  hasDichotomyProperty?: boolean;
  worries: Worry[];
}

interface Worry {
  id: string;
  text: string;
  category: 'unassigned' | 'up-to-me' | 'not-up-to-me';
  isResolved?: boolean;
  createdAt?: string;
}

import { AVAILABLE_PASSIONS } from './data/passions';
export { AVAILABLE_PASSIONS };

export default function Journal({ 
  dayOfYear, 
  token, 
  databaseId, 
  onSaveComplete,
  birthDate,
  favoritedMaxims,
  onGoToSettings,
  onNavigateToTab,
  quote,
  isCurrentQuoteFavorited,
  handleToggleFavorite,
  handleShareQuote,
  isSharing,
  isTogglingFavorite,
  searchQuery,
  setSearchQuery,
  hasPassionsProperty = false,
  hasDichotomyProperty = false,
  worries: initialWorries
}: JournalProps) {
  const isNotionConfigured = !!token.trim() && !!databaseId.trim();
  const localStorageKey = `daily-stoic:reflection-${dayOfYear}`;
  const localFateKey = `daily-stoic:fate-input-${dayOfYear}`;
  const localTagsKey = `daily-stoic:acceptance-tags-${dayOfYear}`;
  const localIntentionsKey = `daily-stoic:morning-intentions-${dayOfYear}`;
  const localMoodKey = `daily-stoic:mood-${dayOfYear}`;
  const localPassionsKey = `daily-stoic:passions-${dayOfYear}`;
  const localCreatedTimeKey = `daily-stoic:created-time-${dayOfYear}`;
  const localVirtueKey = `daily-stoic:selected-virtue-${dayOfYear}`;

  // Active Journey Step (1: Focus, 2: Meditate, 3: Prepare, 4: Reflect)
  const [activeStep, setActiveStep] = useState<number>(() => {
    const hours = new Date().getHours();
    return hours < 14 ? 3 : 4; // Default to Morning Prep (3) before 2 PM, and Evening Review (4) after 2 PM
  });

  // Evening Reflection (Seneca's Interrogation)
  const [reflection, setReflection] = useState('');
  const [savedReflection, setSavedReflection] = useState('');
  
  const [senecaQ1, setSenecaQ1] = useState('');
  const [senecaQ2, setSenecaQ2] = useState('');
  const [senecaQ3, setSenecaQ3] = useState('');

  const [fateInput, setFateInput] = useState('');
  const [savedFateInput, setSavedFateInput] = useState('');
  const [acceptanceTags, setAcceptanceTags] = useState<string[]>([]);

  // Passions state
  const [passions, setPassions] = useState<string[]>([]);
  const [savedPassions, setSavedPassions] = useState<string[]>([]);

  // Morning Intentions (Premeditatio Malorum)
  const [morningIntentions, setMorningIntentions] = useState('');
  const [savedMorningIntentions, setSavedMorningIntentions] = useState('');

  // Mood Tracking
  const [mood, setMood] = useState('');
  const [savedMood, setSavedMood] = useState('');

  // Dichotomy of Control (Spheres of Choice) integration
  const [worries, setWorries] = useState<Worry[]>(initialWorries || []);
  const [savedWorries, setSavedWorries] = useState<Worry[]>(initialWorries || []);
  const [newWorry, setNewWorry] = useState('');
  const [selectedReframeIds, setSelectedReframeIds] = useState<string[]>([]);

  // Enchiridion random recall state
  const [recalledMaxim, setRecalledMaxim] = useState<any>(null);
  const [selectedVirtue, setSelectedVirtue] = useState<string | null>(null);
  const [savedVirtue, setSavedVirtue] = useState<string | null>(null);

  // Sync worries with props on load or day change
  useEffect(() => {
    if (initialWorries) {
      setWorries(initialWorries);
      setSavedWorries(initialWorries);
    }
  }, [initialWorries, dayOfYear]);

  // Sync worries with local storage (only when offline)
  useEffect(() => {
    if (!isNotionConfigured) {
      localStorage.setItem('daily-stoic:dichotomy', JSON.stringify(worries));
    }
  }, [worries, isNotionConfigured]);

  const handleToggleReframeWorry = (id: string) => {
    let nextIds: string[] = [];
    if (selectedReframeIds.includes(id)) {
      nextIds = selectedReframeIds.filter(x => x !== id);
    } else {
      nextIds = [...selectedReframeIds, id];
    }
    setSelectedReframeIds(nextIds);
    
    // Rebuild fateInput grammatically
    const selectedWorries = worries.filter(w => nextIds.includes(w.id));
    if (selectedWorries.length === 0) {
      setFateInput('');
    } else {
      const texts = selectedWorries.map(w => w.text.trim());
      let listStr = '';
      if (texts.length === 1) {
        listStr = texts[0].toLowerCase();
      } else if (texts.length === 2) {
        listStr = `${texts[0].toLowerCase()} and ${texts[1].toLowerCase()}`;
      } else {
        const formatted = texts.map((t, idx) => {
          if (idx === texts.length - 1) return `and ${t.toLowerCase()}`;
          return t.toLowerCase();
        });
        listStr = formatted.join(', ');
      }
      const verb = texts.length === 1 ? 'it as it is' : 'them as they are';
      setFateInput(`I cannot control ${listStr}, but I embrace ${verb}.`);
    }
    setIsSaved(false);
    triggerHaptic('light');
  };

  // Update reflection string when Qs change
  useEffect(() => {
    const combined = [
      senecaQ1.trim() ? `### What ailment or bad habit did I cure today?\n${senecaQ1.trim()}` : '',
      senecaQ2.trim() ? `### What failing did I resist?\n${senecaQ2.trim()}` : '',
      senecaQ3.trim() ? `### In what matter can I show improvement tomorrow?\n${senecaQ3.trim()}` : ''
    ].filter(Boolean).join('\n\n');
    
    if (combined !== reflection) {
      setReflection(combined);
    }
  }, [senecaQ1, senecaQ2, senecaQ3, reflection]);

  const [existingPageId, setExistingPageId] = useState<string | undefined>(undefined);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load reflection and Amor Fati data on day or config change
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!isNotionConfigured) {
        // Fallback to local storage
        const savedRef = localStorage.getItem(localStorageKey) || '';
        setReflection(savedRef);
        setSavedReflection(savedRef);
        
        if (savedRef.includes('### What ailment')) {
          const q1Match = savedRef.match(/### What ailment or bad habit did I cure today\?\n([\s\S]*?)(?=###|$)/);
          const q2Match = savedRef.match(/### What failing did I resist\?\n([\s\S]*?)(?=###|$)/);
          const q3Match = savedRef.match(/### In what matter can I show improvement tomorrow\?\n([\s\S]*?)(?=###|$)/);
          
          setSenecaQ1(q1Match ? q1Match[1].trim() : '');
          setSenecaQ2(q2Match ? q2Match[1].trim() : '');
          setSenecaQ3(q3Match ? q3Match[1].trim() : '');
        } else {
          setSenecaQ1(savedRef);
          setSenecaQ2('');
          setSenecaQ3('');
        }
        const savedIntentions = localStorage.getItem(localIntentionsKey) || '';
        const savedMoodVal = localStorage.getItem(localMoodKey) || '';
        let savedTags: string[] = [];
        try {
          savedTags = JSON.parse(localStorage.getItem(localTagsKey) || '[]');
        } catch {
          savedTags = [];
        }

        let savedPassionsVal: string[] = [];
        try {
          savedPassionsVal = JSON.parse(localStorage.getItem(localPassionsKey) || '[]');
        } catch {
          savedPassionsVal = [];
        }

        const savedVirtueVal = localStorage.getItem(localVirtueKey) || null;
        setSelectedVirtue(savedVirtueVal);
        setSavedVirtue(savedVirtueVal);
        setSavedReflection(savedRef);
        setFateInput(localStorage.getItem(localFateKey) || '');
        setSavedFateInput(localStorage.getItem(localFateKey) || '');
        setAcceptanceTags(savedTags);
        setPassions(savedPassionsVal);
        setSavedPassions(savedPassionsVal);
        setMorningIntentions(savedIntentions);
        setSavedMorningIntentions(savedIntentions);
        setMood(savedMoodVal);
        setSavedMood(savedMoodVal);
        setExistingPageId(undefined);
        setIsSaved(true);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchReflectionForDay(token, databaseId, dayOfYear);
        if (!active) return;

        if (result) {
          const refText = result.text || '';
          setReflection(refText);
          setSavedReflection(refText);
          
          if (refText.includes('### What ailment')) {
            const q1Match = refText.match(/### What ailment or bad habit did I cure today\?\n([\s\S]*?)(?=###|$)/);
            const q2Match = refText.match(/### What failing did I resist\?\n([\s\S]*?)(?=###|$)/);
            const q3Match = refText.match(/### In what matter can I show improvement tomorrow\?\n([\s\S]*?)(?=###|$)/);
            
            setSenecaQ1(q1Match ? q1Match[1].trim() : '');
            setSenecaQ2(q2Match ? q2Match[1].trim() : '');
            setSenecaQ3(q3Match ? q3Match[1].trim() : '');
          } else {
            setSenecaQ1(refText);
            setSenecaQ2('');
            setSenecaQ3('');
          }
          const savedVirtueVal = localStorage.getItem(localVirtueKey) || null;
          setSelectedVirtue(savedVirtueVal);
          setSavedVirtue(savedVirtueVal);
          setFateInput(result.fateInput || '');
          setSavedFateInput(result.fateInput || '');
          setAcceptanceTags(result.acceptanceTags || []);
          setPassions(result.passions || []);
          setSavedPassions(result.passions || []);
          setMorningIntentions(result.morningIntentions || '');
          setSavedMorningIntentions(result.morningIntentions || '');
          setMood(result.mood || '');
          setSavedMood(result.mood || '');
          setExistingPageId(result.id);
          
          let parsedWorries: Worry[] = [];
          if (result.dichotomy) {
            try {
              parsedWorries = JSON.parse(result.dichotomy);
            } catch {}
          } else {
            parsedWorries = initialWorries || [];
          }
          setWorries(parsedWorries);
          setSavedWorries(parsedWorries);
          
          setIsSaved(true);
        } else {
          if (isNotionConfigured) {
            setReflection('');
            setSavedReflection('');
            setFateInput('');
            setSavedFateInput('');
            setAcceptanceTags([]);
            setPassions([]);
            setSavedPassions([]);
            setMorningIntentions('');
            setSavedMorningIntentions('');
            setMood('');
            setSavedMood('');
            setExistingPageId(undefined);
            setWorries([]);
            setSavedWorries([]);
            setSelectedVirtue(null);
            setSavedVirtue(null);
            setIsSaved(true);
          } else {
            // Fallback to local storage
            const localBackup = localStorage.getItem(localStorageKey) || '';
            const localFateBackup = localStorage.getItem(localFateKey) || '';
            const localIntentionsBackup = localStorage.getItem(localIntentionsKey) || '';
            const localMoodBackup = localStorage.getItem(localMoodKey) || '';
            let localTagsBackup: string[] = [];
            try {
              localTagsBackup = JSON.parse(localStorage.getItem(localTagsKey) || '[]');
            } catch {
              localTagsBackup = [];
            }
            let localPassionsBackup: string[] = [];
            try {
              localPassionsBackup = JSON.parse(localStorage.getItem(localPassionsKey) || '[]');
            } catch {
              localPassionsBackup = [];
            }

            const localVirtueBackup = localStorage.getItem(localVirtueKey) || null;
            setReflection(localBackup);
            setSavedReflection('');
            setFateInput(localFateBackup);
            setSavedFateInput('');
            setAcceptanceTags(localTagsBackup);
            setPassions(localPassionsBackup);
            setSavedPassions([]);
            setMorningIntentions(localIntentionsBackup);
            setSavedMorningIntentions('');
            setMood(localMoodBackup);
            setSavedMood('');
            setSelectedVirtue(localVirtueBackup);
            setSavedVirtue(null);
            setExistingPageId(undefined);

            const savedWorriesLocal = localStorage.getItem('daily-stoic:dichotomy');
            let parsedWorriesLocal: Worry[] = [];
            try {
              parsedWorriesLocal = savedWorriesLocal ? JSON.parse(savedWorriesLocal) : [];
            } catch {}
            setWorries(parsedWorriesLocal);
            setSavedWorries(parsedWorriesLocal);

            const empty = localBackup === '' && localFateBackup === '' && localTagsBackup.length === 0 && localIntentionsBackup === '' && localMoodBackup === '' && localPassionsBackup.length === 0 && (localVirtueBackup === null || localVirtueBackup === '');
            setIsSaved(empty);
          }
        }
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'Failed to load reflection.');
        // Still load local storage so app is usable offline
        const localBackup = localStorage.getItem(localStorageKey) || '';
        const localFateBackup = localStorage.getItem(localFateKey) || '';
        const localIntentionsBackup = localStorage.getItem(localIntentionsKey) || '';
        const localMoodBackup = localStorage.getItem(localMoodKey) || '';
        let localTagsBackup: string[] = [];
        try {
          localTagsBackup = JSON.parse(localStorage.getItem(localTagsKey) || '[]');
        } catch {
          localTagsBackup = [];
        }
        let localPassionsBackup: string[] = [];
        try {
          localPassionsBackup = JSON.parse(localStorage.getItem(localPassionsKey) || '[]');
        } catch {
          localPassionsBackup = [];
        }
        const localVirtueBackup = localStorage.getItem(localVirtueKey) || null;
        setReflection(localBackup);
        setFateInput(localFateBackup);
        setAcceptanceTags(localTagsBackup);
        setPassions(localPassionsBackup);
        setMorningIntentions(localIntentionsBackup);
        setMood(localMoodBackup);
        setSelectedVirtue(localVirtueBackup);

        const savedWorriesLocal = localStorage.getItem('daily-stoic:dichotomy');
        let parsedWorriesLocal: Worry[] = [];
        try {
          parsedWorriesLocal = savedWorriesLocal ? JSON.parse(savedWorriesLocal) : [];
        } catch {}
        setWorries(parsedWorriesLocal);
        setSavedWorries(parsedWorriesLocal);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [dayOfYear, token, databaseId, isNotionConfigured, localStorageKey, localFateKey, localTagsKey, localIntentionsKey, localMoodKey, localPassionsKey, localVirtueKey]);

  const handleSave = async () => {
    const cleanedText = reflection.trim();
    const cleanedFate = fateInput.trim();
    const cleanedIntentions = morningIntentions.trim();
    
    localStorage.setItem(localVirtueKey, selectedVirtue || '');

    // Update local storage cache (only when offline)
    if (!isNotionConfigured) {
      localStorage.setItem(localStorageKey, cleanedText);
      localStorage.setItem(localFateKey, cleanedFate);
      localStorage.setItem(localTagsKey, JSON.stringify(acceptanceTags));
      localStorage.setItem(localIntentionsKey, cleanedIntentions);
      localStorage.setItem(localMoodKey, mood);
      localStorage.setItem(localPassionsKey, JSON.stringify(passions));
      if (!localStorage.getItem(localCreatedTimeKey)) {
        localStorage.setItem(localCreatedTimeKey, new Date().toISOString());
      }
    }

    if (!isNotionConfigured) {
      setSavedReflection(cleanedText);
      setSavedFateInput(cleanedFate);
      setSavedPassions([...passions]);
      setSavedMorningIntentions(cleanedIntentions);
      setSavedMood(mood);
      setSavedWorries([...worries]);
      setSavedVirtue(selectedVirtue);
      setIsSaved(true);
      triggerHaptic('success');
      if (onSaveComplete) onSaveComplete();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const cycleStartStr = localStorage.getItem('daily-stoic:cycle-start-date') || `${new Date().getFullYear()}-01-01`;
      const cycleStart = new Date(cycleStartStr);
      const pageDate = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate() + (dayOfYear - 1));
      const dateStr = getLocalTodayStr(pageDate);

      const result = await upsertReflection(
        token,
        databaseId,
        dayOfYear,
        cleanedText,
        ['Stoic', 'Reflection'],
        dateStr,
        existingPageId,
        cleanedFate,
        acceptanceTags,
        false, // favorite
        mood,
        cleanedIntentions,
        passions,
        hasPassionsProperty,
        JSON.stringify(worries),
        hasDichotomyProperty
      );

      setSavedReflection(result.text);
      setSavedFateInput(result.fateInput || '');
      setSavedPassions(result.passions || []);
      setSavedMorningIntentions(result.morningIntentions || '');
      setSavedMood(result.mood || '');
      setExistingPageId(result.id);

      let parsedWorries: Worry[] = [];
      if (result.dichotomy) {
        try {
          parsedWorries = JSON.parse(result.dichotomy);
        } catch {}
      } else {
        parsedWorries = worries;
      }
      setSavedWorries(parsedWorries);
      setSavedVirtue(selectedVirtue);

      setIsSaved(true);
      triggerHaptic('success');
      if (onSaveComplete) onSaveComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save reflection.');
    } finally {
      setIsSaving(false);
    }
  };

  // Dichotomy of Control Actions
  const handleAddWorry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorry.trim()) return;
    const dateStr = new Date().toISOString().split('T')[0];
    setWorries([{ id: Date.now().toString(), text: newWorry.trim(), category: 'unassigned', createdAt: dateStr }, ...worries]);
    setNewWorry('');
    triggerHaptic('light');
  };

  const handleCategorize = (id: string, category: 'up-to-me' | 'not-up-to-me') => {
    setWorries((prev) => prev.map((w) => w.id === id ? { ...w, category } : w));
    triggerHaptic('light');
  };

  const handleToggleConcernResolved = (id: string) => {
    setWorries((prev) => prev.map((w) => w.id === id ? { ...w, isResolved: !w.isResolved } : w));
    triggerHaptic('light');
  };

  // Enchiridion maxim recall
  const handleDrawMaxim = () => {
    if (favoritedMaxims.length === 0) return;
    const randomIndex = Math.floor(Math.random() * favoritedMaxims.length);
    setRecalledMaxim(favoritedMaxims[randomIndex]);
    triggerHaptic('light');
  };

  // Check if a step has been completed
  const getStepCompleted = (stepId: number): boolean => {
    switch (stepId) {
      case 1:
        return !!birthDate;
      case 2:
        return true; // Quotes are read on load
      case 3:
        return morningIntentions.trim().length > 0;
      case 4:
        return (
          reflection.trim().length > 0 ||
          fateInput.trim().length > 0 ||
          mood !== '' ||
          passions.length > 0
        );
      default:
        return false;
    }
  };

  const passionsChanged = JSON.stringify(passions.slice().sort()) !== JSON.stringify(savedPassions.slice().sort());
  const worriesChanged = JSON.stringify(worries) !== JSON.stringify(savedWorries);
  const virtueChanged = selectedVirtue !== savedVirtue;

  const hasChanges =
    reflection.trim() !== savedReflection ||
    fateInput.trim() !== savedFateInput ||
    morningIntentions.trim() !== savedMorningIntentions ||
    mood !== savedMood ||
    passionsChanged ||
    worriesChanged ||
    virtueChanged;

  const moodOptions = [
    { label: <SmilePlus size={24} strokeWidth={2} />, value: 'Great' },
    { label: <Smile size={24} strokeWidth={2} />, value: 'Good' },
    { label: <Meh size={24} strokeWidth={2} />, value: 'Neutral' },
    { label: <Frown size={24} strokeWidth={2} />, value: 'Bad' },
    { label: <Angry size={24} strokeWidth={2} />, value: 'Awful' }
  ];

  // Stepper steps configuration
  const steps = [
    { id: 1, label: 'Focus', icon: <Skull size={16} /> },
    { id: 2, label: 'Meditate', icon: <BookOpen size={16} /> },
    { id: 3, label: 'Prepare', icon: <Sun size={16} /> },
    { id: 4, label: 'Reflect', icon: <Moon size={16} /> }
  ];

  // Filter today's worries for Step 4
  const dateStr = new Date().toISOString().split('T')[0];
  const todaysNotUpToMe = useMemo(() => {
    return worries.filter(w => w.category === 'not-up-to-me' && w.createdAt === dateStr);
  }, [worries, dateStr]);

  const activeUpToMe = useMemo(() => {
    return worries.filter(w => w.category === 'up-to-me');
  }, [worries]);

  const unassignedWorries = useMemo(() => {
    return worries.filter(w => w.category === 'unassigned');
  }, [worries]);

  return (
    <div className="rounded-xl bg-background-secondary border border-tertiary p-4 sm:p-8">
      {/* 4-Step Journey Stepper */}
      <nav className="flex items-center justify-between mb-8 border-b border-tertiary pb-4" aria-label="Stoic Journey Progress">
        {steps.map((step) => {
          const isActive = activeStep === step.id;
          const isCompleted = getStepCompleted(step.id);
          return (
            <button
              key={step.id}
              onClick={() => {
                setActiveStep(step.id);
                triggerHaptic('light');
              }}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 relative py-1 transition-all",
                isActive 
                  ? "text-accent font-semibold" 
                  : "text-text-secondary hover:text-text-primary"
              )}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className={cn(
                "w-8 h-8 rounded-full border flex items-center justify-center text-sm transition-all",
                isActive 
                  ? "border-accent bg-accent/10 shadow-[0_0_12px_rgba(194,181,245,0.2)] text-accent" 
                  : isCompleted 
                    ? "border-success bg-success/5 text-success" 
                    : "border-tertiary bg-background-tertiary"
              )}>
                {isCompleted && !isActive ? <Check size={16} /> : step.icon}
              </div>
              <span className="text-xs sm:text-sm">{step.label}</span>
              {isActive && (
                <div className="absolute bottom-[-17px] left-0 right-0 h-[2.5px] bg-accent" />
              )}
            </button>
          );
        })}
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-text-secondary">
          <span className="mr-2 animate-spin inline-block" aria-hidden="true">⏳</span> Syncing...
        </div>
      ) : (
        <div className="min-h-[280px]">
          {/* STEP 1: Focus (Memento Mori) */}
          {activeStep === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="font-display text-xl text-text-primary mb-3 flex items-center gap-2">
                <Skull size={20} className="text-text-secondary" />
                Focus: Meditate on Mortality (Day {dayOfYear} of 365)
              </h3>
              <p className="text-sm text-text-secondary mb-6">
                Remember you will die. Framing today within the scale of your entire lifespan clears away trivial concerns.
              </p>

              {!birthDate ? (
                <div className="rounded-lg border border-tertiary border-dashed p-6 text-center bg-background-primary/30">
                  <p className="mb-4 text-text-secondary text-sm">
                    Configure your birth date in settings to unlock your life progress grid.
                  </p>
                  <Button onClick={onGoToSettings} size="sm">
                    ⚙️ Configure Birth Date
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    const birthDateObj = new Date(birthDate);
                    const today = new Date();
                    
                    const currentYear = today.getFullYear();
                    const birthMonth = birthDateObj.getMonth();
                    const birthDay = birthDateObj.getDate();
                    
                    const birthdayThisYear = new Date(currentYear, birthMonth, birthDay);
                    let lastBirthday = birthdayThisYear;
                    if (today < birthdayThisYear) {
                      lastBirthday = new Date(currentYear - 1, birthMonth, birthDay);
                    }
                    
                    const diffMs = today.getTime() - birthDateObj.getTime();
                    const weeksElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
                    const totalWeeks = 80 * 52;
                    const percentage = Math.min(100, Math.max(0, (weeksElapsed / totalWeeks) * 100));
                    
                    const msSinceLastBirthday = today.getTime() - lastBirthday.getTime();
                    const weekOfCurrentYear = Math.min(51, Math.max(0, Math.floor(msSinceLastBirthday / (1000 * 60 * 60 * 24 * 7))));
                    
                    const upcomingAge = lastBirthday.getFullYear() + 1 - birthDateObj.getFullYear();
                    
                    const miniBlocks = [];
                    for (let i = 0; i < 52; i++) {
                      const elapsed = i < weekOfCurrentYear;
                      const isCurrent = i === weekOfCurrentYear;
                      miniBlocks.push(
                        <div
                          key={i}
                          className={cn(
                            "rounded-[1px] sm:rounded-sm aspect-square",
                            isCurrent
                              ? "bg-accent animate-pulse ring-2 ring-accent ring-offset-2 ring-offset-background-secondary"
                              : elapsed
                                ? "bg-text-primary"
                                : "bg-border-secondary border border-tertiary"
                          )}
                          title={isCurrent ? "Current week" : elapsed ? `Week ${i + 1} elapsed` : `Week ${i + 1} remaining`}
                        />
                      );
                    }

                    return (
                      <div className="space-y-6">
                        <div className="flex flex-wrap gap-3 sm:gap-6 text-sm font-medium text-text-secondary justify-center sm:justify-start">
                          <span className="rounded-full bg-background-tertiary px-3.5 py-1.5 border border-tertiary">
                            Weeks lived: <strong className="text-text-primary">{weeksElapsed}</strong> / {totalWeeks}
                          </span>
                          <span className="rounded-full bg-background-tertiary px-3.5 py-1.5 border border-tertiary">
                            Lifespan complete: <strong className="text-text-primary">{percentage.toFixed(1)}%</strong>
                          </span>
                        </div>

                        <div className="rounded-xl border border-secondary bg-background-secondary p-5 shadow-md hover:shadow-lg transition-all duration-300">
                          <h4 className="text-xs font-semibold text-text-secondary tracking-wider uppercase mb-3 text-center sm:text-left">
                            Current Year progress (to {upcomingAge})
                          </h4>
                          <div 
                            className="grid gap-1 p-2 rounded-lg bg-background-tertiary border border-tertiary max-w-[420px] mx-auto sm:mx-0"
                            style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
                          >
                            {miniBlocks}
                          </div>
                        </div>

                        <blockquote className="border-l-4 border-l-secondary pl-4 italic text-sm text-text-secondary my-4">
                          "Let us prepare our minds as if we’d come to the very end of life. Let us postpone nothing. Let us balance life’s books each day." — Seneca
                        </blockquote>

                        <div className="flex justify-center sm:justify-start">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onNavigateToTab('/memento')}
                          >
                            View Full 80-Year Life Grid →
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              <div className="mt-6">
                <AppGuideNote summary="Meditating on Mortality (Memento Mori)">
                  <p>
                    <strong>Memento Mori</strong> translates to "remember that you will die." 
                    Stoics meditated on mortality not to become morbid, but to create absolute clarity and gratitude for the present moment. 
                    Viewing your yearly and overall life progress reminds you that time is your most scarce resource.
                  </p>
                </AppGuideNote>
              </div>
            </div>
          )}

          {/* STEP 2: Meditate (Daily Maxim & Enchiridion) */}
          {activeStep === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              <h3 className="font-display text-xl text-text-primary flex items-center gap-2">
                <BookOpen size={20} className="text-text-secondary" />
                Meditate: Today's Principle (Day {dayOfYear} of 365)
              </h3>

              {/* Quote Card */}
              <blockquote className="rounded-lg bg-background-tertiary p-5 sm:p-6 border-l-4 border-l-accent shadow-sm relative">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-display text-xl sm:text-2xl text-text-primary mb-4">“{quote.quote}”</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={handleShareQuote}
                      disabled={isSharing}
                      className="rounded-full p-2 text-text-secondary hover:text-text-primary hover:bg-background-secondary transition-all"
                      title="Share Quote Card"
                      aria-label="Share quote as image"
                    >
                      <Share2 size={20} strokeWidth={2} />
                    </button>
                    <button
                      onClick={handleToggleFavorite}
                      disabled={isTogglingFavorite}
                      className={cn(
                        "rounded-full p-2 transition-all flex items-center justify-center",
                        isCurrentQuoteFavorited ? "scale-110 opacity-100" : "opacity-40 hover:opacity-100 hover:bg-background-secondary"
                      )}
                      aria-label={isCurrentQuoteFavorited ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart 
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
                <cite className="block text-text-secondary font-medium not-italic text-sm">
                  — {quote.author}, <span className="italic">{quote.source}</span>
                </cite>
              </blockquote>

              {/* Keyword Search */}
              <div className="rounded-lg bg-background-primary/40 p-4 border border-tertiary">
                <label className="block text-xs font-semibold text-text-secondary tracking-wider uppercase mb-2">
                  Search other maxims
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="🔍 Filter by keyword (Anxiety, Gratitude, Seneca)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 rounded-md border border-secondary bg-background-tertiary px-3 py-2 text-sm text-text-primary outline-none focus-visible:border-accent"
                  />
                  {searchQuery && (
                    <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Handbook (Enchiridion) Recall widget */}
              <div className="border-t border-tertiary pt-6">
                <h4 className="font-display text-sm font-semibold text-text-secondary mb-3">Recall your Handbook</h4>
                {recalledMaxim ? (
                  <div className="rounded-lg bg-background-primary/40 p-4 border border-tertiary relative animate-in fade-in duration-300">
                    <p className="font-display text-base text-text-primary mb-2 italic">“{recalledMaxim.quote}”</p>
                    <p className="text-xs text-text-secondary">— {recalledMaxim.author}, {recalledMaxim.source}</p>
                    <button 
                      onClick={handleDrawMaxim} 
                      className="absolute top-3 right-3 text-xs text-accent hover:underline"
                    >
                      Draw another
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg bg-background-primary/20 p-4 border border-tertiary border-dashed">
                    <div className="flex-1">
                      <p className="text-sm text-text-secondary">
                        Need additional guidance? Draw a random principle from your personal Enchiridion handbook.
                      </p>
                      {favoritedMaxims.length === 0 && (
                        <p className="text-xs text-text-secondary/60 mt-1">
                          Heart quotes during your daily readings to build your Enchiridion handbook.
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={handleDrawMaxim}
                      disabled={favoritedMaxims.length === 0}
                      className="shrink-0"
                    >
                      🔮 Draw Maxim
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-6">
                <AppGuideNote summary="Meditating on Daily Principles">
                  <p>
                    <strong>Meditating</strong> on philosophical principles prepares the mind for action. 
                    Rather than reading passively, focus on how today's maxim applies to your current circumstances. 
                    Use the search bar to explore specific themes, or draw from your hand-picked <strong>Enchiridion</strong> handbook to reinforce lessons.
                  </p>
                </AppGuideNote>
              </div>
            </div>
          )}

          {/* STEP 3: Prepare (Morning Prep & Spheres of Control) */}
          {activeStep === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              <h3 className="font-display text-xl text-text-primary flex items-center gap-2">
                <Sun size={20} className="text-text-secondary" />
                Prepare: Morning Prep (Day {dayOfYear} of 365)
              </h3>
              <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
                  <span aria-hidden="true" className="text-xl">🛡️</span> Premeditatio Malorum
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  Visualize upcoming obstacles, difficult people, or things that might go wrong. Rehearse response with virtue.
                </p>
                <textarea
                  className="w-full rounded-lg bg-background-tertiary border border-tertiary p-4 text-text-primary placeholder:text-text-secondary/60 outline-none focus:border-accent transition-colors resize-y min-h-[100px]"
                  value={morningIntentions}
                  onChange={(e) => {
                    setMorningIntentions(e.target.value);
                    setIsSaved(false);
                  }}
                  placeholder="Today I might face complaints, obstacles, delays. I will meet them with courage..."
                  disabled={isLoading || isSaving}
                />
              </section>

              {/* Dichotomy of Control Integration */}
              <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
                  <Scale size={20} className="text-text-secondary" />
                  Spheres of Choice (Dichotomy)
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  Sort your current worries into what is completely Up to You and what is Not.
                </p>

                <form onSubmit={handleAddWorry} className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={newWorry}
                    onChange={(e) => setNewWorry(e.target.value)}
                    placeholder="Log a worry/concern for today..."
                    className="flex-1 rounded-md border border-secondary bg-background-tertiary px-3 py-2 text-sm text-text-primary outline-none focus-visible:border-accent"
                  />
                  <Button type="submit" size="sm" disabled={!newWorry.trim()}>Record</Button>
                </form>

                {/* Unassigned worries */}
                {unassignedWorries.length > 0 && (
                  <div className="space-y-3 mb-6">
                    <h4 className="text-xs font-semibold text-text-secondary tracking-wider uppercase">Unsorted concerns</h4>
                    {unassignedWorries.map((worry) => (
                      <div key={worry.id} className="rounded-lg bg-background-tertiary border border-tertiary p-3 flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
                        <span className="text-sm text-text-primary font-medium">{worry.text}</span>
                        <div className="flex gap-2 w-full sm:w-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCategorize(worry.id, 'up-to-me')}
                            className="flex-1 sm:flex-none rounded bg-background-secondary border border-tertiary px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-success hover:border-success hover:bg-success/5 transition-colors"
                          >
                            ✓ Up to Me
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCategorize(worry.id, 'not-up-to-me')}
                            className="flex-1 sm:flex-none rounded bg-background-secondary border border-tertiary px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-energy hover:border-energy hover:bg-energy/5 transition-colors"
                          >
                            ☁ Not Up to Me
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sorted worries summary list */}
                {worries.length > 0 && (
                  <div className="space-y-4">
                    {activeUpToMe.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-success tracking-wider uppercase mb-2">
                          Actionable Concerns (Up to Me)
                        </h4>
                        <ul className="text-sm text-text-secondary space-y-1">
                          {activeUpToMe.map(w => (
                            <li key={w.id} className="flex items-center justify-between gap-2 pl-1">
                              <span>• {w.text}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setWorries(prev => prev.filter(item => item.id !== w.id));
                                  triggerHaptic('light');
                                  setIsSaved(false);
                                }}
                                className="text-text-secondary hover:text-caution px-1.5 transition-colors text-xs"
                                title="Delete concern"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {worries.filter(w => w.category === 'not-up-to-me').length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-energy tracking-wider uppercase mb-2">
                          External Factors (Not Up to Me)
                        </h4>
                        <ul className="text-sm text-text-secondary space-y-1">
                          {worries.filter(w => w.category === 'not-up-to-me').map(w => (
                            <li key={w.id} className="flex items-center justify-between gap-2 pl-1">
                              <span className="line-through decoration-tertiary text-text-secondary/70">• {w.text}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setWorries(prev => prev.filter(item => item.id !== w.id));
                                  triggerHaptic('light');
                                  setIsSaved(false);
                                }}
                                className="text-text-secondary hover:text-caution px-1.5 transition-colors text-xs"
                                title="Delete factor"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <AppGuideNote summary="Preparing for the Day">
                <p>
                  <strong>Premeditatio Malorum</strong> coupled with the <strong>Dichotomy of Control</strong> aligns your focus. 
                  Identify what is up to you (your actions, focus, temper) and let go of the rest (delays, comments). 
                  Save your progress now or proceed directly to the evening reflection.
                </p>
              </AppGuideNote>
            </div>
          )}

          {/* STEP 4: Reflect (Evening Review & Amor Fati) */}
          {activeStep === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              <h3 className="font-display text-xl text-text-primary flex items-center gap-2">
                <Moon size={20} className="text-text-secondary" />
                Reflect: Evening Review (Day {dayOfYear} of 365)
              </h3>
              {/* Mood Check */}
              <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
                  <span aria-hidden="true" className="text-xl">🎭</span> Mood Tracking
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {moodOptions.map(opt => (
                    <button
                      key={opt.value}
                      title={opt.value}
                      onClick={() => {
                        setMood(opt.value);
                        setIsSaved(false);
                        triggerHaptic('light');
                      }}
                      className={cn(
                        "rounded-lg border p-3 transition-all flex items-center justify-center",
                        mood === opt.value
                          ? "border-accent bg-accent-soft scale-105 text-accent"
                          : "border-tertiary text-text-secondary hover:border-secondary hover:bg-background-tertiary hover:text-text-primary"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Passions & Judgments Selector */}
              <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
                  <span aria-hidden="true" className="text-xl">🔥</span> Passions & Judgments
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  Which dysfunctional judgments or passions did you notice in yourself today? (Select all that apply)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AVAILABLE_PASSIONS.map(p => {
                    const active = passions.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setPassions(passions.filter(x => x !== p.id));
                          } else {
                            setPassions([...passions, p.id]);
                          }
                          setIsSaved(false);
                          triggerHaptic('light');
                        }}
                        className={cn(
                          "rounded-lg border p-4 text-left transition-all flex flex-col justify-between h-full",
                          active
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-tertiary text-text-secondary hover:border-secondary hover:bg-background-tertiary"
                        )}
                      >
                        <div>
                          <div className="font-semibold text-sm flex items-center justify-between gap-2">
                            <span className={cn(active ? "text-accent" : "text-text-primary")}>{p.label}</span>
                            <span className="text-[10px] uppercase font-mono tracking-wider opacity-60 px-1.5 py-0.5 rounded bg-background-secondary border border-tertiary shrink-0">{p.category}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{p.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Seneca Questions */}
              <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
                  <span aria-hidden="true" className="text-xl">⚖️</span> Seneca's Evening Interrogation
                </h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">What ailment or bad habit did I cure today?</label>
                    <textarea
                      className="w-full resize-y rounded-lg border border-tertiary bg-background-tertiary p-3 text-sm text-text-primary outline-none focus-visible:border-accent min-h-[60px]"
                      value={senecaQ1}
                      onChange={(e) => {
                        setSenecaQ1(e.target.value);
                        setIsSaved(false);
                      }}
                      placeholder="I stopped complaining about..."
                      disabled={isLoading || isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">What failing did I resist?</label>
                    <textarea
                      className="w-full resize-y rounded-lg border border-tertiary bg-background-tertiary p-3 text-sm text-text-primary outline-none focus-visible:border-accent min-h-[60px]"
                      value={senecaQ2}
                      onChange={(e) => {
                        setSenecaQ2(e.target.value);
                        setIsSaved(false);
                      }}
                      placeholder="Resisted doomscrolling or anger..."
                      disabled={isLoading || isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">In what matter can I show improvement tomorrow?</label>
                    <textarea
                      className="w-full resize-y rounded-lg border border-tertiary bg-background-tertiary p-3 text-sm text-text-primary outline-none focus-visible:border-accent min-h-[60px]"
                      value={senecaQ3}
                      onChange={(e) => {
                        setSenecaQ3(e.target.value);
                        setIsSaved(false);
                      }}
                      placeholder="I will prepare my morning more calmly..."
                      disabled={isLoading || isSaving}
                    />
                  </div>
                </div>
              </section>

              {/* Spheres of Choice evening review box */}
              <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
                  <Scale size={20} className="text-text-secondary" />
                  Spheres of Choice (Dichotomy)
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  Review the concerns you sorted today. Actionable items are Up to Me; external factors are Not Up to Me.
                </p>
                
                <div className="space-y-6">
                  {/* Part 1: Resolve Actionable Concerns */}
                  {activeUpToMe.length > 0 && (
                    <div className="rounded-lg border border-success/30 bg-success/5 p-4 sm:p-5">
                      <h4 className="text-sm font-semibold text-success flex items-center gap-2 mb-2">
                        <span>✓</span> Resolve Actionable Concerns
                      </h4>
                      <p className="text-xs text-text-secondary mb-3">
                        Select the ones you resolved successfully today:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeUpToMe.map(w => {
                          const isSelected = !!w.isResolved;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => handleToggleConcernResolved(w.id)}
                              className={cn(
                                "text-xs rounded px-2.5 py-1 text-left border transition-all duration-200 flex items-center gap-1.5",
                                isSelected
                                  ? "border-success bg-success/15 text-success font-medium"
                                  : "text-text-primary bg-background-secondary border-tertiary hover:border-success"
                              )}
                            >
                              <span>{isSelected ? '✓' : '○'}</span>
                              <span>"{w.text}"</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Part 2: Reframe today's Externals */}
                  {todaysNotUpToMe.length > 0 && (
                    <div className="rounded-lg border border-energy/30 bg-energy/5 p-4 sm:p-5">
                      <h4 className="text-sm font-semibold text-energy flex items-center gap-2 mb-2">
                        <span>☁</span> Reframe today's Externals
                      </h4>
                      <p className="text-xs text-text-secondary mb-3">
                        Today you recognized these factors as out of your control. Select one or more to construct your Amor Fati reframe:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {todaysNotUpToMe.map(w => {
                          const isSelected = selectedReframeIds.includes(w.id);
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => handleToggleReframeWorry(w.id)}
                              className={cn(
                                "text-xs rounded px-2.5 py-1 text-left border transition-all duration-200 flex items-center gap-1.5",
                                isSelected
                                  ? "border-energy bg-energy/15 text-energy font-medium"
                                  : "text-text-primary bg-background-secondary border-tertiary hover:border-energy"
                              )}
                            >
                              <span>{isSelected ? '✓' : '○'}</span>
                              <span>"{w.text}"</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Amor Fati Card */}
              <AmorFatiControl
                fateInput={fateInput}
                onFateInputChange={(val) => {
                  setFateInput(val);
                  setIsSaved(false);
                }}
                acceptanceTags={acceptanceTags}
                onAcceptanceTagsChange={(tags) => {
                  setAcceptanceTags(tags);
                  setIsSaved(false);
                }}
              />

              {/* Cultivating Virtue Card */}
              <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
                  <Shield size={20} className="text-text-secondary" />
                  Cultivating Virtue
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  Identify and commit to the core Stoic virtues—Wisdom, Courage, Justice, and Temperance—to guide your behavior and actions.
                </p>
                
                <div className="space-y-6">
                  <div className="rounded-lg border border-success/30 bg-success/5 p-4 sm:p-5">
                    <h4 className="text-sm font-semibold text-success flex items-center gap-2 mb-2">
                      <span>🛡</span> Four Cardinal Virtues
                    </h4>
                    <p className="text-xs text-text-secondary mb-3">
                      Select the Stoic virtue that was most needed or practiced in today's situations:
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: 'Wisdom', desc: 'Sophia: Navigating situations logically, informed, and calmly.' },
                        { name: 'Courage', desc: 'Andreia: Standing firm and acting rightly in the face of fear or difficulty.' },
                        { name: 'Justice', desc: 'Dikaiosyne: Treating others with fairness, benevolence, and public duty.' },
                        { name: 'Temperance', desc: 'Sophrosyne: Practicing self-control, moderation, and discipline.' }
                      ].map((v) => {
                        const isSelected = selectedVirtue === v.name;
                        return (
                          <button
                            key={v.name}
                            type="button"
                            onClick={() => {
                              const newVal = isSelected ? null : v.name;
                              setSelectedVirtue(newVal);
                              setIsSaved(false);
                              triggerHaptic('light');
                            }}
                            title={v.desc}
                            className={cn(
                              "text-xs rounded px-2.5 py-1 text-left border transition-all duration-200 flex items-center gap-1.5",
                              isSelected
                                ? "border-success bg-success/15 text-success font-medium"
                                : "text-text-primary bg-background-secondary border-tertiary hover:border-success"
                            )}
                          >
                            <span>{isSelected ? '✓' : '○'}</span>
                            <span>{v.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    
                    {selectedVirtue && (
                      <div className="mt-3 text-xs text-text-secondary italic border-l-2 border-success pl-3 pt-0.5 pb-0.5 animate-in fade-in duration-200">
                        {selectedVirtue === 'Wisdom' && 'Wisdom (Sophia): The ability to navigate complex situations in a logical, informed, and calm manner. Understanding what is good, bad, or indifferent.'}
                        {selectedVirtue === 'Courage' && 'Courage (Andreia): Standing firm and acting rightly in the face of fear, adversity, pain, or difficulty.'}
                        {selectedVirtue === 'Justice' && 'Justice (Dikaiosyne): Treating others with fairness, benevolence, and public duty. Stoics believe we are made for the collective good of the community.'}
                        {selectedVirtue === 'Temperance' && 'Temperance (Sophrosyne): Practicing self-control, moderation, and discipline. Knowing the difference between enough and too much.'}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <AppGuideNote summary="Reflecting on the Day">
                <p>
                  <strong>Seneca's Interrogation</strong> balances your daily account. 
                  Record your achievements or lessons, toggle completed actionable concerns, reframe external frictions under <strong>Amor Fati</strong>, log any passions or dysfunctional judgments you noticed in yourself to track your tranquility training ground, and close by reflecting on the four cardinal Stoic virtues (Wisdom, Courage, Justice, and Temperance) to identify which one was most required for today's events, reinforcing your progress as a practicing Stoic.
                </p>
              </AppGuideNote>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg bg-caution/10 border border-caution/40 p-4 text-caution" role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* Unified Stepper Footer */}
      <footer className="border-t border-tertiary pt-6 mt-6 flex flex-col gap-4">
        {/* Navigation row: Back (left) and Next (right) */}
        <div className="flex items-center justify-between w-full">
          <div>
            {activeStep > 1 ? (
              <Button
                onClick={() => {
                  setActiveStep(activeStep - 1);
                  triggerHaptic('light');
                }}
                variant="ghost"
                size="sm"
              >
                ← Back
              </Button>
            ) : (
              <div />
            )}
          </div>

          <div>
            {activeStep < 4 ? (
              <Button
                onClick={() => {
                  setActiveStep(activeStep + 1);
                  triggerHaptic('light');
                }}
                variant="primary"
                size="sm"
              >
                Next →
              </Button>
            ) : (
              <button
                onClick={handleSave}
                disabled={(!hasChanges && isSaved) || isLoading || isSaving}
                type="button"
                className={cn(
                  "rounded-lg px-4 py-2.5 text-sm font-semibold tracking-wide border shadow-sm transition-all duration-250 flex items-center justify-center gap-1.5",
                  isSaving
                    ? "bg-accent/20 border-accent/10 text-accent opacity-60 cursor-not-allowed"
                    : isSaved && !hasChanges
                      ? "bg-background-tertiary border-tertiary text-text-secondary cursor-default shadow-none"
                      : "bg-accent hover:bg-accent-hover text-background-primary border-accent hover:shadow-md"
                )}
              >
                {isSaving ? 'Saving...' : isSaved && !hasChanges ? '✓ Saved' : 'Complete Reflection'}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Unsaved changes indicator */}
      {!isSaved && hasChanges && !isSaving && (
        <div className="text-center mt-4">
          <span className="text-xs font-medium text-accent" role="status">
            ● Unsaved changes in active reflection
          </span>
        </div>
      )}
    </div>
  );
}
