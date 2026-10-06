import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event, Owner } from '@deseo/domain/calendar';
export type OwnerNames = Record<Owner, string>;
export function EventRow({ event, names, timezone, showDate = false }: { event: Event; names: OwnerNames; timezone: string; showDate?: boolean }) {
  const time = event.temporal.kind === 'allDay' ? 'All day' : DateTime.fromISO(event.temporal.startsAt).setZone(timezone).toFormat('HH:mm');
  const date = event.temporal.kind === 'allDay' ? DateTime.fromISO(event.temporal.startDate) : DateTime.fromISO(event.temporal.startsAt).setZone(timezone);
  return <Link className={'event-row owner-' + event.owner} to={'/events/' + event.id}>
    <span className="event-row-time">{time}</span><span className="event-row-content"><strong>{event.title}</strong><span>{showDate ? date.setLocale('en').toFormat('d LLL') + ' · ' : ''}{names[event.owner]}{event.visibility === 'private' ? ' · Private' : ''}</span></span>
  </Link>;
}
