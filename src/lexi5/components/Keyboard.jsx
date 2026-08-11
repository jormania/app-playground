import React, { memo } from 'react'
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
  // Determine letter status based on guesses
  const keyStatuses = {}
  const triedPositions = {} // letter -> set of indices where it was guessed and was 'present' (not correct)
  const correctPositions = {} // letter -> set of indices where it was guessed and was 'correct'
  const allCorrectPositions = new Set()
  
  guesses.forEach(guess => {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i].toUpperCase()
      const isCorrect = word[i].toUpperCase() === letter
      const isPresent = word.toUpperCase().includes(letter)
      
      if (isCorrect) {
        keyStatuses[letter] = 'correct'
        if (!correctPositions[letter]) correctPositions[letter] = new Set()
        correctPositions[letter].add(i)
        allCorrectPositions.add(i)
      } else if (isPresent) {
        if (keyStatuses[letter] !== 'correct') {
          keyStatuses[letter] = 'present'
        }
        if (!triedPositions[letter]) triedPositions[letter] = new Set()
        triedPositions[letter].add(i)
      } else if (!isPresent && !keyStatuses[letter]) {
        keyStatuses[letter] = 'absent'
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
