# API

JSON fixtures in this directory define the backend API. Go and Jest tests both load them.

**Change a fixture only together with both the Go and TypeScript code in the same PR.**

## Endpoints

### GET /health

Returns `200` with `health-response.json`. No headers required.

### POST /process

Turns a voice recording into a draft work log entry.

- Headers: `Authorization: Bearer <key>`, `Content-Type: multipart/form-data`
- Multipart fields:
  - `audio`: the recording (max 50 MB)
  - `catalog`: JSON matching `catalog.json`
- Success: `200` with a body matching `process-response-existing.json` or `process-response-new.json`
- Failure: an error body matching `error-no-speech.json` or `error-unauthorized.json`

## Error codes

| Code               | Status |
| ------------------ | ------ |
| `unauthorized`     | 401    |
| `bad_request`      | 400    |
| `payload_too_large`| 413    |
| `no_speech`        | 422    |
| `upstream_failed`  | 502    |
