import { useState, useEffect } from 'react'
import DeparturePanel from './DeparturePanel.jsx'
import OutPanel from './OutPanel.jsx'
import ResultPanel from './ResultPanel.jsx'
import { rollTier, generateDiscovery } from './engine.js'

const STORAGE_KEY = 'tg-react-state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return { status: 'idle', departedAt: null, lastWalk: null }
}

export default function App() {
  const [state, setState] = useState(loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (_) {}
  }, [state])

  function startWalk() {
    setState(prev => ({ status: 'out', departedAt: Date.now(), lastWalk: prev.lastWalk }))
  }

  async function returnFromWalk() {
    const durationMinutes = (Date.now() - state.departedAt) / 60000
    const tier = rollTier(durationMinutes)
    const discovery = await generateDiscovery(tier)
    setState({ status: 'idle', departedAt: null, lastWalk: { durationMinutes, tier, discovery } })
  }

  const { status, departedAt, lastWalk } = state

  if (status === 'out') {
    return <OutPanel departedAt={departedAt} onReturn={returnFromWalk} />
  }

  if (lastWalk) {
    return <ResultPanel lastWalk={lastWalk} onDepart={startWalk} />
  }

  return <DeparturePanel onDepart={startWalk} />
}
