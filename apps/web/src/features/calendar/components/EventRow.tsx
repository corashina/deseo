import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event, Owner } from '@deseo/domain/calendar';
import { formatDate, formatRange } from '../../../lib/format';
import { useFrom } from '../../../lib/return-to';
export type OwnerNames = Record<Owner, string>;
// day is the calendar day that shows the row. A timed event that started on an earlier day shows its end time there.
export function EventRow({ event, names, timezone, locale, showDate = false, day }: { event: Event; names: OwnerNames; timezone: string; locale: string; showDate?: boolean; day?: string }) {
  const date = event.temporal.kind === 'allDay' ? DateTime.fromISO(event.temporal.startDate) : DateTime.fromISO(event.temporal.startsAt).setZone(timezone);
  const end = event.temporal.kind === 'allDay' ? DateTime.fromISO(event.temporal.endDateExclusive).minus({ days: 1 }) : DateTime.fromISO(event.temporal.endsAt).setZone(timezone);
  const time = event.temporal.kind === 'allDay' ? 'All day'
    : day && day > date.toISODate()! ? (day === end.toISODate() ? 'Until ' + formatDate(end, 'time', locale) : 'Continues')
    : formatDate(date, 'time', locale);
  const dateLabel = formatRange(date, end, date.year === end.year ? 'day' : 'dayYear', locale);
  const now = DateTime.now().setZone(timezone);
  const from = useFrom();
  const ongoing = event.temporal.kind === 'allDay'
    ? now.toISODate()! >= event.temporal.startDate && now.toISODate()! < event.temporal.endDateExclusive
    : now.toMillis() >= date.toMillis() && now.toMillis() < end.toMillis();
  return <Link className={'event-row owner-' + event.owner} to={'/events/' + event.id} state={from}>
    <span className="event-row-time">{time}</span><span className="event-row-content"><strong>{event.title}</strong><span>{showDate ? dateLabel + ' · ' + (ongoing ? 'Ongoing · ' : '') : ''}{names[event.owner]}{event.visibility === 'private' ? ' · Private' : ''}</span></span>
  </Link>;
}
