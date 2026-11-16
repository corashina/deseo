import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { localStatus } from '../../../../supabase/dev/local-status.ts';

const status = localStatus();
export const localUrl = status.API_URL;
export const publicKey = status.PUBLISHABLE_KEY;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin = createClient(localUrl, status.SERVICE_ROLE_KEY, noSession);
// supabase-js uses this key for the default browser storage.
const storageKey = `sb-${new URL(localUrl).hostname.split('.')[0]}-auth-token`;
const disposable = /^entry-[0-9a-f-]+@example\.test$/;

export type Account = { id: string; email: string; password: string; client: SupabaseClient };
export type Pair = { id: string; a: Account; b: Account; inviteToken: string };
export type PendingPair = { id: string; a: Account; inviteToken: string };

export async function rpc<T = Record<string, string>>(client: SupabaseClient, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  if (!data.ok) throw new Error(`${name}: ${data.error.code}`);
  return data.data;
}

// Each password sign-in makes a separate session, as a separate device would.
export async function passwordSession(account: Account): Promise<SupabaseClient> {
  const client = createClient(localUrl, publicKey, noSession);
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw error;
  return client;
}

// A two-hour shared event with fixed dates. Tests override fields as needed.
export async function createEvent(account: Account, pairId: string, input: Record<string, unknown>): Promise<string> {
  const id = randomUUID();
  await rpc(account.client, 'create_event', {
    p_input: { id, pair_id: pairId, owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', repeat: 'none',
      starts_at: '2026-12-05T11:00:00Z', ends_at: '2026-12-05T13:00:00Z', ...input },
    p_command_id: randomUUID(),
  });
  return id;
}

export async function createList(account: Account, pairId: string, name: string): Promise<string> {
  const list = await rpc(account.client, 'create_list', { p_pair_id: pairId, p_name: name, p_command_id: randomUUID() });
  return list.id;
}

// Without a list, the task goes to the General list of the pair.
export async function createTask(account: Account, pairId: string, title: string, listId?: string): Promise<string> {
  const general = await admin.from('task_lists').select('id').eq('pair_id', pairId).eq('is_general', true).single();
  if (general.error) throw general.error;
  const id = randomUUID();
  await rpc(account.client, 'create_task', {
    p_input: { id, pair_id: pairId, list_id: listId ?? general.data.id, title, assignee_id: null, due_date: null },
    p_command_id: randomUUID(),
  });
  return id;
}

export async function sendMessage(account: Account, pairId: string, body: string): Promise<string> {
  const message = await rpc(account.client, 'send_message', { p_pair_id: pairId, p_client_id: randomUUID(), p_body: body });
  return message.id;
}

export async function pinMessage(account: Account, messageId: string) {
  await rpc(account.client, 'pin_message', { p_message_id: messageId, p_command_id: randomUUID() });
}

export async function createIdea(account: Account, pairId: string, title: string): Promise<string> {
  const id = randomUUID();
  await rpc(account.client, 'create_date_idea', { p_input: { id, pair_id: pairId, title, note: null, link: null }, p_command_id: randomUUID() });
  return id;
}

// The test photo is 96 x 64 pixels, so it is valid as both the full photo and the thumbnail.
const photo = readFileSync(new URL('./photos/lake.jpg', import.meta.url));

// Publish a memory with one photo through the same steps as the web: reserve, upload, finalize.
export async function createMemory(account: Account, pairId: string, caption: string): Promise<{ id: string; path: string }> {
  const id = randomUUID();
  const photoId = randomUUID();
  const size = photo.byteLength;
  await rpc(account.client, 'reserve_memory', {
    p_input: { id, pairId, memoryDate: '2026-11-01', caption,
      photos: [{ id: photoId, fullBytes: size, thumbBytes: size, width: 96, height: 64, thumbWidth: 96, thumbHeight: 64 }] },
    p_command_id: randomUUID(),
  });
  const claims = await account.client.auth.getClaims();
  if (claims.error) throw claims.error;
  const sessionId = claims.data?.claims.session_id;
  const path = `${pairId}/${id}/${photoId}/`;
  for (const variant of ['full', 'thumb']) {
    const { error } = await account.client.storage.from('memory-photos').upload(path + variant + '.jpg',
      new Blob([photo], { type: 'image/jpeg' }), { contentType: 'image/jpeg', upsert: false, metadata: { sessionId } });
    if (error) throw error;
  }
  const { data, error } = await account.client.functions.invoke('finalize-memory', { body: { memoryId: id, commandId: randomUUID() }, method: 'POST' });
  if (error) throw error;
  if (!data.ok) throw new Error('finalize-memory: ' + data.error.code);
  return { id, path: path + 'full.jpg' };
}

