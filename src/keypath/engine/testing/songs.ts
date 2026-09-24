import type { Hand, Song, SongNote } from '../song'

/** A song from [pitch, startMs, hand?] triples, 4 notes to a bar of 2 s. */
export function songOf(notes: [number, number, Hand?][], title = 'Test'): Song {
  const list: SongNote[] = notes.map(([pitch, startMs, hand], id) => ({
    id,
    pitch,
    startMs,
    durationMs: 400,
    hand: hand ?? 'right',
    bar: Math.floor(startMs / 2000),
  }))
  return { id: title, title, notes: list, bpm: 120, beatsPerBar: 4, durationMs: Math.max(0, ...list.map((n) => n.startMs + 400)) }
}

/** Ode to Joy, first phrase (Beethoven, public domain melody), right hand, 500 ms per beat. */
export const odeToJoy = songOf(
  [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62].map((p, i): [number, number] => [p, i * 500]),
  'Ode to Joy',
)
