// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsToggle } from './SettingsToggle';

afterEach(cleanup);

describe('SettingsToggle', () => {
  it('renders label and hint correctly', () => {
    render(<SettingsToggle label="Enable reminders" hint="Receive daily notifications" />);
    expect(screen.getByText('Enable reminders')).toBeTruthy();
    expect(screen.getByText('Receive daily notifications')).toBeTruthy();
  });

  it('toggles value when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsToggle label="Toggle me" checked={false} onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
