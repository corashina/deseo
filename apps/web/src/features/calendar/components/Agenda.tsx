import type { ReactNode } from 'react';
import { DateTime } from 'luxon';
import type { AgendaItem } from '@deseo/domain/calendar';
import { agendaDates } from '@deseo/domain/calendar';
import { EventRow, type OwnerNames } from './EventRow';
import { formatDate } from '../../../lib/format';

// One day shows its events without a day heading, because the caller names the day.
export function Agenda({ events, from, to, timezone, locale, names, empty }: { events: AgendaItem[]; from: string; to: string; timezone: string; locale: string; names: OwnerNames; empty: ReactNode }) {
  const days = new Map<string, AgendaItem[]>();
  for (const event of events) for (const date of agendaDates(event, timezone, from, to)) days.set(date, [...(days.get(date) ?? []), event]);
  if (days.size === 0) return <div className="empty-state">{empty}</div>;
  const rows = (items: AgendaItem[]) => items.map(event => <EventRow key={event.id} event={event} names={names} timezone={timezone} locale={locale} />);
  if (DateTime.fromISO(from).plus({ days: 1 }).toISODate() === to) return <div className="agenda">{rows([...days.values()][0])}</div>;
  return <div className="agenda">{[...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => <section key={date} className="agenda-day"><h3>{formatDate(DateTime.fromISO(date), 'weekday', locale)}</h3><div>{rows(items)}</div></section>)}</div>;
}
