// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MidiEvent } from '../../midi/types'
import { Shell } from '../Shell'
import { EngagementLog } from '../log'
import { ProfileRepo } from '../profiles'
import { K, memoryStore } from '../store'
import { celebrated } from '../celebrate/celebrate'
import { JourneyRepo, type JourneyProgress } from './progress'

vi.mock('../../App', () => ({ default: () => <div>probe screen</div> }))

// Stand-in for the Yamaha, as in the Songs tests.
let yamaha: ((e: MidiEvent) => void) | null = null
vi.mock('../connect/keyboard', () => ({
  useKeyboard: (onEvent?: (e: MidiEvent) => void) => {
    if (onEvent) yamaha = onEvent
    return { connected: true, access: 'granted', name: 'Digital Keyboard', checking: false, snapshot: { access: 'granted', error: null, inputs: [] } }
  },
}))
const key = (note: number) => act(() => yamaha!({ type: 'noteon', note, velocity: 80, channel: 1, time: performance.now() } as unknown as MidiEvent))

afterEach(cleanup)

async function open(route: string, progress?: JourneyProgress) {
  const store = memoryStore()
  const profiles = new ProfileRepo(store)
  const p = await profiles.create('Nora', '🐺')
  await profiles.setCurrent(p.id)
  if (progress) await store.set(K.journey(p.id), progress)
  history.replaceState(null, '', route)
  render(<Shell store={store} />)
  return { store, profileId: p.id }
}

const tap = (el: Element) => {
  fireEvent.pointerDown(el, { pointerId: 1 })
  fireEvent.pointerUp(el, { pointerId: 1 })
}
const tapLit = () => act(() => tap(document.querySelector('[data-target]')!))
const stops = () => [...document.querySelectorAll('ol li')].map((li) => `${li.getAttribute('data-state')}: ${li.textContent}`)

