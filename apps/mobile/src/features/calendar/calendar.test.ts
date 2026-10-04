// Importance: 98. Wrong dates can change a person's plans.
import { eventInputSchema, resolveWallTime, toEventInput, inclusiveEndDate } from './schema';
import { agendaDates } from './queries';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent: jest.fn() }) }));

const base = { id: '74ff3de3-609c-43c3-bbd3-01e064593ba9', pairId: '610bc9c7-8c81-47d1-894e-314c92071cf1', title: 'Dinner', owner: 'a' as const, visibility: 'shared' as const, timezone: 'Europe/Warsaw' };

describe('calendar dates', () => {
  it('rejects the Warsaw spring gap instead of moving the time', () => {
    expect(() => resolveWallTime('2026-03-29', '02:30', 'Europe/Warsaw')).toThrow('does not exist');
  });
  it('requires a choice for the Warsaw autumn repeated hour', () => {
    expect(() => resolveWallTime('2026-10-25', '02:30', 'Europe/Warsaw')).toThrow('Choose');
    expect(resolveWallTime('2026-10-25', '02:30', 'Europe/Warsaw', 120)).toBe('2026-10-25T00:30:00.000Z');
    expect(resolveWallTime('2026-10-25', '02:30', 'Europe/Warsaw', 60)).toBe('2026-10-25T01:30:00.000Z');
  });
  it('converts the same instant for partners in Warsaw and New York', () => {
    expect(resolveWallTime('2026-07-01', '18:00', 'Europe/Warsaw')).toBe(resolveWallTime('2026-07-01', '12:00', 'America/New_York'));
  });
  it('rejects the New York spring gap and distinguishes its repeated hour', () => {
    expect(() => resolveWallTime('2026-03-08', '02:30', 'America/New_York')).toThrow('does not exist');
    expect(() => resolveWallTime('2026-11-01', '01:30', 'America/New_York')).toThrow('Choose');
    expect(resolveWallTime('2026-11-01', '01:30', 'America/New_York', -240)).toBe('2026-11-01T05:30:00.000Z');
    expect(resolveWallTime('2026-11-01', '01:30', 'America/New_York', -300)).toBe('2026-11-01T06:30:00.000Z');
  });
  it('keeps inclusive all-day dates through DST', () => {
    const input = toEventInput({ ...base, allDay: true, startDate: '2026-03-28', endDate: '2026-03-30', startTime: '', endTime: '', location: '', description: '' });
    expect(input.temporal).toEqual({ kind: 'allDay', startDate: '2026-03-28', endDateExclusive: '2026-03-31' });
    expect(inclusiveEndDate('2026-03-31')).toBe('2026-03-30');
  });
  it('rejects invalid zones, dates and backwards spans', () => {
    expect(() => resolveWallTime('2026-02-30', '12:00', 'Europe/Warsaw')).toThrow();
    expect(() => resolveWallTime('2026-01-01', '12:00', 'Mars/Base')).toThrow();
    expect(eventInputSchema.safeParse({ ...base, temporal: { kind: 'allDay', startDate: '2026-01-02', endDateExclusive: '2026-01-02' } }).success).toBe(false);
  });
  it('keeps a timed event crossing midnight valid', () => {
    expect(toEventInput({ ...base, allDay: false, startDate: '2026-07-01', endDate: '2026-07-02', startTime: '23:30', endTime: '00:30', location: '', description: '' }).temporal).toEqual({ kind: 'timed', startsAt: '2026-07-01T21:30:00.000Z', endsAt: '2026-07-01T22:30:00.000Z' });
  });
});

// Importance: 96. The agenda must include each overlapping day.
describe('agenda range', () => {
  it('includes each overlapped day and excludes the end instant', () => {
    const item = { ...base, authorId: 'author', version: 1, temporal: { kind: 'timed' as const, startsAt: '2026-07-01T21:30:00Z', endsAt: '2026-07-02T22:00:00Z' } };
    expect(agendaDates(item, 'Europe/Warsaw', '2026-07-02', '2026-07-04')).toEqual(['2026-07-02']);
  });
  it('does not move all-day dates into the viewer timezone', () => {
    const item = { ...base, authorId: 'author', version: 1, temporal: { kind: 'allDay' as const, startDate: '2026-07-01', endDateExclusive: '2026-07-03' } };
    expect(agendaDates(item, 'America/New_York', '2026-07-01', '2026-07-04')).toEqual(['2026-07-01', '2026-07-02']);
  });
});
