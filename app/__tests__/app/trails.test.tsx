import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import Trails from '@/app/(tabs)/trails';
import { DbTestProvider } from '@/db/DbContext';
import type { Db } from '@/db/db';
import { createTestDb } from '../helpers/testDb';
import { seedDay, seedTrail } from '../helpers/seed';

async function renderTrails(db: Db) {
  await renderRouter({
    index: () => (
      <DbTestProvider db={db}>
        <Trails />
      </DbTestProvider>
    ),
  });
}

describe('Trails', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  test('shows the empty state when there are no trails', async () => {
    await renderTrails(db);

    await waitFor(() =>
      expect(screen.getByTestId('trails-empty')).toHaveTextContent('No trails yet. Save a dig day to add one.'),
    );
  });

  test('shows each trail with its saved hours only', async () => {
    const north = await seedTrail(db, 'North Ridge');
    const south = await seedTrail(db, 'South Loop');
    const quiet = await seedTrail(db, 'Quiet');
    await seedDay(db, { trailId: north, startedAt: '2026-10-02T15:00:00Z', minutes: 90 });
    await seedDay(db, { trailId: north, startedAt: '2026-10-03T15:00:00Z', minutes: 60 });
    await seedDay(db, { trailId: north, startedAt: '2026-10-04T15:00:00Z', minutes: 600, status: 'needs_review' });
    await seedDay(db, { trailId: south, startedAt: '2026-10-02T15:00:00Z', minutes: 605 });

    await renderTrails(db);

    await waitFor(() => expect(screen.getByTestId(`trail-${north}`)).toBeOnTheScreen());
    expect(screen.getByTestId(`trail-${north}`)).toHaveTextContent('North Ridge', { exact: false });
    expect(screen.getByTestId(`trail-${north}`)).toHaveTextContent('2.5 h', { exact: false });
    expect(screen.getByTestId(`trail-${south}`)).toHaveTextContent('10.1 h', { exact: false });
    expect(screen.getByTestId(`trail-${quiet}`)).toHaveTextContent('0 h', { exact: false });
    expect(screen.queryByTestId('trails-empty')).toBeNull();
  });
});
