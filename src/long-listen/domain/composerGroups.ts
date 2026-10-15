import { fold, surname } from './identity'

/**
 * Entries grouped by composer — one composer however the name was written.
 * "Claude Debussy" and "Claude  Débussy" fold to one; "Debussy" alone (a
 * concert typed by surname) joins the one full name with that surname, the
 * way Ingest files its work (two with it — the Strausses — or none: its own
 * group). Keyed by the name as first written, so a reader that used the raw
 * name as a key (the Notion Composers row) keeps finding its row.
 */
export function groupByComposer<T>(entries: T[], nameOf: (e: T) => string): Map<string, T[]> {
  const byKey = new Map<string, { name: string; items: T[] }>()
  for (const e of entries) {
    const name = nameOf(e).trim()
    const key = fold(name)
    const g = byKey.get(key)
    if (g) g.items.push(e)
    else byKey.set(key, { name, items: [e] })
  }
  // A bare surname joins the one full name it can only mean.
  for (const [key, g] of [...byKey]) {
    if (key.includes(' ')) continue
    const fuller = [...byKey.entries()].filter(([k]) => k !== key && k.includes(' ') && surname(k) === surname(key))
    if (fuller.length !== 1) continue
    fuller[0][1].items.push(...g.items)
    byKey.delete(key)
  }
  return new Map([...byKey.values()].map((g) => [g.name, g.items]))
}

/**
 * The entry a composer's page asks for, however the name was written: any
 * spelling it was filed under, or — a bare surname, as a concert types it —
 * the one entry with that surname (two with it, or none: no entry).
 */
export function composerEntry<E extends { composer: string; spellings: string[] }>(entries: E[], name: string): E | undefined {
  const want = fold(name)
  const filed = entries.find((e) => [e.composer, ...e.spellings].some((x) => fold(x) === want))
  if (filed || want.includes(' ')) return filed
  const bySurname = entries.filter((e) => surname(e.composer) === want)
  return bySurname.length === 1 ? bySurname[0] : undefined
}
