import { useWorld } from './world.jsx'

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

// golden interior is warm → cool, light blue outside; blue-hour interior is deep
// indigo → warm, light apricot outside (the 3s CSS transition smooths the swap)
const GOLDEN_STAGE = 'linear-gradient(165deg, #d6e6ee 0%, #a8c6da 52%, #82a4c2 100%)'
const BLUE_STAGE = 'linear-gradient(165deg, #f4e6c8 0%, #e8c89e 52%, #d4aa78 100%)'

export default function Stage() {
  const { timeOfDay, light } = useWorld()
  const golden = light ? light.golden : 0
  const blue = light ? light.blue : 0
  const bg = golden >= 0.5 ? GOLDEN_STAGE : blue >= 0.5 ? BLUE_STAGE : STAGE[timeOfDay]
  return <div className="tg-stage" style={{ background: bg }} />
}
