// Importance: 100. Key loss and corruption must block private account access.
// Importance: 98. Large sessions and scoped draft removal protect saved work.
jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-crypto', () => ({}));
jest.mock('react-native-mmkv', () => ({}));
import { createPrivateStorage, PrivateStorageError, type StorageDependencies } from './private-storage';

function fixture() {
  const stores = new Map<string, Map<string, string>>();
  let secret: string | null = null;
  let failWrites = false;
  const deps: StorageDependencies = {
    getKey: async () => secret,
    setKey: async (value) => { secret = value; },
    deleteKey: async () => { secret = null; },
    randomKey: async () => 'a'.repeat(32),
    digest: async (value) => `digest:${value}`,
    exists: (id) => stores.has(id),
    deleteStore: (id) => { stores.delete(id); },
    open: (id, key) => {
      expect(key).toHaveLength(32);
      const values = stores.get(id) ?? new Map<string, string>();
      stores.set(id, values);
      return {
        getString: (name) => values.get(name),
        set: (name, value) => { if (failWrites) throw new Error('disk full'); values.set(name, value); },
        remove: (name) => { values.delete(name); },
        getAllKeys: () => [...values.keys()],
        clearAll: () => { values.clear(); },
      };
    },
  };
  return { deps, stores, loseKey: () => { secret = null; }, failWrites: () => { failWrites = true; } };
}
test('stores a session larger than SecureStore accepts across reopen', async () => {
  const { deps } = fixture();
  const value = 'session'.repeat(4_000);
  await (await createPrivateStorage(deps)).session.setItem('auth-token', value);
  expect(await (await createPrivateStorage(deps)).session.getItem('auth-token')).toBe(value);
});
test('key loss blocks storage without creating a new key over saved data', async () => {
  const f = fixture();
  await createPrivateStorage(f.deps);
  f.loseKey();
  await expect(createPrivateStorage(f.deps)).rejects.toBeInstanceOf(PrivateStorageError);
});
test('corruption blocks reads and later writes', async () => {
  const f = fixture();
  const store = await createPrivateStorage(f.deps);
  await store.session.setItem('auth-token', 'secret');
  f.stores.get('deseo.session')!.set('auth-token', '{broken');
  await expect(store.session.getItem('auth-token')).rejects.toBeInstanceOf(PrivateStorageError);
  await expect(store.session.setItem('other', 'secret')).rejects.toBeInstanceOf(PrivateStorageError);
});
test('failed writes do not report a saved draft', async () => {
  const f = fixture();
  const store = await createPrivateStorage(f.deps);
  f.failWrites();
  await expect(store.setDraft('alice', 'pair-one', 'message', 'draft')).rejects.toBeInstanceOf(PrivateStorageError);
});
test('session expiry preserves drafts and invite; pair purge removes only that pair', async () => {
  const f = fixture();
  const store = await createPrivateStorage(f.deps);
  await store.session.setItem('auth-token', 'session');
  await store.setDraft('alice', 'one', 'message', 'first');
  await store.setDraft('alice', 'two', 'message', 'second');
  await store.setDraft('bob', 'one', 'message', 'other account');
  await store.setIntent('invite', 'token');
  await store.clearSession();
  await store.purgePairDrafts('alice', 'one');
  expect(await store.getDraft('alice', 'one', 'message')).toBeNull();
  expect(await store.getDraft('alice', 'two', 'message')).toBe('second');
  expect(await store.getDraft('bob', 'one', 'message')).toBe('other account');
  expect(await store.getIntent('invite')).toBe('token');
  const reopened = await createPrivateStorage(f.deps);
  expect(await reopened.session.getItem('auth-token')).toBeNull();
  expect(await reopened.getIntent('invite')).toBe('token');
  await store.purgeAccountDrafts('alice');
  expect(await store.getDraft('alice', 'two', 'message')).toBeNull();
  expect(await store.getDraft('bob', 'one', 'message')).toBe('other account');
});
