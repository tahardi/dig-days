import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

function format(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return (
    <Text testID="elapsed-timer" style={styles.text}>
      {format(seconds)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 48, fontVariant: ['tabular-nums'] },
});
