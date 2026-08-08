import React, { useEffect, useState, useRef } from 'react'
import { Modal, Button } from '../../ds'
import { Share2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import styles from './Stats.module.css'

export function Stats({ open, onClose, stats, gameState, word, onPlayAgain, onToast }) {
  const [copied, setCopied] = useState(false)
  const [definition, setDefinition] = useState(null)
  const isFinished = gameState.status !== 'playing'
  const isCrown = gameState.iteration === 0
  const dictStats = stats[gameState.dictionary] || stats.standard
  const shareRef = useRef(null)
  const [statsCopied, setStatsCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setCopied(false)
      if (isFinished && !definition) {
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
          .then(res => res.json())
          .then(data => {
            if (data && data[0] && data[0].meanings) {
              const def = data[0].meanings[0].definitions[0].definition
              setDefinition(def)
            } else {
              setDefinition('Definition not found.')
            }
          })
          .catch(() => setDefinition('Failed to load definition.'))
      }
    }
  }, [open, isFinished, word, definition])

  const handleShare = async () => {
    if (shareRef.current) {
      try {
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
    <Modal open={open} onClose={onClose} title={`Statistics (${gameState.dictionary})`}>
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

      {isFinished && (
        <div className={styles.footer}>
          <div className={styles.wordReveal}>
            The word was: <a href={`https://en.wiktionary.org/wiki/${word.toLowerCase()}`} target="_blank" rel="noreferrer" style={{color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '4px'}}><strong>{word.toUpperCase()}</strong></a>
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
            <Button size="sm" variant="ghost" onClick={handleShareStats} style={{ flex: 1, padding: '0 2px', minWidth: 0 }}>
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

      {/* Hidden element for html2canvas generation */}
      {isFinished && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div ref={shareRef} className={styles.shareCard}>
            <div className={styles.shareHeader}>
              <div className={styles.shareTitle}>
                Lexi5 <span>{gameState.dictionary === 'custom' ? 'custom, AI curated' : gameState.dictionary}</span>
              </div>
              <div className={styles.shareAttempt}>
                {isCrown && <span style={{marginRight: 4}}>👑</span>}
                {gameState.status === 'won' ? `Guesses: ${gameState.guesses.length} out of 6` : 'Failed (X out of 6)'}
              </div>
            </div>
            <div className={styles.shareGrid}>
              {gameState.guesses.map((guess, r) => (
                <div key={r} className={styles.shareRow}>
                  {guess.split('').map((letter, i) => {
                    const l = letter.toUpperCase()
                    const isCorrect = word[i].toUpperCase() === l
                    const isPresent = word.toUpperCase().includes(l)
                    const statusClass = isCorrect ? styles.shareCorrect : (isPresent ? styles.sharePresent : styles.shareAbsent)
                    return <div key={i} className={`${styles.shareTile} ${statusClass}`}></div>
                  })}
                </div>
              ))}
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
