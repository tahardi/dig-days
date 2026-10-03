import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import { checkHealth } from '@/api/client';
import type { ApiErrorKind } from '@/api/types';
import { loadBackendConfig, saveBackendConfig } from '@/settings/store';

const FAILURE_STATUS: Partial<Record<ApiErrorKind, string>> = {
  unreachable: "Can't reach backend",
  unauthorized: 'Wrong key',
};

export default function Settings() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadBackendConfig().then((config) => {
      if (config) {
        setUrl(config.url);
        setKey(config.key);
      }
    });
  }, []);

  async function save() {
    try {
      await saveBackendConfig({ url, key });
      setStatus('Saved');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function test() {
    const result = await checkHealth({ url: url.trim(), key: key.trim() });
    setStatus(result.ok ? 'Connected' : (FAILURE_STATUS[result.kind] ?? 'Backend error'));
  }

  return (
    <View style={styles.container}>
      <TextInput
        testID="backend-url"
        style={styles.input}
        placeholder="Backend URL"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={url}
        onChangeText={setUrl}
      />
      <TextInput
        testID="backend-key"
        style={styles.input}
        placeholder="Backend key"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        value={key}
        onChangeText={setKey}
      />
      <Button testID="settings-save" title="Save" onPress={save} />
      <Button testID="settings-test" title="Test connection" onPress={test} />
      <Text testID="settings-status">{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 10 },
});
