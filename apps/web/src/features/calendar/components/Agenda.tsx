import { DateTime } from 'luxon';
import type { AgendaItem } from '@deseo/domain/calendar';
import { agendaDates } from '../queries';
import { EventRow, type OwnerNames } from './EventRow';
export function Agenda({ events, from, to, timezone, names }: { events: AgendaItem[]; from: string; to: string; timezone: string; names: OwnerNames }) {
  const days = new Map<string, AgendaItem[]>();
  for (const event of events) for (const date of agendaDates(event, timezone, from, to)) days.set(date, [...(days.get(date) ?? []), event]);
  return <div className="agenda">{[...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => <section key={date} className="agenda-day"><h3>{DateTime.fromISO(date).setLocale('en').toFormat('cccc, d LLLL')}</h3><div>{items.map(event => <EventRow key={event.id} event={event} names={names} timezone={timezone} />)}</div></section>)}{days.size === 0 && <p className="empty-state">No events in this range.</p>}</div>;
}
