import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event } from '@deseo/domain/calendar';
import { formatDate } from '../../../lib/format';
import { eventOwner, type OwnerNames } from '../../calendar/components/EventRow';
import { dayLabel } from './NextPlanCard';

// Below 1200px the Our day panel shrinks to these links above the conversation.
// Each chip keeps one line; the event screen shows the full title. The next plan chip shows its owner dot.
export function DayChips({ next, dueCount, important, days, names, zone, locale }: {
  next: Event | undefined; names: OwnerNames; dueCount: number; important: Event | undefined; days: number | null; zone: string; locale: string;
}) {
  const time = next && (next.temporal.kind === 'allDay' ? 'All day' : formatDate(DateTime.fromISO(next.temporal.startsAt).setZone(zone), 'time', locale));
  return <nav className="day-chips" aria-label="Our day">
    {next && <Link to={'/events/' + next.id}><span className="owner-dots" aria-hidden="true"><span className={'owner-' + eventOwner(next, names)} /></span><span>{dayLabel(next, zone, locale)}, {time} · {next.title}</span></Link>}
    {dueCount > 0 && <Link to="/tasks"><span>{dueCount === 1 ? '1 task due' : dueCount + ' tasks due'}</span></Link>}
    {important && days !== null && <Link to={'/events/' + important.id}><span>{important.title} · {days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days'}</span></Link>}
  </nav>;
}
