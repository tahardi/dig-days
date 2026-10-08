export function formatHours(minutes: number): string {
  const hours = (minutes / 60).toFixed(1).replace(/\.0$/, '');
  return `${hours} h`;
}

export function formatLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
