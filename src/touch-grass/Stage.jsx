import { useState, useEffect } from 'react'
import { getTimeOfDay } from './context.js'

// The "table" the card rests on — a gradient inverted against the card's
// interior sky: pale when the scene is dark, dark when the scene is bright.
const STAGE = {
  // dawn interior is warm & dim → cool, light periwinkle outside
  dawn:  'linear-gradient(165deg, #eef0f6 0%, #d4d9ee 50%, #b9c0e0 100%)',
  // day interior is bright & cool → deep, warm plum/aubergine outside
  day:   'linear-gradient(165deg, #46324c 0%, #2e1f38 52%, #1a1024 100%)',
  // dusk interior is warm ember → cool, light mint/teal outside
  dusk:  'linear-gradient(165deg, #e9f2ea 0%, #c8e4dc 50%, #a9d0cb 100%)',
  // night interior is cool & dark → warm, light apricot/gold outside
  night: 'linear-gradient(165deg, #f6e8c6 0%, #ecca9c 50%, #d8ac7e 100%)',
}

export default function Stage() {
  const [tod, setTod] = useState(() => getTimeOfDay(new Date()))

  useEffect(() => {
    const id = setInterval(() => setTod(getTimeOfDay(new Date())), 60_000)
    return () => clearInterval(id)
  }, [])

  return <div className="tg-stage" style={{ background: STAGE[tod] }} />
}
