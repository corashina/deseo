// Importance 100: worker identity, access revocation, provider ambiguity, and durable receipt state.
import { strict as assert } from 'node:assert';
import { handleDispatch, runDispatch } from './dispatch-notifications/handler.ts';
import { handleReceipts, runReceipts } from './check-push-receipts/handler.ts';
import { expoRequest, type NotificationRpc } from './_shared/notification-http.ts';

const id = '00000000-0000-4000-8000-000000000001';
const leaseId = '00000000-0000-4000-8000-000000000002';
const job = { id, leaseId, notificationId: id, token: 'ExponentPushToken[test]', attempt: 1, expiresAt: '2099-01-01T00:00:00Z' };
const receipt = { id, leaseId, ticket: 'ticket-1', attempt: 1, expiresAt: job.expiresAt };
function fixture(jobs = [job]) {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const rpc: NotificationRpc = (name, args) => {
    calls.push({ name, args });
    return Promise.resolve({ data: name === 'claim_due_jobs' ? jobs
      : name === 'revalidate_notification_job' ? jobs.find(item => item.id === args?.p_id) ?? null
      : name === 'claim_push_receipts' ? [receipt] : { ok: true }, error: null });
  };
  return { calls, rpc };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const post = (token?: string) => new Request('http://localhost/worker', {
  method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: '{}',
});

Deno.test('workers reject missing, short, and wrong secrets before backend access', async () => {
  const previous = Deno.env.get('NOTIFICATION_WORKER_SECRET');
  try {
    for (const handler of [handleDispatch, handleReceipts]) {
      Deno.env.delete('NOTIFICATION_WORKER_SECRET');
      assert.equal((await handler(post())).status, 503);
      Deno.env.set('NOTIFICATION_WORKER_SECRET', 'short');
      assert.equal((await handler(post('short'))).status, 503);
      Deno.env.set('NOTIFICATION_WORKER_SECRET', 's'.repeat(32));
      assert.equal((await handler(post())).status, 401);
      assert.equal((await handler(post('wrong'))).status, 401);
      assert.equal((await handler(new Request('http://localhost'))).status, 400);
    }
  } finally {
    if (previous === undefined) Deno.env.delete('NOTIFICATION_WORKER_SECRET');
    else Deno.env.set('NOTIFICATION_WORKER_SECRET', previous);
  }
});
Deno.test('dispatch revalidates each lease and sends only generic text with an opaque ID', async () => {
  const f = fixture(); let sends = 0;
  const fetcher: typeof fetch = async (url, init) => {
    sends++;
    assert.equal(url, 'https://exp.host/--/api/v2/push/send');
    assert.equal(f.calls.at(-1)?.name, 'revalidate_notification_job');
    assert.deepEqual(JSON.parse(init?.body as string), { to: job.token, body: 'You have an update in Deseo.',
      data: { notificationId: id }, expiration: Math.floor(Date.parse(job.expiresAt) / 1000) });
    return json({ data: { status: 'ok', id: 'ticket-1' } });
  };
  assert.deepEqual(await runDispatch(f.rpc, fetcher), { submitted: 1, retried: 0, failed: 0, skipped: 0 });
  assert.equal(sends, 1);
  assert.deepEqual(f.calls.at(-1)?.args, { p_id: id, p_lease_id: leaseId, p_outcome: { status: 'submitted', ticket: 'ticket-1' } });
});
Deno.test('revoked, quiet-hour deferred, expired, and superseded jobs do not send', async () => {
  const f = fixture();
  const rpc: NotificationRpc = (name, args) => name === 'revalidate_notification_job'
    ? Promise.resolve({ data: null, error: null }) : f.rpc(name, args);
  assert.deepEqual(await runDispatch(rpc, () => { throw new Error('Must not send'); }),
    { submitted: 0, retried: 0, failed: 0, skipped: 1 });
  assert.equal(f.calls.some(call => call.name === 'complete_job'), false);
});
Deno.test('ticket errors disable unregistered devices and retry only transient errors', async () => {
  for (const [error, status] of [['DeviceNotRegistered', 'device_not_registered'], ['MessageRateExceeded', 'retry'], ['InvalidCredentials', 'failed']]) {
    const f = fixture();
    await runDispatch(f.rpc, async () => json({ data: { status: 'error', details: { error } } }));
    assert.equal((f.calls.at(-1)?.args?.p_outcome as { status: string }).status, status);
  }
});
Deno.test('HTTP failures, invalid responses, and timeouts have bounded retry outcomes', async () => {
  const cases: Array<[typeof fetch, string]> = [
    [async () => json({}, 429), 'PROVIDER_HTTP_429'],
    [async () => json({}, 503), 'PROVIDER_HTTP_503'],
    [async () => json({ data: { status: 'ok' } }), 'INVALID_PROVIDER_RESPONSE'],
    [async () => new Response('not json'), 'INVALID_PROVIDER_RESPONSE'],
    [async () => { throw new DOMException('Timed out', 'TimeoutError'); }, 'PROVIDER_UNCERTAIN'],
  ];
  for (const [fetcher, code] of cases) {
    const f = fixture(); await runDispatch(f.rpc, fetcher);
    assert.deepEqual(f.calls.at(-1)?.args?.p_outcome, { status: 'retry', code });
  }
  const f = fixture(); await runDispatch(f.rpc, async () => json({}, 401));
  assert.deepEqual(f.calls.at(-1)?.args?.p_outcome, { status: 'failed', code: 'PROVIDER_HTTP_401' });
});
Deno.test('provider request timeout and response size bounds cancel work', async () => {
  const timeoutFetch: typeof fetch = (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  });
  assert.deepEqual(await expoRequest('send', {}, timeoutFetch, 5), { kind: 'uncertain' });
  assert.deepEqual(await expoRequest('send', {}, async () => new Response('x'.repeat(70_000))), { kind: 'invalid' });
});
Deno.test('a lost ticket persistence response never causes an inline push resubmission', async () => {
  const f = fixture(); let sends = 0;
  const rpc: NotificationRpc = (name, args) => name === 'complete_job'
    ? Promise.resolve({ data: null, error: { message: 'lost response' } }) : f.rpc(name, args);
  await assert.rejects(() => runDispatch(rpc, async () => { sends++; return json({ data: { status: 'ok', id: 'ticket-1' } }); }));
  assert.equal(sends, 1);
});
Deno.test('receipts persist provider acceptance without claiming device display or sending again', async () => {
  const f = fixture();
  assert.deepEqual(await runReceipts(f.rpc, async (url, init) => {
    assert.equal(url, 'https://exp.host/--/api/v2/push/getReceipts');
    assert.deepEqual(JSON.parse(init?.body as string), { ids: ['ticket-1'] });
    return json({ data: { 'ticket-1': { status: 'ok' } } });
  }), { accepted: 1, pending: 0, failed: 0 });
  assert.deepEqual(f.calls.at(-1)?.args?.p_outcome, { status: 'accepted' });
  assert.equal(f.calls.some(call => call.name === 'claim_due_jobs'), false);
});
Deno.test('missing or transient receipts remain pending; permanent errors stop receipt work', async () => {
  for (const [response, outcome] of [
    [{ data: {} }, { status: 'pending', code: 'RECEIPT_PENDING' }],
    [{ data: { 'ticket-1': { status: 'error', details: { error: 'DeviceNotRegistered' } } } }, { status: 'device_not_registered' }],
    [{ data: { 'ticket-1': { status: 'error', details: { error: 'MessageTooBig' } } } }, { status: 'failed', code: 'MessageTooBig' }],
    [{ data: { 'ticket-1': { status: 'wat' } } }, { status: 'pending', code: 'INVALID_PROVIDER_RESPONSE' }],
  ]) {
    const f = fixture(); await runReceipts(f.rpc, async () => json(response));
    assert.deepEqual(f.calls.at(-1)?.args?.p_outcome, outcome);
  }
});
Deno.test('one completion failure does not abandon unrelated claimed jobs', async () => {
  const second = { ...job, id: '00000000-0000-4000-8000-000000000003' };
  const f = fixture([job, second]); let completed = 0;
  const rpc: NotificationRpc = (name, args) => {
    if (name === 'complete_job') { completed++; return Promise.resolve({ data: { ok: args?.p_id !== id }, error: null }); }
    return f.rpc(name, args);
  };
  await assert.rejects(() => runDispatch(rpc, async () => json({ data: { status: 'ok', id: 'ticket-1' } })));
  assert.equal(completed, 2);
});
Deno.test('overlapping workers and later runs do not resend a persisted ticket', async () => {
  let state: 'queued' | 'leased' | 'submitted' = 'queued'; let sends = 0;
  const rpc: NotificationRpc = (name) => {
    let data: unknown;
    if (name === 'claim_due_jobs') {
      data = state === 'queued' ? [job] : [];
      if (state === 'queued') state = 'leased';
    } else if (name === 'revalidate_notification_job') data = state === 'leased' ? job : null;
    else { state = 'submitted'; data = { ok: true }; }
    return Promise.resolve({ data, error: null });
  };
  const fetcher: typeof fetch = async () => { sends++; return json({ data: { status: 'ok', id: 'ticket-1' } }); };
  const results = await Promise.all([runDispatch(rpc, fetcher), runDispatch(rpc, fetcher)]);
  assert.equal(results.reduce((sum, result) => sum + result.submitted, 0), 1);
  await runDispatch(rpc, fetcher);
  assert.equal(sends, 1);
});
Deno.test('a failed revalidation leaves the lease for recovery without calling Expo', async () => {
  const f = fixture(); let sends = 0;
  const rpc: NotificationRpc = (name, args) => name === 'revalidate_notification_job'
    ? Promise.resolve({ data: null, error: { code: 'connection_lost' } }) : f.rpc(name, args);
  await assert.rejects(() => runDispatch(rpc, async () => { sends++; return json({}); }));
  assert.equal(sends, 0);
  assert.equal(f.calls.some(call => call.name === 'complete_job'), false);
});
Deno.test('empty claim batches never contact Expo', async () => {
  const rpc: NotificationRpc = () => Promise.resolve({ data: [], error: null });
  const fetcher: typeof fetch = () => { throw new Error('No jobs'); };
  assert.deepEqual(await runDispatch(rpc, fetcher), { submitted: 0, retried: 0, failed: 0, skipped: 0 });
  assert.deepEqual(await runReceipts(rpc, fetcher), { accepted: 0, pending: 0, failed: 0 });
});
Deno.test('receipt lookup failures retry lookup without resubmitting a notification', async () => {
  for (const [fetcher, outcome] of [
    [async () => json({}, 429), { status: 'pending', code: 'PROVIDER_HTTP_429' }],
    [async () => json({}, 502), { status: 'pending', code: 'PROVIDER_HTTP_502' }],
    [async () => json({}, 401), { status: 'failed', code: 'PROVIDER_HTTP_401' }],
    [async () => { throw new Error('Connection lost'); }, { status: 'pending', code: 'PROVIDER_UNCERTAIN' }],
  ] as Array<[typeof fetch, unknown]>) {
    const f = fixture(); await runReceipts(f.rpc, fetcher);
    assert.deepEqual(f.calls.at(-1)?.args?.p_outcome, outcome);
    assert.deepEqual(f.calls.map(call => call.name), ['claim_push_receipts', 'complete_push_receipt']);
  }
});
Deno.test('Expo security token is confined to the request header and errors stay generic', async () => {
  const previous = Deno.env.get('EXPO_ACCESS_TOKEN'); Deno.env.set('EXPO_ACCESS_TOKEN', 'provider-secret');
  try {
    const result = await expoRequest('send', { test: true }, async (_url, init) => {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer provider-secret');
      assert.equal(init?.body, '{"test":true}');
      return json({ message: 'private provider error body' }, 403);
    });
    assert.deepEqual(result, { kind: 'http', status: 403 });
  } finally {
    if (previous === undefined) Deno.env.delete('EXPO_ACCESS_TOKEN'); else Deno.env.set('EXPO_ACCESS_TOKEN', previous);
  }
});
