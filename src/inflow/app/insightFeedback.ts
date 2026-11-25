/**
 * What you thought of an insight, kept on this device: 👍 keeps it near the
 * top; 👎 hides that one, or every insight from the same rule. Settings can
 * bring them all back. Ids name what an insight is about (a client, a venue,
 * a month), so a hidden one stays hidden as the numbers move.
 */
import { useCallback, useEffect, useState } from 'react'
import { readJson, writeJson } from '../../shared/storage'
import type { Insight, InsightRule } from '../lib/insights'

export const FEEDBACK_KEY = 'inflow:insight-feedback'
const EVENT = 'inflow:insight-feedback'

export interface Feedback { liked: string[]; hidden: string[]; muted: InsightRule[] }
const EMPTY: Feedback = { liked: [], hidden: [], muted: [] }

/** The list as you want it: hidden and muted ones out, liked ones first. */
export function applyFeedback(list: Insight[], f: Feedback): Insight[] {
  const shown = list.filter((i) => !f.hidden.includes(i.id) && !f.muted.includes(i.rule))
  return [...shown.filter((i) => f.liked.includes(i.id)), ...shown.filter((i) => !f.liked.includes(i.id))]
}

export function useInsightFeedback() {
  const [f, setF] = useState<Feedback>(() => ({ ...EMPTY, ...readJson<Partial<Feedback>>(FEEDBACK_KEY, {}) }))
  useEffect(() => {
    const on = () => setF({ ...EMPTY, ...readJson<Partial<Feedback>>(FEEDBACK_KEY, {}) })
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  const save = useCallback((next: Feedback) => {
    writeJson(FEEDBACK_KEY, next)
    setF(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])
  const without = <T,>(xs: T[], x: T) => xs.filter((y) => y !== x)
  return {
    feedback: f,
    apply: (list: Insight[]) => applyFeedback(list, f),
    isLiked: (id: string) => f.liked.includes(id),
    toggleLike: (i: Insight) => save({ ...f, liked: f.liked.includes(i.id) ? without(f.liked, i.id) : [...f.liked, i.id] }),
    hide: (i: Insight) => save({ ...f, hidden: [...without(f.hidden, i.id), i.id], liked: without(f.liked, i.id) }),
    mute: (rule: InsightRule) => save({ ...f, muted: [...without(f.muted, rule), rule] }),
    restore: (prev: Feedback) => save(prev),
    hiddenCount: f.hidden.length + f.muted.length,
    reset: () => save({ ...f, hidden: [], muted: [] }),
  }
}

export type InsightFeedback = ReturnType<typeof useInsightFeedback>
