import { useEffect, useState } from 'react'
import Home from './components/Home'
import Session from './components/Session'
import Ended from './components/Ended'
import {
  loadSettings,
  saveSettings,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
} from './lib/storage'

// Yoru's three states: the near-empty home, the running descent, and the quiet
// close. An in-progress session resumes within the same night (see storage.js).
export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState('home')

  // Apply the chosen palette app-wide. 'storm' is the default Night (no
  // attribute); 'moonlight' and 'candlelight' are overrides in yoru.css.
  useEffect(() => {
    const root = document.documentElement
    const palette = settings.palette ?? 'storm'
    if (palette === 'storm') root.removeAttribute('data-yoru-palette')
    else root.setAttribute('data-yoru-palette', palette)
  }, [settings.palette])

  // On open, pick up an unfinished session from earlier this same night.
  useEffect(() => {
    const active = loadActiveSession()
    if (!active) return
    const elapsed = (Date.now() - active.startedAt) / 1000
    if (elapsed >= active.totalSec) {
      clearActiveSession()
      return
    }
    setSession(active)
    setPhase('running')
  }, [])

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }

  const begin = () => {
    const active = {
      startedAt: Date.now(),
      totalSec: settings.minutes * 60,
      breathwork: settings.breathwork,
      breath: settings.breath,
      haptics: settings.haptics,
      scene: settings.scene,
      mix: settings.mix,
      screen: settings.screen,
      moonPath: settings.moonPath,
      starReveal: settings.starReveal,
      stereo: settings.stereo,
      note: '',
    }
    saveActiveSession(active)
    setSession(active)
    setPhase('running')
  }

  // The note is held only for the life of the session, then discarded.
  const setNote = (note) => {
    setSession((prev) => {
      if (!prev) return prev
      const next = { ...prev, note }
      saveActiveSession(next)
      return next
    })
  }

  const finish = () => {
    clearActiveSession()
    setSession(null)
    setPhase('ended')
  }

  const close = () => setPhase('home')

  if (phase === 'running' && session) {
    return <Session session={session} onNote={setNote} onFinish={finish} />
  }
  if (phase === 'ended') {
    return <Ended name={settings.name} onClose={close} />
  }
  return <Home settings={settings} onChange={updateSettings} onBegin={begin} />
}
