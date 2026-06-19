import { useState, useEffect } from 'react'
import { getTimeOfDay } from './context.js'

// The "table" the card rests on — a gradient inverted against the card's
// interior sky: pale when the scene is dark, dark when the scene is bright.
const STAGE = {
  dawn:  'linear-gradient(160deg, #eaf0ec 0%, #dde6e4 55%, #cdd7d6 100%)',
  day:   'linear-gradient(160deg, #232734 0%, #15171f 60%, #0c0e13 100%)',
  dusk:  'linear-gradient(160deg, #efe9ee 0%, #ddd5e6 55%, #ccc4da 100%)',
  night: 'linear-gradient(160deg, #e6ebf3 0%, #d2dbe8 55%, #c0cadd 100%)',
}

export default function Stage() {
  const [tod, setTod] = useState(() => getTimeOfDay(new Date()))

  useEffect(() => {
    const id = setInterval(() => setTod(getTimeOfDay(new Date())), 60_000)
    return () => clearInterval(id)
  }, [])

  return <div className="tg-stage" style={{ background: STAGE[tod] }} />
}
