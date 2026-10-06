import { MemoryCard, useMemorySignals } from '../../memories';
import '../../../styles/memories.css';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import { importantDateCountdown } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { EventRow, useCalendarSignals } from '../../calendar';
import { TaskRow, useTaskSignals } from '../../tasks';
import { NoteCard } from '../../messages';
import '../../../styles/messages.css';
import { getToday, todayKeys } from '../queries';
import '../../../styles/calendar.css';
import '../../../styles/planning.css';
export function TodayPage() {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const zone = pair?.status === 'active' ? pair.timezone : 'UTC';
  const date = DateTime.now().setZone(zone).toISODate()!;
  const query = useQuery({ queryKey: todayKeys.day(account!.id, pairId, date), queryFn: () => getToday(pairId, date) });
  useMemorySignals(account!.id, pair);
  useTaskSignals(account!.id, pair);
  useCalendarSignals(account!.id, pair);
  if (pair?.status !== 'active')
    return null;
  const names = { a: pair.members.find(member => member.slot === 'a')!.displayName, b: pair.members.find(member => member.slot === 'b')!.displayName, together: 'Together' };
  const important = query.data?.importantDate;
  const days = important?.temporal.kind === 'allDay' ? importantDateCountdown(important.temporal.startDate, zone) : null;
  return <>
    <PageHeader
      title="Today"
      description={DateTime.fromISO(date).setLocale('en').toFormat('cccc, d LLLL') + ' · ' + zone}
      action={<Link className="button primary" to="/events/new">Add event</Link>} />
    {query.isPending ? <Status>Loading Today…</Status> : query.isError ? <>
      <Status error>We could not load Today.</Status>
      <Button onClick={() => void query.refetch()}>Retry</Button>
    </> : <div className="today-layout">
      <div className="planning-column">
        <section className="card" data-testid="today-events">
          <div className="section-heading">
            <h2>Upcoming plans</h2>
            <Link to="/calendar">View calendar</Link>
          </div>
          {query.data.agenda.length ? query.data.agenda.map(event => <EventRow
            key={event.id + (event.temporal.kind === 'allDay' ? event.temporal.startDate : event.temporal.startsAt)}
            event={event}
            names={names}
            timezone={zone} />) : <p>Nothing planned for the next seven days.</p>}
        </section>
        <section className="card" data-testid="today-tasks">
          <div className="section-heading">
            <h2>Due tasks</h2>
            <Link to="/tasks">View tasks</Link>
          </div>
          {query.data.tasks.length ? query.data.tasks.map(task => <TaskRow
            key={task.id}
            task={task}
            accountId={account!.id}
            assignee={pair.members.find(member => member.userId === task.assigneeId)?.displayName ?? 'Unassigned'} />) : <p>No unfinished tasks due today.</p>}
        </section>
      </div>
      <aside className="planning-column">
      {query.data.memory && <section data-testid="today-memory"><h2>Latest memory</h2><MemoryCard memory={query.data.memory} author={pair.members.find(member => member.userId === query.data.memory!.createdBy)!.displayName} /></section>}
      {query.data.note && <div data-testid="today-note"><NoteCard message={query.data.note} name={pair.members.find(member => member.userId === query.data.note!.authorId)!.displayName} /></div>}
      {important && <section className="card important-card">
        <h2>Next important date</h2>
        <h3>{important.title}
        </h3>
        <p>{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days'}
        </p>
        <Link to={'/events/' + important.id}>View date</Link>
      </section>}
      </aside>
    </div>}
  </>;
}
