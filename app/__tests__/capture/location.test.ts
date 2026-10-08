import * as Location from 'expo-location';

import { getPin } from '@/capture/location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

const mockPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockCurrent = jest.mocked(Location.getCurrentPositionAsync);
const mockLastKnown = jest.mocked(Location.getLastKnownPositionAsync);

function position(lat: number, lon: number) {
  return { coords: { latitude: lat, longitude: lon } } as Location.LocationObject;
}

describe('getPin', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    mockPermission.mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
    mockLastKnown.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns null when permission is denied', async () => {
    mockPermission.mockResolvedValue({ granted: false } as Location.LocationPermissionResponse);

    const pin = await getPin();

    expect(pin).toBeNull();
    expect(mockCurrent).not.toHaveBeenCalled();
  });

  test('returns the current position', async () => {
    mockCurrent.mockResolvedValue(position(44.4759, -73.2121));

    const pin = await getPin();

    expect(pin).toEqual({ lat: 44.4759, lon: -73.2121 });
    expect(mockCurrent).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  });

  test('falls back to last known position after the timeout', async () => {
    mockCurrent.mockReturnValue(new Promise(() => {}));
    mockLastKnown.mockResolvedValue(position(1, 2));

    const pending = getPin(5000);
    await jest.advanceTimersByTimeAsync(5000);
    const pin = await pending;

    expect(pin).toEqual({ lat: 1, lon: 2 });
    expect(mockLastKnown).toHaveBeenCalledWith({ maxAge: 300000, requiredAccuracy: 200 });
  });

  test('uses a 10 second timeout by default', async () => {
    mockCurrent.mockReturnValue(new Promise(() => {}));
    mockLastKnown.mockResolvedValue(position(1, 2));

    const pending = getPin();
    await jest.advanceTimersByTimeAsync(9999);
    expect(mockLastKnown).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    const pin = await pending;

    expect(pin).toEqual({ lat: 1, lon: 2 });
  });

  test('returns null when the current position times out and none is known', async () => {
    mockCurrent.mockReturnValue(new Promise(() => {}));

    const pending = getPin(5000);
    await jest.advanceTimersByTimeAsync(5000);
    const pin = await pending;

    expect(pin).toBeNull();
  });

  test('falls back to last known position when the current lookup throws', async () => {
    mockCurrent.mockRejectedValue(new Error('unavailable'));
    mockLastKnown.mockResolvedValue(position(3, 4));

    const pin = await getPin();

    expect(pin).toEqual({ lat: 3, lon: 4 });
  });

  test('returns null when both lookups fail', async () => {
    mockCurrent.mockRejectedValue(new Error('unavailable'));
    mockLastKnown.mockRejectedValue(new Error('unavailable'));

    const pin = await getPin();

    expect(pin).toBeNull();
  });

  test('returns null when the permission request throws', async () => {
    mockPermission.mockRejectedValue(new Error('denied'));

    const pin = await getPin();

    expect(pin).toBeNull();
  });
});
