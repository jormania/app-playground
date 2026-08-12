import React, { memo } from 'react'
import { scoreGuess, keyStatuses as computeKeyStatuses } from '../lib/score'
import styles from './Keyboard.module.css'

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace']
]

// Spoken alternative to the key's color-only status — a screen reader can't see the
// green/yellow/gray background, so it needs to be told outright.
const STATUS_LABEL = {
  correct: ', correct',
  present: ', present elsewhere',
  absent: ', absent',
  tbd: ''
}

export const Keyboard = memo(function Keyboard({ guesses, word, onChar, onDelete, onEnter, smartKeyboard }) {
  // Per-letter key colour, folded from the same scoring the board uses (lib/score.js)
  // so a key can never claim a status the board disagrees with.
  const keyStatuses = computeKeyStatuses(guesses, word)

  // Positional memory for the Smart Keyboard dots, which needs per-tile detail rather
  // than the per-letter fold above.
  const triedPositions = {} // letter -> indices where it scored 'present'
  const correctPositions = {} // letter -> indices where it scored 'correct'
  const allCorrectPositions = new Set()

  guesses.forEach(guess => {
    const statuses = scoreGuess(guess, word)
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i].toUpperCase()
      if (statuses[i] === 'correct') {
        if (!correctPositions[letter]) correctPositions[letter] = new Set()
        correctPositions[letter].add(i)
        allCorrectPositions.add(i)
      } else if (statuses[i] === 'present') {
        if (!triedPositions[letter]) triedPositions[letter] = new Set()
        triedPositions[letter].add(i)
      }
    }
  })

  return (
    <div className={styles.keyboard}>
      {ROWS.map((row, i) => (
        <div key={i} className={styles.row}>
          {row.map(key => {
            const isEnter = key === 'Enter'
            const isDel = key === 'Backspace'
            const status = keyStatuses[key] || 'tbd'
            
            return (
              <button
                key={key}
                className={`${styles.key} ${isEnter || isDel ? styles.actionKey : ''} ${styles[status]}`}
                aria-label={isEnter || isDel ? undefined : `${key}${STATUS_LABEL[status]}`}
                onClick={() => {
                  if (isEnter) onEnter()
                  else if (isDel) onDelete()
                  else onChar(key)
                }}
              >
                {(smartKeyboard && (status === 'present' || status === 'correct') && (triedPositions[key] || correctPositions[key])) ? (
                  // Decorative positional hint — its information (which slots this letter has
                  // already been tried/confirmed in) isn't translated to text; hide it from
                  // assistive tech rather than leaving it unexplained.
                  <div className={styles.smartDots} aria-hidden="true">
                    {[0,1,2,3,4].map(idx => {
                      const isCorrect = correctPositions[key]?.has(idx)
                      const isTried = triedPositions[key]?.has(idx) || (allCorrectPositions.has(idx) && !isCorrect)
                      return (
                        <span
                          key={idx}
                          className={`${styles.dot} ${isCorrect ? styles.dotCorrect : (isTried ? styles.dotTried : '')}`}
                        />
                      )
                    })}
                  </div>
                ) : null}
                {isDel ? 'DEL' : key}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
})
