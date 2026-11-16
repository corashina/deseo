import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event } from '@deseo/domain/calendar';
import type { OwnerNames } from '../../calendar';
import { formatDate, formatRange } from '../../../lib/format';

// The label compares days in the pair timezone. It is computed once per render; nothing ticks.
export function dayLabel(event: Event, zone: string, locale: string): string {
  const now = DateTime.now().setZone(zone);
  const start = event.temporal.kind === 'allDay' ? DateTime.fromISO(event.temporal.startDate, { zone }) : DateTime.fromISO(event.temporal.startsAt).setZone(zone);
  if (start <= now) return 'Now';
  const days = start.startOf('day').diff(now.startOf('day'), 'days').days;
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : formatDate(start, 'weekdayName', locale);
}

export function NextPlanCard({ event, names, zone, locale }: { event: Event; names: OwnerNames; zone: string; locale: string }) {
  const time = event.temporal.kind === 'allDay' ? 'All day'
    : formatRange(DateTime.fromISO(event.temporal.startsAt).setZone(zone), DateTime.fromISO(event.temporal.endsAt).setZone(zone), 'time', locale);
  return <Link className={'next-plan owner-' + event.owner} to={'/events/' + event.id} data-testid="today-next-plan">
    <span className="eyebrow">Next plan · {dayLabel(event, zone, locale)}</span>
    <strong>{event.title}</strong>
    <span>{time}{event.location ? ' · ' + event.location : ''} · {names[event.owner]}{event.visibility === 'private' ? ' · Private' : ''}</span>
  </Link>;
}
