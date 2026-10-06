// Importance 100: server authorization, validation, lost responses, and deletion recovery.
import { strict as assert } from 'node:assert';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import { handleFinalize } from './finalize-memory/handler.ts';
import { handleMedia } from './get-memory-media/handler.ts';
import { handleCleanup, runCleanup } from './cleanup/handler.ts';
import { readBody, resolveIdentity, type MemoryActor } from './_shared/memory-http.ts';

const memoryId = '00000000-0000-4000-8000-000000000001';
const photoId = '00000000-0000-4000-8000-000000000002';
const pairId = '00000000-0000-4000-8000-000000000003';
const commandId = '00000000-0000-4000-8000-000000000004';
const ok = (data: unknown) => ({ data: { ok: true, data }, error: null });
const deny = () => ({ data: { ok: false, error: { code: 'FORBIDDEN' } }, error: null });
const post = (body: unknown) => new Request('http://localhost/function', { method: 'POST', body: JSON.stringify(body) });
function fixture() {
  const calls: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
  const photo = { id: photoId, fullPath: `${pairId}/${memoryId}/${photoId}/full.jpg`,
    thumbPath: `${pairId}/${memoryId}/${photoId}/thumb.jpg`, fullBytes: 4, thumbBytes: 4,
    width: 2, height: 2, thumbWidth: 2, thumbHeight: 2, validated: false };
  const memory = { id: memoryId, pairId, state: 'pending', photos: [photo] };
  const storage = {
    list: async () => ({ data: [{ name: 'full.jpg' }], error: null }),
    download: async (_path: string) => ({ data: new Blob([new Uint8Array(4)]), error: null }),
    createSignedUrl: async (_path: string, _seconds: number) => ({ data: { signedUrl: 'https://example.test/private' }, error: null }),
    remove: async (_paths: string[]) => ({ data: [], error: null as null | { message: string } }),
  };
  const client = {
    rpc: (name: string, args?: Record<string, unknown>): Promise<ReturnType<typeof ok> | ReturnType<typeof deny>> => {
      calls.push({ name, args });
      return Promise.resolve(ok(name === 'verify_memory_reservation' ? memory : { photoId, validated: true }));
    }, storage: { from: (_bucket: string) => storage },
  };
  const actor: MemoryActor = { caller: client as unknown as SupabaseClient, admin: client as unknown as SupabaseClient,
    actorId: commandId, sessionId: photoId };
  const authenticate = async () => ({ ok: true as const, data: actor });
  return { calls, photo, memory, storage, client, actor, authenticate };
}

