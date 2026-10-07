import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Credentials remain in the test process and the ignored local status file.
const config = JSON.parse(readFileSync(new URL('../../../../.superpowers/web-backend/status.local.json', import.meta.url), 'utf8'));
export const localUrl: string = config.API_URL;
if (new URL(localUrl).hostname !== '127.0.0.1' || new URL(localUrl).port !== '55721') throw new Error('Use the disposable deseo-web stack.');
export const admin = createClient(localUrl, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const publicKey: string = config.PUBLISHABLE_KEY;
const fixtureClients = new Map<string, SupabaseClient>();
export function entryFixtureClient(email: string): SupabaseClient {
  const client = fixtureClients.get(email);
  if (!client) throw new Error('Disposable fixture session is missing.');
  return client;
}
export type EntryFixture = { accountIds: string[]; email: string; pairId: string | null; inviteToken: string | null };
export async function createEntryFixture(state: 'unpaired' | 'pending' | 'active', recordOwnership?: (fixture: EntryFixture) => Promise<void>): Promise<EntryFixture> {
  const fixture: EntryFixture = { accountIds: [], email: '', pairId: null, inviteToken: null };
  async function account(name: string) {
    const email = `entry-${randomUUID()}@example.test`;
    const password = randomUUID() + randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error('Account missing');
    fixture.accountIds.push(data.user.id);
    await recordOwnership?.(fixture);
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
    if (state !== 'unpaired') {
      fixture.pairId = (await fixtureRpc(owner.client, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: randomUUID() })).pairId;
      await recordOwnership?.(fixture);
      fixture.inviteToken = (await fixtureRpc(owner.client, 'create_invite', { p_pair_id: fixture.pairId, p_command_id: randomUUID() })).token;
      if (state === 'active') {
        const partner = await account('Marek');
        await fixtureRpc(partner.client, 'accept_invite', { p_token: fixture.inviteToken, p_command_id: randomUUID() });
      }
    }
    return fixture;
  } catch (error) { if (!recordOwnership) await cleanupEntryFixture(fixture); throw error; }
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
export function expireEntryCode(accountId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(accountId)) throw new Error('Invalid fixture ID');
  const docker = join(process.env.LOCALAPPDATA!, 'Programs/DockerDesktop/resources/bin/docker.exe');
  execFileSync(docker, ['exec', 'supabase_db_deseo', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
    `update auth.users set confirmation_sent_at=now()-interval '2 hours', recovery_sent_at=now()-interval '2 hours' where id='${accountId}' and email like 'entry-%@example.test'`], { stdio: 'pipe' });
}
