// Importance: 100. A delayed restore must not reopen protected content after sign-out.
import { render, screen, act } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn(), resetSupabaseClient: jest.fn() }));
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn(), onPrivateStorageFailure: jest.fn(() => jest.fn()), resetPrivateStorage: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ resetPrivateQueries: jest.fn(), connectQueryLifecycle: jest.fn(() => jest.fn()) }));
jest.mock('./queries', () => ({ restoreSession: jest.fn() }));
import { getSupabase } from '../../lib/supabase';
import { getPrivateStorage } from '../../lib/private-storage';
import { restoreSession } from './queries';
import { AuthProvider, useAuth } from './session';
import { notifySessionReset } from './session-events';
import type { SessionContext } from '@deseo/domain/auth';
import { registerDraftFlush } from '../../lib/draft';
import { resetPrivateQueries } from '../../lib/query-client';

function Status() {
  const { state } = useAuth();
  return <Text>{state.status === 'authenticated' ? state.userId : state.status}</Text>;
}
beforeEach(() => {
  jest.clearAllMocks();
  (getSupabase as jest.Mock).mockResolvedValue({ auth: {
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(),
  } });
  (getPrivateStorage as jest.Mock).mockResolvedValue({ getIntent: jest.fn().mockResolvedValue(null), setIntent: jest.fn(), purgeAccountDrafts: jest.fn() });
});
test('a delayed restored account cannot replace signed-out state', async () => {
  let finish!: (context: SessionContext) => void;
  (restoreSession as jest.Mock).mockImplementation(() => new Promise<SessionContext>((resolve) => { finish = resolve; }));
  await render(<AuthProvider><Status /></AuthProvider>);
  await screen.findByText('loading');
  await act(async () => { notifySessionReset(); });
  await screen.findByText('signedOut');
  await act(async () => { finish({ userId: 'old-account', account: null }); });
  expect(screen.getByText('signedOut')).toBeTruthy();
});
test('network failure hides the restored account', async () => {
  (restoreSession as jest.Mock).mockRejectedValue(new Error('offline'));
  await render(<AuthProvider><Status /></AuthProvider>);
  await screen.findByText('error');
});

// Importance: 98. A background transition must save the last keystroke before invalidating its draft scope.
test('backgrounding flushes drafts before clearing private query access', async () => {
  const handlers: ((status: AppStateStatus) => void)[] = [];
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    handlers.push(callback); return { remove: jest.fn() };
  });
  (restoreSession as jest.Mock).mockResolvedValue({ userId: 'account-a', account: null });
  await render(<AuthProvider><Status /></AuthProvider>);
  await screen.findByText('account-a');
  let finish!: () => void;
  let saved = false;
  const remove = registerDraftFlush(() => new Promise<void>(resolve => { finish = () => { saved = true; resolve(); }; }));
  (resetPrivateQueries as jest.Mock).mockClear();
  await act(async () => { handlers.forEach(callback => callback('background')); });
  expect(resetPrivateQueries).not.toHaveBeenCalled();
  expect(screen.getByText('loading')).toBeTruthy();
  await act(async () => { finish(); });
  expect(saved).toBe(true);
  expect(resetPrivateQueries).toHaveBeenCalledTimes(1);
  remove(); listener.mockRestore();
});
