import { useState, useEffect } from 'react'

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

export default function OutPanel({ departedAt, onReturn }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = now - departedAt
  const color = elapsedColor(elapsed)

  return (
    <div>
      <h1>You're outside.</h1>
      <p>
        Out for{' '}
        <span style={color ? { color } : undefined}>{formatElapsed(elapsed)}</span>
        {' '}· since {new Date(departedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      <button onClick={onReturn}>I'm back</button>
    </div>
  )
}
