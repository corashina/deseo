// Importance: 100. Retries cannot overwrite bytes, duplicate publication, or accept stale access.
import { getSupabase } from '../../lib/supabase';
import { finalizeMemory, reserveMemory, uploadMemoryPhoto } from './commands';
import { getMemoryMedia, listMemories } from './queries';
import { draft, id, memory, photo, photoId, pairId } from './test-fixtures';

let mockScope = new AbortController();
const mockBytes = jest.fn();
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({
  captureQueryScope: () => { const scope = mockScope; return { signal: scope.signal, assertCurrent: () => { if (scope.signal.aborted) throw new Error('stale'); } }; },
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('expo-file-system', () => ({ File: class { bytes = mockBytes; } }));
let invoke: jest.Mock; let rpc: jest.Mock; let upload: jest.Mock;
beforeEach(() => {
  mockScope = new AbortController();
  mockBytes.mockReset().mockResolvedValue(new Uint8Array([255, 216, 255]));
  invoke = jest.fn(); upload = jest.fn().mockResolvedValue({ error: null });
  rpc = jest.fn().mockImplementation(() => ({ abortSignal: jest.fn().mockResolvedValue({ data: { ok: true, data: memory }, error: null }) }));
  jest.mocked(getSupabase).mockResolvedValue({ rpc, functions: { invoke }, storage: { from: () => ({ upload }) },
    auth: { getClaims: jest.fn().mockResolvedValue({ data: { claims: { session_id: photoId } }, error: null }) } } as never);
});
it('keeps reservation and command IDs after a lost reply', async () => {
  rpc.mockImplementationOnce(() => ({ abortSignal: jest.fn().mockRejectedValue(new Error('timeout')) }));
  expect((await reserveMemory(draft, draft.reserveCommandId)).ok).toBe(false);
  expect((await reserveMemory(draft, draft.reserveCommandId)).ok).toBe(true);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});
it('inspects existing bytes and validates them without overwriting', async () => {
  mockBytes.mockRejectedValue(new Error('Local file was evicted'));
  invoke.mockResolvedValueOnce({ data: { ok: true, data: { memory, photos: [{ id: photoId, full: true, thumb: true, validated: false }] } }, error: null })
    .mockResolvedValueOnce({ data: { ok: true, data: { ...photo, validated: true } }, error: null });
  expect((await uploadMemoryPhoto(memory, { id: photoId, fullUri: 'full', thumbUri: 'thumb' })).ok).toBe(true);
  expect(upload).not.toHaveBeenCalled();
  expect(mockBytes).not.toHaveBeenCalled();
  expect(invoke.mock.calls[1][1].body).toEqual({ action: 'validate', memoryId: id, photoId });
});
it('resolves an upload conflict through inspection and validation', async () => {
  const inspect = (full: boolean) => ({ data: { ok: true, data: { memory, photos: [{ id: photoId, full, thumb: true, validated: false }] } }, error: null });
  invoke.mockResolvedValueOnce(inspect(false)).mockResolvedValueOnce(inspect(true))
    .mockResolvedValueOnce({ data: { ok: false, error: { code: 'VALIDATION' } }, error: null });
  upload.mockResolvedValue({ error: { status: 409 } });
  expect(await uploadMemoryPhoto(memory, { id: photoId, fullUri: 'full', thumbUri: 'thumb' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(upload).toHaveBeenCalledWith(photo.fullPath, expect.any(ArrayBuffer), { upsert: false, contentType: 'image/jpeg', metadata: { sessionId: photoId } });
});
it('preserves explicit Edge denial from a non-2xx result body', async () => {
  invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ ok: false, error: { code: 'FORBIDDEN' } }) } } });
  expect(await finalizeMemory(id, photoId)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
});
it('keeps transport failure retryable and rejects a late response after revocation', async () => {
  invoke.mockResolvedValueOnce({ error: new Error('network'), data: null });
  expect(await finalizeMemory(id, photoId)).toMatchObject({ ok: false, error: { code: 'RETRYABLE' } });
  invoke.mockImplementationOnce(async () => { mockScope.abort(); return { error: null, data: { ok: true, data: memory } }; });
  expect((await finalizeMemory(id, photoId)).ok).toBe(false);
});
it('does not compare server expiry with a potentially wrong device clock', async () => {
  invoke.mockResolvedValue({ data: { ok: true, data: { url: 'https://example.com/private.jpg', expiresAt: '2020-01-01T00:00:00Z' } }, error: null });
  expect((await getMemoryMedia(photoId)).ok).toBe(true);
});
// Importance: 90. Bound pages and preserve the server cursor exactly.
it('encodes the cursor at the query edge and sends the 50-item limit', async () => {
  const cursor = { memoryDate: '2026-10-04', id };
  rpc.mockImplementation(() => ({ abortSignal: jest.fn().mockResolvedValue({ error: null, data: { ok: true, data: { items: [memory], nextCursor: cursor } } }) }));
  const page = await listMemories(pairId);
  expect(page.nextCursor).toBe(JSON.stringify(cursor));
  await listMemories(pairId, page.nextCursor);
  expect(rpc.mock.calls[1][1]).toEqual({ p_pair_id: pairId, p_cursor: cursor, p_limit: 50 });
});