describe('Journey', () => {
  it('shows every step: the first open, the rest locked but offering a test-out', async () => {
    await open('#/door/journey')
    await screen.findByText('Find middle C')
    expect(stops()).toEqual([
      'open: 1Find middle CThe key everything starts from.',
      'locked: 🔒Finger numbersI can do this already',
      'locked: 🔒C, D, EI can do this already',
      'locked: 🔒A five-finger tuneI can do this already',
      'locked: 🔒Your first chordI can do this already',
      'locked: 🔒Both handsI can do this already',
      'locked: 🔒Reading musicI can do this already',
      'locked: 🔒Left handI can do this already',
      'locked: 🔒The black keysI can do this already',
      'locked: 🔒Reading higherI can do this already',
    ])
  })

  it('learns step 1 by the lit keys, passes its check, and opens step 2', async () => {
    const { store, profileId } = await open('#/journey/middleC')
    fireEvent.click(await screen.findByRole('button', { name: 'Learn it' }))
    expect(await screen.findByText(/Middle C is lit/)).toBeTruthy()
    for (let i = 0; i < 4; i++) tapLit()
    expect(await screen.findByText('Nice! Ready for the check?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText('Press three different Cs, anywhere on the keyboard.')).toBeTruthy()
    expect(document.querySelector('[data-target]')).toBeNull()
    for (const c of [48, 60, 72]) key(c)
    expect(await screen.findByText('Step done!')).toBeTruthy()
    expect(celebrated.at(-1)).toBe('stepPassed')

    expect((await new JourneyRepo(store).get(profileId)).middleC).toMatchObject({ how: 'check' })
    const log = (await new EngagementLog(store).read(profileId)).filter((e) => e.type.startsWith('journey'))
    expect(log.map((e) => e.type)).toEqual(['journey_started', 'journey_finished', 'journey_started', 'journey_finished'])
    expect(log[3]).toMatchObject({ step: 'middleC', mode: 'check', passed: true, wrong: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(await screen.findByText('Step 2 · Finger numbers')).toBeTruthy()
  })

  it('tests out of a locked tune step from the Yamaha, set an octave down', async () => {
    const { store, profileId } = await open('#/journey/fiveFinger')
    expect(await screen.findByText('Opens after step 3.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'I can do this already' }))
    expect(await screen.findByText('Press middle C to begin')).toBeTruthy()
    key(48) // middle C, arriving an octave low
    await screen.findByText('Play the tune. The notes fall onto their keys.')
    // Ode to Joy's first line, as the keyboard sends it (all an octave low).
    for (const p of [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62]) key(p - 12)
    expect(await screen.findByText('You knew it already: step done.')).toBeTruthy()
    expect((await new JourneyRepo(store).get(profileId)).fiveFinger).toMatchObject({ how: 'testOut' })
    expect((await new EngagementLog(store).read(profileId)).find((e) => e.type === 'journey_started')).toMatchObject({ testOut: true })

    fireEvent.click(screen.getByRole('button', { name: 'Back to the map' }))
    await screen.findByText('Find middle C')
    expect(stops()[3]).toBe('done: ✓A five-finger tuneTested out')
    expect(stops()[0]).toMatch(/^open/)
  })

  it('finger numbers: the hands light the finger asked for, then the check asks from memory', async () => {
    const { store, profileId } = await open('#/journey/fingers')
    // The hands are there before she starts.
    expect(await screen.findByRole('img', { name: /thumbs are 1/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'I can do this already' }))
    key(60)
    expect(await screen.findByText('Right hand, finger 3.')).toBeTruthy()
    // No hands and no lit key in the check.
    expect(screen.queryByRole('img', { name: /thumbs are 1/ })).toBeNull()
    expect(document.querySelector('[data-target]')).toBeNull()
    for (const p of [64, 60, 55, 67, 48, 53, 65, 52]) key(p)
    expect(await screen.findByText('You knew it already: step done.')).toBeTruthy()
    expect((await new JourneyRepo(store).get(profileId)).fingers).toMatchObject({ how: 'testOut' })
  })

  it('the finger-numbers practice lights the finger on the hands, and its key', async () => {
    await open('#/journey/fingers', { middleC: { at: '', how: 'check' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Learn it' }))
    key(60)
    expect(await screen.findByText('Right hand, finger 1: that’s C.')).toBeTruthy()
    const lit = () => document.querySelector('[data-hand] [data-on] text')?.textContent
    expect(lit()).toBe('1')
    expect(document.querySelector('[data-target]')?.getAttribute('aria-label')).toMatch(/^C/)
    for (const p of [60, 62, 64, 65, 67]) key(p)
    expect(await screen.findByText('Left hand, finger 5: that’s C.')).toBeTruthy()
    expect(document.querySelector('[data-hand="left"] [data-on] text')?.textContent).toBe('5')
  })

  it('a check with too many wrong keys is “nearly”, with another go or practice', async () => {
    const { store, profileId } = await open('#/journey/cde')
    fireEvent.click(await screen.findByRole('button', { name: 'I can do this already' }))
    await screen.findByText('Press D.')
    key(71)
    key(69)
    for (const p of [62, 60, 64, 62, 64, 60]) key(p)
    expect(await screen.findByText(/^Nearly! A few keys went astray/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Practise first' })).toBeTruthy()
    expect((await new JourneyRepo(store).get(profileId)).cde).toBeUndefined()
  })

  it('logs a step left part-way', async () => {
    const { store, profileId } = await open('#/journey/middleC')
    fireEvent.click(await screen.findByRole('button', { name: 'Learn it' }))
    tapLit()
    cleanup()
    await waitFor(async () => expect((await new EngagementLog(store).read(profileId)).at(-1)).toMatchObject({ type: 'journey_left', step: 'middleC', mode: 'practice' }))
  })

  it('after passing the reading check, offers the keys without names, and a Yes turns them off everywhere', async () => {
    const { store, profileId } = await open('#/journey/notation')
    fireEvent.click(await screen.findByRole('button', { name: 'I can do this already' }))
    await screen.findByText('Press middle C to begin')
    key(60)
    await screen.findByText('Read the staff and play it. No lit keys this time.')
    // Mary Had a Little Lamb: E D C D E E E
    for (const p of [64, 62, 60, 62, 64, 64, 64]) key(p)
    expect(await screen.findByText('You can read the staff now. Try the keys without their names?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, change it' }))
    await waitFor(async () => expect((await new ProfileRepo(store).settings(profileId)).keyNames).toBe(false))
    expect((await new EngagementLog(store).read(profileId)).find((e) => e.type === 'suggestion')).toMatchObject({ setting: 'keyNames', to: 'off', accepted: true, step: 'notation' })
    expect(screen.queryByText('You can read the staff now. Try the keys without their names?')).toBeNull()
  })

  it('draws the keys without names once the setting is off, but screen readers still hear them', async () => {
    const store = memoryStore()
    const profiles = new ProfileRepo(store)
    const p = await profiles.create('Nora', '🐺')
    await profiles.setCurrent(p.id)
    await profiles.saveSettings(p.id, { ...(await profiles.settings(p.id)), keyNames: false })
    history.replaceState(null, '', '#/journey/middleC')
    render(<Shell store={store} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Learn it' }))
    const cKeys = await screen.findAllByRole('button', { name: 'C' })
    expect(cKeys.length).toBeGreaterThan(0)
    for (const k of cKeys) expect(k.textContent).toBe('')
  })
})
