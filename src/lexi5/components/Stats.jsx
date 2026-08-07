import React, { useEffect, useState, useRef } from 'react'
import { Modal, Button } from '../../ds'
import html2canvas from 'html2canvas'
import styles from './Stats.module.css'

export function Stats({ open, onClose, stats, gameState, word, onPlayAgain }) {
  const [copied, setCopied] = useState(false)
  const [definition, setDefinition] = useState(null)
  const isFinished = gameState.status !== 'playing'
  const isCrown = gameState.iteration === 0
  const dictStats = stats[gameState.dictionary] || stats.standard
  const shareRef = useRef(null)

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
          
          const seedStr = btoa(`${gameState.date}|${gameState.iteration}|${gameState.dictionary}`)
          const shareUrl = `${window.location.origin}${window.location.pathname}?seed=${seedStr}`
          const attempt = gameState.status === 'won' ? gameState.guesses.length : 'X'
          const text = `Lexi5 (${gameState.dictionary}) ${attempt}/6\nPlay this board: ${shareUrl}`
          
          const file = new File([blob], 'lexi5-share.png', { type: 'image/png' })
          
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              text,
              files: [file]
            })
          } else {
            // Fallback to clipboard if supported, or just copy text
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ])
              setCopied(true)
            } catch (err) {
              navigator.clipboard.writeText(text).then(() => setCopied(true))
            }
          }
        }, 'image/png')
      } catch (err) {
        console.error('Failed to generate share image', err)
      }
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
          <div className={styles.statNum}>{dictStats.crownCurrentStreak || 0}</div>
          <div className={styles.statLabel}>👑 Streak</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statNum}>{dictStats.crownMaxStreak || 0}</div>
          <div className={styles.statLabel}>Max 👑</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statNum}>{avgGuesses}</div>
          <div className={styles.statLabel}>Avg</div>
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
              <div 
                className={`${styles.distBar} ${count > 0 ? styles.hasData : ''}`}
                style={{ width: `${percent}%` }}
              >
                {count}
              </div>
            </div>
          )
        })}
      </div>

      {isFinished && (
        <div className={styles.footer}>
          <div className={styles.wordReveal}>
            The word was: <strong>{word.toUpperCase()}</strong>
          </div>
          {definition && (
            <div className={styles.definition}>
              <i>{definition}</i>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <Button onClick={handleShare}>
              {copied ? 'Copied to Clipboard!' : 'Share Image'}
            </Button>
            <Button variant="primary" onClick={onPlayAgain}>
              Play Again
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
                Lexi5 <span>{gameState.dictionary}</span>
              </div>
              <div className={styles.shareAttempt}>
                {isCrown && <span style={{marginRight: 4}}>👑</span>}
                {gameState.status === 'won' ? gameState.guesses.length : 'X'}/6
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
                <strong>{word.toUpperCase()}</strong>: {definition.substring(0, 80)}{definition.length > 80 ? '...' : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
