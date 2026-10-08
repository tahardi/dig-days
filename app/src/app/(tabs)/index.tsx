import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';

import { getPin } from '@/capture/location';
import { ElapsedTimer } from '@/components/ElapsedTimer';
import { useDb } from '@/db/DbContext';
import type { WorkDay } from '@/db/types';
import { getActiveWorkDay, startWorkDay, stopWorkDay } from '@/db/workDays';

export default function Today() {
  const db = useDb();
  const router = useRouter();
  const [active, setActive] = useState<WorkDay | null>(null);
  const [starting, setStarting] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    getActiveWorkDay(db).then(setActive);
  }, [db]);

  const start = useCallback(async () => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setStarting(true);
    try {
      const pin = await getPin();
      await startWorkDay(db, new Date(), pin);
      setActive(await getActiveWorkDay(db));
    } finally {
      busy.current = false;
      setStarting(false);
    }
  }, [db]);

  const stop = useCallback(async () => {
    if (busy.current || !active) {
      return;
    }
    busy.current = true;
    try {
      await stopWorkDay(db, active.id, new Date());
      setActive(null);
      router.push(`/record/${active.id}`);
    } finally {
      busy.current = false;
    }
  }, [db, active, router]);

  return (
    <View style={styles.container}>
      {active ? (
        <>
          <ElapsedTimer startedAt={active.startedAt} />
          <Button testID="stop-button" title="Stop" onPress={stop} />
        </>
      ) : (
        <Button
          testID="start-button"
          title={starting ? 'Getting location…' : 'Start'}
          disabled={starting}
          onPress={start}
        />
      )}
      <View testID="queue" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
