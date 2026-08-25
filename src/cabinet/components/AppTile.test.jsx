// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The real renderer needs a 2D canvas context, which neither happy-dom nor
// jsdom provides. What's worth pinning here isn't the pixels — it's *which
// element* the QR gets drawn into: qrcode silently falls back to a detached
// canvas of its own when handed a null one, which is exactly how this dialog
// came to render an empty square with nothing in the console.
const drawnInto = []
vi.mock('../../shared/qrCode', () => ({
  appQrUrl: (file) => `https://coneofcold.vercel.app/${file}`,
  renderAppQr: async (canvas) => { drawnInto.push(canvas) },
}))

const { AppTile } = await import('./AppTile')

const APP = {
  file: 'cabinet.html',
  title: 'The Cabinet',
  subtitle: 'small strange tools',
  manifest: '/cabinet.webmanifest',
  kind: 'react-vite',
  emoji: '🗄',
}

afterEach(() => {
  drawnInto.length = 0
  cleanup()
})

describe('AppTile detail sheet (QR)', () => {
  it('draws into a canvas that is actually in the document', async () => {
    render(<AppTile app={APP} installed={false} isNew={false} editing={false} />)

    await userEvent.click(screen.getByRole('button', { name: /details for/i }))

    await waitFor(() => expect(drawnInto).toHaveLength(1))
    const canvas = drawnInto[0]
    expect(canvas).not.toBeNull()
    expect(canvas.tagName).toBe('CANVAS')
    // The regression: a detached canvas draws a QR nobody can see.
    expect(document.body.contains(canvas)).toBe(true)
  })

  it('does not draw before the dialog is opened', () => {
    render(<AppTile app={APP} installed={false} isNew={false} editing={false} />)
    expect(drawnInto).toHaveLength(0)
  })

  it('redraws when the dialog is closed and reopened', async () => {
    render(<AppTile app={APP} installed={false} isNew={false} editing={false} />)
    const open = () => userEvent.click(screen.getByRole('button', { name: /details for/i }))

    await open()
    await waitFor(() => expect(drawnInto).toHaveLength(1))

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    // Modal keeps the portal alive for a 250ms close animation before
    // unmounting it, so reopening only redraws once that has elapsed.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 })

    await open()
    await waitFor(() => expect(drawnInto).toHaveLength(2))
    expect(document.body.contains(drawnInto[1])).toBe(true)
  })
})
