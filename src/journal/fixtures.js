// Sample delights for fixtures mode — the app runs fully on these before any
// Notion token exists (per the "fixtures first" build decision). They double as
// living copy guidance: small acts of attention, never "good days", no scoring.
import { wordCount } from './notion.js'

const RAW = [
  {
    title: 'the espresso foam',
    date: '2026-06-24',
    tags: ['light', 'morning'],
    people: [],
    entry: 'It held its domed shape a beat longer than foam should, catching the window light like a small bald planet, and then the spoon broke it and it was only coffee again. I had not meant to watch it. I watched it.',
  },
  {
    title: 'a stranger holding the lift',
    date: '2026-06-23',
    tags: ['kindness', 'strangers'],
    people: ['the courier'],
    entry: 'A man with both arms full of parcels stuck his elbow against the closing doors for me, and neither of us said anything, and that was somehow the whole of it.',
  },
  {
    title: 'rain starting on the awning',
    date: '2026-06-21',
    tags: ['rain', 'sound'],
    people: [],
    entry: 'The first drops on the cafe awning sounded like someone tuning a tiny drum, irregular and then suddenly committed. Grief was sitting at my table too; the rain did not mind it being there.',
  },
  {
    title: 'Mara mispronouncing "labyrinth"',
    date: '2026-06-19',
    tags: ['language', 'laughter'],
    people: ['Mara'],
    entry: 'She said "lab-ryinth" three times, refused correction, and by the fourth it had become the correct word and the dictionary was simply wrong.',
  },
]

export function seedEntries() {
  return RAW.map((e, i) => ({
    id: `fixture-${i}`,
    ...e,
    wordCount: wordCount(e.entry),
  }))
}
