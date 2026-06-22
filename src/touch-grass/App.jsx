import { useState, useEffect, useRef } from 'react'
import DeparturePanel from './DeparturePanel.jsx'
import OutPanel from './OutPanel.jsx'
import ResultPanel from './ResultPanel.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import GeneratingPanel from './GeneratingPanel.jsx'
import ReliquaryPanel from './ReliquaryPanel.jsx'
import TarotCard from './TarotCard.jsx'
import Stage from './Stage.jsx'
import Locus from './Locus.jsx'
import { useAmbientSound } from './useAmbientSound.js'
import { useDailyCall } from './useDailyCall.js'
import { showWalkNotice, clearWalkNotice } from './walkNotice.js'
import { useWorld } from './world.jsx'
import { moonPhaseName } from './context.js'
import { weatherWord } from './weather.js'
import { rollTier, generateDiscovery } from './engine.js'

// a soft haptic tick at the two moments that matter (Android honours it; iOS
// Safari ignores navigator.vibrate, so this is a no-op there)
function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern) } catch (_) {}
}

const STORAGE_KEY = 'tg-react-state'
const API_KEY_STORAGE = 'tg-react-apikey'
const SOUND_STORAGE = 'tg-react-sound'
const SIGNS_STORAGE = 'tg-react-signs'
const MOTION_STORAGE = 'tg-react-motion'
const CALL_STORAGE = 'tg-react-call'
const HISTORY_STORAGE = 'tg-react-history'
const VIEW_STORAGE = 'tg-react-view'
const THRESHOLD_STORAGE = 'tg-react-threshold'
const THRESHOLD_MODES = ['almanac', 'tonight', 'arc', 'sign']
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

function loadThreshold() {
  const v = localStorage.getItem(THRESHOLD_STORAGE)
  return THRESHOLD_MODES.includes(v) ? v : 'almanac' // default: the living-world almanac
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

// which panel was open (Keeper / Reliquary / stepped-back Threshold), so closing
// and reopening the PWA returns to the exact screen
function loadView() {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE)
    if (raw) {
      const v = JSON.parse(raw)
      return { settings: !!v.settings, reliquary: !!v.reliquary, departure: !!v.departure }
    }
  } catch (_) {}
  return { settings: false, reliquary: false, departure: false }
}

