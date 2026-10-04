import { QueryClient } from '@tanstack/react-query';
import { createEvent } from '../calendar';
import { todayKeys } from './keys';
import { queryClient } from '../../lib/query-client';
import { getSupabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../calendar/screens/CalendarScreen', () => ({}));
jest.mock('../calendar/screens/EventDetailScreen', () => ({}));
jest.mock('../calendar/screens/EventFormScreen', () => ({}));
jest.mock('../calendar/revocation', () => ({}));
jest.mock('../../lib/query-client', () => ({
  queryClient: new (jest.requireActual('@tanstack/react-query').QueryClient)({ defaultOptions: { queries: { gcTime: Infinity } } }),
  captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent() {} }),
}));

// Importance: 98. Today must refresh after a local save when Realtime is unavailable.
test('a confirmed event save invalidates the actual Today cache key', async () => {
  const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
  const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
  const key = todayKeys.day('account-a', pairId, '2026-10-04');
  const client: QueryClient = queryClient;
  client.setQueryData(key, { agenda: [] });
  (getSupabase as jest.Mock).mockResolvedValue({ rpc: () => ({ abortSignal: async () => ({ error: null, data: { ok: true, data: {
    id, pair_id: pairId, created_by: '741dd351-3376-4622-a9bd-ab9ced5fac8d', title: 'Dinner', owner: 'together', visibility: 'shared',
    timezone: 'Europe/Warsaw', starts_at: null, ends_at: null, start_date: '2026-10-04', end_date_exclusive: '2026-10-05',
    location: null, description: null, version: 1, repeat: 'none',
  } } }) }) });
  await createEvent({ id, pairId, title: 'Dinner', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw',
    temporal: { kind: 'allDay', startDate: '2026-10-04', endDateExclusive: '2026-10-05' } }, 'c8cf3be1-51dc-492e-85c6-4cfb634b4590');
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  client.clear();
});
