import { DateTime } from 'luxon';
import type { AgendaItem } from '@deseo/domain/calendar';
import { agendaDates } from '@deseo/domain/calendar';
import { EventRow, type OwnerNames } from './EventRow';
export function PartnerDayView({ events, date, names, timezone }: { events: AgendaItem[]; date: string; names: OwnerNames; timezone: string }) {
  const start = DateTime.fromISO(date).startOf('week');
  return <div className="partner-comparison"><div className="comparison-head"><span>Day</span><h2 className="owner-a">{names.a}</h2><h2 className="owner-b">{names.b}</h2></div>{Array.from({ length: 7 }, (_, i) => {
    const day = start.plus({ days: i }); const iso = day.toISODate()!;
    const items = events.filter(event => agendaDates(event, timezone, iso, day.plus({ days: 1 }).toISODate()!).length);
    return <section key={iso} className="comparison-day"><h3>{day.setLocale('en').toFormat('ccc d')}</h3>{(['a', 'b'] as const).map(owner => <div className="comparison-column" key={owner}><h4 className={'comparison-owner owner-' + owner}>{names[owner]}</h4>{items.filter(event => event.owner === owner).map(event => <EventRow key={event.id} event={event} names={names} timezone={timezone} />)}{!items.some(event => event.owner === owner) && <span className="muted">No events</span>}</div>)}{items.some(event => event.owner === 'together') && <div className="comparison-shared">{items.filter(event => event.owner === 'together').map(event => <EventRow key={event.id} event={event} names={names} timezone={timezone} />)}</div>}</section>;
  })}</div>;
}
