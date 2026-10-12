import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import Today from '@/app/(tabs)/index';
import { getPin } from '@/capture/location';
import type { Db } from '@/db/db';
import { DbTestProvider } from '@/db/DbContext';
import { getActiveWorkDay, getWorkDay, startWorkDay } from '@/db/workDays';

import { createTestDb } from '../helpers/testDb';

jest.mock('@/capture/location', () => ({ getPin: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const mockGetPin = jest.mocked(getPin);
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
});
