import { useState, useEffect, useRef } from 'react'
import DeparturePanel from './DeparturePanel.jsx'
import OutPanel from './OutPanel.jsx'
import ResultPanel from './ResultPanel.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import MixerPanel from './MixerPanel.jsx'
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
const MIX_STORAGE = 'tg-react-mix'
const MIXES_STORAGE = 'tg-react-mixes'
const THRESHOLD_MODES = ['almanac', 'tonight', 'arc']
const HISTORY_CAP = 300

// The Chorus — every value defaults to "unchanged from today's tuned sound"
// (10 = unity gain on each category/volume, warmth fully open, biome null =
// follow wherever you actually are); Activity alone centres at 5 (a neutral
// multiplier, not a ceiling). See ambientAudio.js's own note on this at the
// top of its Chorus section.
export const DEFAULT_MIX = { biome: null, place: 10, weather: 10, wildlife: 10, city: 10, events: 10, volume: 10, activity: 5, warmth: 10 }

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

function loadMix() {
  try {
    const raw = localStorage.getItem(MIX_STORAGE)
    if (raw) return { ...DEFAULT_MIX, ...JSON.parse(raw) }
  } catch (_) {}
  return { ...DEFAULT_MIX }
}

// user-saved Chorus blends: [{ id, name, mix }] — see saveCustomMix()
function loadCustomMixes() {
  try {
    const raw = localStorage.getItem(MIXES_STORAGE)
    if (raw) {
      const a = JSON.parse(raw)
      if (Array.isArray(a)) return a
    }
  } catch (_) {}
  return []
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
  const [mix, setMix] = useState(loadMix)
  const [customMixes, setCustomMixes] = useState(loadCustomMixes)
  const [history, setHistory] = useState(loadHistory)
  const [showSettings, setShowSettings] = useState(() => loadView().settings)
  const [showMixer, setShowMixer] = useState(false)
  const [showReliquary, setShowReliquary] = useState(() => loadView().reliquary)
  const [showDeparture, setShowDeparture] = useState(() => loadView().departure)
  const [departureKey, setDepartureKey] = useState(0)

  const { reveal: playReveal, depart: playDepart } = useAmbientSound(soundOn, mix)
  const world = useWorld()
  useDailyCall(callOn, world.coords, history, world.moments)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (_) {}
  }, [state])

  useEffect(() => {
    try {
      localStorage.setItem(MIX_STORAGE, JSON.stringify(mix))
    } catch (_) {}
  }, [mix])

  useEffect(() => {
    try {
      localStorage.setItem(MIXES_STORAGE, JSON.stringify(customMixes))
    } catch (_) {}
  }, [customMixes])

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
    const recent = (history || []).slice(0, 8).map(w => w && w.discovery && w.discovery.name).filter(Boolean)
    const ctx = { timeOfDay: world.timeOfDay, season: world.season, weather: world.weather, moon: world.moon, coords: world.coords, biome: world.biome, moments: world.moments, recent }
    const { discovery, isStatic, apiAttempted } = await generateDiscovery(tier, durationMinutes, apiKey, ctx)
    // the sky this find was kept under — a small memory carried by each relic
    const sky = {
      moon: world.moon ? moonPhaseName(world.moon.phase) : null,
      weather: world.weather ? weatherWord(world.weather.condition) : null,
      biome: world.biome || null,
      tod: world.timeOfDay || null,
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
    const next = !callOn
    localStorage.setItem(CALL_STORAGE, next ? '1' : '0')
    setCallOn(next)
    // turning notifications on (a real tap, so a valid gesture): if the browser
    // hasn't been asked yet, prompt now. If already denied, it can't be re-asked
    // here — the Keeper shows the "blocked" hint instead.
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission() } catch (_) {}
    }
  }

  function chooseThreshold(mode) {
    const next = THRESHOLD_MODES.includes(mode) ? mode : 'almanac'
    localStorage.setItem(THRESHOLD_STORAGE, next)
    setThresholdMode(next)
  }

  function updateMix(patch) { setMix(prev => ({ ...prev, ...patch })) }
  function resetMix() { setMix({ ...DEFAULT_MIX }) }

  // "+ save this mix" in the Chorus — names are capped at two words so a chip
  // never grows wide (mirrors Yoru's own saved-mixes UI)
  function saveCustomMix(name) {
    const trimmed = (name || '').trim().split(/\s+/).slice(0, 2).join(' ').slice(0, 18)
    if (!trimmed) return
    const entry = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: trimmed, mix: { ...mix } }
    setCustomMixes(prev => [...prev, entry])
  }
  function deleteCustomMix(id) {
    setCustomMixes(prev => prev.filter(m => m.id !== id))
  }

  function clearAllHistory() { setHistory([]) }
  function clearLastHistory() { setHistory(prev => prev.slice(1)) }

  const { status, departedAt, lastWalk } = state

  let panel, title
  if (showMixer) {
    title = 'The Chorus'
    panel = <MixerPanel mix={mix} onChange={updateMix} onReset={resetMix} onClose={() => setShowMixer(false)} customMixes={customMixes} onSaveMix={saveCustomMix} onDeleteMix={deleteCustomMix} />
  } else if (showSettings) {
    title = 'The Keeper'
    panel = <SettingsPanel currentKey={apiKey} onSave={saveApiKey} soundOn={soundOn} onToggleSound={toggleSound} signsOn={signsOn} onToggleSigns={toggleSigns} motionOn={motionOn} onToggleMotion={toggleMotion} callOn={callOn} onToggleCall={toggleCall} thresholdMode={thresholdMode} onThreshold={chooseThreshold} onOpenMixer={() => setShowMixer(true)} onClose={() => { setShowSettings(false); setDepartureKey(k => k + 1) }} />
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
      <a className="tg-guide-link" href="/touch-grass-react-guide.html" target="_blank" rel="noopener" aria-label="The Guide" title="The Guide">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <g fill="none" stroke="#e7c24a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            <path d="M12 6.8 C9.5 5.6 6 5.6 3.5 6 V17.6 C6 17.1 9.5 17.3 12 18.9 C14.5 17.3 18 17.1 20.5 17.6 V6 C18 5.6 14.5 5.6 12 6.8 Z" />
            <line x1="12" y1="6.8" x2="12" y2="18.9" />
          </g>
        </svg>
      </a>
      <div className="tg-shell">
        <header className={darkStage ? 'tg-masthead on-dark' : 'tg-masthead'}>
          <div className="tg-masthead-title">Touch Grass</div>
          <div className="tg-masthead-sub">A small rite for going outside</div>
        </header>
        <TarotCard
          title={title}
          showSigns={signsOn}
          motionOn={motionOn}
          fill={showMixer ? 'full' : (showReliquary ? 'fill' : false)}
          onSettings={(showSettings || showReliquary || showMixer) ? null : () => setShowSettings(true)}
          onReliquary={(showSettings || showReliquary || showMixer) ? null : () => setShowReliquary(true)}
        >{panel}</TarotCard>
      </div>
    </>
  )
}
