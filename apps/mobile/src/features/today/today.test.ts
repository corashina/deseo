import { AppError } from '@deseo/domain/result';
import { getToday } from './queries';
import { getSupabase } from '../../lib/supabase';
import { resetPrivateQueries } from '../../lib/query-client';

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

// Importance: 100. Each summary array must retain the requested Pair authority.
test.each(['agenda', 'important_dates', 'due_tasks', 'notes'])('Today rejects a foreign row in %s', async field => {
  const row = field === 'due_tasks'
    ? { id: author, pair_id: otherPair, list_id: author, title: 'Task', assignee_id: null, due_date: '2026-10-04',
      created_by: author, completed_at: null, completed_by: null, version: 1 }
    : field === 'notes'
      ? { id: author, pair_id: otherPair, author_id: author, client_id: author, body: 'Private note',
        created_at: '2026-10-04T10:00:00Z', pinned_at: '2026-10-04T11:00:00Z', version: 1 }
      : event(author, otherPair, { starts_at: '2026-10-04T06:00:00Z', ends_at: '2026-10-04T07:00:00Z' });
  respond({ ok: true, data: { ...empty, [field]: [row] } });
  await expect(getToday(pairId, '2026-10-04')).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

// Importance: 100. A delayed result must fail after the account or Pair changes.
test('Today aborts its request and rejects a delayed result after scope reset', async () => {
  let release!: (value: unknown) => void;
  let signal!: AbortSignal;
  let received!: () => void;
  const arrived = new Promise<void>(resolve => { received = resolve; });
  const response = new Promise(resolve => { release = resolve; });
  (getSupabase as jest.Mock).mockResolvedValue({ rpc: () => ({ abortSignal: (value: AbortSignal) => {
    signal = value; received(); return response;
  } }) });
  const pending = getToday(pairId, '2026-10-04');
  const rejected = expect(pending).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  await arrived;
  await resetPrivateQueries();
  expect(signal.aborted).toBe(true);
  release({ error: null, data: { ok: true, data: empty } });
  await rejected;
});

// Importance: 100. Invalid input and malformed results must not become empty content.
test('Today rejects invalid Pair IDs, invalid calendar dates, and malformed summaries', async () => {
  jest.mocked(getSupabase).mockClear();
  await expect(getToday('invalid', '2026-10-04')).rejects.toThrow();
  for (const date of ['2026-02-30', '2026-2-03', '2026-10-04T12:00:00Z']) {
    await expect(getToday(pairId, date)).rejects.toMatchObject({ code: 'VALIDATION', field: 'date' });
  }
  expect(getSupabase).not.toHaveBeenCalled();
  respond({ ok: true, data: { ...empty, notes: null } });
  const malformed = getToday(pairId, '2026-10-04');
  await expect(malformed).rejects.toBeInstanceOf(AppError);
  await expect(malformed).rejects.toMatchObject({ code: 'RETRYABLE' });
});

// Importance: 98. Today retains all upcoming plans and removes plans ending at the current instant.
test('Today keeps the full agenda after removing ended plans', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00Z'));
  const upcoming = Array.from({ length: 5 }, (_, index) => event(`00000000-0000-4000-8000-00000000000${index}`, pairId, {}));
  respond({ ok: true, data: { ...empty, agenda: [event(author, pairId, {
    starts_at: '2026-10-04T11:00:00Z', ends_at: '2026-10-04T12:00:00Z',
  }), ...upcoming] } });
  try { expect((await getToday(pairId, '2026-10-04')).agenda.map(item => item.id)).toEqual(upcoming.map(item => item.id)); }
  finally { jest.useRealTimers(); }
});
