import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event, Owner } from '@deseo/domain/calendar';
import { formatDate, formatRange } from '../../../lib/format';
import { useFrom } from '../../../lib/return-to';
export type OwnerNames = Record<Owner, string>;
// The date range and Ongoing label of an event. Only Today shows them, so calendar rows skip this work.
function dateLabel(event: Event, date: DateTime, end: DateTime, timezone: string, locale: string): string {
  const now = DateTime.now().setZone(timezone);
  const ongoing = event.temporal.kind === 'allDay'
    ? now.toISODate()! >= event.temporal.startDate && now.toISODate()! < event.temporal.endDateExclusive
    : now.toMillis() >= date.toMillis() && now.toMillis() < end.toMillis();
  return formatRange(date, end, date.year === end.year ? 'day' : 'dayYear', locale) + ' · ' + (ongoing ? 'Ongoing · ' : '');
}
// day is the calendar day that shows the row. A timed event that started on an earlier day shows its end time there.
export function EventRow({ event, names, timezone, locale, showDate = false, day }: { event: Event; names: OwnerNames; timezone: string; locale: string; showDate?: boolean; day?: string }) {
  const date = event.temporal.kind === 'allDay' ? DateTime.fromISO(event.temporal.startDate) : DateTime.fromISO(event.temporal.startsAt).setZone(timezone);
  const end = event.temporal.kind === 'allDay' ? DateTime.fromISO(event.temporal.endDateExclusive).minus({ days: 1 }) : DateTime.fromISO(event.temporal.endsAt).setZone(timezone);
  const time = event.temporal.kind === 'allDay' ? 'All day'
    : day && day > date.toISODate()! ? (day === end.toISODate() ? 'Until ' + formatDate(end, 'time', locale) : 'Continues')
    : formatDate(date, 'time', locale);
  const from = useFrom();
  return <Link className={'event-row owner-' + event.owner} to={'/events/' + event.id} state={from}>
    <span className="event-row-time">{time}</span><span className="event-row-content"><strong>{event.title}</strong><span>{showDate ? dateLabel(event, date, end, timezone, locale) : ''}{names[event.owner]}{event.visibility === 'private' ? ' · Private' : ''}</span></span>
  </Link>;
}
