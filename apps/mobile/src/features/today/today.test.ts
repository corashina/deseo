import { getToday } from './queries';
import { listAgenda } from '../calendar';
import { getPairContext } from '../pair';

jest.mock('../calendar', () => ({ listAgenda: jest.fn() }));
jest.mock('../pair', () => ({ getPairContext: jest.fn() }));
const pairId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

// Importance: 100. A stale Today request must not expose a former pair's agenda.
test('Today rejects a pair which current membership does not authorize', async () => {
  (getPairContext as jest.Mock).mockResolvedValue({ status: 'ended', pairId });
  await expect(getToday(pairId, '2026-10-04')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(listAgenda).not.toHaveBeenCalled();
});
// Importance: 95. Today must use confirmed calendar rows and cap its agenda.
test('Today shows at most three upcoming events', async () => {
  (getPairContext as jest.Mock).mockResolvedValue({ status: 'active', pairId, members: [], timezone: 'Europe/Warsaw' });
  (listAgenda as jest.Mock).mockResolvedValue([1, 2, 3, 4].map(id => ({ id, temporal: { kind: 'allDay', startDate: '2026-10-04', endDateExclusive: '2026-10-05' } })));
  expect((await getToday(pairId, '2026-10-04')).agenda.map(event => event.id)).toEqual([1, 2, 3]);
});

// Importance: 95. Ended morning plans must not hide the next event.
test('Today removes timed events that have ended before limiting the list', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00Z'));
  (getPairContext as jest.Mock).mockResolvedValue({ status: 'active', pairId, members: [], timezone: 'Europe/Warsaw' });
  (listAgenda as jest.Mock).mockResolvedValue([
    ...[1, 2, 3].map(id => ({ id, temporal: { kind: 'timed', startsAt: '2026-10-04T06:00:00Z', endsAt: '2026-10-04T07:00:00Z' } })),
    { id: 4, temporal: { kind: 'timed', startsAt: '2026-10-04T18:00:00Z', endsAt: '2026-10-04T19:00:00Z' } },
  ]);
  try { expect((await getToday(pairId, '2026-10-04')).agenda.map(event => event.id)).toEqual([4]); }
  finally { jest.useRealTimers(); }
});
