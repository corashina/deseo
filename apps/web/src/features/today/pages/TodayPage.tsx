import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import { importantDateCountdown } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { nextImportantDate, useCalendarSignals } from '../../calendar';
import { useMemorySignals } from '../../memories';
import { useTaskSignals } from '../../tasks';
import { Conversation } from '../../messages';
import { getToday, todayKeys } from '../queries';
import { OurDayPanel } from '../components/OurDayPanel';
import { DayChips } from '../components/DayChips';
import '../../../styles/memories.css';
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
  if (pair?.status !== 'active') return null;
  const locale = account!.locale;
  const names = { a: pair.members.find(member => member.slot === 'a')!.displayName, b: pair.members.find(member => member.slot === 'b')!.displayName, together: 'Together' };
  const important = query.data ? nextImportantDate(query.data.importantDates, zone) : undefined;
  const days = important?.temporal.kind === 'allDay' ? importantDateCountdown(important.temporal.startDate, zone) : null;
  return <div className="today-page">
    <PageHeader
      title="Today"
      eyebrow={formatDate(DateTime.fromISO(date), 'weekday', locale)}
      description={zone !== account!.timezone ? <span translate="no">{zone}</span> : undefined}
      action={<Link className="button secondary" to="/events/new">Add event</Link>} />
    <div className="today-layout">
      <div className="today-conversation">
        {query.data && <DayChips next={query.data.agenda[0]} dueCount={query.data.dueTasks.length} important={important} days={days} zone={zone} locale={locale} />}
        <Conversation />
      </div>
      {query.isPending ? <Status>Loading Today…</Status> : query.isError ? <div><Status error>We could not load Today.</Status><Button onClick={() => void query.refetch()}>Retry</Button></div>
        : <OurDayPanel data={query.data} important={important} days={days} date={date} zone={zone} locale={locale} names={names} members={pair.members} />}
    </div>
  </div>;
}
