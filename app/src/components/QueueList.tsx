import { Button, StyleSheet, Text, View } from 'react-native';

import type { WorkDay } from '@/db/types';
import { formatHours, formatLocalDate } from '@/format';

type Props = {
  items: WorkDay[];
  onRecord: (id: number) => void;
  onReview: (id: number) => void;
};

const STATUS_TEXT: Partial<Record<WorkDay['status'], string>> = {
  needs_recording: 'Needs recording',
  needs_processing: 'Waiting to process',
  needs_review: 'Ready to review',
};

export function QueueList({ items, onRecord, onReview }: Props) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.id} style={styles.row} testID={`queue-item-${item.id}`}>
          <View style={styles.text}>
            <Text style={styles.date}>
              {formatLocalDate(item.startedAt)} · {formatHours(item.durationMinutes ?? 0)}
            </Text>
            <Text>{STATUS_TEXT[item.status]}</Text>
            {item.status === 'needs_processing' && item.processError ? <Text>{item.processError}</Text> : null}
          </View>
          {item.status === 'needs_recording' ? (
            <Button testID={`record-${item.id}`} title="Record" onPress={() => onRecord(item.id)} />
          ) : null}
          {item.status === 'needs_review' ? (
            <Button testID={`review-${item.id}`} title="Review" onPress={() => onReview(item.id)} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: { flex: 1, gap: 2 },
  date: { fontWeight: '600' },
});
