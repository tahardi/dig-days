import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TotalsCard } from '@/components/TotalsCard';
import { WorkDayRow } from '@/components/WorkDayRow';
import { useDb } from '@/db/DbContext';
import { featureTotals } from '@/db/totals';
import { getFeature } from '@/db/trails';
import type { Totals, WorkDay } from '@/db/types';
import { listWorkDays } from '@/db/workDays';

type Loaded = { name: string; totals: Totals; days: WorkDay[] };

export default function FeaturePage() {
  const db = useDb();
  const router = useRouter();
  const params = useLocalSearchParams<{ trailId: string; featureId: string }>();
  const trailId = Number(params.trailId);
  const featureId = params.featureId === 'general' ? null : Number(params.featureId);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [feature, totals, days] = await Promise.all([
          featureId === null ? null : getFeature(db, featureId),
          featureTotals(db, trailId, featureId),
          listWorkDays(db, { trailId, featureId }),
        ]);
        if (active) {
          setLoaded({ name: feature?.name ?? 'General', totals, days });
        }
      })();
      return () => {
        active = false;
      };
    }, [db, trailId, featureId]),
  );

  if (!loaded) {
    return <View style={styles.fill} />;
  }
  return (
    <ScrollView style={styles.fill}>
      <Text style={styles.title}>{loaded.name}</Text>
      <TotalsCard totals={loaded.totals} />
      {loaded.days.map((day) => (
        <WorkDayRow key={day.id} workDay={day} onPress={() => router.push(`/work-day/${day.id}` as never)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16 },
});
