// Importance: 96. Yearly dates and pair-zone countdowns must preserve the selected calendar day.
import { DateTime } from 'luxon';
import { eventInputSchema, eventRowSchema, toEventInput } from '@deseo/domain/calendar';
import { importantDateCountdown, nextImportantDate } from '@deseo/domain/calendar';
import { listImportantDates } from './important-dates';
import { listAgenda } from './queries';

jest.mock('./queries', () => ({ listAgenda: jest.fn() }));
const base = { id: '74ff3de3-609c-43c3-bbd3-01e064593ba9', pairId: '610bc9c7-8c81-47d1-894e-314c92071cf1', title: 'Birthday', owner: 'together' as const, visibility: 'shared' as const, timezone: 'Europe/Warsaw' };
it('accepts one-day yearly dates and rejects yearly timed or multi-day events', () => {
  const temporal = { kind: 'allDay' as const, startDate: '2024-02-29', endDateExclusive: '2024-03-01' };
  expect(eventInputSchema.parse({ ...base, temporal, repeat: 'yearly' }).repeat).toBe('yearly');
  expect(eventInputSchema.safeParse({ ...base, repeat: 'yearly', temporal: { ...temporal, endDateExclusive: '2024-03-02' } }).success).toBe(false);
  expect(eventInputSchema.safeParse({ ...base, repeat: 'yearly', temporal: { kind: 'timed', startsAt: '2026-01-01T12:00:00Z', endsAt: '2026-01-01T13:00:00Z' } }).success).toBe(false);
});
it('uses a server occurrence without replacing the stored leap-day series', () => {
  const event = eventRowSchema.parse({ id: base.id, pair_id: base.pairId, created_by: base.id, title: base.title, owner: base.owner, visibility: base.visibility, timezone: base.timezone, starts_at: null, ends_at: null, start_date: '2024-02-29', end_date_exclusive: '2024-03-01', repeat: 'yearly', repeat_month: 2, repeat_day: 29, occurrence_date: '2027-02-28', location: null, description: null, version: 1 });
  expect(event.temporal).toEqual({ kind: 'allDay', startDate: '2027-02-28', endDateExclusive: '2027-03-01' });
  expect(event.repeat).toBe('yearly');
  expect(event.seriesDate).toBe('2024-02-29');
});
it('counts calendar days in the pair timezone across DST and midnight', () => {
  expect(importantDateCountdown('2026-03-30', 'Europe/Warsaw', DateTime.fromISO('2026-03-28T23:30:00Z'))).toBe(1);
  expect(importantDateCountdown('2026-10-05', 'Europe/Warsaw', DateTime.fromISO('2026-10-04T22:30:00Z'))).toBe(0);
  expect(importantDateCountdown('2026-10-05', 'America/New_York', DateTime.fromISO('2026-10-04T22:30:00Z'))).toBe(1);
});
it('retains yearly repeat when converting a form and filters server occurrences', async () => {
  const event = toEventInput({ ...base, allDay: true, repeat: 'yearly', startDate: '2024-02-29', endDate: '2024-02-29', startTime: '', endTime: '', location: '', description: '' });
  jest.mocked(listAgenda).mockResolvedValue([{ ...event, authorId: base.id, version: 1 }, { ...event, repeat: 'none', importantDate: false, authorId: base.id, version: 1 }]);
  expect(await listImportantDates(base.pairId, '2027-01-01', '2028-01-01')).toHaveLength(1);
  expect(listAgenda).toHaveBeenCalledWith({ pairId: base.pairId, from: '2027-01-01', to: '2028-01-01' });
});
it('includes one-off important dates without annual repeat', async () => {
  const event = { ...base, importantDate: true, repeat: 'none' as const, authorId: base.id, version: 1, temporal: { kind: 'allDay' as const, startDate: '2027-06-01', endDateExclusive: '2027-06-02' } };
  jest.mocked(listAgenda).mockResolvedValue([event]);
  expect(await listImportantDates(base.pairId, '2027-01-01', '2028-01-01')).toEqual([event]);
});
it('selects the next pair-local start date instead of a past overlapping important event', () => {
  const event = { ...base, importantDate: true, authorId: base.id, version: 1, temporal: { kind: 'allDay' as const, startDate: '2026-10-04', endDateExclusive: '2026-10-07' } };
  const next = { ...event, id: 'next', temporal: { kind: 'allDay' as const, startDate: '2026-10-06', endDateExclusive: '2026-10-07' } };
  expect(nextImportantDate([event, next], 'Europe/Warsaw', DateTime.fromISO('2026-10-04T22:30:00Z'))).toBe(next);
  expect(nextImportantDate([event], 'Europe/Warsaw', DateTime.fromISO('2026-10-04T22:30:00Z'))).toBeUndefined();
});
