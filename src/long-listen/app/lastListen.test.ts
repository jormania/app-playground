// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { LAST_LISTEN_FOR_MS, lastListen, rememberListen } from './lastListen'

beforeEach(() => { localStorage.clear() })

describe('the listening view last opened', () => {
  it('is kept for an evening and the morning after, then let go', () => {
    const t = { programmeId: 'p', itemId: 'i', work: 'La mer', composer: 'Claude Debussy', trackIds: ['t1'] }
    rememberListen(t, 1_000)
    expect(lastListen(1_000 + LAST_LISTEN_FOR_MS)).toMatchObject(t)
    expect(lastListen(1_001 + LAST_LISTEN_FOR_MS)).toBeNull()
  })
  it('reads nothing malformed as a place', () => {
    localStorage.setItem('long-listen:last-listen', JSON.stringify({ programmeId: 3 }))
    expect(lastListen()).toBeNull()
  })
})
