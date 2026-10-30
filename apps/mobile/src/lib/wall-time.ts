import { DateTime } from 'luxon';

// Pickers run in UTC. The Date then holds the wall date and time with no device-zone shift.
export function wallDate(date: string, time = '00:00'): Date | null {
  const value = DateTime.fromISO(`${date}T${time}`, { zone: 'utc' });
  return value.isValid ? value.toJSDate() : null;
}

export function wallParts(value: Date): { date: string; time: string } {
  const wall = DateTime.fromJSDate(value, { zone: 'utc' });
  return { date: wall.toISODate()!, time: wall.toFormat('HH:mm') };
}
