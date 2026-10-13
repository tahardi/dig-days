import { persistClip } from '@/capture/audioFiles';

const mockCalls: { created: unknown[]; copies: { from: string; to: string; options: unknown }[] } = {
  created: [],
  copies: [],
};

jest.mock('expo-file-system', () => {
  const join = (parts: (string | { uri: string })[]) => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(parts);
    }
    create(options: unknown) {
      mockCalls.created.push({ uri: this.uri, options });
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(parts);
    }
    copySync(destination: { uri: string }, options: unknown) {
      mockCalls.copies.push({ from: this.uri, to: destination.uri, options });
    }
  }
  return { Directory, File, Paths: { document: new Directory('file:///docs') } };
});

describe('persistClip', () => {
  beforeEach(() => {
    mockCalls.created = [];
    mockCalls.copies = [];
  });

  test('creates the clips directory', () => {
    persistClip('file:///tmp/rec.m4a', 7);

    expect(mockCalls.created).toEqual([
      { uri: 'file:///docs/clips', options: { intermediates: true, idempotent: true } },
    ]);
  });

  test('copies the temp file to work-day-7.m4a, overwriting any existing file', () => {
    persistClip('file:///tmp/rec.m4a', 7);

    expect(mockCalls.copies).toEqual([
      { from: 'file:///tmp/rec.m4a', to: 'file:///docs/clips/work-day-7.m4a', options: { overwrite: true } },
    ]);
  });

  test('returns the destination uri', () => {
    expect(persistClip('file:///tmp/rec.m4a', 7)).toBe('file:///docs/clips/work-day-7.m4a');
  });

  test('copies again for the same day', () => {
    persistClip('file:///tmp/a.m4a', 7);
    persistClip('file:///tmp/b.m4a', 7);

    expect(mockCalls.copies.map((c) => c.from)).toEqual(['file:///tmp/a.m4a', 'file:///tmp/b.m4a']);
    expect(mockCalls.copies.every((c) => c.to === 'file:///docs/clips/work-day-7.m4a')).toBe(true);
  });
});