// end_pair needs a recent sign-in. Fixture accounts sign in with a password when the test starts.
export async function endPair(account: Account, pairId: string) {
  await rpc(account.client, 'end_pair', { p_pair_id: pairId, p_command_id: randomUUID() });
}

async function createAccount(created: Account[], name: string | null): Promise<Account> {
  const email = `entry-${randomUUID()}@example.test`;
  const password = randomUUID() + randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const account: Account = { id: data.user.id, email, password, client: createClient(localUrl, publicKey, noSession) };
  created.push(account);
  account.client = await passwordSession(account);
  if (name !== null) await rpc(account.client, 'save_profile', { p_display_name: name, p_timezone: 'Europe/Warsaw', p_locale: 'en' });
  return account;
}

async function createPendingPair(a: Account): Promise<PendingPair> {
  const { pairId } = await rpc(a.client, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: randomUUID() });
  const { token } = await rpc(a.client, 'create_invite', { p_pair_id: pairId, p_command_id: randomUUID() });
  return { id: pairId, a, inviteToken: token };
}

// Pair two existing accounts. Neither may be in an active or pending pair.
export async function formPair(a: Account, b: Account): Promise<Pair> {
  const pending = await createPendingPair(a);
  await rpc(b.client, 'accept_invite', { p_token: pending.inviteToken, p_command_id: randomUUID() });
  return { ...pending, b };
}

// Delete only disposable accounts and the pairs that hold no other account.
async function cleanup(created: Account[]) {
  const ids = created.map(account => account.id);
  if (ids.length === 0) return;
  for (const account of created) {
    if (!disposable.test(account.email)) throw new Error('Cleanup requires disposable fixture accounts.');
    await account.client.auth.signOut({ scope: 'local' });
  }
  const own = await admin.from('pair_members').select('pair_id').in('user_id', ids);
  if (own.error) throw own.error;
  const pairIds = [...new Set(own.data.map(row => row.pair_id))];
  if (pairIds.length > 0) {
    const members = await admin.from('pair_members').select('user_id').in('pair_id', pairIds);
    if (members.error) throw members.error;
    if (members.data.some(row => !ids.includes(row.user_id))) throw new Error('Cleanup found a pair member it did not create.');
    // Photo rows refer to pair members, so remove the photos and their files first.
    const photos = await admin.from('memory_photos').select('full_path, thumb_path').in('pair_id', pairIds);
    if (photos.error) throw photos.error;
    const paths = photos.data.flatMap(photo => [photo.full_path, photo.thumb_path]);
    if (paths.length > 0) {
      const removed = await admin.storage.from('memory-photos').remove(paths);
      if (removed.error) throw removed.error;
      const { error } = await admin.from('memory_photos').delete().in('pair_id', pairIds);
      if (error) throw error;
    }
    const { error } = await admin.from('pairs').delete().in('id', pairIds);
    if (error) throw error;
  }
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}

export type FilledPair = Pair & { ids: { event: string; list: string; task: string; idea: string; memory: string } };

