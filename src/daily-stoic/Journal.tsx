import { useState, useEffect } from 'react';
import { Button, Modal, BreathingWidget, SegmentedControl } from '../ds';
import AppGuideNote from './components/AppGuideNote';
import { fetchReflectionForDay, upsertReflection, fetchRecentReflections } from './services/NotionService';
import AmorFatiControl from './components/AmorFatiControl';
import styles from './App.module.css';
import { triggerHaptic } from '../shared/haptics';

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

  const [isBreathingModalOpen, setIsBreathingModalOpen] = useState(false);

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
        setError(err.message || 'Failed to load reflection from Notion.');
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
      setError(err.message || 'Failed to save reflection to Notion.');
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
    <div className={styles.journalContainer}>
      <div className={styles.journalHeaderRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 className={styles.journalTitle}>Daily Practice</h2>
          <Button variant="ghost" size="sm" onClick={() => setIsBreathingModalOpen(true)}>
            🌬️ Center Yourself
          </Button>
        </div>
        {isNotionConfigured && (
          <span className={styles.notionBadge} title="Reflections sync to Notion">
            ▲ Notion Synced
          </span>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
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
        <div className={styles.syncState}>
          <span className={styles.spinner}>⏳</span> Syncing with Notion...
        </div>
      ) : (
        <>
          {phase === 'morning' && (
            <div className={styles.textareaWrapper} style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>Premeditatio Malorum</h3>
              <AppGuideNote summary="Why prepare for the worst?">
                <p>
                  <strong>Premeditatio Malorum</strong> is the Stoic practice of negative visualization. 
                  By anticipating challenges, setbacks, and difficult people, you mentally rehearse how to respond with virtue (wisdom, justice, courage, temperance). 
                  When things inevitably go wrong, you won't be shocked—you'll be ready.
                </p>
              </AppGuideNote>
              <textarea
                className={styles.textarea}
                value={morningIntentions}
                onChange={(e) => {
                  setMorningIntentions(e.target.value);
                  setIsSaved(false);
                }}
                placeholder="I might face..."
                rows={4}
                disabled={isLoading || isSaving}
              />
            </div>
          )}

          {phase === 'evening' && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>Mood</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {moodOptions.map(opt => (
                    <button
                      key={opt.value}
                      title={opt.value}
                      onClick={() => { setMood(opt.value); setIsSaved(false); }}
                      style={{
                        background: mood === opt.value ? 'var(--primary)' : 'var(--surface-hover)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '0.5rem',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.textareaWrapper}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>Reflection</h3>
                <textarea
                  className={styles.textarea}
                  value={reflection}
                  onChange={(e) => {
                    setReflection(e.target.value);
                    setIsSaved(false);
                  }}
                  placeholder={
                    isNotionConfigured
                      ? "Write down your thoughts and reflections on today's quote (will save to Notion)..."
                      : "Write down your thoughts and reflections on today's quote (saved locally)..."
                  }
                  rows={6}
                  disabled={isLoading || isSaving}
                />
              </div>

              <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                <AppGuideNote summary="What is Amor Fati?">
                  <p>
                    <strong>Amor Fati</strong> (Love of Fate) is the practice of not just accepting, but embracing whatever happens. 
                    If you faced friction today, log it below and tag the source. Treat it not as an obstacle, but as raw material to practice patience, resilience, and acceptance.
                  </p>
                </AppGuideNote>
              </div>
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
            </>
          )}

          {error && (
            <div className={styles.inlineError} role="alert">
              ⚠️ {error}
            </div>
          )}

          <div className={styles.journalActions}>
            <Button
              onClick={handleSave}
              disabled={(!hasChanges && isSaved) || isLoading || isSaving}
              variant={hasChanges ? 'primary' : 'secondary'}
            >
              {isSaving ? 'Saving to Notion...' : isSaved ? 'Saved' : 'Save Reflection'}
            </Button>

            <Button
              onClick={handleDownload}
              variant="ghost"
              disabled={isLoading || isSaving || isDownloading}
            >
              {isDownloading ? 'Archiving...' : '📥 Download Data'}
            </Button>

            {isSaved && !hasChanges && !error && (
              <span className={styles.saveStatus} role="status">
                ✓ {isNotionConfigured ? 'Saved to Notion' : 'Saved locally'}
              </span>
            )}
            {!isSaved && hasChanges && !isSaving && (
              <span className={styles.unsavedStatus} role="status">
                ● Unsaved changes
              </span>
            )}
          </div>
        </>
      )}

      <Modal
        open={isBreathingModalOpen}
        onClose={() => setIsBreathingModalOpen(false)}
        title="Mindful Breathing"
      >
        <BreathingWidget onComplete={() => setIsBreathingModalOpen(false)} />
      </Modal>
    </div>
  );
}
