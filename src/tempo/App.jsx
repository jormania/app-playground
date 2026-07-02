import { useState } from 'react'
import { ModePicker } from './components/ModePicker'
import { RoundsSetup } from './components/RoundsSetup'
import { CyclesSetup } from './components/CyclesSetup'
import { CustomSetup } from './components/CustomSetup'
import { Player } from './components/Player'

export default function App() {
  const [view, setView] = useState('home') // 'home' | 'setup' | 'player'
  const [mode, setMode] = useState(null)
  const [segments, setSegments] = useState([])

  function handleSelectMode(selected) {
    setMode(selected)
    setView('setup')
  }

  function handleStart(builtSegments) {
    setSegments(builtSegments)
    setView('player')
  }

  function handleExit() {
    setView('home')
    setMode(null)
    setSegments([])
  }

  if (view === 'home') {
    return <ModePicker onSelect={handleSelectMode} />
  }

  if (view === 'setup') {
    const onBack = () => setView('home')
    if (mode === 'rounds') return <RoundsSetup onStart={handleStart} onBack={onBack} />
    if (mode === 'cycles') return <CyclesSetup onStart={handleStart} onBack={onBack} />
    return <CustomSetup onStart={handleStart} onBack={onBack} />
  }

  // Fresh Player instance per session (view only reaches 'player' after a
  // Start click), so useTimerEngine's internal state always begins clean.
  return <Player segments={segments} onExit={handleExit} />
}
