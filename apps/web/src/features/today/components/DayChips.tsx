import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event } from '@deseo/domain/calendar';
import { formatDate } from '../../../lib/format';

// Below 1200px the Our day panel shrinks to these links above the conversation.
export function DayChips({ next, dueCount, important, days, zone, locale }: {
  next: Event | undefined; dueCount: number; important: Event | undefined; days: number | null; zone: string; locale: string;
}) {
  const time = next && (next.temporal.kind === 'allDay' ? 'All day' : formatDate(DateTime.fromISO(next.temporal.startsAt).setZone(zone), 'time', locale));
  return <nav className="day-chips" aria-label="Our day">
    {next && <Link to={'/events/' + next.id}>{time} · {next.title}</Link>}
    {dueCount > 0 && <Link to="/tasks">{dueCount === 1 ? '1 task due' : dueCount + ' tasks due'}</Link>}
    {important && days !== null && <Link to={'/events/' + important.id}>{important.title} · {days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days'}</Link>}
  </nav>;
}
