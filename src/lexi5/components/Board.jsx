import React, { memo } from 'react'
import { scoreGuess } from '../lib/score'
import styles from './Board.module.css'

// Spoken form of a tile's colour. The grid is otherwise colour-only, which reaches a
// screen reader as five unlabelled letters.
const TILE_STATUS_LABEL = {
  correct: 'correct',
  present: 'in the word but the wrong spot',
  absent: 'not in the word',
}

export const Board = memo(function Board({ guesses, currentGuess, word, status, invalidGuess }) {
  const empties = guesses.length < 6 ? Array.from({ length: 5 - guesses.length }) : []

  return (
    <div className={styles.board} role="group" aria-label="Guess grid">
      {guesses.map((guess, i) => (
        <Row
          key={i}
          rowNumber={i + 1}
          guess={guess}
          word={word}
          isSubmitted={true}
          isWinningRow={status === 'won' && i === guesses.length - 1}
        />
      ))}
      {guesses.length < 6 && (
        <Row
          rowNumber={guesses.length + 1}
          guess={currentGuess}
          word={word}
          isSubmitted={false}
          isInvalid={invalidGuess}
        />
      )}
      {empties.map((_, i) => (
        <Row key={`empty-${i}`} rowNumber={guesses.length + 2 + i} guess="" word={word} isSubmitted={false} />
      ))}
    </div>
  )
})

function Row({ guess, word, isSubmitted, isInvalid, isWinningRow, rowNumber }) {
  const tiles = Array.from({ length: 5 })

  // Shared with the keyboard and the share card — see lib/score.js.
  const statuses = isSubmitted ? scoreGuess(guess, word) : Array(5).fill('absent')

  // One label for the whole submitted row, rather than five separately-focusable tiles:
  // a screen reader reads "Row 1: C correct, R not in the word, ..." as a single unit,
  // which is how the row is actually understood.
  const rowLabel = isSubmitted
    ? `Row ${rowNumber}: ${guess.split('').map((c, i) => `${c.toUpperCase()} ${TILE_STATUS_LABEL[statuses[i]]}`).join(', ')}`
    : undefined

  return (
    <div
      className={`${styles.row} ${isInvalid ? styles.shake : ''} ${isWinningRow ? styles.dance : ''}`}
      role={isSubmitted ? 'group' : undefined}
      aria-label={rowLabel}
    >
      {tiles.map((_, i) => {
        const char = guess[i] || ''
        const tileStatus = isSubmitted ? statuses[i] : (char ? 'tbd' : 'empty')

        return (
          <div
            key={i}
            // The row above carries the spoken version; the individual tiles would
            // otherwise be read again as bare letters with no status.
            aria-hidden={isSubmitted ? 'true' : undefined}
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
