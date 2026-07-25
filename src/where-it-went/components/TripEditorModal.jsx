import { useState, useEffect } from 'react';
import { Modal } from '../../ds/components/Modal';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

export default function TripEditorModal({ isOpen, onClose, trip, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('Planned');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (trip) {
      setName(trip.name || '');
      setDestination(trip.destination || '');
      setStartDate(trip.startDate || '');
      setEndDate(trip.endDate || '');
      setStatus(trip.status || 'Planned');
      setNotes(trip.notes || '');
    } else {
      setName('');
      setDestination('');
      setStartDate('');
      setEndDate('');
      setStatus('Planned');
      setNotes('');
    }
  }, [trip, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !name.trim()) return;

    setSaving(true);
    const tripData = {
      name: name.trim(),
      destination: destination.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      status,
      notes: notes.trim()
    };

    try {
      await onSave(trip ? trip.id : null, tripData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} title={trip ? 'Edit Trip' : 'Add Trip'} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Field label="Trip Name" placeholder="e.g. Billund 2025" value={name} onChange={e => setName(e.target.value)} required />
        <Field label="Destination" placeholder="e.g. Billund, Denmark" value={destination} onChange={e => setDestination(e.target.value)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)' }}>
          <Field label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Field label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Status</label>
          <SegmentedControl
            value={status}
            onChange={val => setStatus(val)}
            options={[
              { value: 'Planned', label: 'Planned' },
              { value: 'Active', label: 'Active' },
              { value: 'Completed', label: 'Completed' }
            ]}
          />
        </div>

        <Field label="Notes" placeholder="Optional trip notes or itinerary summary..." value={notes} onChange={e => setNotes(e.target.value)} />

        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
          {trip && (
            <div style={{ marginRight: 'auto' }}>
              <Button type="button" variant="danger" disabled={saving} onClick={async () => {
                if (confirm('Are you sure you want to delete this trip?')) {
                  setSaving(true);
                  await onDelete(trip.id);
                  setSaving(false);
                  onClose();
                }
              }}>Delete</Button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: trip ? 0 : 'auto' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
