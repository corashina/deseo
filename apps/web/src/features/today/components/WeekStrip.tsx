import { DateTime } from 'luxon';
import type { Event, Owner } from '@deseo/domain/calendar';
import { formatDate } from '../../../lib/format';
import { eventOwner, type OwnerNames } from '../../calendar';

const owners: readonly Owner[] = ['a', 'b', 'together'];

// Days an event covers in the pair timezone, as ISO dates. All-day ends are exclusive.
function eventDays(event: Event, zone: string): [string, string] {
  if (event.temporal.kind === 'allDay') return [event.temporal.startDate, event.temporal.endDateExclusive];
  const start = DateTime.fromISO(event.temporal.startsAt).setZone(zone).toISODate()!;
  const end = DateTime.fromISO(event.temporal.endsAt).setZone(zone).minus({ milliseconds: 1 }).plus({ days: 1 }).toISODate()!;
  return [start, end];
}

export function WeekStrip({ date, events, names, zone, locale }: { date: string; events: readonly Event[]; names: OwnerNames; zone: string; locale: string }) {
  const first = DateTime.fromISO(date, { zone });
  const ranges = events.map(event => ({ owner: eventOwner(event, names), days: eventDays(event, zone) }));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = first.plus({ days: index });
    const iso = day.toISODate()!;
    const hits = ranges.filter(range => range.days[0] <= iso && iso < range.days[1]);
    return { iso, day, count: hits.length, owners: owners.filter(owner => hits.some(hit => hit.owner === owner)) };
  });
  return <ol className="week-strip" aria-label="Next seven days">{days.map(({ iso, day, count, owners }) =>
    <li key={iso} aria-current={iso === date ? 'date' : undefined}>
      <span className="week-strip-name">{formatDate(day, 'weekdayName', locale)}</span>
      <span className="week-strip-number">{day.day}</span>
      <span className="owner-dots" aria-hidden="true">{owners.map(owner => <span key={owner} className={'owner-' + owner} />)}</span>
      <span className="visually-hidden">{count === 1 ? '1 plan' : count + ' plans'}</span>
    </li>)}</ol>;
}
