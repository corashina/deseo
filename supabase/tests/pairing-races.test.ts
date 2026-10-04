// Importance: 100. Real Auth accounts and concurrent HTTP requests protect membership invariants.
// Run: node --experimental-strip-types supabase/tests/pairing-races.test.ts
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';

type Account = { id: string; token: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string } };
const base = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
const publicKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const localUrl = new URL(base);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(localUrl.hostname), 'Use a local disposable Supabase stack');
assert.ok(publicKey && secretKey, 'Set local test keys. Keep the service key outside the repository.');
const users: Account[] = [];
const pairs = new Set<string>();

async function request(path: string, method: string, token: string, body?: unknown, admin = false) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { apikey: admin ? secretKey! : publicKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  });
  assert.ok(response.ok, `Local request failed: ${method} ${path.split('?')[0]} (${response.status})`);
  return response.status === 204 ? null : response.json();
}
async function rpc<T>(account: Account, name: string, body: unknown): Promise<Result<T>> {
  return request(`/rest/v1/rpc/${name}`, 'POST', account.token, body);
}
async function createAccount(): Promise<Account> {
  const email = `race-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString('hex');
  const user = await request('/auth/v1/admin/users', 'POST', secretKey!, { email, password, email_confirm: true }, true);
  // Keep the account ID for cleanup even if sign-in fails.
  const account = { id: user.id, token: '' };
  users.push(account);
  const session = await request('/auth/v1/token?grant_type=password', 'POST', publicKey!, { email, password });
  account.token = session.access_token;
  const profile = await rpc(account, 'save_profile', { p_display_name: 'Race fixture', p_timezone: 'Europe/Warsaw', p_locale: 'en' });
  assert.ok(profile.ok);
  return account;
}
async function invite(owner: Account) {
  const result = await rpc<{ pairId: string }>(owner, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: randomUUID() });
  assert.ok(result.ok);
  pairs.add(result.data.pairId);
  const code = await rpc<{ token: string }>(owner, 'create_invite', { p_pair_id: result.data.pairId, p_command_id: randomUUID() });
  assert.ok(code.ok && code.data.token);
  return { pairId: result.data.pairId, token: code.data.token };
}
try {
  const [owner, ...joiners] = await Promise.all(Array.from({ length: 4 }, createAccount));
  const first = await invite(owner);
  const self = await rpc(owner, 'accept_invite', { p_token: first.token, p_command_id: randomUUID() });
  assert.ok(!self.ok && self.error.code === 'INVITE_UNAVAILABLE');
  const commandIds = joiners.map(() => randomUUID());
  const results = await Promise.all(joiners.map((account, index) => rpc<{ pairId: string }>(account, 'accept_invite', {
    p_token: first.token, p_command_id: commandIds[index],
  })));
  assert.equal(results.filter((result) => result.ok).length, 1, 'Exactly one of three concurrent joiners succeeds');
  const winner = results.findIndex((result) => result.ok);
  const replay = await rpc(joiners[winner], 'accept_invite', { p_token: first.token, p_command_id: commandIds[winner] });
  assert.deepEqual(replay, results[winner], 'Same actor replays the confirmed result');
  const eventId = randomUUID();
  const event = { id: eventId, pair_id: first.pairId, title: 'Concurrent event', owner: 'together', visibility: 'shared',
    timezone: 'Europe/Warsaw', start_date: '2026-10-04', end_date_exclusive: '2026-10-05' };
  assert.ok((await rpc(owner, 'create_event', { p_input: event, p_command_id: randomUUID() })).ok);
  const edits = await Promise.all([owner, joiners[winner]].map((account, index) => rpc(account, 'update_event', {
    p_event_id: eventId, p_input: { ...event, title: `Edit ${index}` }, p_expected_version: 1, p_command_id: randomUUID(),
  })));
  assert.equal(edits.filter((result) => result.ok).length, 1, 'One concurrent event edit succeeds');
  assert.ok(edits.some((result) => !result.ok && result.error.code === 'CONFLICT'), 'The stale writer sees a conflict');
  const stranger = joiners[(winner + 1) % joiners.length];
  assert.deepEqual(await request(`/rest/v1/pairs?id=eq.${first.pairId}&select=id`, 'GET', stranger.token), [], 'Third account cannot read pair');
  assert.deepEqual(await request(`/rest/v1/profiles?user_id=eq.${owner.id}&select=user_id`, 'GET', stranger.token), [], 'Third account cannot read inviter profile');

  const [left, right, actor] = await Promise.all(Array.from({ length: 3 }, createAccount));
  const [leftInvite, rightInvite] = await Promise.all([invite(left), invite(right)]);
  const doubleJoin = await Promise.all([leftInvite, rightInvite].map((value) => rpc(actor, 'accept_invite', {
    p_token: value.token, p_command_id: randomUUID(),
  })));
  assert.equal(doubleJoin.filter((result) => result.ok).length, 1, 'One account cannot join two pairs concurrently');
  const [regenOwner, regenJoiner] = await Promise.all(Array.from({ length: 2 }, createAccount));
  const oldInvite = await invite(regenOwner);
  const regenerated = await rpc<{ token: string }>(regenOwner, 'create_invite', { p_pair_id: oldInvite.pairId, p_command_id: randomUUID() });
  assert.ok(regenerated.ok);
  const stale = await rpc(regenJoiner, 'accept_invite', { p_token: oldInvite.token, p_command_id: randomUUID() });
  assert.ok(!stale.ok && stale.error.code === 'INVITE_UNAVAILABLE', 'Regeneration invalidates the prior code');
  const pending = await invite(regenJoiner);
  const cross = await rpc(regenJoiner, 'accept_invite', { p_token: regenerated.data.token, p_command_id: randomUUID() });
  assert.ok(!cross.ok && cross.error.code === 'ALREADY_PAIRED', 'Cancel pending pair before joining');
  assert.ok((await rpc(regenJoiner, 'cancel_pending_pair', { p_pair_id: pending.pairId, p_command_id: randomUUID() })).ok);
  const sameCommand = randomUUID();
  const parallelReplay = await Promise.all(Array.from({ length: 2 }, () => rpc(regenJoiner, 'accept_invite', {
    p_token: regenerated.data.token, p_command_id: sameCommand,
  })));
  assert.ok(parallelReplay.every((result) => result.ok));
  assert.deepEqual(parallelReplay[0], parallelReplay[1], 'Concurrent retries confirm one result');
  await request('/auth/v1/logout?scope=global', 'POST', owner.token);
  const staleSession = await rpc(owner, 'get_session_context', {});
  assert.ok(!staleSession.ok && staleSession.error.code === 'UNAUTHENTICATED', 'Global sign-out rejects a still-valid JWT');
  console.log('Passed real Auth membership races and stale-session checks.');
} finally {
  // Remove only this run's pair IDs before deleting its Auth accounts.
  for (const pairId of pairs) {
    await request(`/rest/v1/pairs?id=eq.${pairId}`, 'DELETE', secretKey!, undefined, true);
  }
  for (const account of users) {
    await request(`/auth/v1/admin/users/${account.id}`, 'DELETE', secretKey!, undefined, true);
  }
}
