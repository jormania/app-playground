import React, { useState, useEffect, useCallback } from 'react'
import { useConfig } from './lib/config'
import { useGameState, getWord, isValidGuess } from './lib/gameState'
import { hapticTap, hapticError, hapticWin } from './lib/haptics'
import { Board } from './components/Board'
import { Keyboard } from './components/Keyboard'
import { Settings } from './components/Settings'
import { Stats } from './components/Stats'
import { IconButton, Modal, Button } from '../ds'
import { HelpCircle, Flag, BarChart2, Settings as SettingsIcon, Share2 } from 'lucide-react'
import confetti from 'canvas-confetti'
import styles from './App.module.css'

export function App() {
  const { config, updateConfig } = useConfig()
  
  // Extract seed from URL if present
  const [urlSeed] = useState(() => new URLSearchParams(window.location.search).get('seed'))
  
  const { gameState, stats, addGuess, startNextGame, forfeitGame, resetStats } = useGameState(config.difficulty, config.dictionary, urlSeed)
  
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
    setTimeout(() => setToast(null), 2000)
  }

  const handleShareBoard = () => {
    const seedStr = encodeURIComponent(btoa(`${gameState.date}|${gameState.iteration}|${gameState.dictionary}`))
    const shareUrl = `${window.location.origin}${window.location.pathname}?seed=${seedStr}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Share link copied to clipboard!')
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
      setInvalidGuess(true)
      setTimeout(() => setInvalidGuess(false), 600)
      return
    }
    
    if (!isValidGuess(currentGuess)) {
      showToast('Not in word list')
      hapticError()
      setInvalidGuess(true)
      setTimeout(() => setInvalidGuess(false), 600)
      return
    }

    // Hard Mode validation
    if (gameState.difficulty === 'hard' && gameState.guesses.length > 0) {
      const lastGuess = gameState.guesses[gameState.guesses.length - 1]
      
      // Calculate exact hints for the last guess to enforce rules
      const wordLetters = word.split('')
      const lastGuessLetters = lastGuess.split('')
      
      const greens = Array(5).fill(false)
      const targetCounts = {}
      for (const char of wordLetters) {
        targetCounts[char] = (targetCounts[char] || 0) + 1
      }
      
      // Step 1: Enforce greens
      for (let i = 0; i < 5; i++) {
        if (lastGuess[i] === word[i]) {
          if (currentGuess[i] !== lastGuess[i]) {
            showToast(`Must use ${lastGuess[i].toUpperCase()} in position ${i + 1}`)
            hapticError()
            setInvalidGuess(true)
            setTimeout(() => setInvalidGuess(false), 600)
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
        if (currentGuess[i] !== word[i]) { // only non-green count towards satisfying yellows
          currentCounts[currentGuess[i]] = (currentCounts[currentGuess[i]] || 0) + 1
        }
      }
      
      for (const [char, count] of Object.entries(requiredYellows)) {
        if ((currentCounts[char] || 0) < count) {
          showToast(`Guess must contain ${char.toUpperCase()}`)
          hapticError()
          setInvalidGuess(true)
          setTimeout(() => setInvalidGuess(false), 600)
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
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.leftActions}>
          <IconButton onClick={() => window.open('/lexi5-guide.html', '_blank')} title="How to play">
            <HelpCircle size={20} />
          </IconButton>
          {gameState.status === 'playing' && gameState.guesses.length > 0 && (
            <IconButton onClick={() => setShowForfeitModal(true)} title="Give up">
              <Flag size={20} />
            </IconButton>
          )}
        </div>
        <h1 className={styles.title}>Lexi5</h1>
        <div className={styles.rightActions}>
          <IconButton onClick={handleShareBoard} title="Share game link">
            <Share2 size={20} />
          </IconButton>
          <IconButton onClick={() => setShowStats(true)} title="Statistics">
            <BarChart2 size={20} />
          </IconButton>
          <IconButton onClick={() => setShowSettings(true)} title="Settings">
            <SettingsIcon size={20} />
          </IconButton>
        </div>
      </header>

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
        onClose={() => setShowSettings(false)} 
        config={config} 
        updateConfig={updateConfig}
        resetStats={resetStats}
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
      />
      
      <Modal open={showForfeitModal} onClose={() => setShowForfeitModal(false)} title="Give Up?">
        <p style={{textAlign: 'center', marginBottom: '24px', fontSize: '1.1rem'}}>
          Are you sure you want to forfeit this game? 
          <br />
          <span style={{color: 'var(--text-subtle)', fontSize: '0.9rem'}}>This counts as a loss.</span>
        </p>
        <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
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
