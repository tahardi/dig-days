import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';

import Record from '@/app/record/[id]';
import { persistClip } from '@/capture/audioFiles';
import type { Db } from '@/db/db';
import { DbTestProvider } from '@/db/DbContext';
import { getWorkDay, startWorkDay, stopWorkDay } from '@/db/workDays';

import { createTestDb } from '../helpers/testDb';

const mockRecorder = {
  uri: null as string | null,
  prepareToRecordAsync: jest.fn(),
  record: jest.fn(),
  stop: jest.fn(),
};
const mockRecorderState = { isRecording: false, durationMillis: 0 };
const mockListeners = new Set<() => void>();
const mockPlayer = { play: jest.fn(), seekTo: jest.fn() };

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => {
    const { useEffect, useState } = jest.requireActual('react');
    const [, setTick] = useState(0);
    useEffect(() => {
      const listener = () => setTick((n: number) => n + 1);
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    }, []);
    return { ...mockRecorderState };
  },
  useAudioPlayer: () => mockPlayer,
}));
jest.mock('@/capture/audioFiles', () => ({ persistClip: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn() }));

const mockPermission = jest.mocked(requestRecordingPermissionsAsync);
const mockPersist = jest.mocked(persistClip);
const mockUseRouter = jest.mocked(useRouter);
const mockParams = jest.mocked(useLocalSearchParams);
const replace = jest.fn();

function recordNextClip(uri: string) {
  mockRecorder.record.mockImplementation(() => {
    mockRecorderState.isRecording = true;
    mockListeners.forEach((listener) => listener());
  });
  mockRecorder.stop.mockImplementation(async () => {
    mockRecorderState.isRecording = false;
    mockRecorder.uri = uri;
    mockListeners.forEach((listener) => listener());
  });
}

async function renderRecord(db: Db) {
  await render(
    <DbTestProvider db={db}>
      <Record />
    </DbTestProvider>,
  );
}

async function recordClip() {
  await waitFor(() => expect(screen.getByTestId('record-button')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('record-button'));
  await fireEvent.press(await screen.findByTestId('record-button'));
}

describe('Record', () => {
  let db: Db;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRecorder.uri = null;
    mockRecorderState.isRecording = false;
    mockPermission.mockResolvedValue({ granted: true } as Awaited<ReturnType<typeof requestRecordingPermissionsAsync>>);
    mockPersist.mockReturnValue('file:///docs/clips/work-day-1.m4a');
    mockUseRouter.mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockParams.mockReturnValue({ id: '1' });
    db = await createTestDb();
    await startWorkDay(db, new Date('2026-10-08T10:00:00.000Z'), null);
    await stopWorkDay(db, 1, new Date('2026-10-08T11:00:00.000Z'));
  });

  test('shows the denied message and opens settings when the microphone is off', async () => {
    mockPermission.mockResolvedValue({ granted: false } as Awaited<
      ReturnType<typeof requestRecordingPermissionsAsync>
    >);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderRecord(db);

    await waitFor(() => expect(screen.getByTestId('mic-denied')).toHaveTextContent('Microphone access is off'));
    await fireEvent.press(screen.getByTestId('open-settings'));

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  test('save is disabled before any recording', async () => {
    await renderRecord(db);

    await waitFor(() => expect(screen.getByTestId('record-button')).toBeTruthy());
    expect(screen.getByTestId('save-button')).toBeDisabled();
    expect(screen.getByTestId('play-button')).toBeDisabled();
  });

  test('record, stop, save stores the clip and moves the day to needs_processing', async () => {
    recordNextClip('file:///tmp/rec.m4a');
    await renderRecord(db);

    await recordClip();
    await waitFor(() => expect(screen.getByTestId('save-button')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('save-button'));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(mockPersist).toHaveBeenCalledWith('file:///tmp/rec.m4a', 1);
    expect(await getWorkDay(db, 1)).toMatchObject({
      status: 'needs_processing',
      audioPath: 'file:///docs/clips/work-day-1.m4a',
    });
  });

  test('play restarts the clip', async () => {
    recordNextClip('file:///tmp/rec.m4a');
    await renderRecord(db);
    await recordClip();

    await fireEvent.press(await screen.findByTestId('play-button'));

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  test('re-record discards the previous clip', async () => {
    recordNextClip('file:///tmp/first.m4a');
    await renderRecord(db);
    await recordClip();

    recordNextClip('file:///tmp/second.m4a');
    await fireEvent.press(await screen.findByTestId('rerecord-button'));
    await waitFor(() => expect(screen.getByTestId('save-button')).toBeDisabled());
    await recordClip();
    await waitFor(() => expect(screen.getByTestId('save-button')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('save-button'));

    await waitFor(() => expect(mockPersist).toHaveBeenCalledWith('file:///tmp/second.m4a', 1));
    expect(mockPersist).not.toHaveBeenCalledWith('file:///tmp/first.m4a', 1);
  });

  test('a day that is not waiting for a recording shows a message and a way back', async () => {
    await db.runAsync("UPDATE work_days SET status = 'needs_processing' WHERE id = 1");
    await renderRecord(db);

    await waitFor(() => expect(screen.getByText('This dig day already has a recording')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('back-button'));

    expect(replace).toHaveBeenCalledWith('/');
  });
});
