import React from 'react';
import styles from './GuideNote.module.css';

export interface GuideNoteProps {
  summary: React.ReactNode;
  children: React.ReactNode;
  hidden?: boolean;
}

const ChevronRight = () => (
  <svg 
    className={styles.icon} 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export function GuideNote({ summary, children, hidden }: GuideNoteProps) {
  if (hidden) return null;

  return (
    <details className={styles.container}>
      <summary className={styles.summary}>
        <ChevronRight />
        {summary}
      </summary>
      <div className={styles.body}>
        {children}
      </div>
    </details>
  );
}
