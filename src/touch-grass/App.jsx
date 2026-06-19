import { useState, useEffect } from 'react'
import DeparturePanel from './DeparturePanel.jsx'
import OutPanel from './OutPanel.jsx'
import ResultPanel from './ResultPanel.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import GeneratingPanel from './GeneratingPanel.jsx'
import TarotCard from './TarotCard.jsx'
import { useAmbientSound } from './useAmbientSound.js'
import { rollTier, generateDiscovery } from './engine.js'

const STORAGE_KEY = 'tg-react-state'
const API_KEY_STORAGE = 'tg-react-apikey'
const SOUND_STORAGE = 'tg-react-sound'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return { status: 'idle', departedAt: null, lastWalk: null, pendingTier: null }
}

function loadApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || ''
}

function loadSound() {
  return localStorage.getItem(SOUND_STORAGE) !== '0' // default on
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#e0533a" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="6.5" r="3.7" />
      <circle cx="12" cy="6.5" r="0.7" fill="#e0533a" stroke="none" />
      <line x1="12" y1="10.2" x2="12" y2="20" />
      <line x1="12" y1="15.5" x2="15.5" y2="15.5" />
      <line x1="12" y1="18.3" x2="14.3" y2="18.3" />
    </svg>
  )
}

export default function App() {
  const [state, setState] = useState(loadState)
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [soundOn, setSoundOn] = useState(loadSound)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeparture, setShowDeparture] = useState(false)
  const [departureKey, setDepartureKey] = useState(0)

  const { reveal: playReveal, depart: playDepart } = useAmbientSound(soundOn)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (_) {}
  }, [state])

  function startWalk() {
    setShowDeparture(false)
    setState(prev => ({ ...prev, status: 'out', departedAt: Date.now(), pendingTier: null }))
    playDepart()
  }

  async function returnFromWalk() {
    const durationMinutes = (Date.now() - state.departedAt) / 60000
    const tier = rollTier(durationMinutes)
    setState(prev => ({ ...prev, status: 'generating', pendingTier: tier }))
    const { discovery, isStatic, apiAttempted } = await generateDiscovery(tier, durationMinutes, apiKey)
    setState(prev => ({ ...prev, status: 'idle', departedAt: null, pendingTier: null, lastWalk: { durationMinutes, tier, discovery, isStatic, apiAttempted } }))
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

  const { status, departedAt, lastWalk } = state

  let panel, title
  if (showSettings) {
    title = 'The Keeper'
    panel = <SettingsPanel currentKey={apiKey} onSave={saveApiKey} soundOn={soundOn} onToggleSound={toggleSound} onClose={() => { setShowSettings(false); setDepartureKey(k => k + 1) }} />
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
      <TarotCard title={title}>{panel}</TarotCard>
      {!showSettings && (
        <button className="tg-settings-btn" onClick={() => setShowSettings(true)} title="The Keeper" aria-label="Settings">
          <KeyIcon />
        </button>
      )}
    </>
  )
}
