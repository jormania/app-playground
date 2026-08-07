/**
 * Local YYYY-MM-DD for "today". Built from date parts, never `Date.parse` of a
 * raw string or `toISOString()` — both read through UTC, which lands a day off
 * from the device's actual today west of Greenwich (the same trap WhereItWent
 * documents in its reminders code).
 */
export function todayIso(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
