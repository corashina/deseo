// Importance: 95. Mounted stack screens share one private subscription without breaking cleanup.
import { connectCalendarSignals } from './realtime';
import { getSupabase } from '../../lib/supabase';
import { queryClient } from '../../lib/query-client';
import { AppState } from 'react-native';
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent: jest.fn() }), queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) } }));
const on = jest.fn(); const subscribe = jest.fn(); const removeChannel = jest.fn().mockResolvedValue(undefined);
const channel = { on, subscribe }; const client = { realtime: { setAuth: jest.fn().mockResolvedValue(undefined) }, channel: jest.fn(() => channel), removeChannel };
beforeEach(() => { jest.clearAllMocks(); AppState.currentState = 'active'; jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); on.mockReturnValue(channel); subscribe.mockReturnValue(channel); jest.mocked(getSupabase).mockResolvedValue(client as never); });
it('keeps one subscription until the last screen leaves', async () => {
  const first = connectCalendarSignals('account', 'pair', jest.fn());
  const second = connectCalendarSignals('account', 'pair', jest.fn());
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(client.channel).toHaveBeenCalledTimes(1);
  expect(client.channel).toHaveBeenCalledWith('calendar:pair', { config: { private: true } });
  first(); expect(removeChannel).not.toHaveBeenCalled();
  on.mock.calls[0][2]();
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendar', 'account', 'pair'] });
  second(); expect(removeChannel).toHaveBeenCalledTimes(1);
});
