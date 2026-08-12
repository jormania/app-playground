import React, { useState, useEffect, useMemo, useId } from 'react'
import { Modal } from '../../ds'
import {
  getWord,
  hasCustomDictionary,
  getCustomDictionarySize,
  BUILTIN_DICTIONARY_ORDER,
  DICTIONARY_SIZES,
  DICTIONARY_LABELS,
  wasGameWon,
  getServedWord,
  loadDictionary,
  isDictionaryLoaded
} from '../lib/gameState'
import styles from './Archive.module.css'

export function Archive({ open, onClose, currentDictionary }) {
  const [dict, setDict] = useState(currentDictionary)
  const archiveSelectId = useId()

  // Sync dictionary selection when modal opens or currentDictionary changes externally
  useEffect(() => {
    if (open) {
      setDict(currentDictionary)
    }
  }, [open, currentDictionary])

  const [ready, setReady] = useState(() => isDictionaryLoaded(currentDictionary))

  // The Archive is the one place that reads a dictionary the player isn't currently
  // playing, so it fetches on selection rather than assuming the list is in memory.
  useEffect(() => {
    if (isDictionaryLoaded(dict)) { setReady(true); return undefined }
    let cancelled = false
    setReady(false)
    loadDictionary(dict).then(() => { if (!cancelled) setReady(true) }).catch(() => {})
    return () => { cancelled = true }
  }, [dict])

  const hasCustomDict = hasCustomDictionary()

  const pastDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      // i = 0 is yesterday, i = 1 is the day before, etc.
      d.setDate(d.getDate() - (i + 1))
      return d.toDateString()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="Daily Word Archive">
      <div className={styles.archiveList}>
        <div className={styles.dictionarySection}>
          <label className={styles.dictionaryLabel} htmlFor={archiveSelectId}>Select Dictionary</label>
          <div className={styles.selectWrapper}>
            <select
              id={archiveSelectId}
              value={dict}
              onChange={e => setDict(e.target.value)}
              className={styles.dropdown}
            >
              {BUILTIN_DICTIONARY_ORDER.map(key => (
                <option key={key} value={key}>
                  {DICTIONARY_LABELS[key]} ({DICTIONARY_SIZES[key].toLocaleString()} words)
                </option>
              ))}
              <option value="custom" disabled={!hasCustomDict}>
                {DICTIONARY_LABELS.custom}{hasCustomDict ? ` (${getCustomDictionarySize().toLocaleString()} words)` : ' — curate one in Settings first'}
              </option>
            </select>
          </div>
        </div>

        {dict === 'custom' && (
          <p className={styles.archiveNote}>
            Curated lists only have history from the days you actually played them — re-curating
            replaces the list, so earlier days can't be reconstructed.
          </p>
        )}

        <div className={styles.daysList}>
          {!ready && <p className={styles.archiveNote}>Loading word list…</p>}
          {ready && pastDays.map(dateString => {
            // For Custom, only a recorded answer is trustworthy: re-curating replaces the
            // list, so recomputing would show words that were never that day's answer.
            // The built-ins never change, so deriving them is still correct.
            const recorded = getServedWord(dict, dateString)
            const word = dict === 'custom' ? recorded : getWord(dict, dateString, 0)
            const isWon = wasGameWon(dict, dateString)
            const dateObj = new Date(dateString)
            const formattedDate = dateObj.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })
            
            return (
              <div key={dateString} className={styles.dayRow}>
                <div className={styles.dayDate}>{formattedDate}</div>
                <div className={`${styles.dayWord} ${isWon ? styles.dayWordWon : ''}`.trim()}>
                  {word ? word.toUpperCase() : <span className={styles.dayWordUnknown}>not recorded</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
