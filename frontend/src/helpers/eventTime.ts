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

export function getTimelineTargetIndex(events: readonly { date: string }[], now: number): number {
  const index = events.findIndex(({ date }) => {
    const value = date.trim();
    // The catalog API interprets timestamps without a timezone as UTC.
    const utcDate = /[T ]\d/i.test(value) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
      ? `${value}Z`
      : value;
    return isEventCurrentOrUpcoming(utcDate, now);
  });
  return index === -1 ? events.length - 1 : index;
}
