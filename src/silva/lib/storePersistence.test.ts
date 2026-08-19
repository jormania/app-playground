// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { SilvaStore, resetDemoThings } from './store'
import { DEMO_THINGS } from './fixtures'

/**
 * SILVA.md specifies the demo store as "a full offline forest in
 * `localStorage`, seeded once from `lib/fixtures.js`". It was module-level
 * memory only, so anything added while exploring without a token vanished on
 * reload — the first-run experience for everyone who hasn't set up Notion yet.
 */
describe('the demo forest persists', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoThings()
  })

  it('writes the whole forest out to localStorage', async () => {
    const store = new SilvaStore('')
    await store.createThing({ body: 'something worth keeping' })

    const raw = localStorage.getItem('silva:demo-forest')
    expect(raw).toBeTruthy()
    const stored = JSON.parse(raw as string)
    expect(stored.things.some((t: { body: string }) => t.body === 'something worth keeping')).toBe(true)
  })

  it('persists every kind of demo write, not just things', async () => {
    const store = new SilvaStore('')
    await store.createLocus({ name: 'Small hours', meaning: 'late thoughts' })
    await store.createSource({ title: 'A book' })

    const stored = JSON.parse(localStorage.getItem('silva:demo-forest') as string)
    expect(stored.loci.some((l: { name: string }) => l.name === 'Small hours')).toBe(true)
    expect(stored.sources.some((s: { title: string }) => s.title === 'A book')).toBe(true)
  })

  it('persists an update, so keeping something survives a reload', async () => {
    const store = new SilvaStore('')
    const created = await store.createThing({ body: 'kept later' })
    await store.updateThing(created.id, { state: 'Kept', kept: '2026-08-19' })

    const stored = JSON.parse(localStorage.getItem('silva:demo-forest') as string)
    const found = stored.things.find((t: { id: string }) => t.id === created.id)
    expect(found.state).toBe('Kept')
  })

  it('persists an archive', async () => {
    const store = new SilvaStore('')
    const locus = await store.createLocus({ name: 'Gone' })
    await store.archiveLocus(locus.id)

    const stored = JSON.parse(localStorage.getItem('silva:demo-forest') as string)
    expect(stored.loci.some((l: { id: string }) => l.id === locus.id)).toBe(false)
  })

  it('resetting puts the original specimens back and clears the additions', async () => {
    const store = new SilvaStore('')
    await store.createThing({ body: 'scribbled over the demo' })
    resetDemoThings()

    const things = await store.listThings()
    expect(things).toHaveLength(DEMO_THINGS.length)
    expect(things.some((t) => t.body === 'scribbled over the demo')).toBe(false)

    const stored = JSON.parse(localStorage.getItem('silva:demo-forest') as string)
    expect(stored.things).toHaveLength(DEMO_THINGS.length)
  })

  it('a live store never touches the demo snapshot', async () => {
    localStorage.removeItem('silva:demo-forest')
    const store = new SilvaStore('a-token', null, null, null, null)
    expect(await store.listThings()).toEqual([])
    expect(localStorage.getItem('silva:demo-forest')).toBeNull()
  })
})
