import { useState, useEffect } from 'react';
import { Button } from '../ds';
import styles from './App.module.css';

interface JournalProps {
  dayOfYear: number;
}

export default function Journal({ dayOfYear }: JournalProps) {
  const storageKey = `daily-stoic:reflection-${dayOfYear}`;
  const [reflection, setReflection] = useState('');
  const [savedReflection, setSavedReflection] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Load reflection on day change
  useEffect(() => {
    const saved = localStorage.getItem(storageKey) || '';
    setReflection(saved);
    setSavedReflection(saved);
    setIsSaved(true);
  }, [dayOfYear, storageKey]);

  const handleSave = () => {
    localStorage.setItem(storageKey, reflection.trim());
    setSavedReflection(reflection.trim());
    setIsSaved(true);
  };

  const hasChanges = reflection.trim() !== savedReflection;

  return (
    <div className={styles.journalContainer}>
      <h2 className={styles.journalTitle}>Today's Reflection</h2>
      <div className={styles.textareaWrapper}>
        <textarea
          className={styles.textarea}
          value={reflection}
          onChange={(e) => {
            setReflection(e.target.value);
            setIsSaved(false);
          }}
          placeholder="Write down your thoughts and reflections on today's quote..."
          rows={6}
        />
      </div>
      <div className={styles.journalActions}>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          variant={hasChanges ? "primary" : "secondary"}
        >
          {isSaved ? "Saved" : "Save Reflection"}
        </Button>
        {isSaved && reflection.trim() !== '' && (
          <span className={styles.saveStatus} role="status">
            ✓ Reflection saved to local storage
          </span>
        )}
        {!isSaved && hasChanges && (
          <span className={styles.unsavedStatus} role="status">
            ● Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
