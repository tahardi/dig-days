import { fireEvent, render, screen } from '@testing-library/react-native';

import { QueueList } from '@/components/QueueList';
import type { WorkDay, WorkDayStatus } from '@/db/types';

function day(id: number, status: WorkDayStatus, processError: string | null = null): WorkDay {
  return {
    id,
    status,
    startedAt: '2026-10-08T12:00:00.000Z',
    endedAt: null,
    durationMinutes: 90,
    lat: null,
    lon: null,
    audioPath: null,
    transcript: null,
    draftJson: null,
    processError,
    trailId: null,
    featureId: null,
    summary: null,
    tools: [],
  };
}

describe('QueueList', () => {
  const onRecord = jest.fn();
  const onReview = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  async function renderList(items: WorkDay[]) {
    await render(<QueueList items={items} onRecord={onRecord} onReview={onReview} />);
  }

  test('needs_recording shows its text and a record button', async () => {
    await renderList([day(1, 'needs_recording')]);

    expect(screen.getByTestId('queue-item-1')).toHaveTextContent(/Needs recording/);
    expect(screen.getByTestId('queue-item-1')).toHaveTextContent(/1\.5 h/);
    await fireEvent.press(screen.getByTestId('record-1'));
    expect(onRecord).toHaveBeenCalledWith(1);
    expect(screen.queryByTestId('review-1')).toBeNull();
  });

  test('needs_processing shows its text and no button', async () => {
    await renderList([day(2, 'needs_processing')]);

    expect(screen.getByTestId('queue-item-2')).toHaveTextContent(/Waiting to process/);
    expect(screen.queryByTestId('record-2')).toBeNull();
    expect(screen.queryByTestId('review-2')).toBeNull();
  });

  test('needs_processing shows the process error', async () => {
    await renderList([day(2, 'needs_processing', "Can't reach backend")]);

    expect(screen.getByTestId('queue-item-2')).toHaveTextContent(/Can't reach backend/);
  });

  test('needs_review shows its text and a review button', async () => {
    await renderList([day(3, 'needs_review')]);

    expect(screen.getByTestId('queue-item-3')).toHaveTextContent(/Ready to review/);
    await fireEvent.press(screen.getByTestId('review-3'));
    expect(onReview).toHaveBeenCalledWith(3);
  });
});
