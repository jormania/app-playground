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
  const openSheet = () => userEvent.click(screen.getByRole('button', { name: /details for/i }))
  const revealQr = () => userEvent.click(screen.getByRole('button', { name: /qr code/i }))

  it('draws into a canvas that is actually in the document', async () => {
    render(<AppTile app={APP} installed={false} isNew={false} editing={false} />)

    await openSheet()
    await revealQr()

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

  // The QR sits behind a disclosure, and the panel is conditionally rendered
  // rather than hidden — which is what keeps the ~23KB qrcode import from
  // being fetched on every sheet open. Opening the sheet alone must draw
  // nothing, or that laziness is gone.
  it('does not draw until the QR disclosure is expanded', async () => {
    render(<AppTile app={APP} installed={false} isNew={false} editing={false} />)

    await openSheet()
    const toggle = screen.getByRole('button', { name: /qr code/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/scan to open on your phone/i)).toBeNull()
    expect(drawnInto).toHaveLength(0)

    await revealQr()
    await waitFor(() => expect(drawnInto).toHaveLength(1))
    expect(screen.getByRole('button', { name: /qr code/i }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/scan to open on your phone/i)).toBeTruthy()
  })

  // Reopening should land on the sheet's own content, not on a QR left
  // expanded from last time.
  it('re-collapses the disclosure when the sheet is closed and reopened', async () => {
    render(<AppTile app={APP} installed={false} isNew={false} editing={false} />)

    await openSheet()
    await revealQr()
    await waitFor(() => expect(drawnInto).toHaveLength(1))

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 })

    await openSheet()
    expect(screen.getByRole('button', { name: /qr code/i }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/scan to open on your phone/i)).toBeNull()
    expect(drawnInto).toHaveLength(1)
  })

  it('redraws when the dialog is closed and reopened', async () => {
    render(<AppTile app={APP} installed={false} isNew={false} editing={false} />)

    await openSheet()
    await revealQr()
    await waitFor(() => expect(drawnInto).toHaveLength(1))

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    // Modal keeps the portal alive for a 250ms close animation before
    // unmounting it, so reopening only redraws once that has elapsed.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 })

    await openSheet()
    await revealQr()
    await waitFor(() => expect(drawnInto).toHaveLength(2))
    expect(document.body.contains(drawnInto[1])).toBe(true)
  })
})

// The grid used to carry a "new" dot and an "installed" dot on each icon.
// Both are gone — a full screen of them was noise, not signal. What must
// survive is the install distinction reaching screen readers through the
// action wording, which is also the stretched link's accessible name.
describe('AppTile grid markup', () => {
  it('carries no new/installed marks on the tile', () => {
    const { container } = render(
      <AppTile app={APP} installed isNew editing={false} />
    )
    expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(0)
    expect(screen.queryByTitle('Installed')).toBeNull()
    expect(container.textContent).not.toMatch(/\(new\)|\(installed\)/)
  })

  it('still tells a screen reader an installed app is launchable, not installable', () => {
    render(<AppTile app={APP} installed isNew={false} editing={false} />)
    expect(screen.getByRole('link', { name: /^Launch The Cabinet/ })).toBeTruthy()
  })

  it('offers Install for an app that is not installed', () => {
    render(<AppTile app={APP} installed={false} isNew={false} editing={false} />)
    expect(screen.getByRole('link', { name: /^Install The Cabinet/ })).toBeTruthy()
  })
})
