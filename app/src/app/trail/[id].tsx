import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import { TotalsCard } from '@/components/TotalsCard';
import { WorkDayRow } from '@/components/WorkDayRow';
import { useDb } from '@/db/DbContext';
import { featureTotals, trailTotals } from '@/db/totals';
import { getTrail, listFeatures } from '@/db/trails';
import type { Totals, Trail, WorkDay } from '@/db/types';
import { listWorkDays } from '@/db/workDays';
import { formatHours } from '@/format';

type FeatureLine = { key: string; id: string; name: string; minutes: number };

type Loaded = { trail: Trail | null; totals: Totals; features: FeatureLine[]; days: WorkDay[] };

export default function TrailPage() {
  const db = useDb();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trailId = Number(id);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [trail, totals, features, days, general] = await Promise.all([
          getTrail(db, trailId),
          trailTotals(db, trailId),
          listFeatures(db, trailId),
          listWorkDays(db, { trailId }),
          featureTotals(db, trailId, null),
        ]);
        const lines: FeatureLine[] = await Promise.all(
          features.map(async (feature) => ({
            key: `feature-${feature.id}`,
            id: String(feature.id),
            name: feature.name,
            minutes: (await featureTotals(db, trailId, feature.id)).minutes,
          })),
        );
        if (days.some((day) => day.featureId === null)) {
          lines.push({ key: 'feature-general', id: 'general', name: 'General', minutes: general.minutes });
        }
        if (active) {
          setLoaded({ trail, totals, features: lines, days });
        }
      })();
      return () => {
        active = false;
      };
    }, [db, trailId]),
  );

  if (!loaded) {
    return <View style={styles.fill} />;
  }
  return (
    <ScrollView style={styles.fill}>
      <Text style={styles.title}>{loaded.trail?.name ?? ''}</Text>
      <TotalsCard totals={loaded.totals} />
      <Text style={styles.heading}>Features</Text>
      {loaded.features.map((line) => (
        <Pressable
          key={line.key}
          style={styles.row}
          testID={line.key}
          onPress={() =>
            router.push({ pathname: '/feature/[trailId]/[featureId]', params: { trailId: id, featureId: line.id } })
          }
        >
          <Text style={styles.name}>{line.name}</Text>
          <Text>{formatHours(line.minutes)}</Text>
        </Pressable>
      ))}
      <Text style={styles.heading}>Work days</Text>
      {loaded.days.map((day) => (
        <WorkDayRow key={day.id} workDay={day} onPress={() => router.push(`/work-day/${day.id}` as never)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16 },
  heading: { fontSize: 16, fontWeight: '600', paddingHorizontal: 16, paddingTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 },
  name: { fontWeight: '600' },
});
