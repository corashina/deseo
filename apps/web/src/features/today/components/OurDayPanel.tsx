import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Event } from '@deseo/domain/calendar';
import type { Memory } from '@deseo/domain/memories';
import type { TodaySummary } from '@deseo/domain/today';
import type { PairMember } from '@deseo/domain/pair';
import { MemoryCard } from '../../memories';
import { EventRow, type OwnerNames } from '../../calendar';
import { TaskRow } from '../../tasks';
import { formatDate } from '../../../lib/format';
import { NextPlanCard } from './NextPlanCard';
import { WeekStrip } from './WeekStrip';

// Plans, tasks, the next important date, and the latest memory beside the conversation.
export function OurDayPanel({ data, important, days, date, zone, locale, names, members }: {
  data: TodaySummary & { memory: Memory | null }; important: Event | undefined; days: number | null;
  date: string; zone: string; locale: string; names: OwnerNames; members: readonly PairMember[];
}) {
  const name = (userId: string | null) => members.find(member => member.userId === userId)?.displayName ?? 'Unassigned';
  return <aside className="our-day" aria-label="Our day">
    {data.agenda[0] && <NextPlanCard event={data.agenda[0]} names={names} zone={zone} locale={locale} />}
    <section className="card" data-testid="today-events">
      <div className="section-heading"><h2>Upcoming plans</h2><Link to="/calendar">View calendar</Link></div>
      <WeekStrip date={date} events={data.agenda} zone={zone} locale={locale} />
      {data.agenda.length ? data.agenda.slice(0, 3).map(event => <EventRow
        key={event.id + (event.temporal.kind === 'allDay' ? event.temporal.startDate : event.temporal.startsAt)}
        event={event} names={names} showDate timezone={zone} locale={locale} />) : <p>Nothing planned for the next seven days.</p>}
    </section>
    <section className="card" data-testid="today-tasks">
      <div className="section-heading"><h2>Due tasks</h2><Link to="/tasks">View tasks</Link></div>
      {data.dueTasks.length ? data.dueTasks.map(task => <TaskRow key={task.id} task={task} timezone={zone} locale={locale}
        assignee={name(task.assigneeId)} />) : <p>No unfinished tasks due today.</p>}
    </section>
    {important && <section className="card important-card" data-testid="today-important-date">
      <h2>Next important date</h2>
      <h3>{important.title}</h3>
      <p>{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days'}</p>
      {important.temporal.kind === 'allDay' && <p><time dateTime={important.temporal.startDate}>
        {formatDate(DateTime.fromISO(important.temporal.startDate, { zone }), 'date', locale)}</time></p>}
      <Link to={'/events/' + important.id}>View date</Link>
    </section>}
    {data.memory ? <section data-testid="today-memory"><h2>Latest memory</h2><MemoryCard memory={data.memory} author={members.find(member => member.userId === data.memory?.createdBy)} locale={locale} /></section>
      : <section className="card today-intro" data-testid="today-intro"><h2>Keep a moment together</h2><p>Add a photo with a date and a caption.</p><div className="today-intro-actions"><Link to="/memories/new">Add memory</Link></div></section>}
  </aside>;
}
