import { useEffect, useState } from 'react'

/**
 * `value`, once it has stopped changing for `ms`. The print preview renders from this, so typing
 * a report title re-renders the report once, not on every key (audit G-01).
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}
