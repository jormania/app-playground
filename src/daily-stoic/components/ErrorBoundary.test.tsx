// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(cleanup);

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders a recovery screen instead of crashing when a child throws', () => {
    // React logs the caught error to the console by design; silence it for this test.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something Interrupted the Reflection')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload the App' })).toBeTruthy();
    expect(screen.getByText(/boom/)).toBeTruthy();

    spy.mockRestore();
  });

  it('reloads the page when the reload button is clicked', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });

    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole('button', { name: 'Reload the App' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
