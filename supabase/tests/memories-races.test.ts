// Importance: 100. Real concurrent clients prove quota, immutable Storage, closure, and worker lease boundaries.
// Run against a disposable local stack: npm run test:memories:race.
// This harness tests SQL and Storage. Edge image-validation tests run separately.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

type Account = { id: string; token: string; sessionId: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string } };
type Photo = { id: string; fullBytes: number; thumbBytes: number; width: number; height: number; thumbWidth: number; thumbHeight: number };
type Memory = { id: string; version: number; photos: Array<Photo & { fullPath: string; thumbPath: string }> };
type Job = { id: string; memoryId: string; bucket: string; paths: string[]; leaseToken: string };
const base = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
const publicKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a local disposable stack');
assert.ok(publicKey && secretKey, 'Set local test keys outside the repository');
const users: Account[] = [];
const pairs = new Set<string>();
const objectPaths = new Set<string>();
const mib = 1024 * 1024;

async function request(path: string, method: string, token: string, body?: unknown, admin = false) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: admin ? secretKey! : publicKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.ok, `${method} ${path.split('?')[0]} failed (${response.status})`);
  return response.status === 204 || response.headers.get('content-length') === '0' ? null : response.json();
}
async function rpc<T>(account: Account, name: string, body: unknown): Promise<Result<T>> {
  return request(`/rest/v1/rpc/${name}`, 'POST', account.token, body);
}
async function serviceRpc<T>(name: string, body: unknown): Promise<Result<T>> {
  return request(`/rest/v1/rpc/${name}`, 'POST', secretKey!, body, true);
}
async function account(): Promise<Account> {
  const email = `memory-race-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString('hex');
  const user = await request('/auth/v1/admin/users', 'POST', secretKey!, { email, password, email_confirm: true }, true);
  const actor = { id: user.id, token: '', sessionId: '' };
  users.push(actor);
  const session = await request('/auth/v1/token?grant_type=password', 'POST', publicKey!, { email, password });
  actor.token = session.access_token;
  actor.sessionId = JSON.parse(Buffer.from(actor.token.split('.')[1], 'base64url').toString('utf8')).session_id;
  assert.ok((await rpc(actor, 'save_profile', { p_display_name: 'Memory fixture', p_timezone: 'Europe/Warsaw', p_locale: 'en' })).ok);
  return actor;
}
async function pair(owner: Account, partner: Account) {
  const created = await rpc<{ pairId: string }>(owner, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: randomUUID() });
  assert.ok(created.ok);
  pairs.add(created.data.pairId);
  const invitation = await rpc<{ token: string }>(owner, 'create_invite', { p_pair_id: created.data.pairId, p_command_id: randomUUID() });
  assert.ok(invitation.ok);
  assert.ok((await rpc(partner, 'accept_invite', { p_token: invitation.data.token, p_command_id: randomUUID() })).ok);
  return created.data.pairId;
}
function photo(fullBytes: number, thumbBytes: number): Photo {
  return { id: randomUUID(), fullBytes, thumbBytes, width: 20, height: 10, thumbWidth: 10, thumbHeight: 5 };
}
function draft(pairId: string, photos: Photo[]) {
  return { id: randomUUID(), pairId, memoryDate: '2026-10-04', caption: 'Synthetic local fixture', photos };
}
async function reserve(actor: Account, input: ReturnType<typeof draft>, commandId = randomUUID()) {
  return rpc<Memory>(actor, 'reserve_memory', { p_input: input, p_command_id: commandId });
}
async function upload(actor: Account, path: string, bytes: number, method = 'POST') {
  return fetch(`${base}/storage/v1/object/memory-photos/${path}`, {
    method,
    headers: { apikey: publicKey!, Authorization: `Bearer ${actor.token}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'false',
      'x-metadata': Buffer.from(JSON.stringify({ sessionId: actor.sessionId })).toString('base64') },
    body: new Uint8Array(bytes), signal: AbortSignal.timeout(30_000),
  });
}
async function removePaths(paths: string[]) {
  if (paths.length === 0) return;
  await request('/storage/v1/object/memory-photos', 'DELETE', secretKey!, { prefixes: paths }, true);
  for (const path of paths) objectPaths.delete(path);
}

