import { useState } from 'react'
import { ModePicker } from './components/ModePicker'
import { PresetSetup } from './components/PresetSetup'
import { CustomSetup } from './components/CustomSetup'
import { Player } from './components/Player'
import { MODES } from './lib/modes'
import { loadActiveSession, clearActiveSession } from './lib/storage'
import styles from './App.module.css'

export default function App() {
  // If a practice was left running when the app closed, pick it back up.
  const [resume] = useState(() => loadActiveSession())

  const [view, setView] = useState(() => (resume ? 'player' : 'home'))
  const [modeId, setModeId] = useState(() => resume?.modeId ?? null)
  const [segments, setSegments] = useState(() => resume?.segments ?? [])
  // A key that changes each session, so the Player (and its engine) remounts clean.
  const [sessionKey, setSessionKey] = useState(0)

  const mode = modeId ? MODES[modeId] : null

  function handleSelectMode(id) {
    setModeId(id)
    setView('setup')
  }

  function handleStart(builtSegments) {
    setSegments(builtSegments)
    setSessionKey((k) => k + 1)
    setView('player')
  }

  function handleExit() {
    clearActiveSession()
    setView('home')
    setModeId(null)
    setSegments([])
  }

  const grad = mode ? mode.grad : 'home'

  let screen
  if (view === 'home') {
    screen = <ModePicker onSelect={handleSelectMode} />
  } else if (view === 'setup') {
    const onBack = () => setView('home')
    screen = mode.isCustom ? (
      <CustomSetup onStart={handleStart} onBack={onBack} />
    ) : (
      <PresetSetup mode={mode} onStart={handleStart} onBack={onBack} />
    )
  } else {
    screen = (
      <Player
        key={sessionKey}
        mode={mode}
        segments={segments}
        resumeFrom={view === 'player' && resume && sessionKey === 0 ? resume : null}
        onExit={handleExit}
      />
    )
  }

  return (
    <div className={`${styles.shell} ${styles[grad] ?? styles.home}`} data-grad={grad}>
      {screen}
    </div>
  )
}