// Long text for layout checks. Names use the 40-character limit. Titles and other text use 80 characters or more.
const filled = {
  names: ['Anna Maria Kowalska-Wiśniewska z Gdańska', 'Marek Aleksander Zieliński-Nowakowski Jr'] as [string, string],
  events: [
    'Dinner at the small Italian restaurant near the old town square with the whole family',
    'Weekend trip to the mountains with a long drive, two hotel nights, and a guided hike',
    'Concert in the park followed by a late walk along the river and coffee before going home',
  ],
  location: 'Restauracja pod Starym Zegarem, ulica Długa 45, Gdańsk, second floor next to the window',
  list: 'Apartment move and paperwork before May',
  tasks: [
    'Call the landlord about the deposit, the meter readings, and the date for the final apartment check',
    'Pack the kitchen boxes, label each one with the room name, and keep the fragile glasses separate',
    'Buy train tickets for the family visit and reserve seats together in the quiet carriage both ways',
  ],
  idea: 'Take a cooking class together and learn to make fresh pasta, a simple sauce, and a dessert',
  note: 'Remember to bring the umbrella, the spare keys, and the printed tickets for the evening concert',
  memories: [
    'Our first morning at the lake, with fog over the water and coffee from the small wooden kiosk by the pier',
    'The forest walk after the rain, when we found the hidden path to the viewpoint and stayed until sunset',
  ],
};

// Hours from now, so Today and the current calendar view show the events.
const hoursFromNow = (hours: number) => new Date(Math.ceil(Date.now() / 3_600_000 + hours) * 3_600_000).toISOString();

async function createFilledPair(created: Account[]): Promise<FilledPair> {
  const pair = await formPair(await createAccount(created, filled.names[0]), await createAccount(created, filled.names[1]));
  const { id, a, b } = pair;
  const events = [];
  for (const [index, title] of filled.events.entries()) {
    events.push(await createEvent(index % 2 ? b : a, id, { title, location: filled.location,
      starts_at: hoursFromNow(24 * (index + 1)), ends_at: hoursFromNow(24 * (index + 1) + 2) }));
  }
  const list = await createList(a, id, filled.list);
  const tasks = [];
  for (const [index, title] of filled.tasks.entries()) tasks.push(await createTask(index % 2 ? b : a, id, title, index ? list : undefined));
  const idea = await createIdea(b, id, filled.idea);
  for (let index = 1; index <= 19; index++) {
    const body = index % 5 ? 'Message ' + index + ': see you after work at the station, then we can walk home together through the park.'
      : 'Message ' + index + ': ' + 'a longer message that wraps over several lines in the conversation view. '.repeat(4).trim();
    await sendMessage(index % 2 ? a : b, id, body);
  }
  // A person can pin only their own message.
  await pinMessage(a, await sendMessage(a, id, filled.note));
  const memories = [];
  for (const [index, caption] of filled.memories.entries()) memories.push(await createMemory(index ? b : a, id, caption));
  return { ...pair, ids: { event: events[0], list, task: tasks[0], idea, memory: memories[0].id } };
}

export type Fixtures = {
  account: (name?: string | null) => Promise<Account>;
  pendingPair: (name?: string) => Promise<PendingPair>;
  pair: (names?: [string, string]) => Promise<Pair>;
  signIn: (page: Page, account: Account) => Promise<void>;
};

// filledPair is one pair per worker with content in each area. Tests read it and never change it.
export const test = base.extend<Fixtures & { created: Account[] }, { filledPair: FilledPair }>({
  created: async ({}, use) => {
    const created: Account[] = [];
    await use(created);
    await cleanup(created);
  },
  account: async ({ created }, use) => {
    await use(name => createAccount(created, name === undefined ? 'Anna' : name));
  },
  pendingPair: async ({ created }, use) => {
    await use(async name => createPendingPair(await createAccount(created, name ?? 'Anna')));
  },
  pair: async ({ created }, use) => {
    await use(async ([first, second] = ['Anna', 'Marek']) => formPair(await createAccount(created, first), await createAccount(created, second)));
  },
  filledPair: [async ({}, use) => {
    const created: Account[] = [];
    try { await use(await createFilledPair(created)); } finally { await cleanup(created); }
  }, { scope: 'worker' }],
  signIn: async ({}, use) => {
    await use(async (page, account) => {
      const client = await passwordSession(account);
      const { data } = await client.auth.getSession();
      // Write the session once per tab. A later sign-out then stays signed out after reload.
      await page.addInitScript(([key, value]) => {
        if (sessionStorage.getItem('e2e-session')) return;
        localStorage.setItem(key, value);
        sessionStorage.setItem('e2e-session', '1');
      }, [storageKey, JSON.stringify(data.session)] as const);
    });
  },
});

export { expect };
