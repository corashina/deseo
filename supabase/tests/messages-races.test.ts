// Importance: 100 for send/cursor races; 94 for pin replacement and deletion.
// Run against the disposable deseo stack: npm run test:db:race.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

type Account = { id: string; token: string };
type Message = { id: string; pair_id: string; author_id: string; client_id: string; body: string; created_at: string; pinned_at: string | null };
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string } };

const base = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:55721';
const publicKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const localUrl = new URL(base);
assert.ok(localUrl.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(localUrl.hostname)
  && ['55721'].includes(localUrl.port) && localUrl.pathname === '/' && !localUrl.search && !localUrl.hash
  && !localUrl.username && !localUrl.password, 'Use the disposable deseo stack on port 55721');
assert.ok(publicKey && secretKey, 'Set local Messages test keys. Keep the server key outside the repository.');
const users: Account[] = [];
const pairs = new Set<string>();

async function request<T>(path: string, method: string, token: string, body?: unknown, admin = false): Promise<T> {
  const response = await fetch(`${localUrl.origin}${path}`, {
    method,
    headers: { apikey: admin ? secretKey! : publicKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  assert.ok(response.ok, `Local request failed: ${method} ${path.split('?')[0]} (${response.status})`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function rpc<T>(account: Account, name: string, body: unknown): Promise<Result<T>> {
  return request(`/rest/v1/rpc/${name}`, 'POST', account.token, body);
}

function data<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? 'RPC succeeded' : result.error.code);
  return result.data;
}

async function createAccount(): Promise<Account> {
  const email = `messages-race-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString('hex');
  const created = await request<{ id: string }>('/auth/v1/admin/users', 'POST', secretKey!,
    { email, password, email_confirm: true }, true);
  const account = { id: created.id, token: '' };
  users.push(account);
  const session = await request<{ access_token: string }>('/auth/v1/token?grant_type=password', 'POST', publicKey!, { email, password });
  account.token = session.access_token;
  data(await rpc(account, 'save_profile', { p_display_name: 'Messages fixture', p_timezone: 'Europe/Warsaw', p_locale: 'en' }));
  return account;
}

const messageColumns = 'id,pair_id,author_id,client_id,body,created_at,pinned_at';

try {
  const [author, partner] = await Promise.all([createAccount(), createAccount()]);
  const pair = data(await rpc<{ pairId: string }>(author, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: randomUUID() }));
  pairs.add(pair.pairId);
  const invitation = data(await rpc<{ token: string }>(author, 'create_invite', { p_pair_id: pair.pairId, p_command_id: randomUUID() }));
  data(await rpc(partner, 'accept_invite', { p_token: invitation.token, p_command_id: randomUUID() }));

  const clientId = randomUUID();
  const send = { p_pair_id: pair.pairId, p_client_id: clientId, p_body: 'Lost acknowledgement' };
  const duplicateSends = await Promise.all(Array.from({ length: 3 }, () => rpc<Message>(author, 'send_message', send)));
  const first = data(duplicateSends[0]);
  assert.ok(duplicateSends.every((result) => data(result).id === first.id), 'Concurrent retries return one durable message');
  const duplicates = await request<Message[]>(`/rest/v1/messages?pair_id=eq.${pair.pairId}&client_id=eq.${clientId}&select=${messageColumns}`,
    'GET', author.token);
  assert.equal(duplicates.length, 1, 'Concurrent retries store one message');
  const changed = await rpc(author, 'send_message', { ...send, p_body: 'Changed payload' });
  assert.ok(!changed.ok && changed.error.code === 'CONFLICT', 'The client ID binds its payload');

  const second = data(await rpc<Message>(author, 'send_message', {
    p_pair_id: pair.pairId, p_client_id: randomUUID(), p_body: 'Replacement note',
  }));
  const pinResults = await Promise.all([first, second].map((message) => rpc(author, 'pin_message', {
    p_message_id: message.id, p_command_id: randomUUID(),
  })));
  pinResults.forEach(data);
  const pins = await request<Message[]>(`/rest/v1/messages?pair_id=eq.${pair.pairId}&author_id=eq.${author.id}&pinned_at=not.is.null&select=${messageColumns}`,
    'GET', author.token);
  assert.equal(pins.length, 1, 'Concurrent replacement leaves exactly one own pin');

  await Promise.all(Array.from({ length: 3 }, (_, index) => rpc<Message>(partner, 'send_message', {
    p_pair_id: pair.pairId, p_client_id: randomUUID(), p_body: `Partner message ${index}`,
  }).then(data)));
  const incoming = await request<Message[]>(`/rest/v1/messages?pair_id=eq.${pair.pairId}&author_id=eq.${partner.id}&select=${messageColumns}&order=created_at.asc,id.asc`,
    'GET', author.token);
  assert.equal(incoming.length, 3);
  assert.equal(new Set(incoming.map((message) => message.created_at)).size, 3, 'Concurrent sends have strictly ordered timestamps');
  const oldest = incoming[0];
  const newest = incoming[incoming.length - 1];
  await Promise.all([newest, oldest].map((message) => rpc(author, 'set_read_cursor', {
    p_pair_id: pair.pairId, p_created_at: message.created_at, p_message_id: message.id,
  }).then(data)));
  const cursor = data(await rpc<{ created_at: string; id: string }>(author, 'set_read_cursor', {
    p_pair_id: pair.pairId, p_created_at: oldest.created_at, p_message_id: oldest.id,
  }));
  assert.equal(cursor.id, newest.id, 'A late cursor request cannot move backwards');
  assert.equal(data(await rpc<{ count: number }>(author, 'get_unread_count', { p_pair_id: pair.pairId })).count, 0);

  const [pinDuringDelete, deleted] = await Promise.all([
    rpc(author, 'pin_message', { p_message_id: first.id, p_command_id: randomUUID() }),
    rpc(author, 'delete_message', { p_message_id: first.id, p_command_id: randomUUID() }),
  ]);
  data(deleted);
  assert.ok(pinDuringDelete.ok || pinDuringDelete.error.code === 'FORBIDDEN', 'Pin either commits before deletion or loses access');
  const resurrection = await rpc(author, 'send_message', send);
  assert.ok(!resurrection.ok && resurrection.error.code === 'FORBIDDEN', 'A deleted send cannot be restored');
  const reconciled = data(await rpc<{ messages: Message[]; deleted_client_ids: string[] }>(author, 'reconcile_message_sends', {
    p_pair_id: pair.pairId, p_client_ids: [clientId],
  }));
  assert.deepEqual(reconciled.messages, []);
  assert.deepEqual(reconciled.deleted_client_ids, [clientId]);
  const hidden = await request<Message[]>(`/rest/v1/messages?id=eq.${first.id}&select=${messageColumns}`, 'GET', partner.token);
  assert.deepEqual(hidden, [], 'Deleted text is unavailable to the partner');
  console.log('Passed Messages send, pin, deletion, and cursor races.');
} finally {
  // Delete only the Auth accounts and pair created by this run.
  for (const pairId of pairs) {
    await request(`/rest/v1/pairs?id=eq.${pairId}`, 'DELETE', secretKey!, undefined, true);
  }
  for (const account of users) {
    await request(`/auth/v1/admin/users/${account.id}`, 'DELETE', secretKey!, undefined, true);
  }
}
