import type { Draft } from '@/api/types';
import { draftToForm, finalDuration, formToReviewInput, type FormValues } from '@/processing/draftToForm';

const baseDraft: Draft = {
  trail: { existing_id: null, new_name: null },
  feature: { existing_id: null, new_name: null },
  summary: 'Built a berm.',
  tools: ['rock bar'],
  break_minutes: 0,
  notes: '',
};

const baseValues: FormValues = {
  trail: { id: 1 },
  feature: null,
  summary: 'Built a berm.',
  tools: ['rock bar'],
  durationMinutes: 120,
  suggestedBreakMinutes: 0,
};

describe('draftToForm', () => {
  test.each([
    {
      name: 'existing ids map to id refs',
      draft: { ...baseDraft, trail: { existing_id: 1, new_name: null }, feature: { existing_id: 2, new_name: null } },
      trail: { id: 1 },
      feature: { id: 2 },
    },
    {
      name: 'new names map to newName refs',
      draft: {
        ...baseDraft,
        trail: { existing_id: null, new_name: 'Granite Ridge' },
        feature: { existing_id: null, new_name: 'Berm' },
      },
      trail: { newName: 'Granite Ridge' },
      feature: { newName: 'Berm' },
    },
    {
      name: 'existing id wins over new name',
      draft: { ...baseDraft, trail: { existing_id: 1, new_name: 'Other' } },
      trail: { id: 1 },
      feature: null,
    },
    { name: 'both null map to null', draft: baseDraft, trail: null, feature: null },
  ])('$name', ({ draft, trail, feature }) => {
    const values = draftToForm(draft, 120);

    expect(values.trail).toEqual(trail);
    expect(values.feature).toEqual(feature);
    expect(values.summary).toBe(draft.summary);
    expect(values.tools).toEqual(draft.tools);
    expect(values.durationMinutes).toBe(120);
  });

  test.each([
    { name: 'break smaller than duration is kept', breakMinutes: 60, duration: 120, want: 60 },
    { name: 'break larger than duration is capped', breakMinutes: 90, duration: 30, want: 30 },
    { name: 'no break stays zero', breakMinutes: 0, duration: 120, want: 0 },
  ])('$name', ({ breakMinutes, duration, want }) => {
    const values = draftToForm({ ...baseDraft, break_minutes: breakMinutes }, duration);

    expect(values.suggestedBreakMinutes).toBe(want);
  });
});

describe('formToReviewInput', () => {
  test.each([
    { name: 'error - missing trail', values: { ...baseValues, trail: null }, want: { error: 'Pick a trail' } },
    {
      name: 'error - negative duration',
      values: { ...baseValues, durationMinutes: -1 },
      want: { error: 'Duration must be 0 or more' },
    },
    {
      name: 'happy path - valid values',
      values: { ...baseValues, feature: { newName: 'Berm' } },
      want: {
        trail: { id: 1 },
        feature: { newName: 'Berm' },
        summary: 'Built a berm.',
        tools: ['rock bar'],
        durationMinutes: 120,
      },
    },
  ])('$name', ({ values, want }) => {
    expect(formToReviewInput(values)).toEqual(want);
  });
});

describe('finalDuration', () => {
  test.each([
    { name: 'break off keeps duration', subtract: false, want: 120 },
    { name: 'break on subtracts the suggestion', subtract: true, want: 60 },
  ])('$name', ({ subtract, want }) => {
    expect(finalDuration({ ...baseValues, suggestedBreakMinutes: 60 }, subtract)).toBe(want);
  });

  test('never goes below zero', () => {
    expect(finalDuration({ ...baseValues, durationMinutes: 30, suggestedBreakMinutes: 60 }, true)).toBe(0);
  });
});
