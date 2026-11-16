
import { DateTime } from 'luxon';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { calendarKeys, listAgenda } from '../queries';
import { useCalendarSignals } from '../realtime';

import { MonthGrid } from '../components/MonthGrid';
import { Agenda } from '../components/Agenda';
import type { OwnerNames } from '../components/EventRow';
import '../../../styles/calendar.css';
export function CalendarPage() {
  const { account, pair } = useSession(); const [params, setParams] = useSearchParams();
  const parsed = DateTime.fromISO(params.get('date') ?? '', { zone: pair && 'timezone' in pair ? pair.timezone : 'Europe/Warsaw' });
  const date = parsed.isValid ? parsed.toISODate()! : DateTime.now().setZone(account!.timezone).toISODate()!;
  const [defaultView] = useState(() => window.matchMedia('(max-width:767px)').matches ? 'agenda' : 'month');
  const view = ['month', 'agenda'].includes(params.get('view') ?? '') ? params.get('view')! : defaultView;
  const owner = ['a', 'b', 'together'].includes(params.get('owner') ?? '') ? params.get('owner')! : 'all';
  const month = DateTime.fromISO(date).startOf('month');
  const range = { pairId: pair?.status === 'active' ? pair.pairId : '', from: month.startOf('week').toISODate()!, to: month.endOf('month').endOf('week').plus({ days: 1 }).toISODate()! };
  const query = useQuery({ queryKey: calendarKeys.agenda(account!.id, range), queryFn: () => listAgenda(range), enabled: pair?.status === 'active' });
  useCalendarSignals(account!.id, pair);
  const events = useMemo(() => (query.data ?? []).filter(event => owner === 'all' || event.owner === owner), [query.data, owner]);
  if (pair?.status !== 'active' || !account) return null;
  const names: OwnerNames = { a: pair.members.find(member => member.slot === 'a')!.displayName, b: pair.members.find(member => member.slot === 'b')!.displayName, together: 'Together' };
  const change = (updates: Record<string, string>) => setParams({ view, date, owner, ...updates });
  return <><PageHeader title="Calendar" description="Shared and private events." action={<div className="actions"><Link className="button secondary" to="/ideas">Date ideas</Link><Link className="button primary" to={'/events/new?date=' + date}>Add event</Link></div>} /><section className="card calendar-card"><div className="calendar-toolbar"><div className="calendar-date-controls"><Button variant="secondary" aria-label="Previous month" onClick={() => change({ date: month.minus({ months: 1 }).toISODate()! })}><CaretLeftIcon size={20} aria-hidden="true" /></Button><h2>{formatDate(month, 'month', account.locale)}</h2><Button variant="secondary" aria-label="Next month" onClick={() => change({ date: month.plus({ months: 1 }).toISODate()! })}><CaretRightIcon size={20} aria-hidden="true" /></Button><Button variant="secondary" onClick={() => change({ date: DateTime.now().setZone(account.timezone).toISODate()! })}>Today</Button></div><div className="view-tabs" aria-label="Calendar view">{['month', 'agenda'].map(value => <button key={value} aria-pressed={view === value} onClick={() => change({ view: value })}>{value === 'month' ? 'Month' : 'Agenda'}</button>)}</div></div><div className="calendar-filters"><div className="owner-filters" aria-label="Event owner">{(['all', 'a', 'b', 'together'] as const).map(value => <button key={value} className={'owner-' + value} aria-pressed={owner === value} onClick={() => change({ owner: value })}>{value === 'all' ? 'Everyone' : names[value]}</button>)}</div></div>{query.isPending ? <Status>Loading events…</Status> : query.isError ? <><Status error>We could not load your events.</Status><Button onClick={() => void query.refetch()}>Retry</Button></> : view === 'month' ? <><MonthGrid date={date} selected={date} events={events} names={names} timezone={account.timezone} locale={account.locale} onSelect={date => change({ date })} /><section className="selected-agenda"><h2>{formatDate(DateTime.fromISO(date), 'weekday', account.locale)}</h2><Agenda events={events} from={date} to={DateTime.fromISO(date).plus({ days: 1 }).toISODate()!} names={names} timezone={account.timezone} locale={account.locale} /></section></> : <Agenda events={events} from={month.toISODate()!} to={month.plus({ months: 1 }).toISODate()!} names={names} timezone={account.timezone} locale={account.locale} />}</section></>;
}
