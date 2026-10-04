// Importance: 98. Purges must remove private files without recreating revoked drafts or deleting originals.
import { getPrivateStorage } from '../../lib/private-storage';
import { discardMemoryDraft, isOwnedCacheUri, photoFile, readMemoryDraft, reconcileMemoryFiles, registerMemoryFiles, writeMemoryDraft } from './drafts';
import { draft, accountId, pairId } from './test-fixtures';

const mockFiles = new Set<string>();
const mockFailed = new Set<string>();
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('expo-file-system', () => {
  const uri = (...parts: (string | { uri: string })[]) => parts.map(part => typeof part === 'string' ? part : part.uri).join('/');
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = uri(...parts); }
    get exists() { return mockFiles.has(this.uri); }
    delete() { if (mockFailed.has(this.uri)) throw new Error('busy'); mockFiles.delete(this.uri); }
  }
  class Directory { uri: string; constructor(...parts: (string | { uri: string })[]) { this.uri = uri(...parts); } exists = false; }
  return { File, Directory, Paths: { cache: 'file:///cache' } };
});
let drafts: Map<string, string>; let intents: Map<string, string>;
beforeEach(() => {
  mockFiles.clear(); mockFailed.clear(); drafts = new Map(); intents = new Map();
  jest.mocked(getPrivateStorage).mockResolvedValue({
    getDraft: async (_a: string, _p: string, key: string) => drafts.get(key) ?? null,
    setDraft: async (_a: string, _p: string, key: string, value: string) => { drafts.set(key, value); },
    removeDraft: async (_a: string, _p: string, key: string) => { drafts.delete(key); },
    getIntent: async (key: string) => intents.get(key) ?? null,
    setIntent: async (key: string, value: string) => { intents.set(key, value); },
  } as never);
});
async function saved() {
  await writeMemoryDraft(draft, () => undefined);
  const paths = ['full', 'thumb'].map(variant => photoFile(draft.draftId, draft.photos[0]!.id, variant as 'full' | 'thumb').uri);
  await registerMemoryFiles(draft, paths, () => undefined);
  paths.forEach(path => mockFiles.add(path));
  return paths;
}
it('preserves a caption and retry IDs when the OS evicts photo files', async () => {
  const paths = await saved(); mockFiles.delete(paths[0]!);
  expect(await readMemoryDraft(accountId, pairId, draft.key)).toMatchObject({ caption: draft.caption, publishCommandId: draft.publishCommandId, photos: [{ status: 'missing' }] });
});
it('uses surviving intent ownership after the core purges draft values', async () => {
  await saved(); drafts.clear();
  await reconcileMemoryFiles({ accountId, pairId }, () => undefined);
  expect(mockFiles.size).toBe(0);
  expect(JSON.parse(intents.get('memories:files')!)).toEqual([]);
});
it('retains failed cleanup ownership and retries after restart', async () => {
  const paths = await saved(); mockFailed.add(paths[0]!);
  await expect(discardMemoryDraft(draft)).rejects.toMatchObject({ code: 'RETRYABLE' });
  expect(drafts.size).toBe(0);
  expect(JSON.parse(intents.get('memories:files')!)[0].paths).toEqual([paths[0]]);
  mockFailed.clear(); await reconcileMemoryFiles(null, () => undefined);
  expect(mockFiles.size).toBe(0);
});
it('rejects a queued draft write after access changes', async () => {
  let current = true;
  const pending = writeMemoryDraft(draft, () => { if (!current) throw new Error('revoked'); });
  current = false;
  await expect(pending).rejects.toThrow('revoked');
  expect(drafts.size).toBe(0);
});
it('refuses source libraries and path traversal', () => {
  expect(isOwnedCacheUri('ph://photo')).toBe(false);
  expect(isOwnedCacheUri('content://library/photo')).toBe(false);
  expect(isOwnedCacheUri('file:///cache/deseo-memories/../../original.jpg')).toBe(false);
  expect(isOwnedCacheUri('file:///cache/other.jpg')).toBe(false);
});
