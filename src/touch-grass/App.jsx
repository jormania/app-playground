import { useState, useEffect } from 'react'
import DeparturePanel from './DeparturePanel.jsx'
import OutPanel from './OutPanel.jsx'
import ResultPanel from './ResultPanel.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import GeneratingPanel from './GeneratingPanel.jsx'
import ReliquaryPanel from './ReliquaryPanel.jsx'
import TarotCard from './TarotCard.jsx'
import Stage from './Stage.jsx'
import { useAmbientSound } from './useAmbientSound.js'
import { useDailyCall } from './useDailyCall.js'
import { useWorld } from './world.jsx'
import { rollTier, generateDiscovery } from './engine.js'

const STORAGE_KEY = 'tg-react-state'
const API_KEY_STORAGE = 'tg-react-apikey'
const SOUND_STORAGE = 'tg-react-sound'
const SIGNS_STORAGE = 'tg-react-signs'
const MOTION_STORAGE = 'tg-react-motion'
const CALL_STORAGE = 'tg-react-call'
const HISTORY_STORAGE = 'tg-react-history'
const HISTORY_CAP = 300

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      // a generation that was interrupted by a reload would be stuck forever —
      // fall back to "out" so the walker can simply return again
      if (s.status === 'generating') return { ...s, status: 'out', pendingTier: null }
      return s
    }
  } catch (_) {}
  return { status: 'idle', departedAt: null, lastWalk: null, pendingTier: null }
}

function loadApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || ''
}

function loadSound() {
  return localStorage.getItem(SOUND_STORAGE) !== '0' // default on
}

function loadSigns() {
  return localStorage.getItem(SIGNS_STORAGE) !== '0' // default on
}

function loadMotion() {
  return localStorage.getItem(MOTION_STORAGE) !== '0' // default on
}

function loadCall() {
  return localStorage.getItem(CALL_STORAGE) !== '0' // default on
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE)
    if (raw) {
      const h = JSON.parse(raw)
      if (Array.isArray(h)) return h
    }
  } catch (_) {}
  return []
}

export default function App() {
  const [state, setState] = useState(loadState)
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [soundOn, setSoundOn] = useState(loadSound)
  const [signsOn, setSignsOn] = useState(loadSigns)
  const [motionOn, setMotionOn] = useState(loadMotion)
  const [callOn, setCallOn] = useState(loadCall)
  const [history, setHistory] = useState(loadHistory)
  const [showSettings, setShowSettings] = useState(false)
  const [showReliquary, setShowReliquary] = useState(false)
  const [showDeparture, setShowDeparture] = useState(false)
  const [departureKey, setDepartureKey] = useState(0)

  const { reveal: playReveal, depart: playDepart } = useAmbientSound(soundOn)
  const world = useWorld()
  useDailyCall(callOn, world.coords, history)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (_) {}
  }, [state])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE, JSON.stringify(history))
    } catch (_) {}
  }, [history])

  function startWalk() {
    setShowDeparture(false)
    setState(prev => ({ ...prev, status: 'out', departedAt: Date.now(), pendingTier: null }))
    playDepart()
  }

  async function returnFromWalk() {
    const durationMinutes = (Date.now() - state.departedAt) / 60000
    const tier = rollTier(durationMinutes)
    setState(prev => ({ ...prev, status: 'generating', pendingTier: tier }))
    const ctx = { timeOfDay: world.timeOfDay, season: world.season, weather: world.weather, moon: world.moon, coords: world.coords, biome: world.biome, moments: world.moments }
    const { discovery, isStatic, apiAttempted } = await generateDiscovery(tier, durationMinutes, apiKey, ctx)
    const walk = { ts: Date.now(), durationMinutes, tier, discovery, isStatic, apiAttempted }
    setState(prev => ({ ...prev, status: 'idle', departedAt: null, pendingTier: null, lastWalk: walk }))
    setHistory(prev => [walk, ...prev].slice(0, HISTORY_CAP))
    playReveal()
  }

  function saveApiKey(key) {
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
    setDepartureKey(k => k + 1)
    setShowSettings(false)
  }

  function toggleSound() {
    setSoundOn(prev => {
      const next = !prev
      localStorage.setItem(SOUND_STORAGE, next ? '1' : '0')
      return next
    })
  }

  function toggleSigns() {
    setSignsOn(prev => {
      const next = !prev
      localStorage.setItem(SIGNS_STORAGE, next ? '1' : '0')
      return next
    })
  }

  function toggleMotion() {
    setMotionOn(prev => {
      const next = !prev
      localStorage.setItem(MOTION_STORAGE, next ? '1' : '0')
      return next
    })
  }

  function toggleCall() {
    setCallOn(prev => {
      const next = !prev
      localStorage.setItem(CALL_STORAGE, next ? '1' : '0')
      return next
    })
  }

  function clearAllHistory() { setHistory([]) }
  function clearLastHistory() { setHistory(prev => prev.slice(1)) }

  const { status, departedAt, lastWalk } = state

  let panel, title
  if (showSettings) {
    title = 'The Keeper'
    panel = <SettingsPanel currentKey={apiKey} onSave={saveApiKey} soundOn={soundOn} onToggleSound={toggleSound} signsOn={signsOn} onToggleSigns={toggleSigns} motionOn={motionOn} onToggleMotion={toggleMotion} callOn={callOn} onToggleCall={toggleCall} onClose={() => { setShowSettings(false); setDepartureKey(k => k + 1) }} />
  } else if (showReliquary) {
    title = 'The Reliquary'
    panel = <ReliquaryPanel history={history} onClearLast={clearLastHistory} onClearAll={clearAllHistory} onClose={() => { setShowReliquary(false); setDepartureKey(k => k + 1) }} />
  } else if (status === 'generating') {
    title = 'The Omen'
    panel = <GeneratingPanel tier={state.pendingTier} />
  } else if (status === 'out') {
    title = 'The Wandering'
    panel = <OutPanel departedAt={departedAt} onReturn={returnFromWalk} />
  } else if (lastWalk && !showDeparture) {
    title = 'The Discovery'
    panel = <ResultPanel lastWalk={lastWalk} onGoBack={() => { setShowDeparture(true); setDepartureKey(k => k + 1) }} />
  } else {
    title = 'The Threshold'
    panel = <DeparturePanel key={departureKey} onDepart={startWalk} apiKey={apiKey} />
  }

  return (
    <>
      <Stage />
      <TarotCard
        title={title}
        showSigns={signsOn}
        motionOn={motionOn}
        fill={showReliquary}
        onSettings={(showSettings || showReliquary) ? null : () => setShowSettings(true)}
        onReliquary={(showSettings || showReliquary) ? null : () => setShowReliquary(true)}
      >{panel}</TarotCard>
    </>
  )
}
