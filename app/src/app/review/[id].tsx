import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Draft } from '@/api/types';
import { WorkDayForm } from '@/components/WorkDayForm';
import { useDb } from '@/db/DbContext';
import { listFeatures, listTrails } from '@/db/trails';
import type { ReviewInput, Trail, WorkDay } from '@/db/types';
import { getWorkDay, saveReview } from '@/db/workDays';
import { draftToForm, type FormValues } from '@/processing/draftToForm';

const EMPTY_FORM: FormValues = {
  trail: null,
  feature: null,
  summary: '',
  tools: [],
  durationMinutes: 0,
  suggestedBreakMinutes: 0,
};

function parseDraft(json: string | null): Draft | null {
  if (!json) {
    return null;
  }
  try {
    const draft = JSON.parse(json) as Draft;
    if (!draft || typeof draft.summary !== 'string' || !draft.trail || !draft.feature) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export default function Review() {
  const db = useDb();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workDayId = Number(id);
  const [workDay, setWorkDay] = useState<WorkDay | null | undefined>(undefined);
  const [trails, setTrails] = useState<Trail[]>([]);

  useEffect(() => {
    getWorkDay(db, workDayId).then(setWorkDay);
    listTrails(db).then(setTrails);
  }, [db, workDayId]);

  const featuresFor = useCallback((trailId: number) => listFeatures(db, trailId), [db]);

  async function submit(input: ReviewInput) {
    await saveReview(db, workDayId, input);
    router.replace('/');
  }

  if (workDay === undefined) {
    return null;
  }

  if (workDay?.status !== 'needs_review') {
    return (
      <View style={styles.centered}>
        <Text>Nothing to review</Text>
        <Button testID="back-button" title="Today" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const draft = parseDraft(workDay.draftJson);
  const duration = workDay.durationMinutes ?? 0;
  const initial = draft ? draftToForm(draft, duration) : { ...EMPTY_FORM, durationMinutes: duration };

  return (
    <ScrollView>
      <View style={styles.header}>
        <Text style={styles.heading}>Transcript</Text>
        <Text testID="review-transcript">{workDay.transcript}</Text>
        {draft?.notes ? <Text testID="review-notes">{draft.notes}</Text> : null}
        {draft ? null : <Text>Couldn&apos;t read the draft; fill in the entry by hand.</Text>}
      </View>
      <WorkDayForm initial={initial} trails={trails} featuresFor={featuresFor} onSubmit={submit} submitLabel="Save" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { padding: 16, gap: 8 },
  heading: { fontWeight: '600' },
});
