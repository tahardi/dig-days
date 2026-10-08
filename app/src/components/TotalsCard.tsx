import { StyleSheet, Text, View } from 'react-native';

import type { Totals } from '@/db/types';
import { formatHours, formatLocalDate } from '@/format';

function formatDates(totals: Totals): string {
  if (!totals.firstDate || !totals.lastDate) {
    return '—';
  }
  const first = formatLocalDate(`${totals.firstDate}T00:00:00`);
  const last = formatLocalDate(`${totals.lastDate}T00:00:00`);
  return first === last ? first : `${first} – ${last}`;
}

export function TotalsCard({ totals }: { totals: Totals }) {
  return (
    <View style={styles.card}>
      <Text style={styles.hours} testID="totals-hours">
        {formatHours(totals.minutes)}
      </Text>
      <Text testID="totals-days">{totals.days === 1 ? '1 day' : `${totals.days} days`}</Text>
      <Text testID="totals-tools">{totals.topTools.length > 0 ? totals.topTools.join(', ') : '—'}</Text>
      <Text testID="totals-dates">{formatDates(totals)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, margin: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  hours: { fontSize: 28, fontWeight: '600' },
});
