import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useConfig } from './lib/config'
import { useGameState, getWord, getWordProgress, isValidGuess, hasCustomDictionary, DICTIONARY_LABELS } from './lib/gameState'
import { hapticTap, hapticError, hapticWin } from './lib/haptics'
import { useWakeLock } from '../shared/useWakeLock'
import { Board } from './components/Board'
import { Keyboard } from './components/Keyboard'
import { Settings } from './components/Settings'
import { Stats } from './components/Stats'
import { Archive } from './components/Archive'
import { IconButton, Modal, Button } from '../ds'
import { HelpCircle, Flag, BarChart2, Settings as SettingsIcon, Share2, Calendar } from 'lucide-react'
import confetti from 'canvas-confetti'
import styles from './App.module.css'

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

  const [currentGuess, setCurrentGuess] = useState('')
  const [invalidGuess, setInvalidGuess] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showForfeitModal, setShowForfeitModal] = useState(false)
  const [toast, setToast] = useState(null)
  const [openSettingsToCurate, setOpenSettingsToCurate] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  
  const toastTimeoutRef = useRef(null)
  const shakeTimeoutRef = useRef(null)

  // Keep the screen awake only while an active game is actually on screen — drop
  // back to default behavior the moment any menu/modal covers it, or the game ends.
  useWakeLock(
    gameState.status === 'playing' &&
    !showSettings && !showStats && !showArchive && !showForfeitModal
  )

  // Show stats automatically when game ends, trigger confetti, update favicon
  useEffect(() => {
    if (gameState.status !== 'playing') {
      const timer = setTimeout(() => setShowStats(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [gameState.status])

  useEffect(() => {
    if (gameState.status === 'won') {
      const timer = setTimeout(() => {
        hapticWin()
        if (gameState.iteration === 0) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
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

  const showToast = (msg) => {
    setToast(msg)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2000)
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
  }, [gameState.dictionary, gameState.date, gameState.iteration])

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

  const handleDictionaryChange = (newDictionary) => {
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

    // Hard Mode validation
    if (gameState.difficulty === 'hard' && gameState.guesses.length > 0) {
      const lastGuess = gameState.guesses[gameState.guesses.length - 1].toLowerCase()
      const currentGuessLower = currentGuess.toLowerCase()
      const targetWord = word.toLowerCase()
      
      // Calculate exact hints for the last guess to enforce rules
      const wordLetters = targetWord.split('')

      const greens = Array(5).fill(false)
      const targetCounts = {}
      for (const char of wordLetters) {
        targetCounts[char] = (targetCounts[char] || 0) + 1
      }
      
      // Step 1: Enforce greens
      for (let i = 0; i < 5; i++) {
        if (lastGuess[i] === targetWord[i]) {
          if (currentGuessLower[i] !== lastGuess[i]) {
            showToast(`Must use ${lastGuess[i].toUpperCase()} in position ${i + 1}`)
            hapticError()
            triggerShake()
            return
          }
          greens[i] = true
          targetCounts[lastGuess[i]] -= 1
        }
      }
      
      // Step 2: Calculate yellows required
      const requiredYellows = {}
      for (let i = 0; i < 5; i++) {
        if (!greens[i] && targetCounts[lastGuess[i]] > 0) {
          requiredYellows[lastGuess[i]] = (requiredYellows[lastGuess[i]] || 0) + 1
          targetCounts[lastGuess[i]] -= 1
        }
      }
      
      // Step 3: Enforce yellows
      const currentCounts = {}
      for (let i = 0; i < 5; i++) {
        if (lastGuess[i] !== targetWord[i]) { // only non-green positions from lastGuess can satisfy its yellows
          currentCounts[currentGuessLower[i]] = (currentCounts[currentGuessLower[i]] || 0) + 1
        }
      }
      
      for (const [char, count] of Object.entries(requiredYellows)) {
        if ((currentCounts[char] || 0) < count) {
          showToast(`Guess must contain ${char.toUpperCase()}`)
          hapticError()
          triggerShake()
          return
        }
      }
    }

    addGuess(currentGuess, word)
    setCurrentGuess('')
  }, [currentGuess, gameState, word, addGuess])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Enter') onEnter()
      else if (e.key === 'Backspace') onDelete()
      else if (/^[a-zA-Z]$/.test(e.key)) onChar(e.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEnter, onDelete, onChar])

  return (
    <div className={styles.app} data-high-contrast={config.highContrast ? "true" : undefined}>
      <header className={styles.header}>
        <div className={styles.leftActions}>
          <IconButton size="sm" onClick={() => window.open('/lexi5-guide.html', '_blank')} title="How to play">
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
        <h1 className={styles.title}>Lexi5</h1>
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
          <Button size="sm" onClick={handleOpenCurate}>Refresh Now</Button>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.boardContainer}>
          <Board 
            guesses={gameState.guesses} 
            currentGuess={currentGuess} 
            word={word}
            status={gameState.status}
            invalidGuess={invalidGuess}
          />
        </div>
        
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

      {toast && (
        <div className={styles.toast}>
          {toast}
        </div>
      )}

      <Settings
        open={showSettings}
        onClose={handleCloseSettings}
        config={config}
        updateConfig={updateConfig}
        onDictionaryChange={handleDictionaryChange}
        resetStats={resetStats}
        gameState={gameState}
        onToast={showToast}
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
      />

      <Archive
        open={showArchive}
        onClose={() => setShowArchive(false)}
        currentDictionary={gameState.dictionary}
      />

      <Modal open={showForfeitModal} onClose={() => setShowForfeitModal(false)} title="Give Up?">
        <p className={styles.forfeitText}>
          Are you sure you want to forfeit this game?
          <br />
          <span className={styles.forfeitSubtext}>This counts as a loss.</span>
        </p>
        <div className={styles.forfeitActions}>
          <Button variant="ghost" onClick={() => setShowForfeitModal(false)}>
            Nevermind
          </Button>
          <Button variant="primary" onClick={() => {
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
