import { describe, expect, it } from 'vitest'
import type { Client, IncomeRecord } from '../domain/types'
import { clientOptions, suggestClients } from './clients'

const c = (id: string, name: string, kind: Client['kind'] = 'individual', archived = false): Client => ({ id, name, kind, country: 'RO', contact: '', notes: '', archived })
const paid = (clientId: string, date: string) => ({ clientId, date, status: 'received' }) as IncomeRecord
const today = '2026-11-26'
const clients = [c('a', 'Ana Popescu'), c('o', 'Oana Ștefănescu'), c('n', 'Nordwind SRL', 'business'), c('m', 'Mihai Ionescu'), c('x', 'Old Archive', 'individual', true), c('z', 'Zoe New')]
const records = [paid('a', '2026-11-20'), paid('o', '2026-10-02'), paid('n', '2026-03-01'), paid('m', '2025-06-01'), paid('x', '2026-11-01')]
const opts = clientOptions(clients, records, today)

describe('the client picker at scale', () => {
  it('offers recent clients, then businesses, with nothing typed; quiet people and archived ones stay out', () => {
    const s = suggestClients(opts, '')
    expect(s.recent.map((o) => o.client.id)).toEqual(['a', 'o', 'n'])
    expect(s.businesses).toEqual([])
    const shown = [...s.recent, ...s.businesses].map((o) => o.client.id)
    expect(shown).not.toContain('m') // unpaid for over a year: quiet
    expect(shown).not.toContain('x') // archived
  })
  it('finds anyone by part of a name, accents ignored, quiet clients included', () => {
    expect(suggestClients(opts, 'stef').matches.map((o) => o.client.id)).toEqual(['o'])
    const m = suggestClients(opts, 'mih').matches
    expect(m.map((o) => o.client.id)).toEqual(['m'])
    expect(m[0].quiet).toBe(true)
  })
  it('offers to add what was typed unless it is an exact name', () => {
    expect(suggestClients(opts, 'Maria Pop').addName).toBe('Maria Pop')
    expect(suggestClients(opts, 'ana popescu').addName).toBeNull()
  })
  it('a business stays on hand however long ago it paid; a person added but unpaid is not quiet', () => {
    const old = clientOptions(clients, [paid('n', '2024-01-01')], today)
    expect(old.find((o) => o.client.id === 'n')!.quiet).toBe(false)
    expect(old.find((o) => o.client.id === 'z')!.quiet).toBe(false)
  })
  it('filters and statements reach archived clients too', () => {
    expect(clientOptions(clients, records, today, true).some((o) => o.client.id === 'x')).toBe(true)
  })
})
