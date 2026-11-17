import { DateTime } from 'luxon';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { calendarKeys, listAgenda } from '../queries';

import { MonthGrid } from '../components/MonthGrid';
import { Agenda } from '../components/Agenda';
import { ownerNames } from '../components/EventRow';
import { useFrom } from '../../../lib/return-to';
import { IdeasSection } from '../ideas/components/IdeasSection';
import '../../../styles/calendar.css';
export function CalendarPage() {
  const { account, pair } = useSession(); const [params, setParams] = useSearchParams(); const from = useFrom();
  const parsed = DateTime.fromISO(params.get('date') ?? '', { zone: account!.timezone });
  const date = parsed.isValid ? parsed.toISODate()! : DateTime.now().setZone(account!.timezone).toISODate()!;
  const [defaultView] = useState(() => window.matchMedia('(max-width:767px)').matches ? 'agenda' : 'month');
  const view = ['month', 'agenda'].includes(params.get('view') ?? '') ? params.get('view')! : defaultView;
  const owner = ['a', 'b', 'together'].includes(params.get('owner') ?? '') ? params.get('owner')! : 'all';
  const month = DateTime.fromISO(date).startOf('month');
  const range = { pairId: pair?.status === 'active' ? pair.pairId : '', from: month.startOf('week').toISODate()!, to: month.endOf('month').endOf('week').plus({ days: 1 }).toISODate()! };
  const query = useQuery({ queryKey: calendarKeys.agenda(account!.id, range), queryFn: () => listAgenda(range), enabled: pair?.status === 'active' });
  const self = pair?.status === 'active' ? pair.members.find(member => member.userId === account!.id)?.slot : undefined;
  // A private event is the viewer's own, so a person filter for the viewer shows it.
  const events = useMemo(() => (query.data ?? []).filter(event => owner === 'all' || event.who === owner || (event.who === 'private' && owner === self)), [query.data, owner, self]);
  const agenda = useRef<HTMLElement>(null);
  if (pair?.status !== 'active' || !account) return null;
  const names = ownerNames(pair.members, account.id);
  const change = (updates: Record<string, string>) => setParams({ view, date, owner, ...updates });
  const today = DateTime.now().setZone(account.timezone).toISODate()!;
  const filter = (value: 'all' | 'a' | 'b' | 'together') => <button key={value} aria-pressed={owner === value} onClick={() => change({ owner: value })}>
    {value !== 'all' && <span className="owner-dots" aria-hidden="true"><span className={'owner-' + value} /></span>}{value === 'all' ? 'Everyone' : names[value]}
  </button>;
  const add = '/events/new?date=' + date;
  return <>
    <PageHeader title="Calendar" hideTitle action={<Link className="button primary" to={add} state={from}>Add event</Link>} />
    <section className="card calendar-card">
      <div className="calendar-toolbar">
        <div className="calendar-date-controls">
          <Button variant="secondary" aria-label="Previous month" onClick={() => change({ date: month.minus({ months: 1 }).toISODate()! })}><CaretLeftIcon size={20} aria-hidden="true" /></Button>
          <Button variant="secondary" aria-label="Next month" onClick={() => change({ date: month.plus({ months: 1 }).toISODate()! })}><CaretRightIcon size={20} aria-hidden="true" /></Button>
          <h2>{formatDate(month, 'month', account.locale)}</h2>
          {date !== today && <Button variant="text" onClick={() => change({ date: today })}>Today</Button>}
        </div>
        <div className="view-tabs" role="group" aria-label="Calendar view">{['month', 'agenda'].map(value => <button key={value} aria-pressed={view === value} onClick={() => change({ view: value })}>{value === 'month' ? 'Month' : 'Agenda'}</button>)}</div>
      </div>
      <div className="view-tabs owner-filters" role="group" aria-label="Event owner">{(['all', 'a', 'b', 'together'] as const).map(filter)}</div>
      {query.isPending ? <Status>Loading your calendar…</Status> : query.isError ? <><Status error>We could not load your events.</Status><Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button></>
        : view === 'month' ? <>
          <MonthGrid date={date} selected={date} today={today} events={events} names={names} timezone={account.timezone} locale={account.locale} onSelect={date => {
            change({ date });
            // The day's events show below the grid. Bring them into view when they start below the window.
            const heading = agenda.current;
            if (heading && heading.getBoundingClientRect().top > window.innerHeight - 96) heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
          }} />
          <section className="selected-agenda" ref={agenda}>
            <h2>{formatDate(DateTime.fromISO(date), 'weekday', account.locale)}</h2>
            <Agenda events={events} from={date} to={DateTime.fromISO(date).plus({ days: 1 }).toISODate()!} names={names} timezone={account.timezone} locale={account.locale}
              empty={<p>Nothing planned for this day.</p>} />
          </section>
        </>
        : <Agenda events={events} from={month.toISODate()!} to={month.plus({ months: 1 }).toISODate()!} names={names} timezone={account.timezone} locale={account.locale} empty={<p>Nothing planned this month.</p>} />}
    </section>
    <IdeasSection pairId={pair.pairId} />
  </>;
}
