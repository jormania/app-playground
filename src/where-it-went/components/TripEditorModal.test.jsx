/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import TripEditorModal from './TripEditorModal';

describe('TripEditorModal Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<TripEditorModal isOpen={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Add Trip form when open and trip is null', () => {
    render(<TripEditorModal isOpen={true} onClose={vi.fn()} trip={null} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getAllByText('Add Trip')[0]).toBeDefined();
    expect(screen.getByLabelText(/Trip Name/i)).toBeDefined();
  });

  it('populates fields when editing an existing trip and handles save', async () => {
    const trip = { id: 't1', name: 'Billund 2025', destination: 'Denmark', status: 'Completed', startDate: '2025-05-10', endDate: '2025-05-15', notes: 'Legoland' };
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(<TripEditorModal isOpen={true} onClose={onClose} trip={trip} onSave={onSave} onDelete={vi.fn()} />);
    expect(screen.getByDisplayValue('Billund 2025')).toBeDefined();
    expect(screen.getByDisplayValue('Denmark')).toBeDefined();

    const saveBtn = screen.getAllByText('Save')[0];
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('t1', expect.objectContaining({
        name: 'Billund 2025',
        destination: 'Denmark',
        status: 'Completed'
      }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
