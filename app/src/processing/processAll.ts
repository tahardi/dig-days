import type { ApiErrorKind, ApiResult, BackendConfig, Catalog, ProcessResponse } from '@/api/types';
import { buildCatalog } from '@/db/catalog';
import type { Db } from '@/db/db';
import { listQueue, markProcessed, markProcessError } from '@/db/workDays';

export type ProcessDeps = {
  db: Db;
  config: BackendConfig;
  process: (config: BackendConfig, audio: Blob, catalog: Catalog) => Promise<ApiResult<ProcessResponse>>;
  readAudio: (uri: string) => Blob;
};

export type ProcessSummary = { processed: number; failed: number };

const MESSAGES: Partial<Record<ApiErrorKind, string>> = {
  unreachable: "Can't reach backend",
  unauthorized: 'Wrong key',
  no_speech: 'No speech found in the recording',
  too_large: 'Recording is too large',
};

function messageFor(kind: ApiErrorKind): string {
  return MESSAGES[kind] ?? 'Backend error';
}

let inFlight: Promise<ProcessSummary> | null = null;

async function run(deps: ProcessDeps): Promise<ProcessSummary> {
  const { db, config } = deps;
  const catalog = await buildCatalog(db);
  const queue = (await listQueue(db)).filter((day) => day.status === 'needs_processing' && day.audioPath);
  const summary: ProcessSummary = { processed: 0, failed: 0 };
  for (const day of queue) {
    const result = await deps.process(config, deps.readAudio(day.audioPath!), catalog);
    if (result.ok) {
      await markProcessed(db, day.id, result.value.transcript, JSON.stringify(result.value.draft));
      summary.processed += 1;
    } else {
      await markProcessError(db, day.id, messageFor(result.kind));
      summary.failed += 1;
    }
  }
  return summary;
}

export function processAll(deps: ProcessDeps): Promise<ProcessSummary> {
  if (!inFlight) {
    inFlight = run(deps).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
