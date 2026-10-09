import { useMemo } from 'react';
import { DateTime } from 'luxon';
import type { AgendaItem } from '@deseo/domain/calendar';
import { agendaDates } from '@deseo/domain/calendar';
import { EventRow, type OwnerNames } from './EventRow';
export function MonthGrid({ events, date, selected, onSelect, timezone, names }: { events: AgendaItem[]; date: string; selected: string; onSelect(date: string): void; timezone: string; names: OwnerNames }) {
  const month = date.slice(0, 7);
  const grid = useMemo(() => {
    const start = DateTime.fromISO(month).startOf('month');
    const gridStart = start.minus({ days: start.weekday - 1 });
    const count = Math.ceil((start.daysInMonth! + start.weekday - 1) / 7) * 7;
    const days = Array.from({ length: count }, (_, index) => {
      const day = gridStart.plus({ days: index });
      return { date: day.toISODate()!, day: day.day, outside: day.month !== start.month, label: day.setLocale('en').toFormat('d LLLL yyyy') };
    });
    return { days, from: gridStart.toISODate()!, to: gridStart.plus({ days: count }).toISODate()! };
  }, [month]);
  const groups = useMemo(() => {
    const values = new Map<string, AgendaItem[]>();
    for (const event of events) {
      for (const date of agendaDates(event, timezone, grid.from, grid.to)) {
        const items = values.get(date) ?? [];
        items.push(event);
        values.set(date, items);
      }
    }
    return values;
  }, [events, timezone, grid]);
  return <div className="month-grid" aria-label="Month calendar"><div className="month-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><div className="month-days">{grid.days.map(day => {
    const items = groups.get(day.date);
    return <div key={day.date} className={'month-day' + (day.outside ? ' outside' : '') + (day.date === selected ? ' selected' : '')}><button className="day-number" aria-label={day.label} aria-pressed={day.date === selected} onClick={() => onSelect(day.date)}>{day.day}</button><div className="day-events">{items?.map(event => <EventRow key={event.id} event={event} names={names} timezone={timezone} />)}</div>{items && items.length > 0 && <span className="day-count">{items.length} event{items.length > 1 ? 's' : ''}</span>}</div>;
  })}</div></div>;
}
