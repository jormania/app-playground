import { useState, useEffect } from 'react';
import { Button } from '../ds';
import { fetchReflectionForDay, upsertReflection } from './services/NotionService';
import styles from './App.module.css';

interface JournalProps {
  dayOfYear: number;
  token: string;
  databaseId: string;
}

export default function Journal({ dayOfYear, token, databaseId }: JournalProps) {
  const isNotionConfigured = !!token.trim() && !!databaseId.trim();
  const localStorageKey = `daily-stoic:reflection-${dayOfYear}`;

  const [reflection, setReflection] = useState('');
  const [savedReflection, setSavedReflection] = useState('');
  const [existingPageId, setExistingPageId] = useState<string | undefined>(undefined);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load reflection on day or config change
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!isNotionConfigured) {
        // Fallback to local storage
        const saved = localStorage.getItem(localStorageKey) || '';
        setReflection(saved);
        setSavedReflection(saved);
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
          setExistingPageId(result.id);
          setIsSaved(true);
        } else {
          // If not in Notion, check local storage as fallback
          const localBackup = localStorage.getItem(localStorageKey) || '';
          setReflection(localBackup);
          setSavedReflection('');
          setExistingPageId(undefined);
          setIsSaved(localBackup === ''); // saved if empty
        }
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'Failed to load reflection from Notion.');
        // Still load local storage so app is usable offline
        const localBackup = localStorage.getItem(localStorageKey) || '';
        setReflection(localBackup);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [dayOfYear, token, databaseId, isNotionConfigured, localStorageKey]);

  const handleSave = async () => {
    const cleanedText = reflection.trim();
    
    // Always update local storage first as a local cache/backup
    localStorage.setItem(localStorageKey, cleanedText);

    if (!isNotionConfigured) {
      setSavedReflection(cleanedText);
      setIsSaved(true);
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
        existingPageId
      );

      setSavedReflection(result.text);
      setExistingPageId(result.id);
      setIsSaved(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save reflection to Notion.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = reflection.trim() !== savedReflection;

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
            {isSaved && reflection.trim() !== '' && !error && (
              <span className={styles.saveStatus} role="status">
                ✓ {isNotionConfigured ? 'Reflection saved to Notion' : 'Reflection saved locally'}
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
