import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import Today from '@/app/(tabs)/index';
import { checkHealth } from '@/api/client';
import { getPin } from '@/capture/location';
import type { Db } from '@/db/db';
import { DbTestProvider } from '@/db/DbContext';
import { getActiveWorkDay, getWorkDay, startWorkDay } from '@/db/workDays';
import { processAll } from '@/processing/processAll';
import { loadBackendConfig } from '@/settings/store';

import { seedDay, seedTrail } from '../helpers/seed';
import { createTestDb } from '../helpers/testDb';

jest.mock('@/capture/location', () => ({ getPin: jest.fn() }));
jest.mock('@/api/client', () => ({ checkHealth: jest.fn(), processClip: jest.fn() }));
jest.mock('@/settings/store', () => ({ loadBackendConfig: jest.fn() }));
jest.mock('@/processing/processAll', () => ({ processAll: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: (effect: () => void | (() => void)) => {
    require('react').useEffect(effect, [effect]);
  },
}));

const mockGetPin = jest.mocked(getPin);
const mockCheckHealth = jest.mocked(checkHealth);
const mockLoadConfig = jest.mocked(loadBackendConfig);
const mockProcessAll = jest.mocked(processAll);
const config = { url: 'http://127.0.0.1:8080', key: 'secret' };

async function seedQueued(db: Db, status: string, startedAt = '2026-10-08T12:00:00.000Z'): Promise<number> {
  const trailId = await seedTrail(db, `Trail ${startedAt}${status}`);
  return seedDay(db, { trailId, startedAt, minutes: 60, status });
}
const mockUseRouter = jest.mocked(useRouter);
const push = jest.fn();

async function renderToday(db: Db) {
  await render(
    <DbTestProvider db={db}>
      <Today />
    </DbTestProvider>,
  );
}

