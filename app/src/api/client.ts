import type { ApiErrorKind, ApiResult, BackendConfig, Catalog, ProcessResponse } from './types';

export type FetchFn = typeof fetch;

const HEALTH_TIMEOUT_MS = 10_000;
const PROCESS_TIMEOUT_MS = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRef(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.existing_id === null || typeof value.existing_id === 'number') &&
    (value.new_name === null || typeof value.new_name === 'string')
  );
}

export function isProcessResponse(value: unknown): value is ProcessResponse {
  if (!isRecord(value) || typeof value.transcript !== 'string' || !isRecord(value.draft)) {
    return false;
  }
  const draft = value.draft;
  return (
    isRef(draft.trail) &&
    isRef(draft.feature) &&
    typeof draft.summary === 'string' &&
    Array.isArray(draft.tools) &&
    draft.tools.every((tool) => typeof tool === 'string') &&
    typeof draft.break_minutes === 'number' &&
    typeof draft.notes === 'string'
  );
}

function kindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 413:
      return 'too_large';
    case 422:
      return 'no_speech';
    default:
      return status >= 400 && status < 500 ? 'bad_request' : 'upstream';
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string') {
      return body.error.message;
    }
  } catch {
    return `HTTP ${response.status}`;
  }
  return `HTTP ${response.status}`;
}

async function request(
  config: BackendConfig,
  path: string,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: FetchFn,
): Promise<ApiResult<Response>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(config.url.replace(/\/$/, '') + path, {
      ...init,
      headers: { Authorization: `Bearer ${config.key}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, kind: kindForStatus(response.status), message: await errorMessage(response) };
    }
    return { ok: true, value: response };
  } catch (err) {
    return { ok: false, kind: 'unreachable', message: err instanceof Error ? err.message : 'request failed' };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(config: BackendConfig, fetchFn: FetchFn = fetch): Promise<ApiResult<null>> {
  const result = await request(config, '/health', { method: 'GET' }, HEALTH_TIMEOUT_MS, fetchFn);
  return result.ok ? { ok: true, value: null } : result;
}

export async function processClip(
  config: BackendConfig,
  audio: Blob,
  catalog: Catalog,
  fetchFn: FetchFn = fetch,
): Promise<ApiResult<ProcessResponse>> {
  const form = new FormData();
  form.append('audio', audio, 'clip.m4a');
  form.append('catalog', JSON.stringify(catalog));
  const result = await request(config, '/process', { method: 'POST', body: form }, PROCESS_TIMEOUT_MS, fetchFn);
  if (!result.ok) {
    return result;
  }
  try {
    const body: unknown = await result.value.json();
    if (isProcessResponse(body)) {
      return { ok: true, value: body };
    }
  } catch {
    return { ok: false, kind: 'invalid_response', message: 'response is not valid JSON' };
  }
  return { ok: false, kind: 'invalid_response', message: 'response has an unexpected shape' };
}
