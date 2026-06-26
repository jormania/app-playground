import { useEffect } from 'react'
import { useSettings } from './settingsContext'
import { useActiveOdysseys } from './useActiveOdysseys'
import { usePlanningOdyssey } from './usePlanningOdyssey'
import { useCheckins } from './useCheckins'
import { useReflections } from './useReflections'
import { cycleState } from './checkins'
import { reflectableWeeks } from './reflections'
import { todayISO, computeDayIndex, CYCLE_DAYS } from './charter'
import { parseDailyTime, parseWeeklySlot, writeReminderState } from './reminders'

/** Mirror the state the reminders service worker needs into the shared IndexedDB whenever the
 *  relevant data is in hand (so its next background wake decides correctly). Cheap: it reads
 *  already-cached queries. Mount on the screens that load this data (Today + Weekly). */
export function useReminderSync() {
  const { settings } = useSettings()
  const active = useActiveOdysseys()
  const odyssey = active.data?.[0]
  const planning = usePlanningOdyssey()
  const draft = planning.data
  const checkins = useCheckins(odyssey?.id)
  const reflections = useReflections(odyssey?.id)

  const checkinData = checkins.data
  const reflectionData = reflections.data

  useEffect(() => {
    const enabled = settings.remindersEnabled
    let cycleActive = false
    let todayLogged = ''
    let weeklyDue = false
    let harvestReady = false
    let harvestId = ''
    let startReady = false
    let startId = ''

    if (enabled && odyssey?.startDate) {
      const cyc = cycleState(odyssey.startDate)
      cycleActive = cyc.phase === 'active'
      const today = todayISO()
      if (checkinData?.some((r) => r.date === today)) todayLogged = today
      const pending = reflectableWeeks(cyc.dayIndex).find(
        (w) => !reflectionData?.some((r) => r.weekIndex === w),
      )
      weeklyDue = pending != null
      // Day 42 reached and not yet harvested (still the active Odyssey).
      if (cyc.dayIndex >= CYCLE_DAYS) {
        harvestReady = true
        harvestId = odyssey.id
      }
    }

    // A planned draft whose start date has arrived but hasn't been begun.
    if (enabled && draft?.startDate && computeDayIndex(draft.startDate) >= 1) {
      startReady = true
      startId = draft.id
    }

    void writeReminderState({
      enabled,
      dailyMinutes: enabled ? parseDailyTime(settings.dailyTime) : null,
      weekly: enabled ? parseWeeklySlot(settings.weeklySlot) : null,
      cycleActive,
      todayLogged,
      weeklyDue,
      startReady,
      startId,
      harvestReady,
      harvestId,
      want: {
        daily: settings.remindersDaily,
        weekly: settings.remindersWeekly,
        start: settings.remindersStart,
        harvest: settings.remindersHarvest,
      },
    })
  }, [
    settings.remindersEnabled,
    settings.remindersDaily,
    settings.remindersWeekly,
    settings.remindersStart,
    settings.remindersHarvest,
    settings.dailyTime,
    settings.weeklySlot,
    odyssey?.id,
    odyssey?.startDate,
    draft?.id,
    draft?.startDate,
    checkinData,
    reflectionData,
  ])
}
