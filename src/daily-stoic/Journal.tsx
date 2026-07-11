import { useState, useEffect } from 'react';
import { Button } from '../ds';
import { fetchReflectionForDay, upsertReflection, fetchRecentReflections } from './services/NotionService';
import AmorFatiControl from './components/AmorFatiControl';
import styles from './App.module.css';

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

  const [reflection, setReflection] = useState('');
  const [savedReflection, setSavedReflection] = useState('');
  
  // Amor Fati local states
  const [fateInput, setFateInput] = useState('');
  const [savedFateInput, setSavedFateInput] = useState('');
  const [acceptanceTags, setAcceptanceTags] = useState<string[]>([]);
  const [savedAcceptanceTags, setSavedAcceptanceTags] = useState<string[]>([]);

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
        const saved = localStorage.getItem(localStorageKey) || '';
        const savedFate = localStorage.getItem(localFateKey) || '';
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
          setExistingPageId(result.id);
          setIsSaved(true);
        } else {
          // If not in Notion, check local storage as fallback
          const localBackup = localStorage.getItem(localStorageKey) || '';
          const localFateBackup = localStorage.getItem(localFateKey) || '';
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
          setExistingPageId(undefined);

          const empty = localBackup === '' && localFateBackup === '' && localTagsBackup.length === 0;
          setIsSaved(empty);
        }
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'Failed to load reflection from Notion.');
        // Still load local storage so app is usable offline
        const localBackup = localStorage.getItem(localStorageKey) || '';
        const localFateBackup = localStorage.getItem(localFateKey) || '';
        let localTagsBackup: string[] = [];
        try {
          localTagsBackup = JSON.parse(localStorage.getItem(localTagsKey) || '[]');
        } catch {
          localTagsBackup = [];
        }
        setReflection(localBackup);
        setFateInput(localFateBackup);
        setAcceptanceTags(localTagsBackup);
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
    
    // Always update local storage first as a local cache/backup
    localStorage.setItem(localStorageKey, cleanedText);
    localStorage.setItem(localFateKey, cleanedFate);
    localStorage.setItem(localTagsKey, JSON.stringify(acceptanceTags));

    if (!isNotionConfigured) {
      setSavedReflection(cleanedText);
      setSavedFateInput(cleanedFate);
      setSavedAcceptanceTags([...acceptanceTags]);
      setIsSaved(true);
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
        acceptanceTags
      );

      setSavedReflection(result.text);
      setSavedFateInput(result.fateInput || '');
      setSavedAcceptanceTags(result.acceptanceTags || []);
      setExistingPageId(result.id);
      setIsSaved(true);
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
    JSON.stringify(acceptanceTags) !== JSON.stringify(savedAcceptanceTags);

  return (
    <div className={styles.journalContainer}>
      <div className={styles.journalHeaderRow}>
        <h2 className={styles.journalTitle}>Today's Reflection</h2>
        {isNotionConfigured && (
          <span className={styles.notionBadge} title="Reflections sync to Notion">
            ▲ Notion Synced
          </span>
        )}
      </div>

      {isLoading ? (
        <div className={styles.syncState}>
          <span className={styles.spinner}>⏳</span> Syncing with Notion...
        </div>
      ) : (
        <>
          <div className={styles.textareaWrapper}>
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
    </div>
  );
}
