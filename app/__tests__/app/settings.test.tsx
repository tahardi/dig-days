import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { checkHealth } from '@/api/client';
import Settings from '@/app/(tabs)/settings';
import { loadBackendConfig, saveBackendConfig } from '@/settings/store';

jest.mock('@/settings/store', () => ({
  loadBackendConfig: jest.fn(),
  saveBackendConfig: jest.fn(),
}));
jest.mock('@/api/client', () => ({ checkHealth: jest.fn() }));

const mockLoad = jest.mocked(loadBackendConfig);
const mockSave = jest.mocked(saveBackendConfig);
const mockHealth = jest.mocked(checkHealth);

async function fillAndRender() {
  await render(<Settings />);
  await fireEvent.changeText(screen.getByTestId('backend-url'), 'http://127.0.0.1:8787');
  await fireEvent.changeText(screen.getByTestId('backend-key'), 'e2e-key');
}

describe('Settings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockLoad.mockResolvedValue(null);
    mockSave.mockResolvedValue();
  });

  test('saves the typed config and shows Saved', async () => {
    await fillAndRender();

    await fireEvent.press(screen.getByTestId('settings-save'));

    await waitFor(() => expect(screen.getByTestId('settings-status')).toHaveTextContent('Saved'));
    expect(mockSave).toHaveBeenCalledWith({ url: 'http://127.0.0.1:8787', key: 'e2e-key' });
  });

  test('shows the save error when the url is invalid', async () => {
    mockSave.mockRejectedValue(new Error('URL must start with https:// or http://'));
    await fillAndRender();

    await fireEvent.press(screen.getByTestId('settings-save'));

    await waitFor(() =>
      expect(screen.getByTestId('settings-status')).toHaveTextContent('URL must start with https:// or http://'),
    );
  });

  test.each([
    ['ok', 'Connected', { ok: true as const, value: null }],
    ['unauthorized', 'Wrong key', { ok: false as const, kind: 'unauthorized' as const, message: 'm' }],
    ['unreachable', "Can't reach backend", { ok: false as const, kind: 'unreachable' as const, message: 'm' }],
    ['upstream', 'Backend error', { ok: false as const, kind: 'upstream' as const, message: 'm' }],
  ])('test connection with %s shows %s', async (_name, want, result) => {
    mockHealth.mockResolvedValue(result);
    await fillAndRender();

    await fireEvent.press(screen.getByTestId('settings-test'));

    await waitFor(() => expect(screen.getByTestId('settings-status')).toHaveTextContent(want));
    expect(mockHealth).toHaveBeenCalledWith({ url: 'http://127.0.0.1:8787', key: 'e2e-key' });
  });

  test('prefills saved values and masks the key', async () => {
    mockLoad.mockResolvedValue({ url: 'https://example.com', key: 'secret' });

    await render(<Settings />);

    await waitFor(() => expect(screen.getByTestId('backend-url').props.value).toBe('https://example.com'));
    expect(screen.getByTestId('backend-key').props.value).toBe('secret');
    expect(screen.getByTestId('backend-key').props.secureTextEntry).toBe(true);
  });
});
