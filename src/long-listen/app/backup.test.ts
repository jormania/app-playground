import { describe, expect, it } from 'vitest'
import { BACKUP_DUE_AFTER_MS, backupDue } from './backup'

const NOW = Date.parse('2026-10-23T12:00:00Z')

describe('when This week mentions a backup (batch one, 23 October 2026)', () => {
  it('not in the first weeks: there is little yet to lose', () => {
    expect(backupDue(2, undefined, NOW, undefined)).toBe(false)
  })
  it('after a few weeks with no backup ever saved', () => {
    expect(backupDue(3, undefined, NOW, undefined)).toBe(true)
  })
  it('once the last backup is more than four weeks old, and not before', () => {
    expect(backupDue(10, new Date(NOW - BACKUP_DUE_AFTER_MS + 60_000).toISOString(), NOW, undefined)).toBe(false)
    expect(backupDue(10, new Date(NOW - BACKUP_DUE_AFTER_MS - 60_000).toISOString(), NOW, undefined)).toBe(true)
  })
  it('not while put off', () => {
    expect(backupDue(10, undefined, NOW, NOW + 1000)).toBe(false)
    expect(backupDue(10, undefined, NOW, NOW - 1000)).toBe(true)
  })
})
