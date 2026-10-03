import { loadBackendConfig, saveBackendConfig } from '@/settings/store';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
}));

describe('backend config store', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  test('round-trips a saved config', async () => {
    await saveBackendConfig({ url: 'https://example.com', key: 'secret' });

    expect(await loadBackendConfig()).toEqual({ url: 'https://example.com', key: 'secret' });
  });

  test.each([
    ['url', 'backend_key'],
    ['key', 'backend_url'],
  ])('returns null when the %s is missing', async (_name, presentKey) => {
    mockStore.set(presentKey, 'value');

    expect(await loadBackendConfig()).toBeNull();
  });

  test('returns null when nothing is saved', async () => {
    expect(await loadBackendConfig()).toBeNull();
  });

  test('trims both values', async () => {
    await saveBackendConfig({ url: '  http://127.0.0.1:8080  ', key: '  secret  ' });

    expect(await loadBackendConfig()).toEqual({ url: 'http://127.0.0.1:8080', key: 'secret' });
  });

  test('rejects a url without an http scheme', async () => {
    await expect(saveBackendConfig({ url: 'ftp://x', key: 'secret' })).rejects.toThrow(
      'URL must start with https:// or http://',
    );
    expect(mockStore.size).toBe(0);
  });
});
