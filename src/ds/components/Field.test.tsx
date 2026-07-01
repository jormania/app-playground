// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Field } from './Field'

afterEach(cleanup)

describe('Field', () => {
  it('associates the label with the input', () => {
    render(<Field label="Email" />)
    // getByLabelText resolves only if the label is wired to the control.
    const input = screen.getByLabelText('Email')
    expect(input.tagName).toBe('INPUT')
  })

  it('renders a hint and points aria-describedby at it', () => {
    render(<Field label="Email" hint="No spam." />)
    const input = screen.getByLabelText('Email')
    const hint = screen.getByText('No spam.')
    expect(input.getAttribute('aria-describedby')).toBe(hint.id)
    expect(input.getAttribute('aria-invalid')).toBeNull()
  })

  it('lets an error take precedence: shown, invalid, described-by, hint hidden', () => {
    render(<Field label="Handle" hint="Your public name" error="Already taken" />)
    const input = screen.getByLabelText('Handle')
    const error = screen.getByRole('alert')
    expect(error.textContent).toBe('Already taken')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(error.id)
    expect(screen.queryByText('Your public name')).toBeNull()
  })

  it('marks a required field for assistive tech', () => {
    render(<Field label="API key" required />)
    expect(screen.getByRole('textbox').getAttribute('aria-required')).toBe('true')
  })
})