Deno.test('request bodies are bounded even without Content-Length', async () => {
  assert.equal(await readBody(post({ value: 'x'.repeat(5000) })), null);
  assert.equal(await readBody(new Request('http://localhost/function')), null);
});
Deno.test('Auth outages remain retryable while explicit revocation keeps its error code', () => {
  const context = { ok: true as const, data: { userId: commandId, account: { status: 'active' } } };
  const check = { actorId: commandId, subject: commandId, sessionId: photoId, userError: null,
    claimsError: null, contextError: null, context };
  assert.equal(resolveIdentity(check).ok, true);
  for (const failure of [{ userError: {} }, { userError: { status: 503 } },
    { claimsError: { status: 502 } }, { contextError: { message: 'fetch failed' } }, { context: null }]) {
    assert.deepEqual(resolveIdentity({ ...check, ...failure }), { ok: false, error: { code: 'RETRYABLE' } });
  }
  assert.deepEqual(resolveIdentity({ ...check, context: { ok: false, error: { code: 'FORBIDDEN' } } }),
    { ok: false, error: { code: 'FORBIDDEN' } });
  assert.deepEqual(resolveIdentity({ ...check, userError: { status: 401 } }),
    { ok: false, error: { code: 'UNAUTHENTICATED' } });
});
Deno.test('photo validation records evidence but never publishes', async () => {
  const f = fixture(); let checked = 0;
  const response = await handleFinalize(post({ action: 'validate', memoryId, photoId }), {
    authenticate: f.authenticate, validate: () => { checked++; },
  });
  assert.equal(response.status, 200); assert.equal(checked, 2);
  assert.deepEqual(f.calls.map(call => call.name), ['verify_memory_reservation', 'validate_memory_photo']);
  assert.equal(f.calls[1].args?.p_session_id, f.actor.sessionId);
});
Deno.test('invalid or missing objects cannot gain validation evidence', async () => {
  const f = fixture();
  const response = await handleFinalize(post({ action: 'validate', memoryId, photoId }), {
    authenticate: f.authenticate, validate: () => { throw new Error('EXIF'); },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(f.calls.map(call => call.name), ['verify_memory_reservation']);
  f.storage.download = async () => ({ data: new Blob([new Uint8Array(9)]), error: null });
  const oversized = await handleFinalize(post({ action: 'validate', memoryId, photoId }), {
    authenticate: f.authenticate, validate: () => assert.fail('Unexpected decode'),
  });
  assert.equal(oversized.status, 400);
});
Deno.test('lost validation acknowledgement returns the same photo without another download', async () => {
  const f = fixture(); f.photo.validated = true;
  f.storage.download = () => { assert.fail('Already validated objects are immutable'); };
  const response = await handleFinalize(post({ action: 'validate', memoryId, photoId }), {
    authenticate: f.authenticate, validate: () => assert.fail('No repeated decode'),
  });
  assert.equal((await response.json()).data.id, photoId);
});
Deno.test('publication preserves command UUID and forwards commit-time revocation', async () => {
  const f = fixture();
  const original = f.client.rpc;
  f.client.rpc = (name, args) => name === 'publish_memory' ? (f.calls.push({ name, args }), Promise.resolve(deny())) : original(name, args);
  const response = await handleFinalize(post({ action: 'publish', memoryId, commandId }), {
    authenticate: f.authenticate, validate: () => assert.fail('Publish must use stored validation'),
  });
  assert.equal(response.status, 403); assert.equal(f.calls[1].args?.p_command_id, commandId);
});
Deno.test('inspect returns completed upload parts and rechecks access after listing', async () => {
  const f = fixture();
  const response = await handleFinalize(post({ action: 'inspect', memoryId }), { authenticate: f.authenticate, validate: () => {} });
  assert.deepEqual((await response.json()).data.photos, [{ id: photoId, full: true, thumb: false, validated: false }]);
  assert.equal(f.calls.filter(call => call.name === 'verify_memory_reservation').length, 2);
  let checks = 0;
  f.client.rpc = () => Promise.resolve(++checks === 1 ? ok(f.memory) : deny());
  const revoked = await handleFinalize(post({ action: 'inspect', memoryId }), { authenticate: f.authenticate, validate: () => {} });
  assert.equal(revoked.status, 403);
});
Deno.test('media URLs use sixty seconds and are withheld after membership loss', async () => {
  const f = fixture(); let calls = 0; let expiry = 0;
  f.client.rpc = () => Promise.resolve(++calls === 1
    ? ok({ bucket: 'memory-photos', path: f.photo.fullPath, expiresIn: 60, photoId }) : deny());
  f.storage.createSignedUrl = async (_path, seconds) => { expiry = seconds; return { data: { signedUrl: 'https://example.test/private' }, error: null }; };
  const response = await handleMedia(post({ photoId }), f.authenticate);
  assert.equal(expiry, 60); assert.equal(response.status, 403);
  assert.equal((await response.json()).data, undefined);
});
Deno.test('unauthorized media requests never sign a path', async () => {
  const f = fixture(); f.client.rpc = () => Promise.resolve(deny());
  f.storage.createSignedUrl = () => { assert.fail('No authorized path'); };
  const response = await handleMedia(post({ photoId }), f.authenticate);
  assert.equal(response.status, 403);
});
// Importance 100: native and browser clients require an authorized, reachable public URL.
Deno.test('media uses the public base and preserves the signed path without leaking its internal host', async () => {
  const previous = Deno.env.get('PUBLIC_SUPABASE_URL');
  const f = fixture();
  f.client.rpc = () => Promise.resolve(ok({ bucket: 'memory-photos', path: f.photo.fullPath, expiresIn: 60, photoId }));
  const path = '/storage/v1/object/sign/memory-photos/' + f.photo.fullPath;
  f.storage.createSignedUrl = async () => ({ data: { signedUrl: 'http://kong:8000' + path + '?token=synthetic' }, error: null });
  try {
    for (const invalid of [undefined, 'file:///private', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test?secret=1']) {
      if (invalid === undefined) Deno.env.delete('PUBLIC_SUPABASE_URL'); else Deno.env.set('PUBLIC_SUPABASE_URL', invalid);
      assert.equal((await handleMedia(post({ photoId }), f.authenticate)).status, 503);
    }
    Deno.env.set('PUBLIC_SUPABASE_URL', 'https://public.example.test');
    const response = await handleMedia(post({ photoId }), f.authenticate);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const result = await response.json();
    assert.equal(result.data.url, 'https://public.example.test' + path + '?token=synthetic');
    assert.ok(Date.parse(result.data.expiresAt) <= Date.now() + 60_000);
  } finally {
    if (previous === undefined) Deno.env.delete('PUBLIC_SUPABASE_URL'); else Deno.env.set('PUBLIC_SUPABASE_URL', previous);
  }
});
Deno.test('cleanup retains failed removals and completes only successful removals', async () => {
  const f = fixture(); const outcomes: unknown[] = [];
  const job = { id: commandId, memoryId, bucket: 'memory-photos', paths: [f.photo.fullPath], leaseToken: photoId, attempt: 1 };
  f.client.rpc = (name, args) => {
    if (name === 'claim_memory_cleanup') { assert.equal(args?.p_limit, 2); return Promise.resolve(ok([job])); }
    outcomes.push(args); return Promise.resolve(ok({ id: job.id, state: 'queued' }));
  };
  f.storage.remove = async () => ({ data: [], error: { message: 'offline' } });
  assert.deepEqual(await runCleanup(f.actor.admin), { completed: 0, retried: 1 });
  assert.equal((outcomes[0] as Record<string, unknown>).p_error_code, 'STORAGE_REMOVE_FAILED');
  f.storage.remove = async () => ({ data: [], error: null });
  assert.deepEqual(await runCleanup(f.actor.admin), { completed: 1, retried: 0 });
  assert.equal((outcomes[1] as Record<string, unknown>).p_error_code, null);
});
Deno.test('cleanup fails closed when no worker secret exists', async () => {
  const previous = Deno.env.get('MEMORY_CLEANUP_SECRET'); Deno.env.delete('MEMORY_CLEANUP_SECRET');
  try { assert.equal((await handleCleanup(post({}))).status, 503); }
  finally { if (previous !== undefined) Deno.env.set('MEMORY_CLEANUP_SECRET', previous); }
});
Deno.test('one failed completion does not consume another lease without removing its objects', async () => {
  const f = fixture(); const removed: string[][] = []; const completed: string[] = [];
  const jobs = [commandId, pairId].map(id => ({ id, memoryId, bucket: 'memory-photos', paths: [f.photo.fullPath], leaseToken: photoId, attempt: 1 }));
  f.client.rpc = (name, args) => {
    if (name === 'claim_memory_cleanup') return Promise.resolve(ok(jobs));
    if (args?.p_job_id === commandId) return Promise.resolve(deny());
    completed.push(args?.p_job_id as string); return Promise.resolve(ok({ state: 'completed' }));
  };
  f.storage.remove = async paths => { removed.push(paths); return { data: [], error: null }; };
  await assert.rejects(() => runCleanup(f.actor.admin), /Cleanup completion failed/);
  assert.equal(removed.length, 2); assert.deepEqual(completed, [pairId]);
});
