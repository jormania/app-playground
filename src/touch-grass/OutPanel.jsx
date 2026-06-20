import { useState, useEffect } from 'react'
import { useWorld } from './world.jsx'
import { getNextSunAnchor } from './context.js'

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

  return (
    <div>
      <h1>You're outside.</h1>
      <p>
        Out for{' '}
        <span style={color ? { color } : undefined}>{formatElapsed(elapsed)}</span>
        {' '}· since {new Date(departedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      {remaining > 0 && (
        <div className="tg-countdown">{ANCHOR_LABEL[anchor.key]} in {formatCountdown(remaining)}</div>
      )}
      <button onClick={onReturn}>I'm back</button>
    </div>
  )
}