try {
  const [owner, partner, stranger] = await Promise.all([account(), account(), account()]);
  const pairId = await pair(owner, partner);
  const initial = draft(pairId, [photo(100, 30)]);
  const reservationCommand = randomUUID();
  const duplicate = await Promise.all([reserve(owner, initial, reservationCommand), reserve(owner, initial, reservationCommand)]);
  assert.ok(duplicate[0].ok && duplicate[1].ok);
  assert.deepEqual(duplicate[0], duplicate[1], 'Concurrent reserve retries return one memory');
  const memory = duplicate[0].data;
  assert.deepEqual(await request(`/rest/v1/memories?id=eq.${memory.id}&select=id`, 'GET', partner.token), [], 'Partner cannot read pending memory');
  assert.deepEqual(await request(`/rest/v1/memory_photos?memory_id=eq.${memory.id}&select=id`, 'GET', stranger.token), [], 'Stranger cannot read photo paths');
  const badSize = await upload(owner, memory.photos[0].fullPath, 101);
  assert.ok(!badSize.ok, 'Measured bytes cannot exceed reserved bytes');
  const full = await upload(owner, memory.photos[0].fullPath, 100);
  assert.ok(full.ok, 'Reserved exact bytes upload');
  objectPaths.add(memory.photos[0].fullPath);
  const thumb = await upload(owner, memory.photos[0].thumbPath, 30);
  assert.ok(thumb.ok);
  objectPaths.add(memory.photos[0].thumbPath);
  assert.ok(!(await upload(owner, memory.photos[0].fullPath, 100)).ok, 'Duplicate upload cannot overwrite');
  assert.ok(!(await upload(owner, memory.photos[0].fullPath, 100, 'PUT')).ok, 'Storage update is forbidden');
  const arbitraryUrl = await fetch(`${base}/storage/v1/object/sign/memory-photos/${memory.photos[0].fullPath}`, {
    method: 'POST', headers: { apikey: publicKey!, Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 86400 }), signal: AbortSignal.timeout(15_000),
  });
  assert.ok(!arbitraryUrl.ok, 'Client cannot mint an arbitrary-duration link');
  // Invalid image bytes can reach private Storage; a SQL-only publication still fails without service validation.
  const unvalidated = await serviceRpc('publish_memory', {
    p_memory_id: memory.id, p_actor_id: owner.id, p_session_id: owner.sessionId, p_command_id: randomUUID(),
  });
  assert.ok(!unvalidated.ok && unvalidated.error.code === 'RETRYABLE', 'Private unvalidated files cannot publish');
  assert.ok((await rpc(owner, 'delete_memory', { p_memory_id: memory.id, p_expected_version: 1, p_command_id: randomUUID() })).ok);

  // Reserve 1000 MiB without uploads. Deleting bytes still count against the quota.
  const seeded: Memory[] = [];
  for (let index = 0; index < 20; index += 1) {
    const result = await reserve(owner, draft(pairId, Array.from({ length: 5 }, () => photo(5 * mib, 5 * mib))));
    assert.ok(result.ok);
    seeded.push(result.data);
  }
  const racers = [owner, partner].map((actor) => reserve(actor, draft(pairId, [photo(5 * mib, 3 * mib), photo(5 * mib, 3 * mib)])));
  const quotaRace = await Promise.all(racers);
  assert.equal(quotaRace.filter((result) => result.ok).length, 1, 'Exactly one concurrent 16 MiB reservation fits');
  assert.ok(quotaRace.some((result) => !result.ok && result.error.code === 'QUOTA_EXCEEDED'));
  const winnerIndex = quotaRace.findIndex((result) => result.ok);
  const winner = quotaRace[winnerIndex];
  assert.ok(winner.ok);
  const winnerActor = [owner, partner][winnerIndex];
  const deletes = await Promise.all([
    ...seeded.map((row) => rpc(owner, 'delete_memory', { p_memory_id: row.id, p_expected_version: 1, p_command_id: randomUUID() })),
    rpc(winnerActor, 'delete_memory', { p_memory_id: winner.data.id, p_expected_version: 1, p_command_id: randomUUID() }),
  ]);
  assert.ok(deletes.every((result) => result.ok));
  const stillFull = await reserve(owner, draft(pairId, [photo(5 * mib, 3 * mib), photo(5 * mib, 3 * mib)]));
  assert.ok(!stillFull.ok && stillFull.error.code === 'QUOTA_EXCEEDED', 'Deletion does not release bytes before Storage cleanup');
  const claims = await Promise.all([serviceRpc<Job[]>('claim_memory_cleanup', { p_limit: 50 }), serviceRpc<Job[]>('claim_memory_cleanup', { p_limit: 50 })]);
  assert.ok(claims[0].ok && claims[1].ok);
  const jobs = [...claims[0].data, ...claims[1].data];
  assert.equal(jobs.length, 22, 'Workers claim each queued memory once');
  assert.equal(new Set(jobs.map((job) => job.id)).size, jobs.length, 'Concurrent workers have no duplicate leases');
  for (const job of jobs) {
    await removePaths(job.paths);
    const completed = await serviceRpc<{ state: string }>('complete_memory_cleanup', { p_job_id: job.id, p_lease_token: job.leaseToken });
    assert.ok(completed.ok && completed.data.state === 'completed');
  }
  assert.ok((await reserve(owner, draft(pairId, [photo(100, 30)]))).ok, 'Cleanup releases quota');

  // Pair closure and reservation use the same locks. Closure blocks all later retries and uploads.
  const proof = randomBytes(32).toString('hex');
  assert.ok((await serviceRpc('issue_verification_proof', {
    p_user_id: owner.id, p_session_id: owner.sessionId, p_action: 'end_pair', p_proof_hash: createHash('sha256').update(proof).digest('hex'),
  })).ok);
  const racingDraft = draft(pairId, [photo(100, 30)]);
  const racingCommand = randomUUID();
  const [reservationRace, closure] = await Promise.all([
    reserve(owner, racingDraft, racingCommand),
    rpc(owner, 'end_pair', { p_pair_id: pairId, p_verification_proof: proof, p_command_id: randomUUID() }),
  ]);
  assert.ok(closure.ok);
  assert.ok(reservationRace.ok || reservationRace.error.code === 'FORBIDDEN');
  const replay = await reserve(owner, racingDraft, racingCommand);
  assert.ok(!replay.ok && replay.error.code === 'FORBIDDEN', 'Closure denies prior command replay');
  const latePath = `${pairId}/${racingDraft.id}/${racingDraft.photos[0].id}/full.jpg`;
  assert.ok(!(await upload(owner, latePath, 100)).ok, 'Late upload cannot complete after closure');
  const publish = await serviceRpc('publish_memory', {
    p_memory_id: racingDraft.id, p_actor_id: owner.id, p_session_id: owner.sessionId, p_command_id: randomUUID(),
  });
  assert.ok(!publish.ok && publish.error.code === 'FORBIDDEN', 'Closure blocks service publication');
  // Importance: 100. An ended-pair retry and current-pair cleanup share the same author's profile lock.
  const currentPair = await pair(owner, stranger);
  const current = await reserve(owner, draft(currentPair, [photo(100, 30)]));
  assert.ok(current.ok);
  const currentDeleteCommand = randomUUID();
  assert.ok((await rpc(owner, 'delete_memory', { p_memory_id: current.data.id, p_expected_version: 1, p_command_id: currentDeleteCommand })).ok);
  const [crossPairClaims, ...retries] = await Promise.all([
    serviceRpc<Job[]>('claim_memory_cleanup', { p_limit: 50 }),
    ...Array.from({ length: 4 }, () => rpc(owner, 'delete_memory', { p_memory_id: memory.id, p_expected_version: 1, p_command_id: randomUUID() })),
    rpc(owner, 'delete_memory', { p_memory_id: current.data.id, p_expected_version: 1, p_command_id: currentDeleteCommand }),
  ]);
  assert.ok(crossPairClaims.ok, 'Cleanup across historical and current pairs avoids a lock cycle');
  assert.ok(retries.slice(0, 4).every((result) => !result.ok && result.error.code === 'FORBIDDEN'));
  assert.ok(retries[4].ok);
  for (const job of crossPairClaims.data) {
    await removePaths(job.paths);
    // Importance: 100. Completion must lock historical authors before pair rows and tombstone foreign keys.
    const [completion, historicalDelete] = await Promise.all([
      serviceRpc('complete_memory_cleanup', { p_job_id: job.id, p_lease_token: job.leaseToken }),
      rpc(owner, 'delete_memory', { p_memory_id: memory.id, p_expected_version: 1, p_command_id: randomUUID() }),
    ]);
    assert.ok(completion.ok, 'Cleanup completion avoids a historical author lock cycle');
    assert.ok(!historicalDelete.ok && historicalDelete.error.code === 'FORBIDDEN');
  }
  console.log('Passed local quota, private Storage, duplicate commands, cleanup leases, and closure races.');
} finally {
  await removePaths([...objectPaths]);
  for (const pairId of pairs) await request(`/rest/v1/pairs?id=eq.${pairId}`, 'DELETE', secretKey!, undefined, true);
  for (const actor of users) await request(`/auth/v1/admin/users/${actor.id}`, 'DELETE', secretKey!, undefined, true);
}
