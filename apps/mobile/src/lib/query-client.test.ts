// Importance: 100. Account and pair changes must block old in-flight requests.
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()) }));
import { captureQueryScope, queryClient, resetPrivateQueries } from './query-client';

afterEach(async () => { await resetPrivateQueries(); });
test('reset aborts the old scope and starts an empty cache', async () => {
  const scope = captureQueryScope();
  queryClient.setQueryData(['account', 'alice', 'pair', 'one'], { private: 'old value' });
  await resetPrivateQueries();
  expect(scope.signal.aborted).toBe(true);
  expect(() => scope.assertCurrent()).toThrow();
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(captureQueryScope().signal.aborted).toBe(false);
});
test('an old query that ignores abort cannot repopulate the new account cache', async () => {
  let finish!: (value: string) => void;
  const pending = queryClient.fetchQuery({ queryKey: ['alice', 'pair'], queryFn: () => new Promise<string>((resolve) => { finish = resolve; }) });
  const settled = pending.catch(() => undefined);
  await resetPrivateQueries();
  finish('late private value');
  await settled;
  expect(queryClient.getQueryData(['alice', 'pair'])).toBeUndefined();
});
