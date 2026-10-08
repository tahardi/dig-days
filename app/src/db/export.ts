import type { Db } from './db';
import { listPhotosForExport } from './photos';
import { listAllFeatures, listTrails } from './trails';
import type { ExportData } from './types';
import { listAllWorkDays } from './workDays';

export async function listAllForExport(db: Db): Promise<ExportData> {
  return {
    trails: await listTrails(db),
    features: await listAllFeatures(db),
    workDays: await listAllWorkDays(db),
    photos: await listPhotosForExport(db),
  };
}
