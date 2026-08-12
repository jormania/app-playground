import React from 'react'
import { Modal, Button } from '../../ds'
import styles from './HowToPlay.module.css'

// A worked example beats a description of the rules. Same three states, in the order a
// player meets them.
const EXAMPLE = [
  { letters: 'CRANE', statuses: ['absent', 'present', 'absent', 'absent', 'correct'],
    note: <><b>R</b> is in the word but somewhere else. <b>E</b> is in the right spot.</> },
]

export function HowToPlay({ open, onClose, firstRun = false }) {
  return (
    <Modal open={open} onClose={onClose} title={firstRun ? 'Welcome to Lexi5' : 'How to play'}>
      <div className={styles.body}>
        {firstRun && (
          <p className={styles.intro}>
            Guess the five-letter word in six tries. Here&rsquo;s everything you need.
          </p>
        )}

        <section className={styles.section}>
          <h3 className={styles.heading}>The colours</h3>
          {EXAMPLE.map(({ letters, statuses, note }) => (
            <div key={letters}>
              <div className={styles.exampleRow} aria-hidden="true">
                {letters.split('').map((letter, i) => (
                  <div key={i} className={`${styles.tile} ${styles[statuses[i]]}`}>{letter}</div>
                ))}
              </div>
              <p className={styles.note}>{note} Everything else isn&rsquo;t in the word at all.</p>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>One word a day, then as many as you like</h3>
          <p className={styles.note}>
            The first game each day is the <b>Daily word</b> — the same one everybody playing
            that dictionary gets, and the only one that counts toward your daily streak.
            After that, <b>Play Again</b> deals unlimited practice rounds.
          </p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>Pick your difficulty</h3>
          <p className={styles.note}>
            Four word lists, easiest to hardest: <b>Lite</b>, <b>Standard</b>, <b>Expanded</b>,
            <b> Expert</b>. Each keeps its own stats, and switching deals a fresh word with no
            penalty. You can also have Claude curate a custom list on any theme — that&rsquo;s
            the <b>AI Curation</b> panel in Settings.
          </p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>Optional extras</h3>
          <ul className={styles.list}>
            <li><b>Hard Mode</b> — every hint you uncover must be reused in later guesses.</li>
            <li><b>Smart Keyboard</b> — dots on each key remember which positions you&rsquo;ve tried.</li>
            <li><b>High Contrast</b> — swaps green/yellow for orange/blue.</li>
          </ul>
        </section>

        <div className={styles.actions}>
          <a
            className={styles.deepLink}
            href="/lexi5-guide.html"
            target="_blank"
            rel="noreferrer"
          >
            Full guide
          </a>
          <Button onClick={onClose}>{firstRun ? 'Play' : 'Got it'}</Button>
        </div>
      </div>
    </Modal>
  )
}
