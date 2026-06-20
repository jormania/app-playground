import { useState, useEffect } from 'react'
import { useWorld } from './world.jsx'
import { getNextSunAnchor } from './context.js'

// a small rite for the walk — the card is an oracle, after all. One is chosen
// per departure (stable for the walk) and sends you outward, not back to the screen.
const WANDER = [
  'Find one thing older than you, and one thing younger.',
  'Let the next sound you can’t name decide which way you turn.',
  'Choose a colour you have no word for, and follow it.',
  'Walk until a single thought finishes itself.',
  'Touch something that has weathered more winters than you.',
  'Find the quietest place within reach, and add nothing to it.',
  'Notice what was here long before the path was.',
  'Let one worry fall behind you with each corner you turn.',
  'Look up until the sky stops being a ceiling.',
  'Greet the first living thing that does not flee from you.',
]

// time until the next turn of the day, in plain words
function formatCountdown(ms) {
  if (ms < 60000) return 'under a minute'
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function elapsedColor(ms) {
  const minutes = ms / 60000
  if (minutes >= 240) return '#c060e0'
  if (minutes >= 60)  return '#c49830'
  if (minutes >= 30)  return '#3ab0c0'
  return null
}

const ANCHOR_LABEL = { sunrise: 'sunrise', noon: 'noon', sunset: 'sunset', midnight: 'midnight' }

export default function OutPanel({ departedAt, onReturn }) {
  const { coords } = useWorld()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = now - departedAt
  const color = elapsedColor(elapsed)

  const anchor = getNextSunAnchor(new Date(now), coords)
  const remaining = anchor.at.getTime() - now

  // a slowly rotating rite — a new one every ~40s, seeded by the departure
  const wanderIdx = (Math.floor(departedAt / 1000) + Math.floor(elapsed / 40000)) % WANDER.length

  return (
    <div>
      <h1>You're outside.</h1>
      <div className="tg-walkmeta">
        <div className="tg-walkmeta-main">Out for <span style={color ? { color } : undefined}>{formatElapsed(elapsed)}</span></div>
        <div>Left at {new Date(departedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        {remaining > 0 && <div>{ANCHOR_LABEL[anchor.key]} in {formatCountdown(remaining)}</div>}
      </div>
      <div className="tg-wander">
        <div className="tg-wander-head">while you wander</div>
        <div className="tg-wander-text" key={wanderIdx}>{WANDER[wanderIdx]}</div>
      </div>
      <button onClick={onReturn}>I'm back</button>
    </div>
  )
}
