import { describe, expect, it } from 'vitest'
import { memoryStore } from '../../shared/kvStore'
import { DEMO_SESSIONS } from '../data/demo'
import { DEFAULT_PREFERENCES } from '../domain/types'
import { descriptionLead, formatDay, formatMonth, newEntry, summarise, thisWeek, weekStart } from '../lib/practice'
import { StillflowRepo, isBackup } from './repo'

const demo = DEMO_SESSIONS.slice(0, 3)

describe('StillflowRepo persistence', () => {
  it('seeds the demo once, and never again after the catalogue is cleared', async () => {
    const store = memoryStore()
    const repo = new StillflowRepo(store)
    expect(await repo.seedOnce(demo)).toBe(true)
    expect((await repo.load()).sessions).toHaveLength(3)
    await repo.deleteSessions(demo.map((s) => s.id))
    expect(await new StillflowRepo(store).seedOnce(demo)).toBe(false)
    expect((await repo.load()).sessions).toHaveLength(0)
  })

  it('does not seed over an existing catalogue', async () => {
    const repo = new StillflowRepo(memoryStore())
    await repo.putSessions([{ ...demo[0], id: 'mine', isDemo: false }])
    expect(await repo.seedOnce(demo)).toBe(false)
    expect((await repo.load()).sessions.map((s) => s.id)).toEqual(['mine'])
  })

  it('survives a "restart": a fresh repo over the same store reads everything back', async () => {
    const store = memoryStore()
    const repo = new StillflowRepo(store)
    await repo.putSessions(demo)
    await repo.putUserData({ sessionId: demo[0].id, favourite: true, rating: 4 })
    const entry = newEntry(demo[0], { date: '2026-11-19', note: '  lovely  ', rating: 5 })
    await repo.putHistory(entry)
    await repo.putCollection({ id: 'c1', name: 'Mornings', sessionIds: [demo[1].id, demo[0].id], createdAt: 'a', updatedAt: 'a' })
    await repo.putPreferences({ ...DEFAULT_PREFERENCES, weeklyTargetMinutes: 120 })

    const after = await new StillflowRepo(store).load()
    expect(after.userData[demo[0].id]).toEqual({ sessionId: demo[0].id, favourite: true, rating: 4 })
    expect(after.history).toEqual([{ ...entry, note: 'lovely' }])
    expect(after.collections[0].sessionIds).toEqual([demo[1].id, demo[0].id])
    expect(after.preferences.weeklyTargetMinutes).toBe(120)
  })

  it('keeps personal data when catalogue records are deleted and re-added', async () => {
    const repo = new StillflowRepo(memoryStore())
    await repo.putSessions(demo)
    await repo.putUserData({ sessionId: demo[0].id, favourite: true })
    await repo.deleteSessions([demo[0].id])
    await repo.putSessions([demo[0]])
    expect((await repo.load()).userData[demo[0].id]?.favourite).toBe(true)
  })

  it('round-trips a full backup and resets cleanly', async () => {
    const repo = new StillflowRepo(memoryStore())
    await repo.putSessions(demo)
    await repo.putHistory(newEntry(demo[1], { date: '2026-11-01' }))
    const backup = await repo.exportBackup(new Date('2026-11-20T00:00:00Z'))
    expect(isBackup(backup)).toBe(true)
    expect(isBackup({ app: 'other' })).toBe(false)

    const other = new StillflowRepo(memoryStore({ 'sf:v1:session:stale': { id: 'stale' }, 'unrelated': 1 }))
    await other.restoreBackup(backup)
    const restored = await other.load()
    expect(restored.sessions.map((s) => s.id).sort()).toEqual(demo.map((s) => s.id).sort())
    expect(restored.history).toHaveLength(1)

    await other.resetAll()
    const empty = await other.load()
    expect(empty.sessions).toEqual([])
    expect(empty.history).toEqual([])
    expect(await other.seedOnce(demo)).toBe(false)
  })

  it('edits and deletes history entries', async () => {
    const repo = new StillflowRepo(memoryStore())
    const e = newEntry(demo[0], { date: '2026-11-10' })
    await repo.putHistory(e)
    await repo.putHistory({ ...e, date: '2026-11-11', minutes: 5 })
    expect((await repo.load()).history).toMatchObject([{ id: e.id, date: '2026-11-11', minutes: 5 }])
    await repo.deleteHistory(e.id)
    expect((await repo.load()).history).toEqual([])
  })
})

describe('practice history', () => {
  it('defaults minutes to the session length and ignores out-of-range ratings', () => {
    const e = newEntry(demo[0], { date: '2026-11-10', rating: 9 })
    expect(e.minutes).toBe(demo[0].durationMinutes)
    expect(e.rating).toBeUndefined()
  })

  it('summarises totals, days and the current Monday-start week', () => {
    const es = [
      newEntry(demo[0], { date: '2026-11-16', minutes: 10 }),
      newEntry(demo[1], { date: '2026-11-16', minutes: 20 }),
      newEntry(demo[2], { date: '2026-11-15', minutes: 30 }),
    ]
    expect(summarise(es)).toEqual({ sessions: 3, minutes: 60, days: 2 })
    expect(weekStart('2026-11-20')).toBe('2026-11-16')
    expect(weekStart('2026-11-16')).toBe('2026-11-16')
    expect(thisWeek(es, '2026-11-20')).toHaveLength(2)
  })
})

describe('dates for display', () => {
  it('formats a posted date from a day or a full timestamp, and says nothing when there is none', () => {
    expect(formatDay('2024-01-22')).toMatch(/22/)
    expect(formatDay('2024-01-22T06:00:10Z')).toMatch(/2024/)
    expect(formatMonth('2024-01-22')).toMatch(/2024/)
    expect(formatDay(undefined)).toBe('')
    expect(formatDay('soon')).toBe('')
  })
})

describe('description lead', () => {
  it('keeps what comes before the channel divider and says there is more', () => {
    const d = 'On day 21 we notice curiosity.\n\nLet me know how it goes!\n\n- - - - - - - - - - \n\nWELCOME to the channel https://www.youtube.com/user/x?sub_confirmation=1'
    expect(descriptionLead(d)).toEqual({ lead: 'On day 21 we notice curiosity.\n\nLet me know how it goes!', rest: true })
    expect(descriptionLead('Short and plain.')).toEqual({ lead: 'Short and plain.', rest: false })
    expect(descriptionLead(undefined)).toEqual({ lead: '', rest: false })
  })
})
