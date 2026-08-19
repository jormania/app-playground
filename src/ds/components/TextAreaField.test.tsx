// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TextAreaField } from './TextAreaField'

describe('TextAreaField', () => {
  afterEach(cleanup)

  it('renders a real textarea, not an input', () => {
    render(<TextAreaField label="Why" defaultValue="a\nb" />)
    expect(screen.getByLabelText('Why').tagName).toBe('TEXTAREA')
  })

  it('associates its label even without an explicit id', () => {
    render(<TextAreaField label="Body" />)
    const area = screen.getByLabelText('Body')
    expect(area.id).toBeTruthy()
  })

  it('shows the error in place of the hint and marks the control invalid', () => {
    render(<TextAreaField label="Body" hint="a hint" error="required" />)
    const area = screen.getByLabelText('Body')
    expect(area.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe('required')
    expect(screen.queryByText('a hint')).toBeNull()
  })

  it('defaults to four rows and lets a caller override them', () => {
    const { rerender } = render(<TextAreaField label="Body" />)
    expect(screen.getByLabelText('Body').getAttribute('rows')).toBe('4')
    rerender(<TextAreaField label="Body" rows={9} />)
    expect(screen.getByLabelText('Body').getAttribute('rows')).toBe('9')
  })
})
