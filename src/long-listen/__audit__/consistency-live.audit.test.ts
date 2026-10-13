// Consistency audit (13 October 2026): "Live in Bucharest keeps its last
// reading rather than vanishing" was fixed for a failed request, not for a
// venue that failed inside a successful one. Fails today.
import { describe, it, expect } from 'vitest'
import { liveEvents, type LiveEvent } from '../live/live'

function marksWith(cached?: { at: string; value: LiveEvent[] }) {
  const store = new Map<string, { id: string; at: string; value?: unknown }>()
  if (cached) store.set('live:scan', { id: 'live:scan', ...cached })
  return { get: async (id: string) => store.get(id), put: async (m: { id: string; at: string; value?: unknown }) => { store.set(m.id, m) } }
}

describe('Live in Bucharest, one venue throttled or unreachable', () => {
  it('keeps that venue’s last reading instead of replacing it with nothing for a day', async () => {
    const ateneu: LiveEvent = { venue: 'Filarmonica George Enescu', title: 'Sibelius 2', date: '2026-10-20' }
    const radio: LiveEvent = { venue: 'Sala Radio', title: 'Brahms', date: '2026-10-22' }
    const marks = marksWith({ at: '2026-10-11T09:00:00.000Z', value: [ateneu, radio] })
    // Marquee answers 200, but the Ateneu's site refused it: its status says so, and it carries no events.
    const fetchImpl = (async () => new Response(JSON.stringify({
      venues: [
        { venueId: 'll-filarmonica', venue: 'Filarmonica George Enescu', status: 'throttled', events: [] },
        { venueId: 'll-salaradio', venue: 'Sala Radio', status: 'ok', events: [radio] },
      ],
      events: [radio],
    }), { status: 200 })) as typeof fetch
    const events = await liveEvents(marks, fetchImpl, new Date('2026-10-13T09:00:00.000Z'))
    expect(events.map((e) => e.title).sort()).toEqual(['Brahms', 'Sibelius 2'])
  })
})
