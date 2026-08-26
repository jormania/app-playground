// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import KeepSheet from './KeepSheet.jsx';
import { buildFindingsIndex, EMPTY_INDEX } from './findings.js';

/**
 * The keep sheet is where Marquee stops being a reader and starts writing into
 * Wanderlist, so the two things worth pinning are what it hands over (never
 * `going`) and that it survives being closed — the sheet's `showing` is cleared
 * one render before its draft is, and reading it on that render took the whole
 * app to a white screen right after a save succeeded.
 */

afterEach(cleanup);

const showing = {
  key: 'k',
  venue: 'Expirat Halele Carol',
  title: 'Ana Coman',
  date: '2026-08-26',
  time: '20:00',
  hall: null,
  link: 'https://tickets.expirat.org/x',
  ticketState: 'open',
  price: 50,
};

const venue = { name: 'Expirat Halele Carol', address: 'Str. Istrati 1, București', category: 'concert' };

const open = (props = {}) => render(
  <KeepSheet
    open
    showing={showing}
    venue={venue}
    findings={EMPTY_INDEX}
    onSave={vi.fn()}
    onClose={vi.fn()}
    {...props}
  />,
);

/** A Findings row matching the showing above. */
const already = buildFindingsIndex([{
  id: 'f1',
  name: 'Ana Coman',
  place: 'Expirat Halele Carol, Str. Istrati 1, București',
  plannedDate: '2026-08-26',
  dateExpiring: '2026-08-26',
  attended: false,
  going: false,
}]);

function field(label) {
  return screen.getByLabelText(new RegExp(label, 'i'));
}

describe('KeepSheet', () => {
  it('opens with the showing already filled in', () => {
    open();
    expect(field('name').value).toBe('Ana Coman');
    expect(field('place').value).toBe('Expirat Halele Carol, Str. Istrati 1, București');
    expect(field('cost').value).toBe('50');
    expect(field('planned date').value).toBe('2026-08-26');
  });

  it('says out loud that it is not marking you as going', () => {
    open();
    expect(screen.getByText(/never marks you as committed/i)).toBeTruthy();
  });

  it('renders nothing once the showing is cleared, rather than crashing', () => {
    const { rerender } = open();
    // The DS Modal portals out of the render container, so presence is checked on
    // the document rather than on `container`.
    expect(document.querySelector('form.vform')).toBeTruthy();
    expect(() => rerender(
      <KeepSheet open={false} showing={undefined} venue={venue} onSave={vi.fn()} onClose={vi.fn()} />,
    )).not.toThrow();
    expect(document.querySelector('form.vform')).toBeNull();
  });

  it('hands the draft to onSave and then closes', async () => {
    const onSave = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    open({ onSave, onClose });

    fireEvent.submit(document.querySelector('form.vform'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Ana Coman',
      category: 'concert',
      going: false,
      attended: false,
      plannedDate: '2026-08-26',
      cost: 50,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the sheet open and shows why when the save fails', async () => {
    const onClose = vi.fn();
    open({ onSave: vi.fn().mockRejectedValue(new Error('Notion said no')), onClose });

    fireEvent.submit(document.querySelector('form.vform'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Notion said no');
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('when it is already in Wanderlist', () => {
    it('refuses to save on the first press, and says why', async () => {
      const onSave = vi.fn();
      open({ findings: already, onSave });

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('already in Wanderlist');
      expect(screen.queryByRole('button', { name: /keep it/i })).toBeNull();

      // Even submitting the form directly must not write a second row.
      fireEvent.submit(document.querySelector('form.vform'));
      await waitFor(() => expect(onSave).not.toHaveBeenCalled());
    });

    it('allows a deliberate second copy after an explicit confirm', async () => {
      const onSave = vi.fn().mockResolvedValue();
      open({ findings: already, onSave });

      fireEvent.click(screen.getByRole('button', { name: /keep a second copy/i }));
      fireEvent.submit(document.querySelector('form.vform'));

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    });

    it('does not block a different night of the same production', async () => {
      const onSave = vi.fn().mockResolvedValue();
      open({
        showing: { ...showing, date: '2026-08-27', key: 'k2' },
        production: { title: 'Ana Coman', venue: 'Expirat Halele Carol', showings: [] },
        findings: already,
        onSave,
      });

      // It says a sibling exists, but the save is allowed — a second night is a
      // second thing, not a duplicate.
      expect(screen.getByText(/Another date of/i)).toBeTruthy();
      fireEvent.submit(document.querySelector('form.vform'));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    });

    it('does not block the same title at a different venue', async () => {
      const onSave = vi.fn().mockResolvedValue();
      open({
        showing: { ...showing, venue: 'Club Control' },
        venue: { name: 'Club Control', address: 'Str. Mille 4', category: 'concert' },
        findings: already,
        onSave,
      });
      fireEvent.submit(document.querySelector('form.vform'));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    });
  });

  it('carries an edit through to the draft', async () => {
    const onSave = vi.fn().mockResolvedValue();
    open({ onSave });

    fireEvent.change(field('name'), { target: { value: 'Ana Coman — Hidden Gems' } });
    fireEvent.submit(document.querySelector('form.vform'));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].name).toBe('Ana Coman — Hidden Gems');
  });
});
