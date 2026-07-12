import { useState, useEffect, useRef } from 'react';
import { Button } from './components/Button';
import AppGuideNote from './components/AppGuideNote';
import { fetchReflectionForDay, upsertReflection, fetchRecentReflections } from './services/NotionService';
import AmorFatiControl from './components/AmorFatiControl';
import { triggerHaptic } from '../shared/haptics';
import { cn } from './lib/cn';
import { SmilePlus, Smile, Meh, Frown, Angry } from 'lucide-react';

interface JournalProps {
  dayOfYear: number;
  token: string;
  databaseId: string;
  onSaveComplete?: () => void;
}

export default function Journal({ dayOfYear, token, databaseId, onSaveComplete }: JournalProps) {
  const isNotionConfigured = !!token.trim() && !!databaseId.trim();
  const localStorageKey = `daily-stoic:reflection-${dayOfYear}`;
  const localFateKey = `daily-stoic:fate-input-${dayOfYear}`;
  const localTagsKey = `daily-stoic:acceptance-tags-${dayOfYear}`;
  const localIntentionsKey = `daily-stoic:morning-intentions-${dayOfYear}`;
  const localMoodKey = `daily-stoic:mood-${dayOfYear}`;

  // Evening Reflection (Seneca's Interrogation)
  const [reflection, setReflection] = useState('');
  const [savedReflection, setSavedReflection] = useState('');
  
  const [senecaQ1, setSenecaQ1] = useState('');
  const [senecaQ2, setSenecaQ2] = useState('');
  const [senecaQ3, setSenecaQ3] = useState('');

  const [fateInput, setFateInput] = useState('');
  const [savedFateInput, setSavedFateInput] = useState('');
  const [acceptanceTags, setAcceptanceTags] = useState<string[]>([]);
  const [savedAcceptanceTags, setSavedAcceptanceTags] = useState<string[]>([]);

  // Morning Intentions (Premeditatio Malorum)
  const [morningIntentions, setMorningIntentions] = useState('');
  const [savedMorningIntentions, setSavedMorningIntentions] = useState('');

  // Mood Tracking
  const [mood, setMood] = useState('');
  const [savedMood, setSavedMood] = useState('');

  // Phase selection
  const [phase, setPhase] = useState<'morning' | 'evening'>(() => {
    const hours = new Date().getHours();
    return hours < 14 ? 'morning' : 'evening'; // Defaults to morning before 2 PM
  });

  // Update reflection string when Qs change
  useEffect(() => {
    if (phase === 'evening') {
      const combined = [
        senecaQ1.trim() ? `### What ailment or bad habit did I cure today?\n${senecaQ1.trim()}` : '',
        senecaQ2.trim() ? `### What failing did I resist?\n${senecaQ2.trim()}` : '',
        senecaQ3.trim() ? `### In what matter can I show improvement tomorrow?\n${senecaQ3.trim()}` : ''
      ].filter(Boolean).join('\n\n');
      
      // Only set if different to avoid infinite loops, but we use reflection to save
      if (combined !== reflection) {
        setReflection(combined);
      }
    }
  }, [senecaQ1, senecaQ2, senecaQ3, phase]);

  const [existingPageId, setExistingPageId] = useState<string | undefined>(undefined);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
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
        }
        const savedIntentions = localStorage.getItem(localIntentionsKey) || '';
        const savedMoodVal = localStorage.getItem(localMoodKey) || '';
        let savedTags: string[] = [];
        try {
          savedTags = JSON.parse(localStorage.getItem(localTagsKey) || '[]');
        } catch {
          savedTags = [];
        }

        setSavedReflection(savedRef);
        setFateInput(localStorage.getItem(localFateKey) || '');
        setSavedFateInput(localStorage.getItem(localFateKey) || '');
        setAcceptanceTags(savedTags);
        setSavedAcceptanceTags(savedTags);
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
          
          // Try to parse Seneca questions
          if (refText.includes('### What ailment')) {
            const q1Match = refText.match(/### What ailment or bad habit did I cure today\?\n([\s\S]*?)(?=###|$)/);
            const q2Match = refText.match(/### What failing did I resist\?\n([\s\S]*?)(?=###|$)/);
            const q3Match = refText.match(/### In what matter can I show improvement tomorrow\?\n([\s\S]*?)(?=###|$)/);
            
            setSenecaQ1(q1Match ? q1Match[1].trim() : '');
            setSenecaQ2(q2Match ? q2Match[1].trim() : '');
            setSenecaQ3(q3Match ? q3Match[1].trim() : '');
          } else {
            // Legacy reflection fallback to Q1 or just keep it
            setSenecaQ1(refText);
          }
          setFateInput(result.fateInput || '');
          setSavedFateInput(result.fateInput || '');
          setAcceptanceTags(result.acceptanceTags || []);
          setSavedAcceptanceTags(result.acceptanceTags || []);
          setMorningIntentions(result.morningIntentions || '');
          setSavedMorningIntentions(result.morningIntentions || '');
          setMood(result.mood || '');
          setSavedMood(result.mood || '');
          setExistingPageId(result.id);
          setIsSaved(true);
        } else {
          // If not in Notion, check local storage as fallback
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

          setReflection(localBackup);
          setSavedReflection('');
          setFateInput(localFateBackup);
          setSavedFateInput('');
          setAcceptanceTags(localTagsBackup);
          setSavedAcceptanceTags([]);
          setMorningIntentions(localIntentionsBackup);
          setSavedMorningIntentions('');
          setMood(localMoodBackup);
          setSavedMood('');
          setExistingPageId(undefined);

          const empty = localBackup === '' && localFateBackup === '' && localTagsBackup.length === 0 && localIntentionsBackup === '' && localMoodBackup === '';
          setIsSaved(empty);
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
        setReflection(localBackup);
        setFateInput(localFateBackup);
        setAcceptanceTags(localTagsBackup);
        setMorningIntentions(localIntentionsBackup);
        setMood(localMoodBackup);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [dayOfYear, token, databaseId, isNotionConfigured, localStorageKey, localFateKey, localTagsKey]);

  const handleSave = async () => {
    const cleanedText = reflection.trim();
    const cleanedFate = fateInput.trim();
    const cleanedIntentions = morningIntentions.trim();
    
    // Always update local storage first as a local cache/backup
    localStorage.setItem(localStorageKey, cleanedText);
    localStorage.setItem(localFateKey, cleanedFate);
    localStorage.setItem(localTagsKey, JSON.stringify(acceptanceTags));
    localStorage.setItem(localIntentionsKey, cleanedIntentions);
    localStorage.setItem(localMoodKey, mood);

    if (!isNotionConfigured) {
      setSavedReflection(cleanedText);
      setSavedFateInput(cleanedFate);
      setSavedAcceptanceTags([...acceptanceTags]);
      setSavedMorningIntentions(cleanedIntentions);
      setSavedMood(mood);
      setIsSaved(true);
      triggerHaptic('success');
      if (onSaveComplete) onSaveComplete();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const year = new Date().getFullYear();
      const date = new Date(year, 0, 1);
      date.setDate(dayOfYear);
      const dateStr = date.toISOString().split('T')[0];

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
        cleanedIntentions
      );

      setSavedReflection(result.text);
      setSavedFateInput(result.fateInput || '');
      setSavedAcceptanceTags(result.acceptanceTags || []);
      setSavedMorningIntentions(result.morningIntentions || '');
      setSavedMood(result.mood || '');
      setExistingPageId(result.id);
      setIsSaved(true);
      triggerHaptic('success');
      if (onSaveComplete) onSaveComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save reflection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      let dataToDownload: any[] = [];

      if (isNotionConfigured) {
        const records = await fetchRecentReflections(token, databaseId);
        dataToDownload = records;
      } else {
        const records = [];
        for (let i = 1; i <= 366; i++) {
          const val = localStorage.getItem(`daily-stoic:reflection-${i}`);
          const fateVal = localStorage.getItem(`daily-stoic:fate-input-${i}`);
          let tagsVal = [];
          try {
            tagsVal = JSON.parse(localStorage.getItem(`daily-stoic:acceptance-tags-${i}`) || '[]');
          } catch {
            tagsVal = [];
          }

          if (val || fateVal || tagsVal.length > 0) {
            records.push({
              quoteId: i,
              text: val || '',
              fateInput: fateVal || '',
              acceptanceTags: tagsVal,
            });
          }
        }
        dataToDownload = records;
      }

      const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-stoic-reflections-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download reflections.');
    } finally {
      setIsDownloading(false);
    }
  };

  const hasChanges =
    reflection.trim() !== savedReflection ||
    fateInput.trim() !== savedFateInput ||
    morningIntentions.trim() !== savedMorningIntentions ||
    mood !== savedMood ||
    JSON.stringify(acceptanceTags) !== JSON.stringify(savedAcceptanceTags);

  const moodOptions = [
    { label: <SmilePlus size={24} strokeWidth={2} />, value: 'Great' },
    { label: <Smile size={24} strokeWidth={2} />, value: 'Good' },
    { label: <Meh size={24} strokeWidth={2} />, value: 'Neutral' },
    { label: <Frown size={24} strokeWidth={2} />, value: 'Bad' },
    { label: <Angry size={24} strokeWidth={2} />, value: 'Awful' }
  ];

  return (
    <div className="rounded-xl bg-background-secondary border border-tertiary p-5 sm:p-8">
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex rounded-lg bg-background-tertiary p-1">
          <button
            onClick={() => setPhase('morning')}
            className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", phase === 'morning' ? "bg-accent text-accent-contrast shadow" : "text-text-secondary hover:text-text-primary")}
          >
            ☀️ Morning Prep
          </button>
          <button
            onClick={() => setPhase('evening')}
            className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", phase === 'evening' ? "bg-accent text-accent-contrast shadow" : "text-text-secondary hover:text-text-primary")}
          >
            🌙 Evening Review
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-text-secondary">
          <span className="mr-2 animate-spin inline-block">⏳</span> Syncing...
        </div>
      ) : (
        <>
          {phase === 'morning' && (
            <section className="mb-8 rounded-lg border border-tertiary bg-background-primary/50 p-5 sm:p-6">
              <h3 className="font-display text-xl text-text-primary mb-6 border-b border-tertiary pb-3">Premeditatio Malorum</h3>
              <textarea
                className="w-full rounded-lg bg-background-tertiary border border-tertiary p-4 text-text-primary placeholder:text-text-secondary outline-none focus:border-accent transition-colors resize-y min-h-[120px]"
                value={morningIntentions}
                onChange={(e) => {
                  setMorningIntentions(e.target.value);
                  setIsSaved(false);
                }}
                placeholder="I might face..."
                disabled={isLoading || isSaving}
              />
              <div className="mt-4">
                <AppGuideNote summary="Why prepare for the worst?">
                  <p>
                    <strong>Premeditatio Malorum</strong> is the Stoic practice of negative visualization. 
                    By anticipating challenges, setbacks, and difficult people, you mentally rehearse how to respond with virtue (wisdom, justice, courage, temperance). 
                    When things inevitably go wrong, you won't be shocked—you'll be ready.
                  </p>
                </AppGuideNote>
              </div>
            </section>
          )}

          {phase === 'evening' && (
            <>
              <section className="mb-8 rounded-lg border border-tertiary bg-background-primary/50 p-5 sm:p-6">
                <h3 className="font-display text-xl text-text-primary mb-6 border-b border-tertiary pb-3">Mood</h3>
                <div className="flex flex-wrap gap-2">
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
                        "rounded-lg border p-3 transition-all",
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

              <section className="mb-8 rounded-lg border border-tertiary bg-background-primary/50 p-5 sm:p-6">
                <h3 className="font-display text-xl text-text-primary mb-6 border-b border-tertiary pb-3">Seneca's Evening Interrogation</h3>
                <div className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">What ailment or bad habit did I cure today?</label>
                    <textarea
                      className="w-full resize-none rounded-lg border border-tertiary bg-background-tertiary p-3 text-text-primary outline-none focus-visible:border-accent custom-scrollbar min-h-[80px]"
                      value={senecaQ1}
                      onChange={(e) => {
                        setSenecaQ1(e.target.value);
                        setIsSaved(false);
                      }}
                      placeholder="e.g., I stopped myself from doomscrolling..."
                      disabled={isLoading || isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">What failing did I resist?</label>
                    <textarea
                      className="w-full resize-none rounded-lg border border-tertiary bg-background-tertiary p-3 text-text-primary outline-none focus-visible:border-accent custom-scrollbar min-h-[80px]"
                      value={senecaQ2}
                      onChange={(e) => {
                        setSenecaQ2(e.target.value);
                        setIsSaved(false);
                      }}
                      placeholder="e.g., I resisted the urge to complain about the traffic..."
                      disabled={isLoading || isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">In what matter can I show improvement tomorrow?</label>
                    <textarea
                      className="w-full resize-none rounded-lg border border-tertiary bg-background-tertiary p-3 text-text-primary outline-none focus-visible:border-accent custom-scrollbar min-h-[80px]"
                      value={senecaQ3}
                      onChange={(e) => {
                        setSenecaQ3(e.target.value);
                        setIsSaved(false);
                      }}
                      placeholder="e.g., I will be more patient with my colleagues..."
                      disabled={isLoading || isSaving}
                    />
                  </div>
                </div>
              </section>

              <div className="mb-8">
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

                <div className="mt-4">
                  <AppGuideNote summary="What is Amor Fati?">
                    <p>
                      <strong>Amor Fati</strong> (Love of Fate) is the practice of not just accepting, but embracing whatever happens. 
                      If you faced friction today, log it below and tag the source. Treat it not as an obstacle, but as raw material to practice patience, resilience, and acceptance.
                    </p>
                  </AppGuideNote>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="mb-6 rounded-lg bg-caution/10 border border-caution/40 p-4 text-caution" role="alert">
              ⚠️ {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-tertiary pt-6">
            <Button
              onClick={handleSave}
              disabled={(!hasChanges && isSaved) || isLoading || isSaving}
              variant={hasChanges ? 'primary' : 'secondary'}
              className="w-full sm:w-auto"
            >
              {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save Reflection'}
            </Button>

            <Button
              onClick={handleDownload}
              variant="ghost"
              disabled={isLoading || isSaving || isDownloading}
              className="w-full sm:w-auto"
            >
              {isDownloading ? 'Archiving...' : '📥 Download Data'}
            </Button>

            {!isSaved && hasChanges && !isSaving && (
              <span className="text-sm font-medium text-accent" role="status">
                ● Unsaved changes
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
