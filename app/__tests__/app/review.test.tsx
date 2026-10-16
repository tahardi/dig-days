import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Review from '@/app/review/[id]';
import type { Draft } from '@/api/types';
import type { Db } from '@/db/db';
import { DbTestProvider } from '@/db/DbContext';
import { getWorkDay } from '@/db/workDays';

import { seedFeature, seedTrail } from '../helpers/seed';
import { createTestDb } from '../helpers/testDb';

const processNew = require('../../../api/testdata/process-response-new.json');
const processExisting = require('../../../api/testdata/process-response-existing.json');

jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockParams = jest.mocked(useLocalSearchParams);
const replace = jest.fn();

async function seedReviewDay(db: Db, draftJson: string, transcript: string, status = 'needs_review') {
  await db.runAsync(
    'INSERT INTO work_days (status, started_at, ended_at, duration_minutes, transcript, draft_json) ' +
      'VALUES (?, ?, ?, ?, ?, ?)',
    status,
    '2026-10-08T10:00:00.000Z',
    '2026-10-08T14:00:00.000Z',
    240,
    transcript,
    draftJson,
  );
}

async function count(db: Db, table: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row!.n;
}

async function renderReview(db: Db) {
  await render(
    <DbTestProvider db={db}>
      <Review />
    </DbTestProvider>,
  );
}

describe('Review', () => {
  let db: Db;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockParams.mockReturnValue({ id: '1' });
    db = await createTestDb();
    const whiteWolf = await seedTrail(db, 'White Wolf');
    await seedTrail(db, 'Ridgeback');
    await seedFeature(db, whiteWolf, 'Step-up #1');
    await seedFeature(db, whiteWolf, 'Step-up #2');
  });

  test('renders the transcript and notes, then saves a new trail and feature only on submit', async () => {
    await seedReviewDay(db, JSON.stringify(processNew.draft), processNew.transcript);
    await renderReview(db);

    expect(await screen.findByTestId('review-transcript')).toHaveTextContent(processNew.transcript);
    expect(screen.getByTestId('review-notes')).toHaveTextContent(processNew.draft.notes);
    expect(screen.getByTestId('duration-input').props.value).toBe('240');
    expect(await count(db, 'trails')).toBe(2);
    expect(await count(db, 'features')).toBe(2);

    await fireEvent(screen.getByTestId('break-toggle'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('form-submit'));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    const day = await getWorkDay(db, 1);
    expect(day).toMatchObject({ status: 'saved', durationMinutes: 180, summary: processNew.draft.summary });
    expect(day?.tools).toEqual(['rock bar']);
    const trail = await db.getFirstAsync<{ id: number }>("SELECT id FROM trails WHERE name = 'Granite Ridge'");
    const feature = await db.getFirstAsync<{ id: number; trail_id: number }>(
      "SELECT id, trail_id FROM features WHERE name = 'Berm'",
    );
    expect(day?.trailId).toBe(trail?.id);
    expect(day?.featureId).toBe(feature?.id);
    expect(feature?.trail_id).toBe(trail?.id);
  });

  test('links an existing trail and feature without creating anything', async () => {
    await seedReviewDay(db, JSON.stringify(processExisting.draft), processExisting.transcript);
    await renderReview(db);

    await waitFor(() => expect(screen.getByTestId('trail-picker-option-1')).toBeSelected());
    await waitFor(() => expect(screen.getByTestId('feature-picker-option-2')).toBeSelected());
    expect(screen.queryByTestId('review-notes')).toBeNull();
    await fireEvent.press(screen.getByTestId('form-submit'));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(await getWorkDay(db, 1)).toMatchObject({ status: 'saved', trailId: 1, featureId: 2 });
    expect(await count(db, 'trails')).toBe(2);
    expect(await count(db, 'features')).toBe(2);
  });

  test('reuses an existing trail when the proposed name matches case-insensitively', async () => {
    const draft: Draft = {
      ...processNew.draft,
      trail: { existing_id: null, new_name: 'white wolf' },
      feature: { existing_id: null, new_name: 'step-up #1' },
    };
    await seedReviewDay(db, JSON.stringify(draft), processNew.transcript);
    await renderReview(db);

    await screen.findByTestId('review-transcript');
    await fireEvent.press(screen.getByTestId('form-submit'));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(await getWorkDay(db, 1)).toMatchObject({ status: 'saved', trailId: 1, featureId: 1 });
    expect(await count(db, 'trails')).toBe(2);
    expect(await count(db, 'features')).toBe(2);
  });

  test('error - malformed draft falls back to an empty form', async () => {
    await seedReviewDay(db, '{not json', 'Some transcript.');
    await renderReview(db);

    expect(await screen.findByText("Couldn't read the draft; fill in the entry by hand.")).toBeTruthy();
    expect(screen.getByTestId('review-transcript')).toHaveTextContent('Some transcript.');
    await fireEvent.press(screen.getByTestId('form-submit'));
    expect(await screen.findByTestId('form-error')).toHaveTextContent('Pick a trail');
    expect(replace).not.toHaveBeenCalled();
  });

  test('a day that is not waiting for review shows a message and a way back', async () => {
    await seedReviewDay(db, JSON.stringify(processNew.draft), processNew.transcript, 'saved');
    await renderReview(db);

    expect(await screen.findByText('Nothing to review')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('back-button'));

    expect(replace).toHaveBeenCalledWith('/');
  });
});
