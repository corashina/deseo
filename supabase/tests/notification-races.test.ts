// Importance: 100. Real requests check lease exclusion, token ownership, and session revocation.
// Use a disposable stack on port 55621 or 55721 without worker secrets. This harness never calls Expo.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';

type Account = { id: string; token: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string } };
type Job = { id: string; leaseId: string; notificationId: string; token: string; attempt: number; expiresAt: string };
type Device = { id: string; user_id: string; installation_id: string; expo_token: string | null; revoked_at: string | null };

const localUrl = new URL(process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:55621');
const publicKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const serverKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
assert.ok(localUrl.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(localUrl.hostname)
  && ['55621', '55721'].includes(localUrl.port) && localUrl.pathname === '/' && !localUrl.search && !localUrl.hash
  && !localUrl.username && !localUrl.password, 'Use the disposable Notifications stack on port 55621 or 55721.');
assert.ok(publicKey && serverKey, 'Set local test keys outside the repository.');

async function request<T>(path: string, method: string, token: string, body?: unknown, admin = false): Promise<T> {
  const response = await fetch(`${localUrl.origin}${path}`, {
    method, headers: { apikey: admin ? serverKey! : publicKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  });
  assert.ok(response.ok, `Local request failed: ${method} ${path.split('?')[0]} (${response.status})`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
const rpc = <T>(account: Account, name: string, body: unknown): Promise<Result<T>> =>
  request(`/rest/v1/rpc/${name}`, 'POST', account.token, body);
const worker = <T>(name: string, body: unknown): Promise<T> =>
  request(`/rest/v1/rpc/${name}`, 'POST', serverKey!, body, true);
function data<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? 'RPC succeeded' : `Command failed: ${result.error.code}`);
  return result.data;
}

test('notification leases, token transfers, and session revocation', { timeout: 180_000 }, async () => {
  const users: Account[] = []; const pairs: string[] = [];
  async function createAccount(): Promise<Account> {
    const email = `notification-race-${randomUUID()}@example.test`;
    const password = randomBytes(32).toString('hex');
    const created = await request<{ id: string }>('/auth/v1/admin/users', 'POST', serverKey!,
      { email, password, email_confirm: true }, true);
    const account = { id: created.id, token: '' }; users.push(account);
    const session = await request<{ access_token: string }>('/auth/v1/token?grant_type=password', 'POST', publicKey!, { email, password });
    account.token = session.access_token;
    data(await rpc(account, 'save_profile', { p_display_name: 'Notification fixture', p_timezone: 'UTC', p_locale: 'en' }));
    return account;
  }
  try {
    // Global worker claims have no source filter. Refuse a stack containing other notification records.
    const existing = await request<unknown[]>('/rest/v1/notifications?select=id&limit=1', 'GET', serverKey!, undefined, true);
    assert.equal(existing.length, 0, 'Use an empty disposable Notifications stack.');
    const sender = await createAccount();
    const recipient = await createAccount();
    const other = await createAccount();
    const { pairId } = data(await rpc<{ pairId: string }>(sender, 'create_pair', { p_timezone: 'UTC', p_command_id: randomUUID() }));
    pairs.push(pairId);
    const invitation = data(await rpc<{ token: string }>(sender, 'create_invite', { p_pair_id: pairId, p_command_id: randomUUID() }));
    data(await rpc(recipient, 'accept_invite', { p_token: invitation.token, p_command_id: randomUUID() }));
    data(await rpc(recipient, 'save_notification_preferences', {
      p_input: { messageAlerts: true, timezone: 'UTC' }, p_expected_version: 0,
    }));
    const installationId = randomUUID();
    const token = `ExpoPushToken[notification-race-${randomUUID()}]`;
    const register = (account: Account, installation: string, expoToken: string) => rpc<{ deviceId: string }>(account, 'register_device', {
      p_input: { installationId: installation, token: expoToken, permission: 'allowed', platform: 'android' },
    }).then(data);
    await register(recipient, installationId, token);
    async function claim(): Promise<Job[]> {
      const foreign = await request<unknown[]>(`/rest/v1/notifications?select=id&pair_id=neq.${pairId}&limit=1`, 'GET', serverKey!, undefined, true);
      assert.equal(foreign.length, 0, 'Do not run other notification fixtures with this harness.');
      return worker('claim_due_jobs', { p_limit: 1, p_lease_seconds: 120 });
    }
    async function send(): Promise<{ messageId: string; notificationId: string }> {
      const message = data(await rpc<{ id: string }>(sender, 'send_message', {
        p_pair_id: pairId, p_client_id: randomUUID(), p_body: 'Notification race fixture',
      }));
      const notifications = await request<Array<{ id: string }>>(
        `/rest/v1/notifications?select=id&source_id=eq.${message.id}&user_id=eq.${recipient.id}`,
        'GET', serverKey!, undefined, true);
      assert.equal(notifications.length, 1, 'One message creates one recipient notification.');
      return { messageId: message.id, notificationId: notifications[0].id };
    }
    const revalidate = (job: Job): Promise<Job | null> => worker('revalidate_notification_job', { p_id: job.id, p_lease_id: job.leaseId });
    const removeMessage = (id: string) => rpc(sender, 'delete_message', { p_message_id: id, p_command_id: randomUUID() }).then(data);

    const first = await send();
    const overlapping = await Promise.all([claim(), claim()]);
    const claimed = overlapping.flat();
    assert.equal(claimed.length, 1, 'Two workers receive one lease for the same job.');
    const job = claimed[0];
    assert.equal(job.notificationId, first.notificationId);
    assert.equal(job.attempt, 1);
    assert.equal((await revalidate(job))?.id, job.id);
    assert.deepEqual(await worker('complete_job', {
      p_id: job.id, p_lease_id: randomUUID(), p_outcome: { status: 'submitted', ticket: `forged-${randomUUID()}` },
    }), { ok: false }, 'A stale lease cannot store a ticket.');
    const ticket = `synthetic-ticket-${randomUUID()}`;
    assert.deepEqual(await worker('complete_job', {
      p_id: job.id, p_lease_id: job.leaseId, p_outcome: { status: 'submitted', ticket },
    }), { ok: true });
    assert.deepEqual(await claim(), [], 'A known ticket cannot enter the send queue again.');
    assert.equal(await revalidate(job), null);
    assert.deepEqual(await worker('complete_job', {
      p_id: job.id, p_lease_id: job.leaseId, p_outcome: { status: 'retry', code: 'STALE_WORKER' },
    }), { ok: false }, 'A completed lease cannot requeue a known ticket.');

    const revoked = await send();
    const deviceClaim = await claim(); assert.equal(deviceClaim.length, 1);
    assert.equal(deviceClaim[0].notificationId, revoked.notificationId);
    data(await rpc(recipient, 'revoke_device', { p_installation_id: installationId }));
    assert.equal(await revalidate(deviceClaim[0]), null, 'Device revocation cancels a claimed send.');
    await removeMessage(revoked.messageId);

    await register(recipient, installationId, token);
    const signedOut = await send();
    const sessionClaim = await claim(); assert.equal(sessionClaim.length, 1);
    assert.equal(sessionClaim[0].notificationId, signedOut.notificationId);
    await request('/auth/v1/logout?scope=global', 'POST', recipient.token);
    assert.equal(await revalidate(sessionClaim[0]), null, 'Global signout blocks the device without a revoke call.');
    await removeMessage(signedOut.messageId);

    const transferToken = `ExpoPushToken[transfer-race-${randomUUID()}]`;
    const installations = [randomUUID(), randomUUID()];
    await Promise.all([register(sender, installations[0], transferToken), register(other, installations[1], transferToken)]);
    const devices = await request<Device[]>(
      `/rest/v1/devices?select=id,user_id,installation_id,expo_token,revoked_at&installation_id=in.(${installations.join(',')})`,
      'GET', serverKey!, undefined, true);
    assert.equal(devices.length, 2);
    const active = devices.filter(device => device.expo_token === transferToken && device.revoked_at === null);
    assert.equal(active.length, 1, 'Concurrent registrations leave one active token owner.');
    assert.ok([sender.id, other.id].includes(active[0].user_id));
    assert.equal(devices.filter(device => device.expo_token === null && device.revoked_at !== null).length, 1,
      'The previous owner loses the token.');
  } finally {
    // Delete only records created here. Account deletion also removes its device records.
    const removedPairs = await Promise.allSettled(pairs.map(pairId =>
      request(`/rest/v1/pairs?id=eq.${pairId}`, 'DELETE', serverKey!, undefined, true)));
    const removedUsers = await Promise.allSettled(users.map(account =>
      request(`/auth/v1/admin/users/${account.id}`, 'DELETE', serverKey!, undefined, true)));
    assert.ok([...removedPairs, ...removedUsers].every(result => result.status === 'fulfilled'), 'Fixture cleanup failed.');
  }
});
