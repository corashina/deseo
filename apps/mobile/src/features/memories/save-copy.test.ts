// Importance: 98. Access checks must preserve active copies and clean revoked or abandoned files.
import { getPrivateStorage } from '../../lib/private-storage';
import { Asset } from 'expo-media-library';
import { saveMemoryCopy } from './save-copy';
import { reconcileMemoryFiles, registerMemoryFiles } from './drafts';
import { accountId, pairId, photoId } from './test-fixtures';

const mockFiles = new Set<string>();
const mockEvents: string[] = [];
const mockDownload = jest.fn();
let mockDeleteFails = false;
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent: jest.fn() }) }));
jest.mock('./lifecycle', () => ({ getMemoryLifecycle: () => ({ status: 'ready', accountId: '741dd351-3376-4622-a9bd-ab9ced5fac8d', pairId: '610bc9c7-8c81-47d1-894e-314c92071cf1' }), reconcileMemoryAccess: jest.fn().mockResolvedValue(undefined) }));
jest.mock('./queries', () => ({ getMemoryMedia: jest.fn().mockResolvedValue({ ok: true, data: { url: 'https://example.com/photo.jpg', expiresAt: '2026-10-04T12:00:00Z' } }) }));
jest.mock('expo-media-library', () => ({ requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }), Asset: { create: jest.fn() } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'c8cf3be1-51dc-492e-85c6-4cfb634b4590' }));
jest.mock('expo-file-system', () => {
  const uri = (...parts: (string | { uri: string })[]) => parts.map(part => typeof part === 'string' ? part : part.uri).join('/');
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = uri(...parts); }
    get exists() { return mockFiles.has(this.uri); }
    delete() { mockEvents.push('delete'); if (mockDeleteFails) throw new Error('busy'); mockFiles.delete(this.uri); }
    static downloadFileAsync = (...args: unknown[]) => mockDownload(...args);
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = uri(...parts); }
    get exists() { return [...mockFiles].some(path => path.startsWith(`${this.uri}/`)); }
    create() {}
    list() { return [...mockFiles].filter(path => path.startsWith(`${this.uri}/`)).map(path => new File(path)); }
  }
  return { File, Directory, Paths: { cache: 'file:///cache' } };
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let intents: Map<string, string>;
const path = `file:///cache/deseo-memories/${photoId}.jpg`;
const owner = { accountId, pairId };
beforeEach(() => {
  jest.clearAllMocks(); mockFiles.clear(); mockEvents.length = 0; mockDeleteFails = false; intents = new Map();
  jest.mocked(getPrivateStorage).mockResolvedValue({
    getDraft: async () => null, removeDraft: async () => undefined,
    getIntent: async (key: string) => intents.get(key) ?? null,
    setIntent: async (key: string, value: string) => { intents.set(key, value); },
  } as never);
  jest.mocked(Asset.create).mockResolvedValue({} as never);
});
it('keeps a registered file while its download is pending during same-owner reconciliation', async () => {
  const started = deferred<void>(); const download = deferred<unknown>();
  mockDownload.mockImplementationOnce((_url, file) => { mockFiles.add(file.uri); started.resolve(); return download.promise; });
  const saving = saveMemoryCopy(photoId);
  await started.promise;
  await reconcileMemoryFiles(owner, () => undefined);
  const retained = mockFiles.has(path);
  const registered = JSON.parse(intents.get('memories:files')!).some((entry: { paths: string[] }) => entry.paths.includes(path));
  download.resolve({ uri: path });
  await saving;
  expect(retained).toBe(true);
  expect(registered).toBe(true);
  expect(mockFiles.has(path)).toBe(false);
});
it('keeps the source while native library import is pending', async () => {
  const started = deferred<void>(); const imported = deferred<never>();
  mockDownload.mockImplementationOnce(async (_url, file) => { mockFiles.add(file.uri); return file; });
  jest.mocked(Asset.create).mockImplementationOnce(() => { started.resolve(); return imported.promise; });
  const saving = saveMemoryCopy(photoId);
  await started.promise;
  await reconcileMemoryFiles(owner, () => undefined);
  const retained = mockFiles.has(path);
  imported.resolve({} as never);
  await saving;
  expect(retained).toBe(true);
  expect(mockFiles.has(path)).toBe(false);
});
it('aborts a download before confirmed access loss deletes its source', async () => {
  const started = deferred<void>(); const download = deferred<unknown>();
  mockDownload.mockImplementationOnce((_url, file, options: { signal: AbortSignal }) => {
    mockFiles.add(file.uri);
    options.signal.addEventListener('abort', () => { mockEvents.push('abort'); download.reject(new Error('aborted')); });
    started.resolve(); return download.promise;
  });
  const result = saveMemoryCopy(photoId).catch(error => error);
  await started.promise;
  await reconcileMemoryFiles(null, () => undefined);
  expect(await result).toMatchObject({ code: 'FORBIDDEN' });
  expect(mockEvents.slice(0, 2)).toEqual(['abort', 'delete']);
  expect(Asset.create).not.toHaveBeenCalled();
  expect(mockFiles.size).toBe(0);
});
it('waits for an accepted native import before deleting its source after access loss', async () => {
  const started = deferred<void>(); const imported = deferred<never>();
  mockDownload.mockImplementationOnce(async (_url, file) => { mockFiles.add(file.uri); return file; });
  jest.mocked(Asset.create).mockImplementationOnce(() => { started.resolve(); return imported.promise; });
  const result = saveMemoryCopy(photoId).catch(error => error);
  await started.promise;
  let reconciled = false;
  const cleanup = reconcileMemoryFiles(null, () => undefined).then(() => { reconciled = true; });
  await Promise.resolve(); await Promise.resolve();
  expect(reconciled).toBe(false);
  expect(mockFiles.has(path)).toBe(true);
  imported.resolve({} as never);
  await cleanup;
  expect(await result).toMatchObject({ code: 'FORBIDDEN' });
  expect(mockFiles.size).toBe(0);
});
it('removes persisted transient ownership that has no live process operation', async () => {
  await registerMemoryFiles({ ...owner, draftId: photoId, key: `memories:copy:${photoId}` }, [path], () => undefined);
  mockFiles.add(path);
  await reconcileMemoryFiles(owner, () => undefined);
  expect(mockFiles.size).toBe(0);
  expect(JSON.parse(intents.get('memories:files')!)).toEqual([]);
});
it('retains failed deletion for retry after the live operation ends', async () => {
  mockDownload.mockImplementationOnce(async (_url, file) => { mockFiles.add(file.uri); return file; });
  mockDeleteFails = true;
  await expect(saveMemoryCopy(photoId)).rejects.toMatchObject({ code: 'RETRYABLE' });
  expect(JSON.parse(intents.get('memories:files')!)[0].paths).toEqual([path]);
  mockDeleteFails = false;
  await reconcileMemoryFiles(owner, () => undefined);
  expect(mockFiles.size).toBe(0);
  expect(JSON.parse(intents.get('memories:files')!)).toEqual([]);
});
