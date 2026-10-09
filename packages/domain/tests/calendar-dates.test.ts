import { DateTime } from 'luxon';
import { agendaDates, nextImportantDate, type AgendaItem } from '@deseo/domain/calendar';

const base = { id: '74ff3de3-609c-43c3-bbd3-01e064593ba9', pairId: '610bc9c7-8c81-47d1-894e-314c92071cf1', title: 'Dinner', owner: 'a' as const, visibility: 'shared' as const, timezone: 'Europe/Warsaw' };

// Importance: 96. The agenda must include each overlapping day.
describe('agenda range', () => {
  it('includes each overlapped day and excludes the end instant', () => {
    const item: AgendaItem = { ...base, authorId: 'author', version: 1, temporal: { kind: 'timed', startsAt: '2026-07-01T21:30:00Z', endsAt: '2026-07-02T22:00:00Z' } };
    expect(agendaDates(item, 'Europe/Warsaw', '2026-07-02', '2026-07-04')).toEqual(['2026-07-02']);
  });
  it('does not move all-day dates into the viewer timezone', () => {
    const item: AgendaItem = { ...base, authorId: 'author', version: 1, temporal: { kind: 'allDay', startDate: '2026-07-01', endDateExclusive: '2026-07-03' } };
    expect(agendaDates(item, 'America/New_York', '2026-07-01', '2026-07-04')).toEqual(['2026-07-01', '2026-07-02']);
  });

  it('clips both range boundaries and excludes events outside the range', () => {
    const item: AgendaItem = { ...base, authorId: 'author', version: 1,
      temporal: { kind: 'allDay', startDate: '2026-07-01', endDateExclusive: '2026-07-05' } };
    expect(agendaDates(item, 'Europe/Warsaw', '2026-07-02', '2026-07-04')).toEqual(['2026-07-02', '2026-07-03']);
    expect(agendaDates(item, 'Europe/Warsaw', '2026-06-29', '2026-07-01')).toEqual([]);
    expect(agendaDates(item, 'Europe/Warsaw', '2026-07-05', '2026-07-07')).toEqual([]);
  });

  it('uses calendar days through a DST change and excludes local midnight at the end', () => {
    const item: AgendaItem = { ...base, authorId: 'author', version: 1,
      temporal: { kind: 'timed', startsAt: '2026-10-24T22:00:00Z', endsAt: '2026-10-26T23:00:00Z' } };
    expect(agendaDates(item, 'Europe/Warsaw', '2026-10-24', '2026-10-28')).toEqual(['2026-10-25', '2026-10-26']);
  });
});

// Importance: 96. Selection keeps date rules, input order, and input values.
describe('next important date', () => {
  const now = DateTime.fromISO('2026-10-09T12:00:00Z');
  const allDay = (title: string, startDate: string): AgendaItem => ({ ...base, title, authorId: 'author', version: 1,
    temporal: { kind: 'allDay', startDate, endDateExclusive: DateTime.fromISO(startDate).plus({ days: 1 }).toISODate()! } });

  it('keeps the first input item when eligible dates match', () => {
    const first = allDay('First', '2026-10-10');
    const second = allDay('Second', '2026-10-10');
    expect(nextImportantDate([allDay('Later', '2026-10-11'), first, second], 'Europe/Warsaw', now)).toBe(first);
    expect(nextImportantDate([second, first], 'Europe/Warsaw', now)).toBe(second);
  });

  it('skips past dates and timed events while keeping today eligible', () => {
    const today = allDay('Today', '2026-10-09');
    const timed: AgendaItem = { ...base, authorId: 'author', version: 1,
      temporal: { kind: 'timed', startsAt: '2026-10-09T15:00:00Z', endsAt: '2026-10-09T16:00:00Z' } };
    expect(nextImportantDate([allDay('Past', '2026-10-08'), timed, allDay('Later', '2026-10-10'), today], 'Europe/Warsaw', now)).toBe(today);
    expect(nextImportantDate([allDay('Past', '2026-10-08'), timed], 'Europe/Warsaw', now)).toBeUndefined();
    expect(nextImportantDate([], 'Europe/Warsaw', now)).toBeUndefined();
  });

  it('uses the pair date across timezone boundaries', () => {
    const boundary = DateTime.fromISO('2026-10-09T00:30:00Z');
    const previous = allDay('Previous local day', '2026-10-08');
    const current = allDay('Current local day', '2026-10-09');
    expect(nextImportantDate([current, previous], 'America/New_York', boundary)).toBe(previous);
    expect(nextImportantDate([previous, current], 'Europe/Warsaw', boundary)).toBe(current);
  });

  it('retains a leap-day occurrence and leaves the input unchanged', () => {
    const leapDay = allDay('Leap day', '2028-02-29');
    const items = [allDay('March', '2028-03-01'), leapDay, allDay('Past', '2028-02-28')];
    const before = structuredClone(items);
    expect(nextImportantDate(items, 'Europe/Warsaw', DateTime.fromISO('2028-02-29T12:00:00Z'))).toBe(leapDay);
    expect(items).toEqual(before);
    expect(items[1]).toBe(leapDay);
  });
});