import { describe, it, expect } from 'vitest'
import { Journey } from './journey'
import { Repo, memoryStore } from '../store/repo'
import type { CuratorClient } from './api'
import { goingKey } from '../domain/going'
import type { LiveEvent } from '../live/live'

function fakeCurator(script: Partial<Record<string, (payload: any) => unknown>>) {
  const calls: { op: string; payload: any }[] = []
  const client: CuratorClient = {
    async call<T>(op: string, payload: unknown): Promise<T> {
      calls.push({ op, payload })
      const fn = script[op]
      if (!fn) throw new Error(`unexpected curator call: ${op}`)
      return fn(payload) as T
    },
  }
  return { client, count: (op: string) => calls.filter((c) => c.op === op).length, calls }
}

const event: LiveEvent = { venue: 'Filarmonica George Enescu', title: 'Brahms & Sibelius', date: '2026-10-23', time: '19:00', hall: 'Sala Mare', link: 'https://example.org/e', description: 'Brahms: Dublul concert; Sibelius: Simfonia nr. 2' }

describe('release four, in the journey', () => {
  it('defines a term once per language and keeps it', async () => {
    const repo = new Repo(memoryStore())
    const c = fakeCurator({ define: (p) => ({ definition: `${p.term}: a ground that repeats.`, promptVersion: 'define@t' }) })
    const j = new Journey(repo, c.client)
    expect(await j.definition('passacaglia')).toBeUndefined()
    expect(await j.define('Passacaglia', 'A passacaglia closes it.')).toBe('passacaglia: a ground that repeats.')
    await j.define('passacaglia', 'Elsewhere.')
    expect(c.count('define')).toBe(1)
    expect(c.calls[0].payload).toMatchObject({ term: 'passacaglia', sentence: 'A passacaglia closes it.', language: 'en' })
    expect(await j.definition('passacaglia')).toBe('passacaglia: a ground that repeats.')
  })

  it('marks a concert as going, prepares it once, and lets the kept concert close the mark', async () => {
    const repo = new Repo(memoryStore())
    const c = fakeCurator({ prepare: () => ({ intro: 'An evening.', inTheHall: 'Sit back.', soloists: [], works: [{ composer: 'Jean Sibelius', title: 'Symphony No. 2', catalogue: 'Op. 43', soloists: [], about: 'a', listenFor: 'b' }], promptVersion: 'prepare@t' }) })
    const j = new Journey(repo, c.client)
    await j.goingTo(event, true)
    await j.goingTo(event, true)
    const [g] = await j.goings()
    expect(g.key).toBe(goingKey(event))
    expect(await j.goings()).toHaveLength(1)
    const prep = await j.prepare(g.key)
    await j.prepare(g.key)
    expect(c.count('prepare')).toBe(1)
    expect(c.calls[0].payload.event).toMatchObject({ venue: event.venue, date: event.date, description: event.description })
    expect(prep.works[0].title).toBe('Symphony No. 2')
    await j.concertKept(g.key, 'concert_1')
    expect((await j.goings())[0].concertId).toBe('concert_1')
    await j.goingTo(event, false)
    expect(await j.goings()).toEqual([])
  })

  it('writes a composer’s portrait once, however the name is spelt', async () => {
    const repo = new Repo(memoryStore())
    const c = fakeCurator({ portrait: (p) => ({ lifespan: '1865–1957', portrait: `About ${p.composer}.`, promptVersion: 'portrait@t' }) })
    const j = new Journey(repo, c.client)
    await j.portrait('Jean Sibelius', ['Symphony No. 2'])
    expect((await j.portraitOf('JEAN SIBELIUS'))?.portrait).toBe('About Jean Sibelius.')
    await j.portrait('Jean Sibelius', [])
    expect(c.count('portrait')).toBe(1)
  })
})
