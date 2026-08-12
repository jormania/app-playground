import React, { useState, useEffect, useMemo, useId } from 'react'
import { Modal } from '../../ds'
import { ConfirmModal } from '../../ds/components/Dialogs'
import { Play, Eye } from 'lucide-react'
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

export function Archive({ open, onClose, currentDictionary, gameState }) {
  const [dict, setDict] = useState(currentDictionary)
  const [revealed, setRevealed] = useState(() => new Set())
  const [pendingPlay, setPendingPlay] = useState(null)
  const archiveSelectId = useId()

  // Sync dictionary selection when modal opens or currentDictionary changes externally
  useEffect(() => {
    if (open) {
      setDict(currentDictionary)
      // Yesterday's answer shouldn't still be on screen next time this opens.
      setRevealed(new Set())
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

  // Starting an archived day replaces the single stored game, so a game with guesses in it
  // is worth protecting behind a confirmation rather than silently discarding.
  const gameInProgress = !!(gameState && gameState.status === 'playing' && gameState.guesses.length > 0)

  const startArchivedGame = (dateString) => {
    // Reuses the existing seed mechanism — the same encoding a shared link uses, so
    // "play this day" and "play the link someone sent me" are one code path.
    const seed = encodeURIComponent(btoa(`${dateString}|0|${dict}`))
    window.location.href = `${window.location.origin}${window.location.pathname}?seed=${seed}`
  }

  const requestPlay = (dateString) => {
    if (gameInProgress) setPendingPlay(dateString)
    else startArchivedGame(dateString)
  }

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
            replaces the list, so earlier days can&rsquo;t be reconstructed.
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

            // Words you've already beaten are yours to see. Everything else stays hidden
            // until asked for — this list used to hand out the answer to every puzzle you
            // hadn't played yet, which is the opposite of what an archive should do.
            const showWord = !word || isWon || revealed.has(dateString)

            return (
              <div key={dateString} className={styles.dayRow}>
                <div className={styles.dayDate}>{formattedDate}</div>

                <div className={`${styles.dayWord} ${isWon ? styles.dayWordWon : ''}`.trim()}>
                  {!word
                    ? <span className={styles.dayWordUnknown}>not recorded</span>
                    : showWord
                      ? word.toUpperCase()
                      : <span className={styles.hidden} aria-hidden="true">•••••</span>}
                </div>

                <div className={styles.dayActions}>
                  {word && !showWord && (
                    <button
                      type="button"
                      className={styles.iconAction}
                      onClick={() => setRevealed(prev => new Set(prev).add(dateString))}
                      title={`Reveal the word for ${formattedDate}`}
                      aria-label={`Reveal the word for ${formattedDate}`}
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  {word && (
                    <button
                      type="button"
                      className={styles.iconAction}
                      onClick={() => requestPlay(dateString)}
                      title={isWon ? `Replay ${formattedDate}` : `Play ${formattedDate}`}
                      aria-label={isWon ? `Replay ${formattedDate}` : `Play ${formattedDate}`}
                    >
                      <Play size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!pendingPlay}
        onCancel={() => setPendingPlay(null)}
        title="Leave your current game?"
        message="You have a game in progress. Playing an earlier day replaces it — your current guesses won't be kept."
        confirmText="Play earlier day"
        variant="danger"
        onConfirm={() => {
          const target = pendingPlay
          setPendingPlay(null)
          startArchivedGame(target)
        }}
      />
    </Modal>
  )
}
