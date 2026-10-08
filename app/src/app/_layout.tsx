import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';

import { DbProvider } from '@/db/DbContext';
import { migrate } from '@/db/migrate';
import type { Db } from '@/db/db';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="digdays.db" onInit={(db) => migrate(db as unknown as Db)}>
      <DbProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="trail/[id]" options={{ title: 'Trail' }} />
          <Stack.Screen name="feature/[trailId]/[featureId]" options={{ title: 'Feature' }} />
        </Stack>
      </DbProvider>
    </SQLiteProvider>
  );
}
