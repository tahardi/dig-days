export type Ref = { existing_id: number | null; new_name: string | null };

export type Draft = {
  trail: Ref;
  feature: Ref;
  summary: string;
  tools: string[];
  break_minutes: number;
  notes: string;
};

export type ProcessResponse = { transcript: string; draft: Draft };

export type Catalog = {
  trails: { id: number; name: string; features: { id: number; name: string }[] }[];
  tools: string[];
};

export type ApiErrorKind =
  'unreachable' | 'unauthorized' | 'bad_request' | 'too_large' | 'no_speech' | 'upstream' | 'invalid_response';

export type ApiResult<T> = { ok: true; value: T } | { ok: false; kind: ApiErrorKind; message: string };

export type BackendConfig = { url: string; key: string };
