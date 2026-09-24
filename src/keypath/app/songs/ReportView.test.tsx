// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Report } from '../../engine'
import { AppContext, type KeyPathApp } from '../context'
import { translate } from '../i18n'
import { EngagementLog } from '../log'
import { DEFAULT_PROFILE_SETTINGS, ProfileRepo } from '../profiles'
import { memoryStore } from '../store'
import { celebrated } from '../celebrate/celebrate'
import { ReportView } from './ReportView'

afterEach(cleanup)

const report: Report = {
  stars: 3,
  score: 1,
  hit: 12,
  total: 12,
  missed: 0,
  wrong: 0,
  timing: { early: 1, onTime: 10, late: 1 },
  highlights: [
    { kind: 'finished' },
    { kind: 'notes', hit: 12, total: 12 },
    { kind: 'cleanBars', bars: [0, 2] },
  ],
  toWorkOn: [{ bar: 1, missed: 0, wrong: 0, early: 1, late: 1 }],
  suggestion: { setting: 'onWrong', to: 'wait' },
}

function renderReport(language: 'en' | 'ro' = 'en') {
  const store = memoryStore()
  const log = new EngagementLog(store)
  const updateSetting = vi.fn(async () => {})
  const onMakeItYours = vi.fn()
  const app = {
    store,
    log,
    profiles: new ProfileRepo(store),
    profile: { id: 'p1', name: 'Nora', avatar: '🐺', createdAt: '2026-09-24T00:00:00.000Z' },
    settings: { ...DEFAULT_PROFILE_SETTINGS, language },
    t: (key, vars) => translate(language, key, vars),
    updateSetting,
    choose: async () => {},
    removeProfile: async () => {},
    reload: async () => {},
  } as KeyPathApp
  render(
    <AppContext.Provider value={app}>
      <ReportView report={report} songId="starter:ode" onPlayAgain={() => {}} onAnotherSong={() => {}} onMakeItYours={onMakeItYours} />
    </AppContext.Provider>,
  )
  return { log, updateSetting, onMakeItYours }
}

describe('ReportView', () => {
  it('lists what went well first, counting bars from 1', () => {
    renderReport()
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['You played it to the end!', '12 of 12 notes right', 'Clean bars: 1, 3'])
    expect(screen.getByText('Bar 2 is worth another go.')).toBeTruthy()
  })

  it('offers the next setting and changes it only when she says yes', async () => {
    const { log, updateSetting } = renderReport()
    expect(screen.getByText('That went really well. Try “Wait for it” next time?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, change it' }))
    await waitFor(() => expect(updateSetting).toHaveBeenCalledWith('onWrong', 'wait'))
    expect((await log.read('p1')).at(-1)).toMatchObject({ type: 'suggestion', setting: 'onWrong', to: 'wait', accepted: true, songId: 'starter:ode' })
    expect(screen.queryByRole('button', { name: 'Yes, change it' })).toBeNull()
  })

  it('logs “Not now” and leaves the setting alone', async () => {
    const { log, updateSetting } = renderReport('ro')
    fireEvent.click(screen.getByRole('button', { name: 'Nu acum' }))
    await waitFor(async () => expect((await log.read('p1')).at(-1)).toMatchObject({ type: 'suggestion', accepted: false }))
    expect(updateSetting).not.toHaveBeenCalled()
  })

  it('offers “Make it yours” after a finished song', () => {
    const { onMakeItYours } = renderReport()
    fireEvent.click(screen.getByRole('button', { name: /Make it yours/ }))
    expect(onMakeItYours).toHaveBeenCalled()
  })

  it('celebrates a finished song, and three stars with the big one', () => {
    celebrated.length = 0
    renderReport()
    expect(celebrated).toEqual(['threeStars'])
  })
})
