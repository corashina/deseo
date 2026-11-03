import { DateTime } from 'luxon';
import { dateSchema, zoneSchema } from './schema';
import type { AgendaItem } from './types';

const instantFormat = 'd LLL yyyy, HH:mm';
export function formatInstant(iso: string, zone: string): string {
  return DateTime.fromISO(iso).setZone(zone).setLocale('en').toFormat(instantFormat);
}
export function formatInstantRange(startIso: string, endIso: string, zone: string): string {
  const start = DateTime.fromISO(startIso).setZone(zone);
  const end = DateTime.fromISO(endIso).setZone(zone);
  return formatInstant(startIso, zone) + ' to ' + (start.hasSame(end, 'day') ? end.toFormat('HH:mm') : formatInstant(endIso, zone));
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
  let next: AgendaItem | undefined;
  let earliestDate: string | undefined;
  for (const event of items) {
    if (event.temporal.kind !== 'allDay' || event.temporal.startDate < today) continue;
    if (earliestDate === undefined || event.temporal.startDate < earliestDate) {
      next = event;
      earliestDate = event.temporal.startDate;
    }
  }
  return next;
}

export function agendaDates(event: AgendaItem, viewerTimezone: string, from: string, to: string): string[] {
  const temporal = event.temporal;
  const start = temporal.kind === 'allDay' ? temporal.startDate : DateTime.fromISO(temporal.startsAt).setZone(viewerTimezone).toISODate()!;
  const end = temporal.kind === 'allDay' ? temporal.endDateExclusive : DateTime.fromISO(temporal.endsAt).setZone(viewerTimezone).minus({ milliseconds: 1 }).plus({ days: 1 }).toISODate()!;
  const dates: string[] = [];
  let cursor = DateTime.fromISO(start < from ? from : start, { zone: 'UTC' });
  const limit = end < to ? end : to;
  while (cursor.toISODate()! < limit) {
    dates.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
}
