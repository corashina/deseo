// Importance: 100. Closed feature tabs must refresh private caches and stop after pair access ends.
import { act, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { FeatureLifecycle } from './FeatureLifecycle';
import { queryClient } from '../lib/query-client';
import { connectTaskSignals } from '../features/tasks';
import { connectCalendarSignals } from '../features/calendar';
import { ensureMemoryLifecycle } from '../features/memories';
import { subscribeMessages } from '../features/messages';

const mockRefresh = jest.fn(); const mockStop = jest.fn();
let mockPaired = true;
jest.mock('../features/pair', () => ({ usePairGate: () => ({ account: { id: 'account' },
  pair: mockPaired ? { status: 'active', pairId: 'pair' } : { status: 'ended' }, refresh: mockRefresh }) }));
jest.mock('../features/tasks', () => ({ connectTaskSignals: jest.fn(() => mockStop) }));
jest.mock('../features/calendar', () => ({ connectCalendarSignals: jest.fn(() => mockStop) }));
jest.mock('../features/memories', () => ({ ensureMemoryLifecycle: jest.fn() }));
jest.mock('../features/messages', () => ({ subscribeMessages: jest.fn().mockImplementation(async () => mockStop),
  messageKeys: { all: (...parts: string[]) => ['messages', ...parts] } }));
jest.mock('../lib/query-client', () => ({
  queryClient: new (jest.requireActual('@tanstack/react-query').QueryClient)({ defaultOptions: { queries: { gcTime: Infinity } } }),
  captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent() {} }),
}));
beforeEach(() => { jest.clearAllMocks(); mockPaired = true; AppState.currentState = 'active'; queryClient.clear(); });
afterEach(() => { queryClient.clear(); });
it('refreshes unread and notes before Messages opens, then ignores queued signals after disconnect', async () => {
  const view = await render(<FeatureLifecycle />);
  await waitFor(() => expect(subscribeMessages).toHaveBeenCalledTimes(1));
  expect(ensureMemoryLifecycle).toHaveBeenCalledTimes(1);
  expect(connectTaskSignals).toHaveBeenCalledWith('account', 'pair', mockRefresh);
  expect(connectCalendarSignals).toHaveBeenCalledWith('account', 'pair', mockRefresh);
  const keys = [
    ['messages', 'account', 'pair', 'unread'], ['messages', 'account', 'pair', 'notes'], ['today', 'account', 'pair', 'day'],
  ];
  for (const key of keys) queryClient.setQueryData(key, 'confirmed');
  const signal = jest.mocked(subscribeMessages).mock.calls[0]![2];
  await act(() => signal());
  for (const key of keys) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  mockPaired = false;
  await view.rerender(<FeatureLifecycle />);
  expect(mockStop).toHaveBeenCalledTimes(3);
  for (const key of keys) queryClient.setQueryData(key, 'confirmed');
  await act(() => signal());
  for (const key of keys) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
});
