import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { WorkDayForm } from '@/components/WorkDayForm';
import type { Feature, Trail } from '@/db/types';
import type { FormValues } from '@/processing/draftToForm';

const trails: Trail[] = [
  { id: 1, name: 'White Wolf', notes: null, createdAt: '2026-10-01T00:00:00Z' },
  { id: 2, name: 'Ridgeback', notes: null, createdAt: '2026-10-01T00:00:00Z' },
];

const features: Record<number, Feature[]> = {
  1: [
    { id: 1, trailId: 1, name: 'Step-up #1', notes: null, createdAt: '2026-10-01T00:00:00Z' },
    { id: 2, trailId: 1, name: 'Step-up #2', notes: null, createdAt: '2026-10-01T00:00:00Z' },
  ],
  2: [{ id: 3, trailId: 2, name: 'Rock garden', notes: null, createdAt: '2026-10-01T00:00:00Z' }],
};

const initial: FormValues = {
  trail: { id: 1 },
  feature: { id: 2 },
  summary: 'Cut rock for the jump.',
  tools: ['rock bar'],
  durationMinutes: 120,
  suggestedBreakMinutes: 0,
};

const featuresFor = jest.fn(async (trailId: number) => features[trailId] ?? []);
const onSubmit = jest.fn(async () => {});

async function renderForm(values: FormValues = initial) {
  await render(
    <WorkDayForm initial={values} trails={trails} featuresFor={featuresFor} onSubmit={onSubmit} submitLabel="Save" />,
  );
  if (values.trail !== null && 'id' in values.trail) {
    await waitFor(() => expect(featuresFor).toHaveBeenCalled());
  }
}

describe('WorkDayForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the prefilled values', async () => {
    await renderForm();

    expect(screen.getByTestId('trail-picker-option-1')).toBeSelected();
    expect(await screen.findByTestId('feature-picker-option-2')).toBeSelected();
    expect(screen.getByTestId('summary-input').props.value).toBe('Cut rock for the jump.');
    expect(screen.getByTestId('tool-remove-rock bar')).toBeTruthy();
    expect(screen.getByTestId('duration-input').props.value).toBe('120');
    expect(screen.queryByTestId('break-toggle')).toBeNull();
  });

  test('choosing another existing trail reloads its features', async () => {
    await renderForm();
    await screen.findByTestId('feature-picker-option-2');

    await fireEvent.press(screen.getByTestId('trail-picker-option-2'));

    expect(await screen.findByTestId('feature-picker-option-3')).toBeTruthy();
    expect(screen.queryByTestId('feature-picker-option-2')).toBeNull();
    expect(featuresFor).toHaveBeenLastCalledWith(2);
    expect(screen.getByTestId('feature-picker-none')).toBeSelected();
  });

  test('typing a new trail name selects it', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByTestId('trail-new-input'), 'Granite Ridge');
    await fireEvent.press(screen.getByTestId('form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ trail: { newName: 'Granite Ridge' } }));
  });

  test('shows the draft proposal as a new option', async () => {
    await renderForm({ ...initial, trail: { newName: 'Granite Ridge' }, feature: { newName: 'Berm' } });

    expect(screen.getByText('New: Granite Ridge')).toBeTruthy();
    expect(screen.getByTestId('trail-picker-new')).toBeSelected();
    expect(screen.getByText('New: Berm')).toBeTruthy();
    expect(screen.getByTestId('feature-picker-new')).toBeSelected();
  });

  test('removes and adds tools', async () => {
    await renderForm();

    await fireEvent.press(screen.getByTestId('tool-remove-rock bar'));
    await fireEvent.changeText(screen.getByTestId('tool-add-input'), 'sledge');
    await fireEvent(screen.getByTestId('tool-add-input'), 'submitEditing');
    await fireEvent.press(screen.getByTestId('form-submit'));

    expect(screen.queryByTestId('tool-remove-rock bar')).toBeNull();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tools: ['sledge'] })));
  });

  test('error - submitting with no trail shows an error and does not call onSubmit', async () => {
    await renderForm({ ...initial, trail: null, feature: null });

    await fireEvent.press(screen.getByTestId('form-submit'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent('Pick a trail');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('toggling the break updates the duration shown and submitted', async () => {
    await renderForm({ ...initial, suggestedBreakMinutes: 60 });

    expect(screen.getByText('Subtract 60 min break')).toBeTruthy();
    await fireEvent(screen.getByTestId('break-toggle'), 'valueChange', true);
    expect(screen.getByTestId('duration-input').props.value).toBe('60');
    await fireEvent.press(screen.getByTestId('form-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 60 })));

    await fireEvent(screen.getByTestId('break-toggle'), 'valueChange', false);
    expect(screen.getByTestId('duration-input').props.value).toBe('120');
  });

  test('editing the duration is submitted', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByTestId('duration-input'), '90');
    await fireEvent.press(screen.getByTestId('form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 90 })));
  });
});
