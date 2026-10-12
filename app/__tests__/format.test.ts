import { formatHours, formatLocalDate } from '@/format';

describe('formatHours', () => {
  test.each([
    [0, '0 h'],
    [90, '1.5 h'],
    [60, '1 h'],
    [605, '10.1 h'],
    [45, '0.8 h'],
  ])('formats %i minutes as %s', (minutes, want) => {
    expect(formatHours(minutes)).toBe(want);
  });
});

describe('formatLocalDate', () => {
  test('matches toLocaleDateString with short month', () => {
    const iso = '2026-10-04T15:30:00.000Z';

    const got = formatLocalDate(iso);

    expect(got).toBe(new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
  });
});
