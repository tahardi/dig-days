import { Pressable, StyleSheet, Text } from 'react-native';

import type { WorkDay } from '@/db/types';
import { formatHours, formatLocalDate } from '@/format';

export function WorkDayRow({ workDay, onPress }: { workDay: WorkDay; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={`work-day-${workDay.id}`}>
      <Text style={styles.date}>
        {formatLocalDate(workDay.startedAt)} · {formatHours(workDay.durationMinutes ?? 0)}
      </Text>
      <Text>{workDay.summary ?? ''}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  date: { fontWeight: '600' },
});
