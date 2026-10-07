import { getToday } from './queries';
import { getSupabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
const pairId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const otherPair = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const author = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
function respond(data: unknown) {
  (getSupabase as jest.Mock).mockResolvedValue({ rpc: () => ({ abortSignal: async () => ({ error: null, data }) }) });
}
function event(id: string, pair: string, temporal: { starts_at?: string; ends_at?: string }) {
  return { id, pair_id: pair, created_by: author, title: 'Plan', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw',
    starts_at: temporal.starts_at ?? null, ends_at: temporal.ends_at ?? null,
    start_date: temporal.starts_at ? null : '2026-10-04', end_date_exclusive: temporal.starts_at ? null : '2026-10-05',
    location: null, description: null, version: 1, repeat: 'none' };
}
const empty = { agenda: [], important_dates: [], due_tasks: [], notes: [] };

// Importance: 100. A stale Today request must not expose a former pair's content.
test('Today rejects a pair which current membership does not authorize', async () => {
  respond({ ok: false, error: { code: 'FORBIDDEN' } });
  await expect(getToday(pairId, '2026-10-04')).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
// Importance: 100. Rows from another pair must never reach Today.
test('Today rejects rows from another pair', async () => {
  respond({ ok: true, data: { ...empty, agenda: [event('dddddddd-dddd-4ddd-dddd-dddddddddddd', otherPair, {})] } });
  await expect(getToday(pairId, '2026-10-04')).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
// Importance: 95. Ended morning plans must not hide the next event.
test('Today removes timed events that have ended', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00Z'));
  respond({ ok: true, data: { ...empty, agenda: [
    event('11111111-1111-4111-8111-111111111111', pairId, { starts_at: '2026-10-04T06:00:00Z', ends_at: '2026-10-04T07:00:00Z' }),
    event('22222222-2222-4222-8222-222222222222', pairId, { starts_at: '2026-10-04T18:00:00Z', ends_at: '2026-10-04T19:00:00Z' }),
  ] } });
  try { expect((await getToday(pairId, '2026-10-04')).agenda.map(item => item.id)).toEqual(['22222222-2222-4222-8222-222222222222']); }
  finally { jest.useRealTimers(); }
});
