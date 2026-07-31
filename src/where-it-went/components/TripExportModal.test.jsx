/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TripExportModal from './TripExportModal';
import { FeaturesContext } from '../FeaturesContext';

describe('TripExportModal', () => {
  it('renders without crashing', () => {
    const trip = { id: 'trip-1', name: 'Test Trip' };
    const data = {
      transactions: [
        { id: 'tx-1', amount: 100, categoryId: 'cat-1', tripId: 'trip-1', type: 'Expense' }
      ],
      categories: [
        { id: 'cat-1', name: 'Travel' }
      ]
    };
    
    render(
      <FeaturesContext.Provider value={{}}>
        <TripExportModal trip={trip} data={data} onClose={() => {}} />
      </FeaturesContext.Provider>
    );

    expect(screen.getByText('Test Trip')).toBeInTheDocument();
  });
});
