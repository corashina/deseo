// Importance: 100. A picker can outlive its screen; access loss must stop writes and publication.
import { AppState } from 'react-native';
import { restoreSession } from '../auth';
import { getPairContext } from '../pair';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { reserveMemory, deleteMemory, finalizeMemory, uploadMemoryPhoto } from './commands';
import { readMemoryDraft, reconcileMemoryFiles, writeMemoryDraft } from './drafts';
import { prepareMemoryDraft } from './prepare';
import { draft, memory, accountId, pairId } from './test-fixtures';
import * as lifecycle from './lifecycle';
import type { MemoryDraft } from './types';

let mockController = new AbortController();
let mockAppState: (state: string) => void;
let mockCounter = 0;
jest.mock('../auth', () => ({ restoreSession: jest.fn() }));
jest.mock('../pair', () => ({ getPairContext: jest.fn() }));
jest.mock('expo-image', () => ({ Image: { clearMemoryCache: jest.fn().mockResolvedValue(true) } }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockCounter).padStart(12, '0')}` }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => {
  const controller = mockController;
  return { signal: controller.signal, assertCurrent: () => { if (controller.signal.aborted) throw new Error('stale'); } };
}, queryClient: { getQueryCache: () => ({ subscribe: jest.fn() }) } }));
jest.mock('../../lib/supabase', () => {
  const client = { auth: { onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }) } };
  return { getSupabase: async () => client };
});
jest.mock('../../lib/private-storage', () => ({ onPrivateStorageFailure: jest.fn() }));
jest.mock('../../lib/draft', () => ({ registerDraftFlush: jest.fn() }));
jest.mock('./queries', () => ({ subscribeMemorySignals: jest.fn().mockResolvedValue(jest.fn()) }));
jest.mock('./commands', () => ({ reserveMemory: jest.fn(), deleteMemory: jest.fn(), finalizeMemory: jest.fn(), uploadMemoryPhoto: jest.fn(), updateMemory: jest.fn() }));
jest.mock('./prepare', () => ({ prepareMemoryDraft: jest.fn() }));
jest.mock('./drafts', () => ({
  clearMemoryRoot: jest.fn(), discardMemoryDraft: jest.fn().mockResolvedValue(undefined), flushMemoryFiles: jest.fn().mockResolvedValue(undefined),
  isOwnedCacheUri: () => false, photoFile: (_draft: string, photo: string, variant: string) => ({ uri: `file:///cache/${photo}.${variant}`, exists: true, copy: jest.fn().mockResolvedValue(undefined) }),
  readMemoryDraft: jest.fn(), reconcileMemoryFiles: jest.fn().mockResolvedValue(undefined), registerMemoryFiles: jest.fn().mockResolvedValue(undefined),
  removeMemoryFiles: jest.fn().mockResolvedValue(undefined), writeMemoryDraft: jest.fn(),
}));
let saved: MemoryDraft;
beforeAll(async () => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, listener) => { mockAppState = listener as (state: string) => void; return { remove: jest.fn() }; });
  lifecycle.ensureMemoryLifecycle();
});
beforeEach(async () => {
  jest.clearAllMocks(); saved = structuredClone(draft);
  jest.mocked(restoreSession).mockResolvedValue({ account: { id: accountId } } as never);
  jest.mocked(getPairContext).mockResolvedValue({ status: 'active', pairId } as never);
  jest.mocked(readMemoryDraft).mockImplementation(async () => structuredClone(saved));
  jest.mocked(writeMemoryDraft).mockImplementation(async value => { saved = structuredClone(value); });
  jest.mocked(reserveMemory).mockResolvedValue({ ok: true, data: memory });
  jest.mocked(deleteMemory).mockResolvedValue({ ok: true, data: { id: memory.id } });
  mockController.abort(); mockController = new AbortController();
  mockAppState('active');
  await lifecycle.reconcileMemoryAccess();
  await lifecycle.openMemoryDraft('UTC');
});
it('keeps drafts on transient verification failures and purges only confirmed loss', async () => {
  jest.mocked(restoreSession).mockRejectedValueOnce(new Error('offline'));
  await lifecycle.reconcileMemoryAccess();
  expect(lifecycle.getMemoryLifecycle().status).toBe('blocked');
  expect(reconcileMemoryFiles).not.toHaveBeenCalledWith(null, expect.anything());
  jest.mocked(restoreSession).mockResolvedValueOnce(null);
  await lifecycle.reconcileMemoryAccess();
  expect(reconcileMemoryFiles).toHaveBeenCalledWith(null, expect.anything(), true);
});
it('keeps picker results through background, screen loss, and access verification', async () => {
  let finish: (value: unknown) => void = () => undefined;
  jest.mocked(launchImageLibraryAsync).mockImplementationOnce(() => new Promise(resolve => { finish = resolve as typeof finish; }));
  jest.mocked(prepareMemoryDraft).mockImplementationOnce(async input => ({ ...input.draft, caption: 'Picker recovered' }));
  const pending = lifecycle.pickMemoryPhotos();
  await Promise.resolve(); await Promise.resolve();
  mockAppState('background');
  await Promise.resolve(); await Promise.resolve();
  mockController.abort(); mockController = new AbortController();
  finish({ canceled: false, assets: [{ uri: 'ph://original', width: 100, height: 100 }] });
  mockAppState('active');
  await lifecycle.reconcileMemoryAccess();
  await pending;
  expect(prepareMemoryDraft).toHaveBeenCalledTimes(1);
  expect(lifecycle.getMemoryLifecycle().drafts['memories:new']?.caption).toBe('Picker recovered');
});
it('cancels a cleaned reservation before assigning new photo and command IDs', async () => {
  saved = { ...draft, reserved: true, submitted: true };
  mockController.abort(); mockController = new AbortController();
  await lifecycle.reconcileMemoryAccess(); await lifecycle.openMemoryDraft('UTC');
  jest.mocked(reserveMemory).mockResolvedValueOnce({ ok: false, error: { code: 'FORBIDDEN' } });
  await lifecycle.restartMemoryDraft();
  expect(deleteMemory).toHaveBeenCalledWith(draft.id, 1, draft.commandId);
  expect(saved.caption).toBe(draft.caption);
  expect(saved.id).not.toBe(draft.id);
  expect(saved.photos[0]!.id).not.toBe(draft.photos[0]!.id);
  expect(saved.publishCommandId).not.toBe(draft.publishCommandId);
});
it('replays an uncertain reservation before canceling it', async () => {
  saved = { ...draft, submitted: true, reserved: false };
  mockController.abort(); mockController = new AbortController();
  await lifecycle.reconcileMemoryAccess(); await lifecycle.openMemoryDraft('UTC');
  await lifecycle.restartMemoryDraft();
  expect(reserveMemory).toHaveBeenCalledWith(expect.objectContaining({ id: draft.id }), draft.reserveCommandId);
  expect(deleteMemory).toHaveBeenCalledTimes(1);
});
it('recognizes a published retry without reuploading or publishing again', async () => {
  jest.mocked(reserveMemory).mockResolvedValueOnce({ ok: true, data: { ...memory, state: 'published' } });
  await lifecycle.submitMemoryDraft('memories:new');
  expect(lifecycle.getMemoryLifecycle().completedId).toBe(memory.id);
  expect(uploadMemoryPhoto).not.toHaveBeenCalled();
  expect(finalizeMemory).not.toHaveBeenCalled();
});
// Importance: 100. Cache eviction must not block recovery of remote files or publication.
async function restoreMissingPhotoDraft() {
  saved = { ...draft, submitted: true, reserved: true, photos: draft.photos.map(photo => ({ ...photo, status: 'missing' })) };
  mockController.abort(); mockController = new AbortController();
  await lifecycle.reconcileMemoryAccess(); await lifecycle.openMemoryDraft('UTC');
}
it('retries remote validation and publication after local cache eviction', async () => {
  await restoreMissingPhotoDraft();
  jest.mocked(uploadMemoryPhoto).mockResolvedValueOnce({ ok: true, data: { ...memory.photos[0]!, validated: true } });
  jest.mocked(finalizeMemory).mockResolvedValueOnce({ ok: true, data: { ...memory, state: 'published' } });
  await lifecycle.submitMemoryDraft('memories:new');
  expect(reserveMemory).toHaveBeenCalledWith(expect.objectContaining({ id: draft.id }), draft.reserveCommandId);
  expect(uploadMemoryPhoto).toHaveBeenCalledTimes(1);
  expect(finalizeMemory).toHaveBeenCalledWith(draft.id, draft.publishCommandId);
  expect(lifecycle.getMemoryLifecycle().completedId).toBe(memory.id);
});
it('recovers a lost publication reply after local cache eviction', async () => {
  await restoreMissingPhotoDraft();
  jest.mocked(reserveMemory).mockResolvedValueOnce({ ok: true, data: { ...memory, state: 'published' } });
  await lifecycle.submitMemoryDraft('memories:new');
  expect(lifecycle.getMemoryLifecycle().completedId).toBe(memory.id);
  expect(uploadMemoryPhoto).not.toHaveBeenCalled();
  expect(finalizeMemory).not.toHaveBeenCalled();
});
