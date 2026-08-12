import React, { useEffect, useState, useRef, useId } from 'react'
import { Modal, Button } from '../../ds'
import { Share2 } from 'lucide-react'
import { scoreGuess } from '../lib/score'
import { buildShareText } from '../lib/share'
import { BUILTIN_DICTIONARY_ORDER, DICTIONARY_LABELS, hasCustomDictionary } from '../lib/gameState'
import styles from './Stats.module.css'

export function Stats({ open, onClose, stats, gameState, word, onPlayAgain, onToast, highContrast, hintUsed }) {
  const [copied, setCopied] = useState(false)
  const [gridCopied, setGridCopied] = useState(false)
  // Keyed by the word it describes, not a bare string. <Stats> never unmounts (only its
  // inner Modal returns null), so a plain `!definition` guard meant the first word's
  // definition stuck for the whole session — every later game showed the wrong one, and
  // baked it into the share image as the HINT line.
  const [def, setDef] = useState({ word: null, text: null })
  const definition = def.text
  const isFinished = gameState.status !== 'playing'
  const isCrown = gameState.iteration === 0

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
  const shareRef = useRef(null)
  const dictPickerId = useId()
  const [statsCopied, setStatsCopied] = useState(false)

  useEffect(() => {
    if (open) setCopied(false)
  }, [open])

  useEffect(() => {
    if (!open || !isFinished || def.word === word) return undefined

    // Aborted on cleanup so a slow response can't resolve against a word the player
    // has already moved on from (Play Again is one tap away).
    const controller = new AbortController()
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, { signal: controller.signal })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        const found = data && data[0] && data[0].meanings && data[0].meanings[0].definitions[0].definition
        setDef({ word, text: found || 'Definition not found.' })
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setDef({ word, text: 'Failed to load definition.' })
      })

    return () => controller.abort()
  }, [open, isFinished, word, def.word])

  const handleShare = async () => {
    if (shareRef.current) {
      try {
        // Loaded on demand: html2canvas is only needed once a game has ended and the
        // player actually taps Share, so it stays off the initial bundle.
        const { default: html2canvas } = await import('html2canvas')
        const canvas = await html2canvas(shareRef.current, { backgroundColor: '#121213', scale: 2 })
        canvas.toBlob(async (blob) => {
          if (!blob) return
          
          const seedStr = encodeURIComponent(btoa(`${gameState.date}|${gameState.iteration}|${gameState.dictionary}`))
          const shareUrl = `${window.location.origin}${window.location.pathname}?seed=${seedStr}`
          const dictLabel = gameState.dictionary === 'custom' ? 'custom, AI curated' : gameState.dictionary
          const attemptText = gameState.status === 'won' ? `Guessed in ${gameState.guesses.length} out of 6` : 'Failed (X out of 6)'
          const text = `Lexi5 (${dictLabel}) — ${attemptText}\nPlay the same word here: ${shareUrl}`
          
          const file = new File([blob], 'lexi5-share.png', { type: 'image/png' })
          
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ text, files: [file] })
            } catch (err) {
              // AbortError just means the user closed the native share sheet — not a failure.
              if (err.name !== 'AbortError') {
                console.error('Failed to share', err)
                onToast?.('Could not share — try again.')
              }
            }
          } else {
            // Fallback to clipboard if supported, or just copy text
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ])
              setCopied(true)
            } catch (_err) {
              navigator.clipboard.writeText(text)
                .then(() => setCopied(true))
                .catch(() => onToast?.('Could not copy to clipboard — try again.'))
            }
          }
        }, 'image/png')
      } catch (err) {
        console.error('Failed to generate share image', err)
        onToast?.('Could not generate the share image — try again.')
      }
    }
  }

  const handleShareGrid = async () => {
    const seedStr = encodeURIComponent(btoa(`${gameState.date}|${gameState.iteration}|${gameState.dictionary}`))
    const text = buildShareText({
      guesses: gameState.guesses,
      word,
      highContrast,
      dictionaryLabel: DICTIONARY_LABELS[gameState.dictionary] || gameState.dictionary,
      won: gameState.status === 'won',
      iteration: gameState.iteration,
      hardMode: gameState.difficulty === 'hard',
      hintUsed,
      url: `${window.location.origin}${window.location.pathname}?seed=${seedStr}`,
    })

    if (navigator.share && navigator.canShare && navigator.canShare({ text })) {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        // A dismissed share sheet is not a failure; fall through to the clipboard only
        // for real errors.
        if (err.name === 'AbortError') return
      }
    }
    navigator.clipboard.writeText(text)
      .then(() => setGridCopied(true))
      .catch(() => onToast?.('Could not copy to clipboard — try again.'))
  }

  const handleShareStats = () => {
    const dictLabel = gameState.dictionary === 'custom' ? 'custom, AI curated' : gameState.dictionary
    const winPct = dictStats.gamesPlayed > 0 ? Math.round((dictStats.gamesWon / dictStats.gamesPlayed) * 100) : 0
    const text = `Lexi5 (${dictLabel})\nPlayed: ${dictStats.gamesPlayed}\nWin %: ${winPct}%\nStreak: ${dictStats.currentStreak || 0}\nMax Streak: ${dictStats.maxStreak || 0}`
    if (navigator.share && navigator.canShare && navigator.canShare({ text })) {
      navigator.share({ text }).catch(err => {
        if (err.name !== 'AbortError') onToast?.('Could not share stats — try again.')
      })
    } else {
      navigator.clipboard.writeText(text)
        .then(() => setStatsCopied(true))
        .catch(() => onToast?.('Could not copy to clipboard — try again.'))
    }
  }

  const maxGuessCount = Math.max(...Object.values(dictStats.guesses), 1)

  const totalGuesses = Object.entries(dictStats.guesses).reduce((acc, [num, count]) => acc + (Number(num) * count), 0)
  const avgGuesses = dictStats.gamesWon > 0 ? (totalGuesses / dictStats.gamesWon).toFixed(1) : '-'

  return (
    <Modal open={open} onClose={onClose} title="Statistics">
      <div className={styles.dictPicker}>
        <label className={styles.dictPickerLabel} htmlFor={dictPickerId}>Showing</label>
        <select
          id={dictPickerId}
          className={styles.dictPickerSelect}
          value={viewDict}
          onChange={e => setViewDict(e.target.value)}
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
          {definition && (
            <div className={styles.definition}>
              <i>{definition}</i>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'center', gap: '6px', marginTop: '12px', width: '100%' }}>
            <Button size="sm" onClick={handleShare} style={{ flex: 1, padding: '0 2px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Share2 size={14} style={{ marginRight: '4px', flexShrink: 0 }} />
                <span>{copied ? 'Copied!' : 'Image'}</span>
              </div>
            </Button>
            {gameState.guesses.length > 0 && (
            <Button size="sm" variant="secondary" onClick={handleShareGrid} style={{ flex: 1, padding: '0 2px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Share2 size={14} style={{ marginRight: '4px', flexShrink: 0 }} />
                <span>{gridCopied ? 'Copied!' : 'Grid'}</span>
              </div>
            </Button>
            )}
            <Button size="sm" variant="secondary" onClick={handleShareStats} style={{ flex: 1, padding: '0 2px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Share2 size={14} style={{ marginRight: '4px', flexShrink: 0 }} />
                <span>{statsCopied ? 'Copied!' : 'Stats'}</span>
              </div>
            </Button>
            <Button size="sm" variant="primary" onClick={onPlayAgain} style={{ flex: 1, padding: '0 2px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span>Play Again</span>
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* Off-screen source for html2canvas. Positioned out of view rather than display:none
          (which html2canvas can't rasterise), so it needs aria-hidden/inert to stay out of
          the accessibility tree — otherwise a screen reader reads the whole result twice. */}
      {isFinished && viewingCurrent && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }} aria-hidden="true" inert="">
          <div ref={shareRef} className={styles.shareCard}>
            <div className={styles.shareHeader}>
              <div className={styles.shareTitle}>
                <div className={styles.shareTitleMain}>Lexi5</div>
                <div className={styles.shareTitleSub}>{gameState.dictionary === 'custom' ? 'custom, AI curated' : gameState.dictionary}</div>
              </div>
              <div className={styles.shareAttempt}>
                {isCrown && <span style={{marginRight: 4}}>👑</span>}
                {gameState.status === 'won' ? `${gameState.guesses.length}/6` : 'X/6'}
              </div>
            </div>
            <div className={styles.shareGrid}>
              {gameState.guesses.map((guess, r) => {
                // Same scorer as the board (lib/score.js). This grid used to re-implement
                // scoring naively and painted yellows the board never showed.
                const statuses = scoreGuess(guess, word)
                const statusClass = { correct: styles.shareCorrect, present: styles.sharePresent, absent: styles.shareAbsent }
                return (
                  <div key={r} className={styles.shareRow}>
                    {statuses.map((status, i) => (
                      <div key={i} className={`${styles.shareTile} ${statusClass[status]}`}></div>
                    ))}
                  </div>
                )
              })}
            </div>
            {definition && (
              <div className={styles.shareDef}>
                <strong>HINT</strong>: {definition.substring(0, 80)}{definition.length > 80 ? '...' : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
