import type { Draft, Ref } from '@/api/types';
import type { NameOrId, ReviewInput } from '@/db/types';

export type FormValues = {
  trail: NameOrId | null;
  feature: NameOrId | null;
  summary: string;
  tools: string[];
  durationMinutes: number;
  suggestedBreakMinutes: number;
};

function refToNameOrId(ref: Ref): NameOrId | null {
  if (ref.existing_id !== null) {
    return { id: ref.existing_id };
  }
  if (ref.new_name) {
    return { newName: ref.new_name };
  }
  return null;
}

export function draftToForm(draft: Draft, durationMinutes: number): FormValues {
  return {
    trail: refToNameOrId(draft.trail),
    feature: refToNameOrId(draft.feature),
    summary: draft.summary,
    tools: draft.tools,
    durationMinutes,
    suggestedBreakMinutes: Math.min(draft.break_minutes, durationMinutes),
  };
}

export function finalDuration(values: FormValues, subtractBreak: boolean): number {
  return subtractBreak ? Math.max(0, values.durationMinutes - values.suggestedBreakMinutes) : values.durationMinutes;
}

export function formToReviewInput(values: FormValues): ReviewInput | { error: string } {
  if (!values.trail) {
    return { error: 'Pick a trail' };
  }
  if (values.durationMinutes < 0) {
    return { error: 'Duration must be 0 or more' };
  }
  return {
    trail: values.trail,
    feature: values.feature,
    summary: values.summary,
    tools: values.tools,
    durationMinutes: values.durationMinutes,
  };
}
