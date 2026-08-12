import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useConfig } from './lib/config'
import { useGameState, getWord, getWordProgress, isValidGuess, hasCustomDictionary, recordServedWord, loadDictionary, isDictionaryLoaded, getDayRecord, describeDay, DICTIONARY_LABELS } from './lib/gameState'
import { hapticTap, hapticError, hapticWin } from './lib/haptics'
import { validateHardMode } from './lib/hardMode'
import { useToastQueue } from './lib/useToastQueue'
import { applyUndo } from './lib/undo'
import { msUntilNextWord, formatCountdown } from './lib/dailyCountdown'
import { buildShareText, shareOrCopy } from './lib/share'
import { readJson, writeJson } from '../shared/storage'
import { useWakeLock } from '../shared/useWakeLock'
import { Board } from './components/Board'
import { Keyboard } from './components/Keyboard'
import { Settings } from './components/Settings'
import { Stats } from './components/Stats'
import { Archive } from './components/Archive'
import { HowToPlay } from './components/HowToPlay'
import { IconButton, Modal, Button } from '../ds'
import { HelpCircle, Flag, BarChart2, Settings as SettingsIcon, Share2, Calendar, X } from 'lucide-react'
import styles from './App.module.css'

const SEEN_GUIDE_KEY = 'lexi5_seen_guide'

