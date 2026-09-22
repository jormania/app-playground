import { describe, it, expect, beforeEach, vi } from 'vitest'

// Same stub shape as rhythm.test.js, which is this app's house style (R-017).
const store = {}
const localStorageStub = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
}
vi.stubGlobal('localStorage', localStorageStub)

import {
  loadDrafts, addDraft, updateDraft, removeDraft,
  isSettledForWeek, settleForWeek, pendingRepeats, resetDraftBanners,
} from './drafts.js'

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
})

describe('storing drafts', () => {
  it('starts empty', () => {
    expect(loadDrafts()).toEqual([])
  })

  it('round-trips a draft through localStorage', () => {
    const d = addDraft({ name: 'Mondays', items: [{ day: 1, title: 'Standup' }] })
    expect(loadDrafts()).toEqual([d])
    expect(d.items).toEqual([{ day: 1, title: 'Standup' }])
  })

  it('gives every draft a distinct id, even within the same millisecond', () => {
    // The id is Date.now() in base 36 plus a counter. Without the counter, two
    // drafts saved in one tick would collide and updateDraft would patch both.
    const ids = [addDraft({ name: 'a' }), addDraft({ name: 'b' }), addDraft({ name: 'c' })].map(d => d.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('names an unnamed draft rather than storing a blank', () => {
    expect(addDraft({}).name).toBe('Untitled')
    expect(addDraft({ name: '   ' }).name).toBe('Untitled')
    expect(addDraft({ name: '  Fridays  ' }).name).toBe('Fridays')
  })

  it('defaults items to a list and repeat to false', () => {
    const d = addDraft({ name: 'bare' })
    expect(d.items).toEqual([])
    expect(d.repeat).toBe(false)
  })

  it('survives a corrupt or non-array payload instead of throwing', () => {
    // A draft is a personal template on this device; unreadable storage should
    // read as "no drafts", never as a crash on open.
    store.loom_drafts = 'not json at all'
    expect(loadDrafts()).toEqual([])
    store.loom_drafts = '{"not":"an array"}'
    expect(loadDrafts()).toEqual([])
  })
})

describe('editing drafts', () => {
  it('patches only the named draft and returns it', () => {
    const a = addDraft({ name: 'a' })
    const b = addDraft({ name: 'b' })
    const patched = updateDraft(b.id, { name: 'b2', repeat: true })

    expect(patched).toMatchObject({ id: b.id, name: 'b2', repeat: true })
    expect(loadDrafts().find(d => d.id === a.id).name).toBe('a')
  })

  it('returns null for an id that is not there, without disturbing the rest', () => {
    addDraft({ name: 'a' })
    expect(updateDraft('draft-nope', { name: 'x' })).toBeNull()
    expect(loadDrafts()).toHaveLength(1)
  })

  it('removes one draft and leaves the others', () => {
    const a = addDraft({ name: 'a' })
    const b = addDraft({ name: 'b' })
    removeDraft(a.id)
    expect(loadDrafts().map(d => d.id)).toEqual([b.id])
  })
})

describe('the cast log', () => {
  it('reports nothing settled to begin with', () => {
    expect(isSettledForWeek('draft-1', '2026-09-21')).toBe(false)
  })

  it('settles a draft for one week only', () => {
    settleForWeek('draft-1', '2026-09-21')
    expect(isSettledForWeek('draft-1', '2026-09-21')).toBe(true)
    // The point of keying by week: next week the offer comes back.
    expect(isSettledForWeek('draft-1', '2026-09-28')).toBe(false)
  })

  it('does not double-record a draft settled twice', () => {
    settleForWeek('draft-1', '2026-09-21')
    settleForWeek('draft-1', '2026-09-21')
    expect(JSON.parse(store.loom_cast_log)['2026-09-21']).toEqual(['draft-1'])
  })

  it('keeps several drafts settled in the same week', () => {
    settleForWeek('draft-1', '2026-09-21')
    settleForWeek('draft-2', '2026-09-21')
    expect(isSettledForWeek('draft-1', '2026-09-21')).toBe(true)
    expect(isSettledForWeek('draft-2', '2026-09-21')).toBe(true)
  })
})

describe('what the week view is offered', () => {
  it('offers repeating drafts that are not yet settled', () => {
    const repeating = addDraft({ name: 'weekly', repeat: true })
    addDraft({ name: 'one-off' })
    expect(pendingRepeats('2026-09-21').map(d => d.id)).toEqual([repeating.id])
  })

  it('stops offering one once it is cast or dismissed', () => {
    const repeating = addDraft({ name: 'weekly', repeat: true })
    settleForWeek(repeating.id, '2026-09-21')
    expect(pendingRepeats('2026-09-21')).toEqual([])
    // Settling is per week — the offer returns on the next one. This is the
    // whole reason the log is keyed by week rather than a flag on the draft.
    expect(pendingRepeats('2026-09-28').map(d => d.id)).toEqual([repeating.id])
  })

  it('never offers a non-repeating draft', () => {
    addDraft({ name: 'one-off' })
    expect(pendingRepeats('2026-09-21')).toEqual([])
  })

  it('brings every offer back when the banners are reset', () => {
    const repeating = addDraft({ name: 'weekly', repeat: true })
    settleForWeek(repeating.id, '2026-09-21')
    resetDraftBanners()
    expect(pendingRepeats('2026-09-21').map(d => d.id)).toEqual([repeating.id])
    // Resetting the banners must not delete the drafts themselves.
    expect(loadDrafts()).toHaveLength(1)
  })
})
