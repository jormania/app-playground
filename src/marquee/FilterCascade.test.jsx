// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FilterCascade from './FilterCascade.jsx';

afterEach(cleanup);

const level = (over = {}) => ({
  id: 'type',
  label: 'Type',
  value: null,
  options: [
    { key: 'play', label: 'Theatre', count: 3 },
    { key: 'movie', label: 'Cinema', count: 7 },
  ],
  allCount: 10,
  onChange: vi.fn(),
  focus: vi.fn(),
  ...over,
});

const venueLevel = (over = {}) => level({
  id: 'venue',
  label: 'Venue',
  options: [{ key: 'ARCUB', label: 'ARCUB', count: 2 }],
  minOptions: 1,
  allCount: 2,
  ...over,
});

describe('FilterCascade', () => {
  it('gives every level its own labelled group, an All chip and one chip per option', () => {
    render(<FilterCascade levels={[level()]} onReset={vi.fn()} />);
    const group = screen.getByRole('group', { name: 'Type' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Theatre' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cinema' })).toBeTruthy();
  });

  it('shows each option’s count without letting it into the chip’s name', () => {
    // "Theatre 3" is not what anyone calls this filter — the number is a
    // visual aid, so it is aria-hidden and the accessible name stays "Theatre".
    render(<FilterCascade levels={[level()]} onReset={vi.fn()} />);
    const chip = screen.getByRole('button', { name: 'Theatre' });
    expect(chip.textContent).toContain('3');
    expect(screen.queryByRole('button', { name: 'Theatre 3' })).toBeNull();
  });

  it('a level with nothing to choose between does not render at all', () => {
    // One hall narrows nothing and says nothing.
    render(<FilterCascade levels={[level({ id: 'hall', label: 'Hall', options: [{ key: 'Sala Mare', label: 'Sala Mare', count: 2 }] })]} onReset={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Hall' })).toBeNull();
  });

  it('the venue level earns its place at a single option, because stepping into it reveals the hall level', () => {
    render(<FilterCascade levels={[venueLevel()]} onReset={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Venue' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ARCUB' })).toBeTruthy();
  });

  it('picking an option reports it, and re-tapping the active one clears that level', () => {
    const onChange = vi.fn();
    render(<FilterCascade levels={[level({ value: 'play', onChange })]} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cinema' }));
    expect(onChange).toHaveBeenLastCalledWith('movie');

    fireEvent.click(screen.getByRole('button', { name: 'Theatre' }));
    expect(onChange).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('marks the chosen chip pressed, and the All chip pressed when nothing is', () => {
    const { rerender } = render(<FilterCascade levels={[level()]} onReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');

    rerender(<FilterCascade levels={[level({ value: 'play' })]} onReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Theatre' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('the path reads "Everything" while nothing is picked, with nothing to press', () => {
    render(<FilterCascade levels={[level(), venueLevel()]} onReset={vi.fn()} />);
    const path = screen.getByRole('navigation', { name: 'Filter the programme' });
    expect(path.textContent).toContain('Everything');
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).toBeNull();
  });

  it('the path names each chosen level, and its crumbs drop only what is below them', () => {
    const typeFocus = vi.fn();
    const onReset = vi.fn();
    render(
      <FilterCascade
        levels={[
          level({ value: 'play', valueLabel: 'Theatre', focus: typeFocus }),
          venueLevel({ value: 'ARCUB' }),
        ]}
        onReset={onReset}
      />,
    );

    const path = screen.getByRole('navigation', { name: 'Filter the programme' });
    expect(path.textContent).toContain('Theatre');
    expect(path.textContent).toContain('ARCUB');

    // The deepest crumb is where you already are — a marker, not a button.
    expect(screen.queryByRole('button', { name: 'Back to ARCUB' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Theatre' }));
    expect(typeFocus).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(onReset).toHaveBeenCalled();
  });
});
