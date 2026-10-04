// Importance: 100. Shared subscriptions must stop callbacks after account access ends.
import { subscribeMessages } from './realtime';
import { getSupabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
let mockAbort = new AbortController();
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({
  signal: mockAbort.signal, assertCurrent() { if (mockAbort.signal.aborted) throw new Error('Revoked'); },
}) }));
const on = jest.fn(); const subscribe = jest.fn(); const removeChannel = jest.fn().mockResolvedValue(undefined);
const channel = { on, subscribe };
const client = { channel: jest.fn(() => channel), removeChannel };
beforeEach(() => {
  jest.clearAllMocks(); mockAbort = new AbortController(); on.mockReturnValue(channel); subscribe.mockReturnValue(channel);
  jest.mocked(getSupabase).mockResolvedValue(client as never);
});
it('shares one channel between the tab badge and open conversation', async () => {
  const badge = jest.fn(); const conversation = jest.fn();
  const [stopBadge, stopConversation] = await Promise.all([
    subscribeMessages('account', 'pair', badge), subscribeMessages('account', 'pair', conversation),
  ]);
  expect(client.channel).toHaveBeenCalledTimes(1);
  on.mock.calls[0][2]();
  expect(badge).toHaveBeenCalledTimes(1); expect(conversation).toHaveBeenCalledTimes(1);
  stopBadge(); expect(removeChannel).not.toHaveBeenCalled();
  stopConversation(); expect(removeChannel).toHaveBeenCalledTimes(1);
});
it('removes the channel and ignores queued signals after revocation', async () => {
  const refresh = jest.fn();
  const stop = await subscribeMessages('account', 'pair', refresh);
  mockAbort.abort();
  on.mock.calls[0][2](); subscribe.mock.calls[0][0]('SUBSCRIBED');
  expect(refresh).not.toHaveBeenCalled(); expect(removeChannel).toHaveBeenCalledTimes(1);
  stop(); expect(removeChannel).toHaveBeenCalledTimes(1);
});
