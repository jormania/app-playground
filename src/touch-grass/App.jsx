import { useState, useEffect } from 'react'
import DeparturePanel from './DeparturePanel.jsx'
import OutPanel from './OutPanel.jsx'
import ResultPanel from './ResultPanel.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import GeneratingPanel from './GeneratingPanel.jsx'
import TarotCard from './TarotCard.jsx'
import { rollTier, generateDiscovery } from './engine.js'

const STORAGE_KEY = 'tg-react-state'
const API_KEY_STORAGE = 'tg-react-apikey'

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

const cornerStyle = {
  position: 'fixed', bottom: '14px', right: '18px', zIndex: 9999,
  display: 'flex', gap: '8px', alignItems: 'center',
}

const chipStyle = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
  fontVariant: 'small-caps', letterSpacing: '0.05em',
  color: '#7a8499', textDecoration: 'none',
  background: 'rgba(12,14,20,0.85)', border: '1px solid #222636',
  padding: '3px 10px', borderRadius: '5px',
  backdropFilter: 'blur(8px)', cursor: 'pointer',
  appearance: 'none', lineHeight: '1.6', margin: 0,
}

export default function App() {
  const [state, setState] = useState(loadState)
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeparture, setShowDeparture] = useState(false)
  const [departureKey, setDepartureKey] = useState(0)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (_) {}
  }, [state])

  function startWalk() {
    setShowDeparture(false)
    setState(prev => ({ ...prev, status: 'out', departedAt: Date.now(), pendingTier: null }))
  }

  async function returnFromWalk() {
    const durationMinutes = (Date.now() - state.departedAt) / 60000
    const tier = rollTier(durationMinutes)
    setState(prev => ({ ...prev, status: 'generating', pendingTier: tier }))
    const { discovery, isStatic, apiAttempted } = await generateDiscovery(tier, durationMinutes, apiKey)
    setState(prev => ({ ...prev, status: 'idle', departedAt: null, pendingTier: null, lastWalk: { durationMinutes, tier, discovery, isStatic, apiAttempted } }))
  }

  function saveApiKey(key) {
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
    setDepartureKey(k => k + 1)
    setShowSettings(false)
  }

  const { status, departedAt, lastWalk } = state

  let panel, title
  if (showSettings) {
    title = 'The Keeper'
    panel = <SettingsPanel currentKey={apiKey} onSave={saveApiKey} onClose={() => { setShowSettings(false); setDepartureKey(k => k + 1) }} />
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
      <div style={cornerStyle}>
        <a href="/touch-grass-react-guide.html" style={chipStyle}>guide ↗</a>
        <button onClick={() => setShowSettings(true)} style={chipStyle}>settings</button>
      </div>
    </>
  )
}