describe('Today', () => {
  let db: Db;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockUseRouter.mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    mockGetPin.mockResolvedValue({ lat: 44.4759, lon: -73.2121 });
    mockLoadConfig.mockResolvedValue(config);
    mockCheckHealth.mockResolvedValue({ ok: true, value: null });
    db = await createTestDb();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('start creates an active day and shows the timer and stop button', async () => {
    await renderToday(db);

    await fireEvent.press(await screen.findByTestId('start-button'));

    await waitFor(() => expect(screen.getByTestId('stop-button')).toBeTruthy());
    expect(screen.getByTestId('elapsed-timer')).toBeTruthy();
    const active = await getActiveWorkDay(db);
    expect(active).toMatchObject({ status: 'active', lat: 44.4759, lon: -73.2121 });
  });

  test('start shows a disabled button while the location is loading', async () => {
    let resolvePin: (pin: null) => void = () => {};
    mockGetPin.mockReturnValue(new Promise((resolve) => (resolvePin = resolve)));
    await renderToday(db);

    const start = await screen.findByTestId('start-button');

    const pressed = fireEvent.press(start);

    await waitFor(() => expect(screen.getByText('Getting location…')).toBeTruthy());
    expect(screen.getByTestId('start-button')).toBeDisabled();
    await act(async () => resolvePin(null));
    await pressed;
    await waitFor(() => expect(screen.getByTestId('stop-button')).toBeTruthy());
  });

  test('start without a pin still creates the day', async () => {
    mockGetPin.mockResolvedValue(null);
    await renderToday(db);

    await fireEvent.press(await screen.findByTestId('start-button'));

    await waitFor(() => expect(screen.getByTestId('stop-button')).toBeTruthy());
    const active = await getActiveWorkDay(db);
    expect(active).toMatchObject({ status: 'active', lat: null, lon: null });
  });

  test('pressing start twice quickly creates one day', async () => {
    let resolvePin: (pin: null) => void = () => {};
    mockGetPin.mockReturnValue(new Promise((resolve) => (resolvePin = resolve)));
    await renderToday(db);
    const start = await screen.findByTestId('start-button');

    const first = fireEvent.press(start);
    await waitFor(() => expect(screen.getByText('Getting location…')).toBeTruthy());
    await fireEvent.press(start);
    await act(async () => resolvePin(null));
    await first;

    await waitFor(() => expect(screen.getByTestId('stop-button')).toBeTruthy());
    const rows = await db.getAllAsync<{ id: number }>('SELECT id FROM work_days');
    expect(rows).toHaveLength(1);
    expect(mockGetPin).toHaveBeenCalledTimes(1);
  });

  test('stop ends the day and opens the record screen', async () => {
    await renderToday(db);
    await fireEvent.press(await screen.findByTestId('start-button'));

    await fireEvent.press(await screen.findByTestId('stop-button'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/record/1'));
    expect((await getWorkDay(db, 1))?.status).toBe('needs_recording');
    expect(await getActiveWorkDay(db)).toBeNull();
  });

  test('an existing active day shows the elapsed time after a restart', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(new Date('2026-10-08T12:00:00.000Z'));
    await startWorkDay(db, new Date('2026-10-08T11:00:00.000Z'), null);

    await renderToday(db);

    await waitFor(() => expect(screen.getByTestId('elapsed-timer')).toHaveTextContent('1:00:00'));
    expect(screen.getByTestId('stop-button')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('elapsed-timer')).toHaveTextContent('1:00:01');
  });

  test('renders an empty queue container', async () => {
    await renderToday(db);

    expect(await screen.findByTestId('queue')).toBeTruthy();
  });

  test('lists queued days with their actions', async () => {
    const record = await seedQueued(db, 'needs_recording', '2026-10-06T12:00:00.000Z');
    const waiting = await seedQueued(db, 'needs_processing', '2026-10-07T12:00:00.000Z');
    const review = await seedQueued(db, 'needs_review', '2026-10-08T12:00:00.000Z');
    await seedQueued(db, 'saved', '2026-10-09T12:00:00.000Z');
    await renderToday(db);

    expect(await screen.findByTestId(`queue-item-${record}`)).toHaveTextContent(/Needs recording/);
    expect(screen.getByTestId(`queue-item-${waiting}`)).toHaveTextContent(/Waiting to process/);
    expect(screen.getByTestId(`queue-item-${review}`)).toHaveTextContent(/Ready to review/);
    expect(screen.queryAllByTestId(/^queue-item-/)).toHaveLength(3);
    await fireEvent.press(screen.getByTestId(`record-${record}`));
    expect(push).toHaveBeenCalledWith(`/record/${record}`);
    await fireEvent.press(screen.getByTestId(`review-${review}`));
    expect(push).toHaveBeenCalledWith(`/review/${review}`);
  });

  test('process-all is disabled when nothing is waiting', async () => {
    await seedQueued(db, 'needs_review');
    await renderToday(db);

    await screen.findByTestId('queue-item-1');
    await waitFor(() => expect(mockCheckHealth).toHaveBeenCalled());
    expect(screen.getByTestId('process-all')).toBeDisabled();
  });

  test('process-all is disabled when the health check fails', async () => {
    mockCheckHealth.mockResolvedValue({ ok: false, kind: 'unreachable', message: 'offline' });
    await seedQueued(db, 'needs_processing');
    await renderToday(db);

    await screen.findByTestId('queue-item-1');
    await waitFor(() => expect(mockCheckHealth).toHaveBeenCalled());
    expect(screen.getByTestId('process-all')).toBeDisabled();
  });

  test('process-all is disabled without a backend config', async () => {
    mockLoadConfig.mockResolvedValue(null);
    await seedQueued(db, 'needs_processing');
    await renderToday(db);

    await screen.findByTestId('queue-item-1');
    await waitFor(() => expect(mockLoadConfig).toHaveBeenCalled());
    expect(screen.getByTestId('process-all')).toBeDisabled();
    expect(mockCheckHealth).not.toHaveBeenCalled();
  });

  test('process-all runs once, shows progress, then refreshes the list', async () => {
    const id = await seedQueued(db, 'needs_processing');
    let finish: () => void = () => {};
    mockProcessAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => {
            db.runAsync("UPDATE work_days SET status = 'needs_review' WHERE id = ?", id).then(() =>
              resolve({ processed: 1, failed: 0 }),
            );
          };
        }),
    );
    await renderToday(db);
    await waitFor(() => expect(screen.getByTestId('process-all')).toBeEnabled());

    const pressed = fireEvent.press(screen.getByTestId('process-all'));

    await waitFor(() => expect(screen.getByText('Processing…')).toBeTruthy());
    expect(screen.getByTestId('process-all')).toBeDisabled();
    await act(async () => finish());
    await pressed;
    await waitFor(() => expect(screen.getByText('Ready to review')).toBeTruthy());
    expect(mockProcessAll).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('process-all')).toBeDisabled();
  });
});
