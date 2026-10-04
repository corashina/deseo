import { DateTime } from 'luxon';
import { dateSchema, zoneSchema } from './schema';
import { listAgenda } from './queries';
import type { AgendaItem } from './types';

export async function listImportantDates(pairId: string, from: string, to: string): Promise<AgendaItem[]> {
  return (await listAgenda({ pairId, from, to })).filter(event => event.importantDate === true || event.repeat === 'yearly');
}
export function importantDateCountdown(date: string, pairTimezone: string, now: DateTime = DateTime.now()): number {
  const day = dateSchema.parse(date);
  zoneSchema.parse(pairTimezone);
  const today = now.setZone(pairTimezone).toISODate()!;
  return Math.round(DateTime.fromISO(day, { zone: 'UTC' }).diff(DateTime.fromISO(today, { zone: 'UTC' }), 'days').days);
}
export function nextImportantDate(items: AgendaItem[], pairTimezone: string, now: DateTime = DateTime.now()): AgendaItem | undefined {
  zoneSchema.parse(pairTimezone);
  const today = now.setZone(pairTimezone).toISODate()!;
  return items.filter(event => event.temporal.kind === 'allDay' && event.temporal.startDate >= today)
    .sort((a, b) => a.temporal.kind === 'allDay' && b.temporal.kind === 'allDay' ? a.temporal.startDate.localeCompare(b.temporal.startDate) : 0)[0];
}
