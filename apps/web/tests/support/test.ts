import { randomUUID } from 'node:crypto';
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

async function createPendingPair(created: Account[], name: string): Promise<PendingPair> {
  const a = await createAccount(created, name);
  const { pairId } = await rpc(a.client, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: randomUUID() });
  const { token } = await rpc(a.client, 'create_invite', { p_pair_id: pairId, p_command_id: randomUUID() });
  return { id: pairId, a, inviteToken: token };
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

type Fixtures = {
  account: (name?: string | null) => Promise<Account>;
  pendingPair: (name?: string) => Promise<PendingPair>;
  pair: (names?: [string, string]) => Promise<Pair>;
  signIn: (page: Page, account: Account) => Promise<void>;
};

export const test = base.extend<Fixtures & { created: Account[] }>({
  created: async ({}, use) => {
    const created: Account[] = [];
    await use(created);
    await cleanup(created);
  },
  account: async ({ created }, use) => {
    await use(name => createAccount(created, name === undefined ? 'Anna' : name));
  },
  pendingPair: async ({ created }, use) => {
    await use(name => createPendingPair(created, name ?? 'Anna'));
  },
  pair: async ({ created }, use) => {
    await use(async ([first, second] = ['Anna', 'Marek']) => {
      const pending = await createPendingPair(created, first);
      const b = await createAccount(created, second);
      await rpc(b.client, 'accept_invite', { p_token: pending.inviteToken, p_command_id: randomUUID() });
      return { ...pending, b };
    });
  },
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