export default function App() {
  const [state, setState] = useState(loadState)
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [soundOn, setSoundOn] = useState(loadSound)
  const [signsOn, setSignsOn] = useState(loadSigns)
  const [motionOn, setMotionOn] = useState(loadMotion)
  const [callOn, setCallOn] = useState(loadCall)
  const [thresholdMode, setThresholdMode] = useState(loadThreshold)
  const [history, setHistory] = useState(loadHistory)
  const [showSettings, setShowSettings] = useState(() => loadView().settings)
  const [showReliquary, setShowReliquary] = useState(() => loadView().reliquary)
  const [showDeparture, setShowDeparture] = useState(() => loadView().departure)
  const [departureKey, setDepartureKey] = useState(0)

  const { reveal: playReveal, depart: playDepart } = useAmbientSound(soundOn)
  const world = useWorld()
  useDailyCall(callOn, world.coords, history, world.moments)

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

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE, JSON.stringify({ settings: showSettings, reliquary: showReliquary, departure: showDeparture }))
    } catch (_) {}
  }, [showSettings, showReliquary, showDeparture])

  // raise the standing reminder while out; take it down whenever we're not
  useEffect(() => {
    if (state.status !== 'out') clearWalkNotice()
  }, [state.status])

  // while out, the browser tab quietly carries the walk — a glance at a
  // backgrounded tab or the recent-apps view becomes a gentle nudge back outside
  useEffect(() => {
    const base = 'Touch Grass'
    if (state.status !== 'out') { document.title = base; return }
    const update = () => {
      const min = Math.floor((Date.now() - state.departedAt) / 60000)
      document.title = `◷ Outside · ${min}m — ${base}`
    }
    update()
    const id = setInterval(update, 30000)
    return () => { clearInterval(id); document.title = base }
  }, [state.status, state.departedAt])

  // a notification tap reopens the app and asks to return — straight to the
  // result. Handle both a cold open (?return=1) and a focus of the live app
  // (a 'tg-return' message from the service worker). Kept in a ref so the
  // handlers always see the current state.
  const tryReturnRef = useRef(() => {})
  tryReturnRef.current = () => { if (state.status === 'out') returnFromWalk() }

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('return') === '1') {
        p.delete('return')
        const qs = p.toString()
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
        tryReturnRef.current()
      }
    } catch (_) {}
    const sw = navigator.serviceWorker
    if (!sw) return
    const onMsg = (e) => { if (e.data && e.data.type === 'tg-return') tryReturnRef.current() }
    sw.addEventListener('message', onMsg)
    return () => sw.removeEventListener('message', onMsg)
  }, [])

  function startWalk() {
    setShowDeparture(false)
    setState(prev => ({ ...prev, status: 'out', departedAt: Date.now(), pendingTier: null }))
    playDepart()
    showWalkNotice()
    buzz(18) // a single soft tick as you set out
  }

  async function returnFromWalk() {
    const durationMinutes = (Date.now() - state.departedAt) / 60000
    const tier = rollTier(durationMinutes)
    setState(prev => ({ ...prev, status: 'generating', pendingTier: tier }))
    const ctx = { timeOfDay: world.timeOfDay, season: world.season, weather: world.weather, moon: world.moon, coords: world.coords, biome: world.biome, moments: world.moments }
    const { discovery, isStatic, apiAttempted } = await generateDiscovery(tier, durationMinutes, apiKey, ctx)
    // the sky this find was kept under — a small memory carried by each relic
    const sky = {
      moon: world.moon ? moonPhaseName(world.moon.phase) : null,
      weather: world.weather ? weatherWord(world.weather.condition) : null,
      biome: world.biome || null,
    }
    const walk = { ts: Date.now(), durationMinutes, tier, discovery, isStatic, apiAttempted, sky }
    setState(prev => ({ ...prev, status: 'idle', departedAt: null, pendingTier: null, lastWalk: walk }))
    setHistory(prev => [walk, ...prev].slice(0, HISTORY_CAP))
    playReveal()
    buzz([0, 14, 70, 22]) // a gentle double-tick as the card turns over
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

  function chooseThreshold(mode) {
    const next = THRESHOLD_MODES.includes(mode) ? mode : 'almanac'
    localStorage.setItem(THRESHOLD_STORAGE, next)
    setThresholdMode(next)
  }

  function clearAllHistory() { setHistory([]) }
  function clearLastHistory() { setHistory(prev => prev.slice(1)) }

  const { status, departedAt, lastWalk } = state

  let panel, title
  if (showSettings) {
    title = 'The Keeper'
    panel = <SettingsPanel currentKey={apiKey} onSave={saveApiKey} soundOn={soundOn} onToggleSound={toggleSound} signsOn={signsOn} onToggleSigns={toggleSigns} motionOn={motionOn} onToggleMotion={toggleMotion} callOn={callOn} onToggleCall={toggleCall} thresholdMode={thresholdMode} onThreshold={chooseThreshold} onClose={() => { setShowSettings(false); setDepartureKey(k => k + 1) }} />
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
    panel = <DeparturePanel key={departureKey} onDepart={startWalk} apiKey={apiKey} fill={thresholdMode} />
  }

  // the masthead text inverts against the daily stage: cream on the dark midday
  // surface, dark ink on the pale dawn/dusk/night surfaces — readable either way
  const darkStage = world.timeOfDay === 'day'

  return (
    <>
      <Stage />
      <Locus />
      <div className="tg-shell">
        <header className={darkStage ? 'tg-masthead on-dark' : 'tg-masthead'}>
          <div className="tg-masthead-title">Touch Grass</div>
          <div className="tg-masthead-sub">A small rite for going outside</div>
        </header>
        <TarotCard
          title={title}
          showSigns={signsOn}
          motionOn={motionOn}
          fill={showReliquary}
          onSettings={(showSettings || showReliquary) ? null : () => setShowSettings(true)}
          onReliquary={(showSettings || showReliquary) ? null : () => setShowReliquary(true)}
        >{panel}</TarotCard>
      </div>
    </>
  )
}
