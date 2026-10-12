import * as Location from 'expo-location';

import type { Pin } from '@/db/types';

function toPin(position: Location.LocationObject | null): Pin | null {
  return position ? { lat: position.coords.latitude, lon: position.coords.longitude } : null;
}

async function current(timeoutMs: number): Promise<Location.LocationObject | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lastKnown(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getLastKnownPositionAsync({ maxAge: 300000, requiredAccuracy: 200 });
  } catch {
    return null;
  }
}

export async function getPin(timeoutMs = 10000): Promise<Pin | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return null;
    }
  } catch {
    return null;
  }
  return toPin((await current(timeoutMs)) ?? (await lastKnown()));
}
