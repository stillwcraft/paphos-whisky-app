// Event records have no end time; the calendar link uses a two-hour duration.
export const EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

export function eventEndTime(date: string): number | null {
  const start = new Date(date).valueOf();
  return Number.isFinite(start) ? start + EVENT_DURATION_MS : null;
}

export function isEventCurrentOrUpcoming(date: string, now: number): boolean {
  const end = eventEndTime(date);
  return end !== null && end > now;
}
