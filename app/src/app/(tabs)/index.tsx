import { File } from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';

import { checkHealth, processClip } from '@/api/client';
import type { BackendConfig } from '@/api/types';
import { getPin } from '@/capture/location';
import { ElapsedTimer } from '@/components/ElapsedTimer';
import { QueueList } from '@/components/QueueList';
import { useDb } from '@/db/DbContext';
import type { WorkDay } from '@/db/types';
import { getActiveWorkDay, listQueue, startWorkDay, stopWorkDay } from '@/db/workDays';
import { processAll } from '@/processing/processAll';
import { loadBackendConfig } from '@/settings/store';

export default function Today() {
  const db = useDb();
  const router = useRouter();
  const [active, setActive] = useState<WorkDay | null>(null);
  const [starting, setStarting] = useState(false);
  const [queue, setQueue] = useState<WorkDay[]>([]);
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [healthy, setHealthy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    getActiveWorkDay(db).then(setActive);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      let current = true;
      listQueue(db).then((items) => current && setQueue(items));
      loadBackendConfig().then(async (loaded) => {
        const health = loaded ? await checkHealth(loaded) : null;
        if (current) {
          setConfig(loaded);
          setHealthy(health?.ok ?? false);
        }
      });
      return () => {
        current = false;
      };
    }, [db]),
  );

  const runAll = useCallback(async () => {
    if (!config || processing) {
      return;
    }
    setProcessing(true);
    try {
      await processAll({ db, config, process: processClip, readAudio: (uri) => new File(uri) });
    } finally {
      setProcessing(false);
      setQueue(await listQueue(db));
    }
  }, [db, config, processing]);

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
      <View testID="queue" style={styles.queue}>
        <Button
          testID="process-all"
          title={processing ? 'Processing…' : 'Process all'}
          disabled={processing || !config || !healthy || !queue.some((day) => day.status === 'needs_processing')}
          onPress={runAll}
        />
        <QueueList
          items={queue}
          onRecord={(id) => router.push(`/record/${id}`)}
          onReview={(id) => router.push(`/review/${id}`)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  queue: { alignSelf: 'stretch', gap: 8 },
});
