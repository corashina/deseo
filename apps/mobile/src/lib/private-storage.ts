import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createMMKV, deleteMMKV, existsMMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';
import { AppError } from './result';

const STORE_IDS = ['deseo.session', 'deseo.drafts', 'deseo.intent'] as const;
const KEY_NAME = 'deseo.private-key';
const MARKER = '__vault';
const MARKER_VALUE = 'deseo.encrypted.v1';
interface Vault {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): unknown;
  getAllKeys(): string[];
  clearAll(): void;
}
export interface StorageDependencies {
  getKey(): Promise<string | null>;
  setKey(value: string): Promise<void>;
  deleteKey(): Promise<void>;
  randomKey(): Promise<string>;
  digest(value: string): Promise<string>;
  exists(id: string): boolean;
  open(id: string, key: string): Vault;
  deleteStore(id: string): void;
}
export class PrivateStorageError extends AppError {
  constructor() {
    super({ code: 'RETRYABLE', message: 'We could not open private storage. Reset local storage and sign in again. Local drafts will be removed.' });
    this.name = 'PrivateStorageError';
  }
}
const listeners = new Set<(error: PrivateStorageError) => void>();
export function onPrivateStorageFailure(listener: (error: PrivateStorageError) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function announceFailure() {
  const error = new PrivateStorageError();
  listeners.forEach((listener) => listener(error));
  return error;
}
const nativeDependencies: StorageDependencies = {
  getKey: () => SecureStore.getItemAsync(KEY_NAME),
  setKey: (value) => SecureStore.setItemAsync(KEY_NAME, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  deleteKey: () => SecureStore.deleteItemAsync(KEY_NAME),
  randomKey: async () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const bytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(bytes, (byte) => alphabet[byte & 63]).join('');
  },
  digest: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
  exists: existsMMKV,
  open: (id, key) => createMMKV({ id, encryptionKey: key, encryptionType: 'AES-256', recoveryStrategy: 'discard-on-error' }),
  deleteStore: (id) => { deleteMMKV(id); },
};
export interface PrivateStorage {
  session: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  clearSession(): Promise<void>;
  getDraft(accountId: string, pairId: string | null, key: string): Promise<string | null>;
  setDraft(accountId: string, pairId: string | null, key: string, value: string): Promise<void>;
  removeDraft(accountId: string, pairId: string | null, key: string): Promise<void>;
  purgeAccountDrafts(accountId: string): Promise<void>;
  purgePairDrafts(accountId: string, pairId: string): Promise<void>;
  getIntent(key: string): Promise<string | null>;
  setIntent(key: string, value: string): Promise<void>;
  removeIntent(key: string): Promise<void>;
}
export async function createPrivateStorage(deps: StorageDependencies): Promise<PrivateStorage> {
  try {
    let key = await deps.getKey();
    if (!key) {
      if (STORE_IDS.some((id) => deps.exists(id))) throw new PrivateStorageError();
      key = await deps.randomKey();
      await deps.setKey(key);
    }
    if (key.length !== 32) throw new PrivateStorageError();
    const vaults = STORE_IDS.map((id) => {
      const existed = deps.exists(id);
      const vault = deps.open(id, key);
      if (existed && vault.getString(MARKER) !== MARKER_VALUE) throw new PrivateStorageError();
      if (!existed) vault.set(MARKER, MARKER_VALUE);
      return vault;
    });
    const [session, drafts, intent] = vaults as [Vault, Vault, Vault];
    let failed = false;
    let queue = Promise.resolve();
    function operation<T>(run: () => T | Promise<T>): Promise<T> {
      const pending = queue.then(async () => {
        if (failed) throw new PrivateStorageError();
        try { return await run(); }
        catch { failed = true; throw announceFailure(); }
      });
      queue = pending.then(() => undefined, () => undefined);
      return pending;
    }
    function read(vault: Vault, name: string) {
      return operation(async () => {
        const raw = vault.getString(name);
        if (raw === undefined) return null;
        const data: unknown = JSON.parse(raw);
        if (!data || typeof data !== 'object' || !('value' in data) || !('digest' in data)
          || typeof data.value !== 'string' || typeof data.digest !== 'string'
          || await deps.digest(data.value) !== data.digest) throw new PrivateStorageError();
        return data.value;
      });
    }
    function write(vault: Vault, name: string, value: string) {
      return operation(async () => {
        const raw = JSON.stringify({ value, digest: await deps.digest(value) });
        vault.set(name, raw);
        if (vault.getString(name) !== raw) throw new PrivateStorageError();
      });
    }
    function remove(vault: Vault, name: string) {
      return operation(() => { vault.remove(name); if (vault.getString(name) !== undefined) throw new PrivateStorageError(); });
    }
    const accountPrefix = (accountId: string) => `draft:${encodeURIComponent(accountId)}:`;
    const pairPrefix = (accountId: string, pairId: string | null) => `${accountPrefix(accountId)}${pairId === null ? '-' : encodeURIComponent(pairId)}:`;
    const draftKey = (accountId: string, pairId: string | null, name: string) => `${pairPrefix(accountId, pairId)}${encodeURIComponent(name)}`;
    const purge = (vault: Vault, prefix: string) => operation(() => {
      for (const name of vault.getAllKeys()) if (name !== MARKER && name.startsWith(prefix)) vault.remove(name);
      if (vault.getAllKeys().some((name) => name !== MARKER && name.startsWith(prefix))) throw new PrivateStorageError();
    });
    return {
      session: { getItem: (name) => read(session, name), setItem: (name, value) => write(session, name, value), removeItem: (name) => remove(session, name) },
      clearSession: () => purge(session, ''),
      getDraft: (accountId, pairId, name) => read(drafts, draftKey(accountId, pairId, name)),
      setDraft: (accountId, pairId, name, value) => write(drafts, draftKey(accountId, pairId, name), value),
      removeDraft: (accountId, pairId, name) => remove(drafts, draftKey(accountId, pairId, name)),
      purgeAccountDrafts: (accountId) => purge(drafts, accountPrefix(accountId)),
      purgePairDrafts: (accountId, pairId) => purge(drafts, pairPrefix(accountId, pairId)),
      getIntent: (name) => read(intent, name),
      setIntent: (name, value) => write(intent, name, value),
      removeIntent: (name) => remove(intent, name),
    };
  } catch { throw announceFailure(); }
}
let privateStorage: Promise<PrivateStorage> | undefined;
export function getPrivateStorage(): Promise<PrivateStorage> {
  if (Platform.OS === 'web') return Promise.reject(new PrivateStorageError());
  privateStorage ??= createPrivateStorage(nativeDependencies);
  return privateStorage;
}
export async function resetPrivateStorage(): Promise<void> {
  privateStorage = undefined;
  try {
    for (const id of STORE_IDS) nativeDependencies.deleteStore(id);
    await nativeDependencies.deleteKey();
    await getPrivateStorage();
  } catch { throw announceFailure(); }
}
