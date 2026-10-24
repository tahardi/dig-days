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
    delete process.env.EXPO_PUBLIC_BACKEND_URL;
    delete process.env.EXPO_PUBLIC_BACKEND_KEY;
  });

  test.each([
    ['nothing is saved', false],
    ['a config is saved', true],
  ])('uses the dev config from the environment when %s', async (_name, saved) => {
    if (saved) {
      await saveBackendConfig({ url: 'https://saved.example.com', key: 'saved' });
    }
    process.env.EXPO_PUBLIC_BACKEND_URL = 'https://dev.example.com';
    process.env.EXPO_PUBLIC_BACKEND_KEY = 'dev';

    expect(await loadBackendConfig()).toEqual({ url: 'https://dev.example.com', key: 'dev' });
  });

  test.each([
    ['EXPO_PUBLIC_BACKEND_URL', 'https://dev.example.com'],
    ['EXPO_PUBLIC_BACKEND_KEY', 'dev'],
  ])('ignores the dev config when only %s is set', async (name, value) => {
    await saveBackendConfig({ url: 'https://saved.example.com', key: 'saved' });
    process.env[name] = value;

    expect(await loadBackendConfig()).toEqual({ url: 'https://saved.example.com', key: 'saved' });
  });

  test('trims the dev config', async () => {
    process.env.EXPO_PUBLIC_BACKEND_URL = '  https://dev.example.com  ';
    process.env.EXPO_PUBLIC_BACKEND_KEY = '  dev  ';

    expect(await loadBackendConfig()).toEqual({ url: 'https://dev.example.com', key: 'dev' });
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
