import * as SecureStore from 'expo-secure-store';

import type { BackendConfig } from '@/api/types';

const URL_KEY = 'backend_url';
const KEY_KEY = 'backend_key';

export async function loadBackendConfig(): Promise<BackendConfig | null> {
  const devUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  const devKey = process.env.EXPO_PUBLIC_BACKEND_KEY?.trim();
  if (devUrl && devKey) {
    return { url: devUrl, key: devKey };
  }
  const url = await SecureStore.getItemAsync(URL_KEY);
  const key = await SecureStore.getItemAsync(KEY_KEY);
  if (!url || !key) {
    return null;
  }
  return { url, key };
}

export async function saveBackendConfig(config: BackendConfig): Promise<void> {
  const url = config.url.trim();
  const key = config.key.trim();
  if (!/^https?:\/\//.test(url)) {
    throw new Error('URL must start with https:// or http://');
  }
  await SecureStore.setItemAsync(URL_KEY, url);
  await SecureStore.setItemAsync(KEY_KEY, key);
}
