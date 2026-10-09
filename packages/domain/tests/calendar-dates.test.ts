import { agendaDates, type AgendaItem } from '@deseo/domain/calendar';

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
