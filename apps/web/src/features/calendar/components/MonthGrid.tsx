import { DateTime } from 'luxon';
import type { AgendaItem } from '@deseo/domain/calendar';
import { agendaDates } from '@deseo/domain/calendar';
import { EventRow, type OwnerNames } from './EventRow';
export function MonthGrid({ events, date, selected, onSelect, timezone, names }: { events: AgendaItem[]; date: string; selected: string; onSelect(date: string): void; timezone: string; names: OwnerNames }) {
  const start = DateTime.fromISO(date).startOf('month');
  const gridStart = start.minus({ days: start.weekday - 1 });
  const count = Math.ceil((start.daysInMonth! + start.weekday - 1) / 7) * 7;
  return <div className="month-grid" aria-label="Month calendar"><div className="month-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><div className="month-days">{Array.from({ length: count }, (_, i) => {
    const day = gridStart.plus({ days: i }); const iso = day.toISODate()!;
    const items = events.filter(event => agendaDates(event, timezone, iso, day.plus({ days: 1 }).toISODate()!).length > 0);
    return <div key={iso} className={'month-day' + (day.month !== start.month ? ' outside' : '') + (iso === selected ? ' selected' : '')}><button className="day-number" aria-label={day.setLocale('en').toFormat('d LLLL yyyy')} aria-pressed={iso === selected} onClick={() => onSelect(iso)}>{day.day}</button><div className="day-events">{items.map(event => <EventRow key={event.id} event={event} names={names} timezone={timezone} />)}</div>{items.length > 0 && <span className="day-count">{items.length} event{items.length > 1 ? 's' : ''}</span>}</div>;
  })}</div></div>;
}
