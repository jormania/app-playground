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

export default function OutPanel({ departedAt, onReturn }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <h1>You're outside.</h1>
      <p>Time out: {formatElapsed(now - departedAt)}</p>
      <p>Departed: {new Date(departedAt).toLocaleTimeString()}</p>
      <button onClick={onReturn}>I'm back</button>
    </div>
  )
}
