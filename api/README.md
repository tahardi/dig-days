# API

The backend API is defined by JSON test data in `testdata/`. It is not app data: the files are examples used only by
Go and Jest tests, so the two sides cannot drift.

**Change a file in `testdata/` only together with both the Go and TypeScript code in the same PR.**

## Endpoints

### GET /health

Returns `200` with `testdata/health-response.json`. No headers required.

### POST /process

Turns a voice recording into a draft work log entry.

- Headers: `Authorization: Bearer <key>`, `Content-Type: multipart/form-data`
- Multipart fields:
  - `audio`: the recording (max 50 MB)
  - `catalog`: JSON matching `testdata/catalog.json`
- Success: `200` with a body matching `testdata/process-response-existing.json` or `testdata/process-response-new.json`
- Failure: an error body matching `testdata/error-no-speech.json` or `testdata/error-unauthorized.json`

## Error codes

| Code               | Status |
| ------------------ | ------ |
| `unauthorized`     | 401    |
| `bad_request`      | 400    |
| `payload_too_large`| 413    |
| `no_speech`        | 422    |
| `upstream_failed`  | 502    |
