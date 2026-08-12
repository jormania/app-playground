import React, { memo } from 'react'
import { scoreGuess } from '../lib/score'
import styles from './Board.module.css'

export const Board = memo(function Board({ guesses, currentGuess, word, status, invalidGuess }) {
  const empties = guesses.length < 6 ? Array.from({ length: 5 - guesses.length }) : []
  
  return (
    <div className={styles.board}>
      {guesses.map((guess, i) => (
        <Row 
          key={i} 
          guess={guess} 
          word={word} 
          isSubmitted={true} 
          isWinningRow={status === 'won' && i === guesses.length - 1}
        />
      ))}
      {guesses.length < 6 && (
        <Row 
          guess={currentGuess} 
          word={word} 
          isSubmitted={false} 
          isInvalid={invalidGuess} 
        />
      )}
      {empties.map((_, i) => (
        <Row key={`empty-${i}`} guess="" word={word} isSubmitted={false} />
      ))}
    </div>
  )
})

function Row({ guess, word, isSubmitted, isInvalid, isWinningRow }) {
  const tiles = Array.from({ length: 5 })
  
  // Shared with the keyboard and the share card — see lib/score.js.
  const statuses = isSubmitted ? scoreGuess(guess, word) : Array(5).fill('absent')

  return (
    <div className={`${styles.row} ${isInvalid ? styles.shake : ''} ${isWinningRow ? styles.dance : ''}`}>
      {tiles.map((_, i) => {
        const char = guess[i] || ''
        const tileStatus = isSubmitted ? statuses[i] : (char ? 'tbd' : 'empty')
        
        return (
          <div 
            key={i} 
            className={`${styles.tile} ${styles[tileStatus]} ${char && !isSubmitted ? styles.filled : ''}`}
            style={{ 
              animationDelay: isWinningRow 
                ? `${i * 0.25}s, ${1.6 + (i * 0.1)}s` 
                : (isSubmitted ? `${i * 0.25}s` : '0s') 
            }}
          >
            {char}
          </div>
        )
      })}
    </div>
  )
}