// A full-board bounce followed by a particle burst is close to a worst case for anyone
// sensitive to motion, so the celebration is skipped entirely when the OS asks for less.
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function App() {
  const { config, updateConfig } = useConfig()
  
  // Extract seed from URL if present
  const [urlSeed] = useState(() => new URLSearchParams(window.location.search).get('seed'))
  
  const { gameState, stats, addGuess, startNextGame, switchDictionary, forfeitGame, resetStats } = useGameState(config.difficulty, config.dictionary, urlSeed)
  
  const [word, setWord] = useState(() => getWord(gameState.dictionary, gameState.date, gameState.iteration))
  
  // Re-calculate the word if the iteration or dictionary changes in the game state
  useEffect(() => {
    setWord(getWord(gameState.dictionary, gameState.date, gameState.iteration))
  }, [gameState.dictionary, gameState.date, gameState.iteration])

  // Remember what Custom actually served today, so the Archive can report history that
  // survives a re-curation instead of recomputing it against whatever list exists now.
  useEffect(() => {
    if (gameState.iteration !== 0) return
    recordServedWord(gameState.dictionary, gameState.date, word)
  }, [gameState.dictionary, gameState.date, gameState.iteration, word])

  const [currentGuess, setCurrentGuess] = useState('')
  const [invalidGuess, setInvalidGuess] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showForfeitModal, setShowForfeitModal] = useState(false)
  const [openSettingsToCurate, setOpenSettingsToCurate] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [showResultBar, setShowResultBar] = useState(false)
  // First run shows the guide unprompted. Lexi5 has four dictionaries, Hard Mode, Crown vs
  // Endless and AI curation — none of it discoverable from an empty grid.
  const [showHowTo, setShowHowTo] = useState(() => !readJson(SEEN_GUIDE_KEY, false))
  const [isFirstRun] = useState(() => !readJson(SEEN_GUIDE_KEY, false))
  const [hintUsed, setHintUsed] = useState(false)
  const [hint, setHint] = useState(null)
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilNextWord()))
  // Re-read rather than held: useGameState writes it when a game ends, so the value is
  // only meaningful once the result is in.
  const dayRecord = showResultBar ? getDayRecord(gameState.dictionary, gameState.date) : null
  const daySummary = dayRecord ? describeDay(dayRecord) : null
  // Read on every new round so the header reflects the run you carried into it.
  const todayRun = getDayRecord(gameState.dictionary, gameState.date).run

  const shakeTimeoutRef = useRef(null)
  const { toast, showToast } = useToastQueue()

  // Keep the screen awake only while an active game is actually on screen — drop
  // back to default behavior the moment any menu/modal covers it, or the game ends.
  useWakeLock(
    gameState.status === 'playing' &&
    !showSettings && !showStats && !showArchive && !showForfeitModal
  )

  // A result bar rather than an auto-opening modal. Stats used to open itself 1.5s after
  // the game ended, which landed in the middle of the 1.6s victory dance and covered the
  // finished board before the player had looked at it. The bar appears after the tiles
  // have settled and leaves the choice of when to leave the board to the player.
  useEffect(() => {
    if (gameState.status === 'playing') {
      setShowResultBar(false)
      return undefined
    }
    const timer = setTimeout(() => setShowResultBar(true), prefersReducedMotion() ? 300 : 2200)
    return () => clearTimeout(timer)
  }, [gameState.status])

  useEffect(() => {
    if (gameState.status === 'won') {
      const timer = setTimeout(() => {
        hapticWin()
        if (gameState.iteration === 0 && !prefersReducedMotion()) {
          // Loaded on demand so the confetti library stays off the initial bundle —
          // it can't be needed until a Crown game has actually been won.
          import('canvas-confetti').then(({ default: confetti }) => {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
          }).catch(() => {})
        }
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [gameState.status, gameState.iteration])

  useEffect(() => {
    const link = document.querySelector('link[rel="icon"]')
    if (link) {
      if (gameState.status === 'won') {
        link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23538d4e"/></svg>'
      } else if (gameState.status === 'lost') {
        link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%233a3a3c"/></svg>'
      } else {
        link.href = '/lexi5-icon-192.png'
      }
    }
  }, [gameState.status])

  // Only ticks while there's something to show it on. A minute's resolution is plenty for
  // "come back tomorrow" and avoids re-rendering the app every second.
  useEffect(() => {
    if (!showResultBar || gameState.iteration !== 0) return undefined
    setCountdown(formatCountdown(msUntilNextWord()))
    const id = setInterval(() => setCountdown(formatCountdown(msUntilNextWord())), 30000)
    return () => clearInterval(id)
  }, [showResultBar, gameState.iteration])

  // A new game means a fresh chance to solve it unaided.
  useEffect(() => {
    setHintUsed(false)
    setHint(null)
  }, [gameState.date, gameState.iteration, gameState.dictionary])

  /**
   * Reveals the answer's dictionary definition.
   *
   * The definition was already being fetched for the post-game reveal, so offering it as a
   * deliberate lifeline costs nothing new. Held back until the fourth guess so it can't
   * replace playing, and recorded so the shared result says a hint was used — the score
   * shouldn't quietly claim to be unaided.
   */
  const handleHint = async () => {
    setHintUsed(true)
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      const found = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition
      if (found) setHint(found)
      else showToast("No definition found for this word — you're on your own!")
    } catch {
      showToast("Couldn't fetch a definition — check your connection.")
    }
  }

  const dismissHowTo = () => {
    setShowHowTo(false)
    writeJson(SEEN_GUIDE_KEY, true)
  }

  const triggerShake = () => {
    setInvalidGuess(true)
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)
    shakeTimeoutRef.current = setTimeout(() => setInvalidGuess(false), 600)
  }

  // Let the player know when they've cycled through every word in the list and it's starting over,
  // or give them a heads-up when their custom list is about to run out.
  useEffect(() => {
    const { position, total, justWrapped } = getWordProgress(gameState.dictionary, gameState.date, gameState.iteration)
    if (justWrapped) {
      showToast(`You've played all ${total} words in this list — starting a fresh cycle!`)
    } else if (gameState.dictionary === 'custom' && total > 3) {
      const remaining = total - position
      if (remaining <= 3 && remaining > 0) {
        showToast(`Only ${remaining} word${remaining === 1 ? '' : 's'} remaining in your custom list!`)
      }
    }
  }, [gameState.dictionary, gameState.date, gameState.iteration, showToast])

  // Defensive backstop: a game can end up pointed at 'custom' with no curated list behind
  // it (storage cleared mid-session, or a shared seed link from someone else's custom list).
  // Rather than silently playing Standard words under the 'custom' label, fall back for real.
  useEffect(() => {
    if (gameState.dictionary === 'custom' && !hasCustomDictionary()) {
      switchDictionary('standard')
      updateConfig({ dictionary: 'standard' })
      showToast("Your custom word list isn't available — switched to Standard.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.dictionary])

  const handleDictionaryChange = async (newDictionary) => {
    // The new list has to be in memory before the switch lands, or getWord would resolve
    // against whatever else is loaded and deal a word from the wrong dictionary.
    if (!isDictionaryLoaded(newDictionary)) {
      try {
        await loadDictionary(newDictionary)
      } catch {
        showToast("Couldn't load that dictionary — check your connection and try again.")
        return
      }
    }
    updateConfig({ dictionary: newDictionary })
    switchDictionary(newDictionary)
    showToast(`Switched to ${DICTIONARY_LABELS[newDictionary] || newDictionary} — new word, no penalty!`)
  }

  // Unlike the built-in dictionaries (which just reshuffle silently), Custom needs the
  // player to actually take an action to get fresh words — so once its cycle has wrapped
  // at least once, keep a persistent banner up (not just the one-off toast) until they refresh.
  const customCycleStale = gameState.dictionary === 'custom'
    && getWordProgress('custom', gameState.date, gameState.iteration).cycleNumber >= 1

  const handleOpenCurate = () => {
    setOpenSettingsToCurate(true)
    setShowSettings(true)
  }

  const handleCloseSettings = () => {
    setShowSettings(false)
    setOpenSettingsToCurate(false)
  }

  // Restores whatever the last destructive action snapshotted, then re-reads it. Stats
  // and the game both derive from localStorage, so a reload is the honest way to pick the
  // restored values up everywhere at once rather than threading them back through state.
  const handleUndo = () => {
    const undone = applyUndo()
    if (!undone) {
      showToast('Nothing left to undo.')
      return
    }
    window.location.reload()
  }

  // The same grid the Statistics panel offers, one tap from where the game actually ends.
  const handleShareResult = async () => {
    const seedStr = encodeURIComponent(btoa(`${gameState.date}|${gameState.iteration}|${gameState.dictionary}`))
    const text = buildShareText({
      guesses: gameState.guesses,
      word,
      highContrast: config.highContrast,
      dictionaryLabel: DICTIONARY_LABELS[gameState.dictionary] || gameState.dictionary,
      won: gameState.status === 'won',
      iteration: gameState.iteration,
      hardMode: gameState.difficulty === 'hard',
      hintUsed,
      url: `${window.location.origin}${window.location.pathname}?seed=${seedStr}`,
    })
    const outcome = await shareOrCopy(text)
    if (outcome === 'copied') showToast('Result copied to clipboard!')
    else if (outcome === 'failed') showToast('Could not share or copy — try again.')
  }

  const handleShareBoard = () => {
    const seedStr = encodeURIComponent(btoa(`${gameState.date}|${gameState.iteration}|${gameState.dictionary}`))
    const shareUrl = `${window.location.origin}${window.location.pathname}?seed=${seedStr}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Share link copied to clipboard!')
    }).catch(() => {
      showToast("Couldn't copy the link — try again.")
    })
  }

  const onChar = useCallback((char) => {
    if (gameState.status !== 'playing') return
    if (currentGuess.length < 5) {
      hapticTap()
      setCurrentGuess(prev => prev + char.toLowerCase())
    }
  }, [currentGuess, gameState.status])

  const onDelete = useCallback(() => {
    if (gameState.status !== 'playing') return
    hapticTap()
    setCurrentGuess(prev => prev.slice(0, -1))
  }, [gameState.status])

  const onEnter = useCallback(() => {
    if (gameState.status !== 'playing') return
    if (currentGuess.length !== 5) {
      showToast('Not enough letters')
      hapticError()
      triggerShake()
      return
    }
    
    if (!isValidGuess(currentGuess)) {
      showToast('Not in word list')
      hapticError()
      triggerShake()
      return
    }

    if (gameState.difficulty === 'hard' && gameState.guesses.length > 0) {
      const violation = validateHardMode(currentGuess, gameState.guesses[gameState.guesses.length - 1], word)
      if (violation) {
        showToast(violation)
        hapticError()
        triggerShake()
        return
      }
    }

    addGuess(currentGuess, word)
    setCurrentGuess('')
  }, [currentGuess, gameState, word, addGuess, showToast])

  // The board only owns the keyboard when it's actually the surface in front of the
  // player. Without this, typing into any Settings/curation field also typed onto the
  // board behind the modal — and Enter there submitted a real guess, burning an attempt
  // (and potentially losing the Crown game) while the player was just naming a theme.
  const anyModalOpen = showSettings || showStats || showArchive || showForfeitModal

  useEffect(() => {
    if (anyModalOpen) return undefined

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      // Second, independent guard: never steal keystrokes aimed at a form control,
      // even one rendered outside a modal.
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'Enter') onEnter()
      else if (e.key === 'Backspace') onDelete()
      else if (/^[a-zA-Z]$/.test(e.key)) onChar(e.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEnter, onDelete, onChar, anyModalOpen])

  return (
    <div className={styles.app} data-high-contrast={config.highContrast ? "true" : undefined}>
      <header className={styles.header}>
        <div className={styles.leftActions}>
          <IconButton size="sm" onClick={() => setShowHowTo(true)} title="How to play">
            <HelpCircle size={18} />
          </IconButton>
          {gameState.status === 'playing' && (
            <IconButton size="sm" onClick={() => setShowForfeitModal(true)} title="Give up">
              <Flag size={18} />
            </IconButton>
          )}
          <IconButton size="sm" onClick={() => setShowArchive(true)} title="Daily Word Archive">
            <Calendar size={18} />
          </IconButton>
        </div>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Lexi5</h1>
          {gameState.iteration > 0 && (
            <span className={styles.roundBadge}>
              Endless #{gameState.iteration}
              {todayRun >= 2 && <> · {todayRun} in a row</>}
            </span>
          )}
        </div>
        <div className={styles.rightActions}>
          <IconButton size="sm" onClick={handleShareBoard} title="Share game link">
            <Share2 size={18} />
          </IconButton>
          <IconButton size="sm" onClick={() => setShowStats(true)} title="Statistics">
            <BarChart2 size={18} />
          </IconButton>
          <IconButton size="sm" onClick={() => setShowSettings(true)} title="Settings">
            <SettingsIcon size={18} />
          </IconButton>
        </div>
      </header>

      {customCycleStale && (
        <div className={styles.staleBanner}>
          <span>You've used every word in your Custom list — it's repeating now.</span>
          <div className={styles.staleActions}>
            <Button size="sm" onClick={handleOpenCurate}>Refresh Now</Button>
            {/* The only ways out used to be re-curating (needs an API key) or hunting
                through Settings. A player without a key was stuck with repeats. */}
            <Button size="sm" variant="secondary" onClick={() => handleDictionaryChange('standard')}>
              Use Standard
            </Button>
          </div>
        </div>
      )}

      {showResultBar && !showStats && (
        <div className={styles.resultBar}>
          <span className={styles.resultText}>
            {gameState.status === 'won'
              ? `Solved in ${gameState.guesses.length} of 6 — the word was ${word.toUpperCase()}.`
              : `Out of guesses — the word was ${word.toUpperCase()}.`}
            {gameState.iteration === 0
              ? <span className={styles.resultSub}>Next daily word in {countdown}. Play Again for unlimited practice rounds.</span>
              : <span className={styles.resultSub}>
                  {daySummary ? `${daySummary}. ` : ''}Only the first game each day counts toward your daily streak.
                </span>}
          </span>
          <div className={styles.resultActions}>
            {gameState.guesses.length > 0 && (
              <Button size="sm" variant="secondary" onClick={handleShareResult} title="Share your result grid">
                <Share2 size={14} style={{ marginRight: 4 }} />Share
              </Button>
            )}
            <Button size="sm" onClick={() => setShowStats(true)}>Stats</Button>
            <IconButton size="sm" onClick={() => setShowResultBar(false)} title="Dismiss">
              <X size={16} />
            </IconButton>
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.boardContainer}>
          <div className={styles.boardSizer}>
            <Board
              guesses={gameState.guesses}
              currentGuess={currentGuess}
              word={word}
              status={gameState.status}
              invalidGuess={invalidGuess}
            />
          </div>
        </div>
        
        {gameState.status === 'playing' && gameState.guesses.length >= 4 && !hintUsed && (
          <div className={styles.hintRow}>
            <button type="button" className={styles.hintButton} onClick={handleHint}>
              Stuck? Reveal a definition
            </button>
          </div>
        )}
        {hintUsed && hint && (
          <div className={styles.hintRow}>
            <p className={styles.hintText}><b>Hint:</b> <i>{hint}</i></p>
          </div>
        )}

        <div className={styles.keyboardContainer}>
          <Keyboard 
            guesses={gameState.guesses}
            word={word}
            onChar={onChar}
            onDelete={onDelete}
            onEnter={onEnter}
            smartKeyboard={config.smartKeyboard}
          />
        </div>
      </main>

      {/* Portalled to <body> and stacked above the modal range. `.app` is position:fixed,
          which creates a stacking context in Chrome, so a toast rendered inside it was
          trapped at the app's level in the root stacking order — every modal overlay
          painted straight over it. That hid every toast fired from Settings (curation
          finished, list cleared, dictionary switched), and made the Undo action on a
          destructive change unclickable behind the scrim. */}
      {toast && createPortal(
        <div className={styles.toast} role="status" aria-live="polite" aria-atomic="true">
          <span>{toast.message}</span>
          {toast.action && (
            <button type="button" className={styles.toastAction} onClick={toast.action.onClick}>
              {toast.action.label}
            </button>
          )}
        </div>,
        document.body
      )}

      {/* The result reached screen-reader users only when the Stats modal took focus a
          second and a half later. Announced here as soon as the game ends, and assertive
          because it's the outcome the player was waiting for. */}
      <div className={styles.srOnly} role="status" aria-live="assertive" aria-atomic="true">
        {gameState.status === 'won'
          ? `You won in ${gameState.guesses.length} of 6. The word was ${word.toUpperCase()}.`
          : gameState.status === 'lost'
            ? `Out of guesses. The word was ${word.toUpperCase()}.`
            : ''}
      </div>

      <Settings
        open={showSettings}
        onClose={handleCloseSettings}
        config={config}
        updateConfig={updateConfig}
        onDictionaryChange={handleDictionaryChange}
        resetStats={resetStats}
        gameState={gameState}
        onToast={showToast}
        onUndo={handleUndo}
        initialShowCurate={openSettingsToCurate}
      />

      <Stats
        open={showStats}
        onClose={() => setShowStats(false)}
        stats={stats}
        gameState={gameState}
        word={word}
        onPlayAgain={() => {
          startNextGame(config.difficulty, config.dictionary)
          setShowStats(false)
        }}
        onToast={showToast}
        highContrast={config.highContrast}
        hintUsed={hintUsed}
      />

      <Archive
        open={showArchive}
        onClose={() => setShowArchive(false)}
        currentDictionary={gameState.dictionary}
        gameState={gameState}
      />

      <HowToPlay open={showHowTo} onClose={dismissHowTo} firstRun={isFirstRun} />

      <Modal open={showForfeitModal} onClose={() => setShowForfeitModal(false)} title="Give Up?">
        <p className={styles.forfeitText}>
          Are you sure you want to forfeit this game?
          <br />
          <span className={styles.forfeitSubtext}>This counts as a loss.</span>
        </p>
        <div className={styles.forfeitActions}>
          <Button variant="secondary" onClick={() => setShowForfeitModal(false)}>
            Nevermind
          </Button>
          {/* The destructive choice carries the destructive styling — it used to be
              `primary`, i.e. the recommended-looking button was the irreversible one. */}
          <Button variant="danger" onClick={() => {
            forfeitGame()
            setShowForfeitModal(false)
          }}>
            Yes, Give Up
          </Button>
        </div>
      </Modal>
    </div>
  )
}
