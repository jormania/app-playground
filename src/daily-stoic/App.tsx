import { useState, useEffect } from 'react';
import { SegmentedControl, NumberStepper, Button } from '../ds';
import Journal from './Journal';
import Settings from './Settings';
import { getDayOfYear, getQuoteForDay, formatDateLabel } from './utils/date';
import styles from './App.module.css';

function getDateFromDayOfYear(day: number): Date {
  const year = new Date().getFullYear();
  const date = new Date(year, 0, 1);
  date.setDate(day);
  return date;
}

export default function App() {
  const today = getDayOfYear();
  const [dayOfYear, setDayOfYear] = useState(today);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('daily-stoic:theme') as 'light' | 'dark' | 'system') || 'system';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [token, setToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');

  const loadCredentials = () => {
    setToken(localStorage.getItem('daily-stoic:notion-token') || '');
    setDatabaseId(localStorage.getItem('daily-stoic:notion-db') || '');
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  // Apply theme changes to document Element
  useEffect(() => {
    const root = document.documentElement;
    const metaTheme = document.querySelector('meta[name="theme-color"]');

    const updateTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        root.setAttribute('data-theme', 'dark');
        if (metaTheme) metaTheme.setAttribute('content', '#0e1115');
      } else {
        root.removeAttribute('data-theme');
        if (metaTheme) metaTheme.setAttribute('content', '#f4f5f7');
      }
    };

    updateTheme();
    localStorage.setItem('daily-stoic:theme', theme);

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', updateTheme);
      return () => media.removeEventListener('change', updateTheme);
    }
  }, [theme]);

  const quote = getQuoteForDay(dayOfYear);
  const currentDate = getDateFromDayOfYear(dayOfYear);

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div className={styles.appShell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandEmoji} aria-hidden="true">🏛️</span>
          <h1 className={styles.brandTitle}>Daily Stoic</h1>
        </div>
        <div className={styles.headerActions}>
          {!isSettingsOpen && (
            <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(true)}>
              ⚙️ Settings
            </Button>
          )}
          <div className={styles.themeToggle}>
            <SegmentedControl
              options={themeOptions}
              value={theme}
              onChange={(val) => setTheme(val as 'light' | 'dark' | 'system')}
              size="sm"
            />
          </div>
        </div>
      </header>

      {isSettingsOpen ? (
        <main className={styles.mainContent}>
          <Settings
            onClose={() => {
              setIsSettingsOpen(false);
              loadCredentials();
            }}
          />
        </main>
      ) : (
        <main className={styles.mainContent}>
          <section className={styles.navigationSection}>
            <NumberStepper
              label="Day of Year"
              value={dayOfYear}
              min={1}
              max={366}
              onChange={(val) => setDayOfYear(val)}
            />
            {dayOfYear !== today && (
              <Button variant="ghost" size="sm" onClick={() => setDayOfYear(today)}>
                Back to Today
              </Button>
            )}
          </section>

          <section className={styles.dateDisplay}>
            <span className={styles.dateLabel}>{formatDateLabel(currentDate)}</span>
            <span className={styles.dayLabel}>Day {dayOfYear} of 366</span>
          </section>

          <blockquote className={styles.quoteBlock}>
            <p className={styles.quoteText}>“{quote.text}”</p>
            <cite className={styles.quoteCite}>
              — {quote.author}, <span className={styles.quoteSource}>{quote.source}</span>
            </cite>
          </blockquote>

          <Journal dayOfYear={dayOfYear} token={token} databaseId={databaseId} />
        </main>
      )}

      <footer className={styles.footer}>
        <p>Stoic wisdom is in the public domain. Your reflections are stored locally.</p>
      </footer>
    </div>
  );
}
