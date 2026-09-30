import { checkHealth, processClip } from '@/api/client';
import type { BackendConfig, Catalog } from '@/api/types';

const healthResponse = require('../../../api/testdata/health-response.json');
const errorUnauthorized = require('../../../api/testdata/error-unauthorized.json');
const errorNoSpeech = require('../../../api/testdata/error-no-speech.json');
const processExisting = require('../../../api/testdata/process-response-existing.json');
const processNew = require('../../../api/testdata/process-response-new.json');
const catalog: Catalog = require('../../../api/testdata/catalog.json');

const config: BackendConfig = { url: 'https://pc.ts.net/', key: 'k' };
const audio = new Blob(['audio-bytes'], { type: 'audio/m4a' });

function respond(body: unknown, status: number) {
  return jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe('checkHealth', () => {
  it('happy path - 200 returns ok and sends the key in the header', async () => {
    // given
    const fetchFn = respond(healthResponse, 200);

    // when
    const got = await checkHealth(config, fetchFn);

    // then
    expect(got).toEqual({ ok: true, value: null });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://pc.ts.net/health');
    expect(init.headers.Authorization).toBe('Bearer k');
    expect(url).not.toContain('k=');
  });

  it('error - 401 maps to unauthorized', async () => {
    // given
    const fetchFn = respond(errorUnauthorized, 401);

    // when
    const got = await checkHealth(config, fetchFn);

    // then
    expect(got).toEqual({ ok: false, kind: 'unauthorized', message: 'missing or invalid key' });
  });

  it('error - network failure maps to unreachable', async () => {
    // given
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    // when
    const got = await checkHealth(config, fetchFn);

    // then
    expect(got).toMatchObject({ ok: false, kind: 'unreachable' });
  });

  it('error - times out after 10 seconds as unreachable', async () => {
    // given
    jest.useFakeTimers();
    const fetchFn = hangingFetch();

    // when
    const pending = checkHealth(config, fetchFn);
    await jest.advanceTimersByTimeAsync(10_000);
    const got = await pending;

    // then
    expect(got).toMatchObject({ ok: false, kind: 'unreachable' });
    jest.useRealTimers();
  });
});

function hangingFetch() {
  return jest.fn(
    (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  ) as unknown as typeof fetch;
}

describe('processClip', () => {
  it.each([
    ['existing', processExisting],
    ['new', processNew],
  ])('happy path - 200 with %s fixture returns the value', async (_name, fixture) => {
    // given
    const fetchFn = respond(fixture, 200);

    // when
    const got = await processClip(config, audio, catalog, fetchFn);

    // then
    expect(got).toEqual({ ok: true, value: fixture });
  });

  it('happy path - sends audio and catalog as form data with the key only in the header', async () => {
    // given
    const fetchFn = respond(processNew, 200);

    // when
    await processClip(config, audio, catalog, fetchFn);

    // then
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://pc.ts.net/process');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer k');
    const form = init.body as FormData;
    expect(form.get('audio')).toBeInstanceOf(Blob);
    expect(JSON.parse(form.get('catalog') as string)).toEqual(catalog);
    expect(JSON.stringify([...form.entries()])).not.toContain('"k"');
    expect(url).not.toContain('Bearer');
  });

  it('error - 422 maps to no_speech with the body message', async () => {
    // given
    const fetchFn = respond(errorNoSpeech, 422);

    // when
    const got = await processClip(config, audio, catalog, fetchFn);

    // then
    expect(got).toEqual({ ok: false, kind: 'no_speech', message: 'no speech found' });
  });

  it.each([
    [400, 'bad_request'],
    [401, 'unauthorized'],
    [413, 'too_large'],
    [500, 'upstream'],
    [502, 'upstream'],
  ])('error - status %i maps to %s', async (status, kind) => {
    // given
    const fetchFn = respond({}, status);

    // when
    const got = await processClip(config, audio, catalog, fetchFn);

    // then
    expect(got).toMatchObject({ ok: false, kind });
  });

  it('error - 200 with a malformed body maps to invalid_response', async () => {
    // given
    const fetchFn = respond({ transcript: 5 }, 200);

    // when
    const got = await processClip(config, audio, catalog, fetchFn);

    // then
    expect(got).toMatchObject({ ok: false, kind: 'invalid_response' });
  });

  it('error - 200 with a non-JSON body maps to invalid_response', async () => {
    // given
    const fetchFn = jest.fn().mockResolvedValue(new Response('nope', { status: 200 }));

    // when
    const got = await processClip(config, audio, catalog, fetchFn);

    // then
    expect(got).toMatchObject({ ok: false, kind: 'invalid_response' });
  });

  it('error - times out after 120 seconds as unreachable', async () => {
    // given
    jest.useFakeTimers();
    const fetchFn = hangingFetch();

    // when
    const pending = processClip(config, audio, catalog, fetchFn);
    await jest.advanceTimersByTimeAsync(120_000);
    const got = await pending;

    // then
    expect(got).toMatchObject({ ok: false, kind: 'unreachable' });
    jest.useRealTimers();
  });
});
