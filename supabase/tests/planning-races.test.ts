// Importance: 100. Real Auth and concurrent requests check atomic writes and access revocation.
// Run after local migrations: node --experimental-strip-types --test supabase/tests/planning-races.test.ts
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import test from 'node:test';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string } };
type Account = { id: string; client: SupabaseClient };
type Task = { id: string; list_id: string; version: number; completed_at: string | null };
type Idea = { id: string; state: string; linked_event_id: string | null; version: number };
type Event = { id: string; version: number };
const base = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
const publicKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const serverKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const url = new URL(base);
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
  'Use a local disposable Supabase stack.');
assert.ok(publicKey && serverKey, 'Set local test keys. Keep the server key outside the repository.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(base, serverKey, options);
const users: string[] = [];
const pairs: string[] = [];
const channels: { client: SupabaseClient; channel: RealtimeChannel }[] = [];

// Importance: 100. Task and calendar topics must reject other pairs and carry no private content.
async function planningSignals(client: SupabaseClient, topic: 'tasks' | 'calendar', pairId: string, allowed: boolean) {
  await client.realtime.setAuth();
  const messages: unknown[] = [];
  const channel = client.channel(`${topic}:${pairId}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, (message) => messages.push(message.payload));
  channels.push({ client, channel });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Realtime authorization did not finish.')), 20_000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        if (allowed) resolve(); else reject(new Error(`Another pair joined a private ${topic} channel.`));
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        if (allowed) reject(new Error(`A member could not join the ${topic} channel.`)); else resolve();
      }
    });
  });
  return messages;
}

async function expectSignal(messages: unknown[], previousCount: number) {
  const deadline = Date.now() + 10_000;
  while (messages.length <= previousCount && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(messages.length > previousCount, 'The partner must receive a confirmed change.');
  assert.ok(messages.every((message) => JSON.stringify(message) === '{}'), 'Planning signals must contain no private content.');
}

async function account(): Promise<Account> {
  const email = `planning-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString('hex');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null);
  const id = created.data.user!.id;
  users.push(id);
  const client = createClient(base, publicKey!, options);
  const session = await client.auth.signInWithPassword({ email, password });
  assert.equal(session.error, null);
  const result = await rpc(client, 'save_profile', { p_display_name: 'Planning fixture', p_timezone: 'Europe/Warsaw', p_locale: 'en' });
  assert.ok(result.ok);
  return { id, client };
}

async function rpc<T>(client: SupabaseClient, name: string, input: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await client.rpc(name, input).abortSignal(AbortSignal.timeout(15_000));
  assert.equal(error, null, `RPC ${name} must return its command result.`);
  return data as Result<T>;
}

function success<T>(value: Result<T>): T {
  if (!value.ok) assert.fail(`Command failed: ${value.error.code}`);
  return value.data;
}

async function pair(a: Account, b: Account) {
  const created = success(await rpc<{ pairId: string }>(a.client, 'create_pair', {
    p_timezone: 'Europe/Warsaw', p_command_id: randomUUID(),
  }));
  pairs.push(created.pairId);
  const invitation = success(await rpc<{ token: string }>(a.client, 'create_invite', {
    p_pair_id: created.pairId, p_command_id: randomUUID(),
  }));
  success(await rpc(b.client, 'accept_invite', { p_token: invitation.token, p_command_id: randomUUID() }));
  return created.pairId;
}

async function rows<T>(client: SupabaseClient, table: string, pairId: string): Promise<T[]> {
  const { data, error } = await client.from(table).select('*').eq('pair_id', pairId).abortSignal(AbortSignal.timeout(15_000));
  assert.equal(error, null);
  return data as T[];
}

test('shared planning concurrency and account isolation', { timeout: 180_000 }, async () => {
  try {
    const [a, b, outsider, other] = await Promise.all([account(), account(), account(), account()]);
    const [pairId, otherPairId] = await Promise.all([pair(a, b), pair(outsider, other)]);
    const initialLists = await rows<{ id: string; name: string }>(a.client, 'task_lists', pairId);
    assert.equal(initialLists.filter((list) => list.name === 'General').length, 1, 'Pair activation creates one General list.');
    const general = initialLists.find((list) => list.name === 'General')!;
    const list = success(await rpc<{ id: string }>(a.client, 'create_list', {
      p_pair_id: pairId, p_name: 'Race list', p_command_id: randomUUID(),
    }));
    const input = { id: randomUUID(), pair_id: pairId, list_id: list.id, title: 'Original', assignee_id: a.id, due_date: '2099-10-04' };
    const signals = await planningSignals(b.client, 'tasks', pairId, true);
    await planningSignals(outsider.client, 'tasks', pairId, false);
    const signalsBeforeCreate = signals.length;
    const task = success(await rpc<Task>(a.client, 'create_task', { p_input: input, p_command_id: randomUUID() }));
    await expectSignal(signals, signalsBeforeCreate);

    const edits = await Promise.all([a, b].map((actor, index) => rpc<Task>(actor.client, 'update_task', {
      p_task_id: task.id, p_input: { ...input, title: `Edit ${index}` }, p_expected_version: task.version, p_command_id: randomUUID(),
    })));
    assert.equal(edits.filter((result) => result.ok).length, 1, 'Only one writer can update a version.');
    assert.ok(edits.some((result) => !result.ok && result.error.code === 'CONFLICT'));
    const edited = success(edits.find((result) => result.ok)!);
    const completion = { p_task_id: task.id, p_completed: true, p_expected_version: edited.version, p_command_id: randomUUID() };
    const completions = await Promise.all([rpc<Task>(a.client, 'set_task_completed', completion), rpc<Task>(a.client, 'set_task_completed', completion)]);
    const completed = success(completions[0]);
    assert.deepEqual(completions[1], completions[0], 'Concurrent retries replay one completion.');
    assert.ok(completed.completed_at);
    assert.equal(completed.version, edited.version + 1);
    const reopened = success(await rpc<Task>(b.client, 'set_task_completed', {
      p_task_id: task.id, p_completed: false, p_expected_version: completed.version, p_command_id: randomUUID(),
    }));
    assert.equal(reopened.completed_at, null, 'Either member can undo completion.');

    const badAssignee = await rpc(a.client, 'create_task', {
      p_input: { ...input, id: randomUUID(), assignee_id: outsider.id }, p_command_id: randomUUID(),
    });
    assert.ok(!badAssignee.ok && badAssignee.error.code === 'VALIDATION');
    const foreignLists = await rows<{ id: string }>(outsider.client, 'task_lists', otherPairId);
    const crossPair = await rpc(a.client, 'create_task', {
      p_input: { ...input, id: randomUUID(), list_id: foreignLists[0].id }, p_command_id: randomUUID(),
    });
    assert.ok(!crossPair.ok, 'A task cannot reference another pair list.');
    assert.deepEqual(await rows(outsider.client, 'tasks', pairId), [], 'Another pair cannot read tasks.');
    assert.deepEqual(await rows(outsider.client, 'task_lists', pairId), [], 'Another pair cannot read lists.');

    const nonemptyDelete = await rpc(a.client, 'delete_empty_list', { p_list_id: list.id, p_command_id: randomUUID() });
    assert.ok(!nonemptyDelete.ok, 'Deleting a nonempty list must preserve its tasks.');
    const createDuringMove = { ...input, id: randomUUID(), title: 'Created during move' };
    const moved = await Promise.all([
      rpc(a.client, 'move_list_tasks_to_general', { p_list_id: list.id, p_command_id: randomUUID() }),
      rpc<Task>(b.client, 'create_task', { p_input: createDuringMove, p_command_id: randomUUID() }),
    ]);
    moved.forEach((result) => assert.ok(result.ok));
    const afterMove = await rows<Task>(a.client, 'tasks', pairId);
    assert.equal(afterMove.find((row) => row.id === task.id)?.list_id, general.id);
    assert.equal(afterMove.filter((row) => row.id === createDuringMove.id).length, 1, 'The concurrent task survives exactly once.');
    success(await rpc(a.client, 'move_list_tasks_to_general', { p_list_id: list.id, p_command_id: randomUUID() }));
    success(await rpc(a.client, 'delete_empty_list', { p_list_id: list.id, p_command_id: randomUUID() }));
    const afterDelete = await rows<Task>(b.client, 'tasks', pairId);
    assert.equal(afterDelete.length, 2, 'List deletion preserves moved tasks.');
    assert.ok(afterDelete.every((row) => row.list_id === general.id));

    const ideaInput = { id: randomUUID(), pair_id: pairId, title: 'Evening walk', note: 'Along the river', link: null };
    const calendarSignals = await planningSignals(b.client, 'calendar', pairId, true);
    await planningSignals(outsider.client, 'calendar', pairId, false);
    const calendarSignalsBeforeCreate = calendarSignals.length;
    const idea = success(await rpc<Idea>(a.client, 'create_date_idea', { p_input: ideaInput, p_command_id: randomUUID() }));
    await expectSignal(calendarSignals, calendarSignalsBeforeCreate);
    const eventInput = { id: randomUUID(), pair_id: pairId, title: ideaInput.title, owner: 'together', visibility: 'shared',
      timezone: 'Europe/Warsaw', location: null, description: ideaInput.note, confirm_shared: false,
      starts_at: '2099-10-04T16:00:00Z', ends_at: '2099-10-04T17:00:00Z', start_date: null, end_date_exclusive: null, repeat: 'none' };
    const plan = { p_idea_id: idea.id, p_event_input: eventInput, p_expected_version: idea.version, p_command_id: randomUUID() };
    const planned = await Promise.all([rpc<Event>(a.client, 'plan_date_idea', plan), rpc<Event>(a.client, 'plan_date_idea', plan)]);
    assert.deepEqual(planned[1], planned[0], 'Concurrent retries return the same planned event.');
    const event = success(planned[0]);
    assert.equal(event.id, eventInput.id);
    assert.equal((await rows<Event>(b.client, 'events', pairId)).filter((row) => row.id === event.id).length, 1);
    const linked = (await rows<Idea>(b.client, 'date_ideas', pairId)).find((row) => row.id === idea.id)!;
    assert.equal(linked.state, 'planned');
    assert.equal(linked.linked_event_id, event.id);
    assert.equal(linked.version, idea.version + 1);
    assert.deepEqual(await rows(outsider.client, 'date_ideas', pairId), [], 'Another pair cannot read saved ideas.');
    const foreignPlan = await rpc(outsider.client, 'plan_date_idea', { ...plan, p_command_id: randomUUID() });
    assert.ok(!foreignPlan.ok && foreignPlan.error.code === 'FORBIDDEN');

    const contested = success(await rpc<Idea>(a.client, 'create_date_idea', {
      p_input: { ...ideaInput, id: randomUUID(), title: 'Contested plan' }, p_command_id: randomUUID(),
    }));
    const contestedEvents: string[] = [randomUUID(), randomUUID()];
    const competingPlans = await Promise.all([a, b].map((actor, index) => rpc<Event>(actor.client, 'plan_date_idea', {
      p_idea_id: contested.id, p_event_input: { ...eventInput, id: contestedEvents[index] },
      p_expected_version: contested.version, p_command_id: randomUUID(),
    })));
    assert.equal(competingPlans.filter((result) => result.ok).length, 1, 'Only one member can plan a saved version.');
    assert.ok(competingPlans.some((result) => !result.ok && result.error.code === 'CONFLICT'));
    const pairEvents = await rows<Event>(b.client, 'events', pairId);
    assert.equal(pairEvents.filter((row) => contestedEvents.includes(row.id)).length, 1, 'The losing transaction leaves no event.');

    const unplanned = success(await rpc<Idea>(a.client, 'create_date_idea', {
      p_input: { ...ideaInput, id: randomUUID(), title: 'Foreign link attempt' }, p_command_id: randomUUID(),
    }));
    const crossPairPlan = await rpc(a.client, 'plan_date_idea', {
      p_idea_id: unplanned.id, p_event_input: { ...eventInput, id: randomUUID(), pair_id: otherPairId },
      p_expected_version: unplanned.version, p_command_id: randomUUID(),
    });
    assert.ok(!crossPairPlan.ok, 'Planning cannot create an event in another pair.');
    const existingEventPlan = await rpc(a.client, 'plan_date_idea', {
      p_idea_id: unplanned.id, p_event_input: eventInput, p_expected_version: unplanned.version, p_command_id: randomUUID(),
    });
    assert.ok(!existingEventPlan.ok, 'A second idea cannot reuse another idea event.');
    const untouched = (await rows<Idea>(b.client, 'date_ideas', pairId)).find((row) => row.id === unplanned.id)!;
    assert.equal(untouched.state, 'saved');
    assert.equal(untouched.linked_event_id, null);
    assert.equal(untouched.version, unplanned.version, 'Failed planning leaves the idea unchanged.');

    success(await rpc(b.client, 'delete_event', { p_event_id: event.id, p_expected_version: event.version, p_command_id: randomUUID() }));
    const restored = (await rows<Idea>(a.client, 'date_ideas', pairId)).find((row) => row.id === idea.id)!;
    assert.equal(restored.state, 'saved', 'Deleting a future event restores its idea.');
    assert.equal(restored.linked_event_id, null);
    assert.equal(restored.version, linked.version + 1);
    const deletedPlanReplay = await rpc(a.client, 'plan_date_idea', plan);
    assert.ok(!deletedPlanReplay.ok, 'An old receipt must not return a deleted event.');

    const endedAt = new Date();
    const closed = await admin.from('pairs').update({ state: 'ended', ended_at: endedAt.toISOString(),
      purge_after: new Date(endedAt.getTime() + 30 * 86_400_000).toISOString() }).eq('id', pairId);
    assert.equal(closed.error, null);
    assert.deepEqual(await rows(a.client, 'tasks', pairId), [], 'Closure removes normal task access.');
    assert.deepEqual(await rows(a.client, 'date_ideas', pairId), [], 'Closure removes normal idea access.');
    const replayAfterClosure = await rpc(a.client, 'set_task_completed', completion);
    assert.ok(!replayAfterClosure.ok && replayAfterClosure.error.code === 'FORBIDDEN', 'Receipt replay must recheck current access.');
  } finally {
    // Remove only this run's synthetic pairs and Auth accounts, even after an assertion fails.
    const failures: string[] = [];
    for (const { client, channel } of channels) await client.removeChannel(channel);
    for (const id of pairs) {
      const { error } = await admin.from('pairs').delete().eq('id', id);
      if (error) failures.push(`Pair cleanup: ${error.code}`);
    }
    for (const id of users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) failures.push(`Account cleanup: ${error.code}`);
    }
    assert.deepEqual(failures, [], 'Synthetic fixture cleanup must succeed.');
  }
});
