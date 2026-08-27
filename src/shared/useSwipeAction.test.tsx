// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { useSwipeAction } from './useSwipeAction'

afterEach(cleanup)

function Harness({ onSwipeLeft, onSwipeRight, disabled = false }: {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  disabled?: boolean
}) {
  const { dx, revealing, bind } = useSwipeAction({ onSwipeLeft, onSwipeRight, disabled })
  return (
    <div data-testid="row" data-dx={dx} data-revealing={revealing ?? ''} {...bind} />
  )
}

/** setPointerCapture doesn't exist in happy-dom; the hook already swallows the
 *  throw, this just keeps the test output quiet. */
function drag(el: Element, path: { x: number; y: number }[]) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: path[0].x, clientY: path[0].y, pointerType: 'touch', button: 0 })
  for (const { x, y } of path.slice(1)) {
    fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y })
  }
}

describe('useSwipeAction', () => {
  it('fires onSwipeLeft once the drag crosses the threshold leftward', () => {
    const onSwipeLeft = vi.fn()
    render(<Harness onSwipeLeft={onSwipeLeft} />)
    const row = screen.getByTestId('row')
    drag(row, [{ x: 200, y: 0 }, { x: 100, y: 0 }])
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 100, clientY: 0 })
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it('does not fire short of the threshold', () => {
    const onSwipeLeft = vi.fn()
    render(<Harness onSwipeLeft={onSwipeLeft} />)
    const row = screen.getByTestId('row')
    drag(row, [{ x: 200, y: 0 }, { x: 160, y: 0 }])
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 160, clientY: 0 })
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('hands vertical movement back to the scroller, never firing a swipe', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    render(<Harness onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />)
    const row = screen.getByTestId('row')
    drag(row, [{ x: 200, y: 0 }, { x: 210, y: 120 }])
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 210, clientY: 120 })
    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('is inert while disabled', () => {
    const onSwipeLeft = vi.fn()
    render(<Harness onSwipeLeft={onSwipeLeft} disabled />)
    const row = screen.getByTestId('row')
    drag(row, [{ x: 200, y: 0 }, { x: 80, y: 0 }])
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 80, clientY: 0 })
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('resets dx to 0 once the gesture ends, win or not', () => {
    render(<Harness onSwipeLeft={() => {}} />)
    const row = screen.getByTestId('row')
    drag(row, [{ x: 200, y: 0 }, { x: 100, y: 0 }])
    expect(Number(row.getAttribute('data-dx'))).not.toBe(0)
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 100, clientY: 0 })
    expect(row.getAttribute('data-dx')).toBe('0')
  })
})
