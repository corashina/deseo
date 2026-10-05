import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event, Owner } from '@deseo/domain/calendar';
export type OwnerNames = Record<Owner, string>;
export function EventRow({ event, names, timezone }: { event: Event; names: OwnerNames; timezone: string }) {
  const time = event.temporal.kind === 'allDay' ? 'All day' : DateTime.fromISO(event.temporal.startsAt).setZone(timezone).toFormat('HH:mm');
  return <Link className={'event-row owner-' + event.owner} to={'/events/' + event.id}>
    <span className="event-row-time">{time}</span><span className="event-row-content"><strong>{event.title}</strong><span>{names[event.owner]}{event.visibility === 'private' ? ' · Private' : ''}</span></span>
  </Link>;
}
