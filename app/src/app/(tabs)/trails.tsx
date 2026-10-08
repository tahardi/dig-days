import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDb } from '@/db/DbContext';
import { allTrailMinutes } from '@/db/totals';
import { listTrails } from '@/db/trails';
import type { Trail } from '@/db/types';
import { formatHours } from '@/format';

export default function Trails() {
  const db = useDb();
  const router = useRouter();
  const [trails, setTrails] = useState<Trail[] | null>(null);
  const [minutes, setMinutes] = useState<Map<number, number>>(new Map());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listTrails(db), allTrailMinutes(db)]).then(([list, totals]) => {
        if (active) {
          setTrails(list);
          setMinutes(totals);
        }
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  if (trails === null) {
    return <View style={styles.center} />;
  }
  if (trails.length === 0) {
    return (
      <View style={styles.center}>
        <Text testID="trails-empty">No trails yet. Save a dig day to add one.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={trails}
      keyExtractor={(trail) => String(trail.id)}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          testID={`trail-${item.id}`}
          onPress={() => router.push({ pathname: '/trail/[id]', params: { id: String(item.id) } })}
        >
          <Text style={styles.name}>{item.name}</Text>
          <Text>{formatHours(minutes.get(item.id) ?? 0)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  name: { fontWeight: '600' },
});
