import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import FeaturePage from '@/app/feature/[trailId]/[featureId]';
import TrailPage from '@/app/trail/[id]';
import { DbTestProvider } from '@/db/DbContext';
import type { Db } from '@/db/db';
import { featureTotals, trailTotals } from '@/db/totals';
import { formatHours } from '@/format';
import { createTestDb } from '../helpers/testDb';
import { seedDay, seedFeature, seedTrail } from '../helpers/seed';

function withDb(db: Db, Screen: () => React.JSX.Element) {
  return () => (
    <DbTestProvider db={db}>
      <Screen />
    </DbTestProvider>
  );
}

async function renderAt(db: Db, url: string) {
  await renderRouter(
    {
      index: () => null,
      'trail/[id]': withDb(db, TrailPage),
      'feature/[trailId]/[featureId]': withDb(db, FeaturePage),
    },
    { initialUrl: url },
  );
}

describe('TrailPage', () => {
  let db: Db;
  let trailId: number;
  let loop: number;
  let spur: number;
  let oldest: number;
  let middle: number;
  let newest: number;
  let general: number;

  beforeEach(async () => {
    db = await createTestDb();
    trailId = await seedTrail(db, 'North Ridge');
    loop = await seedFeature(db, trailId, 'Upper Loop');
    spur = await seedFeature(db, trailId, 'Spur');
    oldest = await seedDay(db, {
      trailId,
      featureId: loop,
      startedAt: '2026-10-01T15:00:00Z',
      minutes: 90,
      summary: 'oldest',
      tools: ['Shovel'],
    });
    newest = await seedDay(db, {
      trailId,
      featureId: loop,
      startedAt: '2026-10-05T15:00:00Z',
      minutes: 60,
      summary: 'newest',
      tools: ['Shovel', 'Rake'],
    });
    middle = await seedDay(db, {
      trailId,
      featureId: null,
      startedAt: '2026-10-03T15:00:00Z',
      minutes: 30,
      summary: 'middle',
    });
    general = middle;
    await seedDay(db, {
      trailId,
      featureId: spur,
      startedAt: '2026-10-06T15:00:00Z',
      minutes: 500,
      status: 'needs_review',
    });
  });

  test('shows totals equal to trailTotals', async () => {
    const want = await trailTotals(db, trailId);

    await renderAt(db, `/trail/${trailId}`);

    await waitFor(() => expect(screen.getByTestId('totals-hours')).toBeOnTheScreen());
    expect(screen.getByTestId('totals-hours')).toHaveTextContent(formatHours(want.minutes), { exact: false });
    expect(screen.getByTestId('totals-hours')).toHaveTextContent('3 h', { exact: false });
    expect(screen.getByTestId('totals-days')).toHaveTextContent(String(want.days), { exact: false });
    expect(screen.getByTestId('totals-tools')).toHaveTextContent(want.topTools.join(', '), { exact: false });
    expect(screen.getByTestId('totals-dates')).not.toHaveTextContent('—', { exact: false });
  });

  test('shows feature subtotals and the general row when general has saved days', async () => {
    const wantLoop = await featureTotals(db, trailId, loop);
    const wantGeneral = await featureTotals(db, trailId, null);

    await renderAt(db, `/trail/${trailId}`);

    await waitFor(() => expect(screen.getByTestId(`feature-${loop}`)).toBeOnTheScreen());
    expect(screen.getByTestId(`feature-${loop}`)).toHaveTextContent('Upper Loop', { exact: false });
    expect(screen.getByTestId(`feature-${loop}`)).toHaveTextContent(formatHours(wantLoop.minutes), { exact: false });
    expect(screen.getByTestId(`feature-${spur}`)).toHaveTextContent('0 h', { exact: false });
    expect(screen.getByTestId('feature-general')).toHaveTextContent(formatHours(wantGeneral.minutes), { exact: false });
  });

  test('hides the general row when general has no saved days', async () => {
    const other = await seedTrail(db, 'Other');
    const otherFeature = await seedFeature(db, other, 'Only');
    await seedDay(db, { trailId: other, featureId: otherFeature, startedAt: '2026-10-02T15:00:00Z', minutes: 60 });
    await renderAt(db, `/trail/${other}`);

    await waitFor(() => expect(screen.getByTestId(`feature-${otherFeature}`)).toBeOnTheScreen());
    expect(screen.queryByTestId('feature-general')).toBeNull();
  });

  test('lists saved work days newest first', async () => {
    await renderAt(db, `/trail/${trailId}`);

    await waitFor(() => expect(screen.getByTestId(`work-day-${newest}`)).toBeOnTheScreen());
    const ids = screen.getAllByTestId(/^work-day-\d+$/).map((node) => node.props.testID as string);
    expect(ids).toEqual([`work-day-${newest}`, `work-day-${middle}`, `work-day-${oldest}`]);
    expect(screen.getByTestId(`work-day-${newest}`)).toHaveTextContent('newest', { exact: false });
    expect(screen.getByTestId(`work-day-${newest}`)).toHaveTextContent('1 h', { exact: false });
  });

  test('feature page for general lists only feature-less days', async () => {
    const want = await featureTotals(db, trailId, null);

    await renderAt(db, `/feature/${trailId}/general`);

    await waitFor(() => expect(screen.getByTestId(`work-day-${general}`)).toBeOnTheScreen());
    expect(screen.getAllByTestId(/^work-day-\d+$/)).toHaveLength(1);
    expect(screen.getByTestId('totals-hours')).toHaveTextContent(formatHours(want.minutes), { exact: false });
  });

  test('feature page lists only that feature days', async () => {
    const want = await featureTotals(db, trailId, loop);

    await renderAt(db, `/feature/${trailId}/${loop}`);

    await waitFor(() => expect(screen.getByTestId(`work-day-${newest}`)).toBeOnTheScreen());
    expect(screen.getAllByTestId(/^work-day-\d+$/)).toHaveLength(2);
    expect(screen.getByTestId('totals-hours')).toHaveTextContent(formatHours(want.minutes), { exact: false });
    expect(screen.getByTestId('totals-days')).toHaveTextContent(String(want.days), { exact: false });
  });
});
