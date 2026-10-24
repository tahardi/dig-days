import { renderRouter, screen } from 'expo-router/testing-library';

import TabsLayout from '@/app/(tabs)/_layout';
import Today from '@/app/(tabs)/index';
import Settings from '@/app/(tabs)/settings';
import Trails from '@/app/(tabs)/trails';

const mockDb = { getFirstAsync: async () => null, getAllAsync: async () => [] };
jest.mock('@/db/DbContext', () => ({
  useDb: () => mockDb,
}));
jest.mock('@/settings/store', () => ({
  loadBackendConfig: jest.fn().mockResolvedValue(null),
  saveBackendConfig: jest.fn(),
}));

describe('TabsLayout', () => {
  test('shows the three tabs and starts on Today', async () => {
    const view = await renderRouter({
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': Today,
      '(tabs)/trails': Trails,
      '(tabs)/settings': Settings,
    });

    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trails').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
    expect(view.getPathname()).toBe('/');
  });
});
