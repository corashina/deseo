import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { localStatus } from '../../../../supabase/dev/local-status.ts';

const config = localStatus();
export const localUrl: string = config.API_URL;
export const admin = createClient(localUrl, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const publicKey: string = config.PUBLISHABLE_KEY;
const fixtureClients = new Map<string, SupabaseClient>();
export function entryFixtureClient(email: string): SupabaseClient {
  const client = fixtureClients.get(email);
  if (!client) throw new Error('Disposable fixture session is missing.');
  return client;
}
export type EntryFixture = { accountIds: string[]; email: string; pairId: string | null; inviteToken: string | null };
export async function createEntryFixture(state: 'pending' | 'active'): Promise<EntryFixture> {
  const fixture: EntryFixture = { accountIds: [], email: '', pairId: null, inviteToken: null };
  async function account(name: string) {
    const email = `entry-${randomUUID()}@example.test`;
    const password = randomUUID() + randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error('Account missing');
    fixture.accountIds.push(data.user.id);
    const client = createClient(localUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    await fixtureRpc(client, 'save_profile', { p_display_name: name, p_timezone: 'Europe/Warsaw', p_locale: 'en' });
    fixtureClients.set(email, client);
    return { client, email };
  }
  try {
    const owner = await account('Anna');
    fixture.email = owner.email;
    fixture.pairId = (await fixtureRpc(owner.client, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: randomUUID() })).pairId;
    fixture.inviteToken = (await fixtureRpc(owner.client, 'create_invite', { p_pair_id: fixture.pairId, p_command_id: randomUUID() })).token;
    if (state === 'active') {
      const partner = await account('Marek');
      await fixtureRpc(partner.client, 'accept_invite', { p_token: fixture.inviteToken, p_command_id: randomUUID() });
    }
    return fixture;
  } catch (error) { await cleanupEntryFixture(fixture); throw error; }
}
export async function fixtureRpc(client: SupabaseClient, name: string, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error || !data.ok) throw error ?? new Error(data.error.code);
  return data.data;
}
export async function cleanupEntryFixture(fixture: EntryFixture) {
  if (fixture.pairId) {
    const { error } = await admin.from('pairs').delete().eq('id', fixture.pairId);
    if (error) throw error;
  }
  await cleanupEntryFixtureSessions(fixture.accountIds);
  for (const id of fixture.accountIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}
export async function cleanupEntryFixtureSessions(accountIds: readonly string[]) {
  for (const [email, client] of fixtureClients) {
    const session = await client.auth.getSession();
    if (accountIds.includes(session.data.session?.user.id ?? '')) { await client.auth.signOut({ scope: 'local' }); fixtureClients.delete(email); }
  }
}
