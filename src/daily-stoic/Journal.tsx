import { useState, useEffect, useRef } from 'react';
import { SegmentedControl } from '../ds';
import { Button } from './components/Button';
import AppGuideNote from './components/AppGuideNote';
import { fetchReflectionForDay, upsertReflection, fetchRecentReflections } from './services/NotionService';
import AmorFatiControl from './components/AmorFatiControl';
import { triggerHaptic } from '../shared/haptics';
import { cn } from './lib/cn';

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

  // Evening Reflection
  const [reflection, setReflection] = useState('');
  const [savedReflection, setSavedReflection] = useState('');
  
  // Amor Fati local states
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

  const [existingPageId, setExistingPageId] = useState<string | undefined>(undefined);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moodMessage, setMoodMessage] = useState<string | null>(null);
  const moodTimerRef = useRef<any>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (moodTimerRef.current) {
        clearTimeout(moodTimerRef.current);
      }
    };
  }, []);

  // Load reflection and Amor Fati data on day or config change
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!isNotionConfigured) {
        // Fallback to local storage
        const saved = localStorage.getItem(localStorageKey) || '';
        const savedFate = localStorage.getItem(localFateKey) || '';
        const savedIntentions = localStorage.getItem(localIntentionsKey) || '';
        const savedMoodVal = localStorage.getItem(localMoodKey) || '';
        let savedTags: string[] = [];
        try {
          savedTags = JSON.parse(localStorage.getItem(localTagsKey) || '[]');
        } catch {
          savedTags = [];
        }

        setReflection(saved);
        setSavedReflection(saved);
        setFateInput(savedFate);
        setSavedFateInput(savedFate);
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
          setReflection(result.text);
          setSavedReflection(result.text);
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
    { label: '🤩', value: 'Great' },
    { label: '🙂', value: 'Good' },
    { label: '😐', value: 'Neutral' },
    { label: '😔', value: 'Bad' },
    { label: '😠', value: 'Awful' }
  ];

  return (
    <div className="rounded-xl bg-background-secondary border border-tertiary p-5 sm:p-8">
      <div className="flex items-center justify-center mb-6">
        <SegmentedControl
          options={[
            { label: '☀️ Morning Prep', value: 'morning' },
            { label: '🌙 Evening Review', value: 'evening' }
          ]}
          value={phase}
          onChange={(v) => setPhase(v as 'morning' | 'evening')}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-text-secondary">
          <span className="mr-2 animate-spin inline-block">⏳</span> Syncing...
        </div>
      ) : (
        <>
          {phase === 'morning' && (
            <div className="mb-6">
              <h3 className="font-display text-lg text-text-primary mb-3">Premeditatio Malorum</h3>
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
            </div>
          )}

          {phase === 'evening' && (
            <>
              <div className="mb-8">
                <h3 className="font-display text-lg text-text-primary mb-3">Mood</h3>
                <div className="flex flex-wrap gap-2">
                  {moodOptions.map(opt => (
                    <button
                      key={opt.value}
                      title={opt.value}
                      onClick={() => {
                        setMood(opt.value);
                        setIsSaved(false);
                        triggerHaptic('light');
                        setMoodMessage(`Recorded choice: ${opt.label} ${opt.value}`);
                        if (moodTimerRef.current) {
                          clearTimeout(moodTimerRef.current);
                        }
                        moodTimerRef.current = setTimeout(() => {
                          setMoodMessage(null);
                        }, 3000);
                      }}
                      className={cn(
                        "rounded-lg border p-3 text-2xl transition-all",
                        mood === opt.value
                          ? "border-accent bg-accent-soft scale-105"
                          : "border-tertiary hover:border-secondary hover:bg-background-tertiary"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {moodMessage && (
                  <div className="mt-2 text-sm font-medium text-success" role="status">
                    ✓ {moodMessage}
                  </div>
                )}
              </div>

              <div className="mb-8">
                <h3 className="font-display text-lg text-text-primary mb-3">Reflection</h3>
                <textarea
                  className="w-full rounded-lg bg-background-tertiary border border-tertiary p-4 text-text-primary placeholder:text-text-secondary outline-none focus:border-accent transition-colors resize-y min-h-[160px]"
                  value={reflection}
                  onChange={(e) => {
                    setReflection(e.target.value);
                    setIsSaved(false);
                  }}
                  placeholder="Write down your thoughts and reflections on today's quote..."
                  disabled={isLoading || isSaving}
                />
              </div>

              <div className="mb-8">
                <h3 className="font-display text-lg text-text-primary mb-3">Amor Fati</h3>
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
