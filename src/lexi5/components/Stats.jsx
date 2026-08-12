import React, { useEffect, useState, useRef, useId } from 'react'
import { Modal, Button } from '../../ds'
import { Share2 } from 'lucide-react'
import { useShareResult } from '../lib/useShareResult'
import { BUILTIN_DICTIONARY_ORDER, DICTIONARY_LABELS, hasCustomDictionary } from '../lib/gameState'
import styles from './Stats.module.css'

// Only rendered once the fetch has actually settled — 'idle'/'loading' show nothing rather
// than a placeholder, since most opens of this panel are mid-fetch for a fraction of a second.
const DEFINITION_MESSAGE = {
  'not-found': 'No definition found for this word.',
  error: "Couldn't load a definition — try again in a moment.",
}

export function Stats({
  open,
  onClose,
  stats,
  gameState,
  word,
  onPlayAgain,
  onToast,
  highContrast,
  hintUsed,
  definition,
  requestDefinition,
}) {
  const isFinished = gameState.status !== 'playing'

  // Which dictionary's record is on screen. Every dictionary's stats have always been
  // stored separately, but the only way to see another one's was to *switch* dictionaries
  // — which deals a fresh word and abandons the game in progress. This is a read-only
  // view and never touches what's being played.
  const [viewDict, setViewDict] = useState(gameState.dictionary)
  useEffect(() => {
    if (open) setViewDict(gameState.dictionary)
  }, [open, gameState.dictionary])

  const viewingCurrent = viewDict === gameState.dictionary
  const dictStats = stats[viewDict] || stats.standard
  const dictPickerId = useId()

  // The word/definition/share footer only renders for the currently-played dictionary, so
  // switching the picker away from it can shrink the panel a lot. Without resetting scroll
  // here, doing that while scrolled down left the panel sitting at its old scroll offset —
  // past the new, shorter end, showing nothing until you scrolled back up yourself.
  const topRef = useRef(null)
  const resetScroll = () => topRef.current?.parentElement?.scrollTo({ top: 0 })
  useEffect(() => {
    if (open) resetScroll()
  }, [open])

  // Fires once per fresh open rather than on every definition-state change — requestDefinition
  // already short-circuits a 'found'/'not-found' answer cached for this word, but it does
  // (deliberately) retry a stale 'error', and depending on `definition.status` here would
  // re-invoke it the moment that retry settled back to 'error', looping for as long as the
  // panel stayed open.
  useEffect(() => {
    if (!open || !isFinished) return
    requestDefinition(word)
  }, [open, isFinished, word, requestDefinition])

  // The one share action — identical to the button the result bar offers the moment a game
  // ends. Stats used to grow three of its own (a rendered image, a plain grid, a plain
  // stats summary), each telling a friend something slightly different; this is the only
  // one worth keeping.
  const { share } = useShareResult({
    gameState,
    word,
    dictionaryLabel: DICTIONARY_LABELS[gameState.dictionary] || gameState.dictionary,
    highContrast,
    hintUsed,
    onToast,
  })

  const maxGuessCount = Math.max(...Object.values(dictStats.guesses), 1)

  const totalGuesses = Object.entries(dictStats.guesses).reduce((acc, [num, count]) => acc + (Number(num) * count), 0)
  const avgGuesses = dictStats.gamesWon > 0 ? (totalGuesses / dictStats.gamesWon).toFixed(1) : '-'

  const definitionMessage = definition.word === word ? DEFINITION_MESSAGE[definition.status] : undefined

  return (
    <Modal open={open} onClose={onClose} title="Statistics">
      <div className={styles.dictPicker} ref={topRef}>
        <label className={styles.dictPickerLabel} htmlFor={dictPickerId}>Showing</label>
        <select
          id={dictPickerId}
          className={styles.dictPickerSelect}
          value={viewDict}
          onChange={e => {
            setViewDict(e.target.value)
            resetScroll()
          }}
        >
          {BUILTIN_DICTIONARY_ORDER.map(key => (
            <option key={key} value={key}>{DICTIONARY_LABELS[key]}</option>
          ))}
          <option value="custom" disabled={!hasCustomDictionary()}>{DICTIONARY_LABELS.custom}</option>
        </select>
      </div>

      <div className={styles.statsContainer}>
        <div className={styles.statBox}>
          <div className={styles.statNum}>{dictStats.gamesPlayed}</div>
          <div className={styles.statLabel}>Played</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statNum}>
            {dictStats.gamesPlayed > 0 ? Math.round((dictStats.gamesWon / dictStats.gamesPlayed) * 100) : 0}
          </div>
          <div className={styles.statLabel}>Win %</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statNum}>{avgGuesses}</div>
          <div className={styles.statLabel}>Avg</div>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statBox} title="Consecutive wins">
          <div className={styles.statNum}>{dictStats.currentStreak || 0}</div>
          <div className={styles.statLabel}>Streak</div>
        </div>
        <div className={styles.statBox} title="Best streak ever">
          <div className={styles.statNum}>{dictStats.maxStreak || 0}</div>
          <div className={styles.statLabel}>Best</div>
        </div>
      </div>

      <h3 className={styles.distTitle}>Guess Distribution</h3>
      <div className={styles.distribution}>
        {[1, 2, 3, 4, 5, 6].map(num => {
          const count = dictStats.guesses[num] || 0
          const percent = Math.max((count / maxGuessCount) * 100, 7) // Min 7% width to fit the number

          return (
            <div key={num} className={styles.distRow}>
              <div className={styles.distNum}>{num}</div>
              {count > 0 && (
                <div
                  className={`${styles.distBar} ${styles.hasData}`}
                  style={{ width: `${percent}%` }}
                >
                  {dictStats.gamesWon > 0 ? `${count} (${Math.round((count / dictStats.gamesWon) * 100)}%)` : count}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!viewingCurrent && (
        <p className={styles.viewingNote}>
          Viewing your {DICTIONARY_LABELS[viewDict]} record. You&rsquo;re currently playing{' '}
          {DICTIONARY_LABELS[gameState.dictionary]} — switching here changes nothing.
        </p>
      )}

      {isFinished && viewingCurrent && (
        <div className={styles.footer}>
          <div className={styles.wordReveal}>
            The word was: <a href={`https://en.wiktionary.org/wiki/${word.toLowerCase()}`} target="_blank" rel="noreferrer" style={{color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '4px'}}><strong className={styles.wordRevealWord}>{word.toLowerCase()}</strong></a>
          </div>
          {definition.word === word && definition.status === 'found' && (
            <div className={styles.definition}>
              <i>{definition.text}</i>
            </div>
          )}
          {definitionMessage && (
            <div className={styles.definition}>
              <i>{definitionMessage}</i>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'center', gap: '6px', marginTop: '12px', width: '100%' }}>
            {gameState.guesses.length > 0 && (
              <Button size="sm" onClick={share} style={{ flex: 1, padding: '0 2px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Share2 size={14} style={{ marginRight: '4px', flexShrink: 0 }} />
                  <span>Share</span>
                </div>
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={onPlayAgain} style={{ flex: 1, padding: '0 2px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span>Play Again</span>
              </div>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
