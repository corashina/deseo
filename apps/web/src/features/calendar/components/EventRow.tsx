import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event, Owner } from '@deseo/domain/calendar';
import { formatDate, formatRange } from '../../../lib/format';
import { useFrom } from '../../../lib/return-to';
export type OwnerNames = Record<Owner, string>;
// The date range and Ongoing label of an event, in the display timezone.
function dateLabel(event: Event, timezone: string, locale: string): string {
  const date = event.temporal.kind === 'allDay' ? DateTime.fromISO(event.temporal.startDate) : DateTime.fromISO(event.temporal.startsAt).setZone(timezone);
  const end = event.temporal.kind === 'allDay' ? DateTime.fromISO(event.temporal.endDateExclusive).minus({ days: 1 }) : DateTime.fromISO(event.temporal.endsAt).setZone(timezone);
  const now = DateTime.now().setZone(timezone);
  const ongoing = event.temporal.kind === 'allDay'
    ? now.toISODate()! >= event.temporal.startDate && now.toISODate()! < event.temporal.endDateExclusive
    : now.toMillis() >= date.toMillis() && now.toMillis() < end.toMillis();
  return formatRange(date, end, date.year === end.year ? 'day' : 'dayYear', locale) + ' · ' + (ongoing ? 'Ongoing · ' : '');
}
// Only Today shows the date. The calendar rows skip that work.
export function EventRow({ event, names, timezone, locale, showDate = false }: { event: Event; names: OwnerNames; timezone: string; locale: string; showDate?: boolean }) {
  const time = event.temporal.kind === 'allDay' ? 'All day' : formatDate(DateTime.fromISO(event.temporal.startsAt).setZone(timezone), 'time', locale);
  const from = useFrom();
  return <Link className={'event-row owner-' + event.owner} to={'/events/' + event.id} state={from}>
    <span className="event-row-time">{time}</span><span className="event-row-content"><strong>{event.title}</strong><span>{showDate ? dateLabel(event, timezone, locale) : ''}{names[event.owner]}{event.visibility === 'private' ? ' · Private' : ''}</span></span>
  </Link>;
}
