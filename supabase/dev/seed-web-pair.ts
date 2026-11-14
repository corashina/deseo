import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FIXED_IDS, fixtureContentCommandId, ANNA_EMAIL, MAREK_EMAIL, type FixtureIds } from './web-fixtures.ts';
export function assertLoopback(url: string) {
  const target = new URL(url);
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.username || target.password) throw new Error('Fixtures require a loopback backend.');
}
export function localFixtureBackend() {
  const config = JSON.parse(readFileSync(new URL('../../.superpowers/backend/status.local.json', import.meta.url), 'utf8'));
  assertLoopback(config.API_URL);
  if (new URL(config.API_URL).port !== '55721') throw new Error('Use the dedicated deseo backend.');
  return { url: config.API_URL as string, publicKey: config.PUBLISHABLE_KEY as string,
    admin: createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
export async function fixtureCommand(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const response = await client.rpc(name, args);
  if (response.error || !response.data?.ok) throw new Error(`${name}: ${response.error?.message ?? response.data?.error?.code}`);
  return response.data.data;
}
export async function localAccountSession(email: string) {
  const { admin, url, publicKey } = localFixtureBackend();
  const link = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (link.error) throw link.error;
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'recovery' });
  if (login.error) throw login.error;
  return client;
}
async function ensureAccount(email: string, id: string, name: string) {
  const { admin } = localFixtureBackend();
  const existing = await admin.auth.admin.getUserById(id);
  if (existing.data.user && existing.data.user.email !== email) throw new Error('Fixture account ID belongs to another user.');
  if (!existing.data.user) {
    const result = await admin.auth.admin.createUser({ id, email, email_confirm: true });
    if (result.error) throw result.error;
  }
  const client = await localAccountSession(email);
  const profile = await client.from('profiles').select('user_id').eq('user_id', id).maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data) await fixtureCommand(client, 'save_profile', { p_display_name: name, p_timezone: 'Europe/Warsaw', p_locale: 'en' });
  return client;
}
export async function populatePortalPair(anna: SupabaseClient, marek: SupabaseClient, pairId: string, annaId: string, marekId: string,
  fixed: typeof FIXED_IDS = FIXED_IDS, commandId = fixtureContentCommandId): Promise<FixtureIds> {
  async function event(id: string, title: string, owner: string, temporal: Record<string, unknown>, extra = {}) {
    const old = await anna.from('events').select('id').eq('id', id).maybeSingle();
    if (old.error) throw old.error;
    if (!old.data) await fixtureCommand(anna, 'create_event', { p_input: { id, pair_id: pairId, title, owner, visibility: 'shared', timezone: 'Europe/Warsaw', repeat: 'none', ...temporal, ...extra }, p_command_id: commandId(Number.parseInt(id.slice(-6), 16)) });
  }
  await event(fixed.sharedEventId, 'Dinner together', 'together', { starts_at: '2026-10-05T17:00:00Z', ends_at: '2026-10-05T19:00:00Z' }, { location: 'Our kitchen', description: 'Pasta, candles, and time to talk.' });
  await event(fixed.walkEventId, 'Weekend walk', 'together', { start_date: '2026-10-10', end_date_exclusive: '2026-10-12' }, { location: 'Citadel Park' });
  await event(fixed.annaEventId, 'Anna’s yoga', 'a', { starts_at: '2026-10-06T16:00:00Z', ends_at: '2026-10-06T17:00:00Z' });
  await event(fixed.marekEventId, 'Marek’s cycling', 'b', { starts_at: '2026-10-07T15:00:00Z', ends_at: '2026-10-07T17:00:00Z' });
  await event(fixed.privateEventId, 'Anna’s private appointment', 'a', { starts_at: '2026-10-08T10:00:00Z', ends_at: '2026-10-08T11:00:00Z' }, { visibility: 'private' });
  await event(fixed.breakEventId, 'Autumn break', 'together', { start_date: '2026-09-30', end_date_exclusive: '2026-10-07' });
  await event(fixed.importantEventId, 'Our anniversary', 'together', { start_date: '2024-10-18', end_date_exclusive: '2024-10-19' }, { repeat: 'yearly', important_date: true });
  for (const [id, title, note] of [[fixed.ideaId, 'Pottery evening', 'Try a workshop together.'], [fixed.secondIdeaId, 'Picnic by the lake', 'Pack sandwiches and a blanket.']]) {
    const old = await anna.from('date_ideas').select('id').eq('id', id).maybeSingle();
    if (old.error) throw old.error;
    if (!old.data) await fixtureCommand(anna, 'create_date_idea', { p_input: { id, pair_id: pairId, title, note, link: null }, p_command_id: commandId(Number.parseInt(id.slice(-6),16)) });
  }
  const general = await anna.from('task_lists').select('id').eq('pair_id', pairId).eq('is_general', true).single();
  if (general.error) throw general.error;
  const lists = await anna.from('task_lists').select('id').eq('pair_id', pairId).eq('name', 'Groceries').maybeSingle();
  if (lists.error) throw lists.error;
  const groceries = lists.data ?? await fixtureCommand(anna, 'create_list', { p_pair_id: pairId, p_name: 'Groceries', p_command_id: commandId(103) });
  const tasks = [
    [fixed.taskId, 'Book the pottery workshop', general.data.id, annaId, '2026-10-09'],
    [fixed.unassignedTaskId, 'Choose a film', general.data.id, null, null],
    [fixed.completedTaskId, 'Buy pasta', groceries.id, marekId, null],
    [fixed.dueTaskId, 'Get fresh tomatoes', groceries.id, marekId, '2026-10-05'],
  ];
  for (const [id, title, list_id, assignee_id, due_date] of tasks) {
    const old = await anna.from('tasks').select('*').eq('id', id).maybeSingle();
    if (old.error) throw old.error;
    if (!old.data) {
      const task = await fixtureCommand(anna, 'create_task', { p_input: { id, pair_id: pairId, title, list_id, assignee_id, due_date }, p_command_id: commandId(Number.parseInt(String(id).slice(-6),16)) });
      if (id === fixed.completedTaskId) await fixtureCommand(marek, 'set_task_completed', { p_task_id: id, p_completed: true, p_expected_version: task.version, p_command_id: commandId(500) });
    }
  }
  const annaMessage = await fixtureCommand(anna, 'send_message', { p_pair_id: pairId, p_client_id: fixed.annaMessageClientId, p_body: 'I’m looking forward to dinner with you.' });
  const marekMessage = await fixtureCommand(marek, 'send_message', { p_pair_id: pairId, p_client_id: fixed.marekMessageClientId, p_body: 'I’ll bring flowers. See you tonight.' });
  if (!annaMessage.pinned_at) await fixtureCommand(anna, 'pin_message', { p_message_id: annaMessage.id, p_command_id: commandId(501) });
  if (!marekMessage.pinned_at) await fixtureCommand(marek, 'pin_message', { p_message_id: marekMessage.id, p_command_id: commandId(502) });
  for (const [client, id, photoId, asset, caption, memoryDate] of [
    [anna, fixed.memoryId, fixed.photoId, 'walk', 'Our quiet walk through the park.', '2026-10-03'],
    [marek, fixed.secondMemoryId, fixed.secondPhotoId, 'dinner', 'Dinner at home, with candles.', '2026-10-04'],
  ] as const) {
    const old = await client.from('memories').select('id,state').eq('id', id).maybeSingle();
    if (old.error) throw old.error;
    if (old.data?.state === 'published') continue;
    const bytes = readFileSync(new URL(`./assets/sample-${asset}.jpg`, import.meta.url));
    const memory = await fixtureCommand(client, 'reserve_memory', { p_input: { id, pairId, memoryDate, caption, photos: [{ id: photoId, fullBytes: bytes.length, thumbBytes: bytes.length, width: 512, height: 384, thumbWidth: 512, thumbHeight: 384 }] }, p_command_id: commandId(asset === 'walk' ? 503 : 504) });
    const claims = await client.auth.getClaims();
    if (claims.error) throw claims.error;
    for (const variant of ['full', 'thumb'] as const) {
      // Storage never overwrites. An existing file is an earlier run's upload.
      const upload = await client.storage.from('memory-photos').upload(memory.photos[0][`${variant}Path`], bytes, { contentType: 'image/jpeg', upsert: false, metadata: { sessionId: claims.data!.claims.session_id } });
      if (upload.error && (upload.error as { statusCode?: string }).statusCode !== '409') throw upload.error;
    }
    const response = await client.functions.invoke('finalize-memory', { body: { memoryId: id, commandId: commandId(asset === 'walk' ? 505 : 506) } });
    if (response.error || !response.data?.ok) throw new Error('Memory finalization failed: ' + (response.data?.error?.code ?? response.error?.message));
  }
  return { ...fixed, annaId, marekId, pairId, generalListId: general.data.id, groceriesListId: groceries.id, annaMessageId: annaMessage.id, marekMessageId: marekMessage.id };
}
export async function seedWebPair(): Promise<FixtureIds> {
  const anna = await ensureAccount(ANNA_EMAIL, FIXED_IDS.annaId, 'Anna');
  const marek = await ensureAccount(MAREK_EMAIL, FIXED_IDS.marekId, 'Marek');
  let context = await fixtureCommand(anna, 'get_pair_context', {});
  let pairId: string;
  if (context.status === 'active') {
    pairId = context.pairId;
    if (!context.members.some((member: { userId: string }) => member.userId === FIXED_IDS.marekId)) throw new Error('Named fixture belongs to another pair.');
  } else {
    if (context.status !== 'unpaired' && context.status !== 'pending') throw new Error('Named pair has ended. Do not overwrite it.');
    pairId = context.status === 'pending' ? context.pairId : (await fixtureCommand(anna, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: FIXED_IDS.createPairCommandId })).pairId;
    const invite = await fixtureCommand(anna, 'create_invite', { p_pair_id: pairId, p_command_id: FIXED_IDS.inviteCommandId });
    await fixtureCommand(marek, 'accept_invite', { p_token: invite.token, p_command_id: FIXED_IDS.acceptCommandId });
    context = await fixtureCommand(anna, 'get_pair_context', {});
    if (context.pairId !== pairId) throw new Error('Pair identity changed.');
  }
  return populatePortalPair(anna, marek, pairId, FIXED_IDS.annaId, FIXED_IDS.marekId);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedWebPair().then(ids => {
    console.log(JSON.stringify(ids, null, 2));
    console.log(`Sign in with ${ANNA_EMAIL} or ${MAREK_EMAIL}. Read the code at http://127.0.0.1:55724.`);
  }).catch(() => { console.error('Local fixture setup failed. Inspect the local backend and fixture contract.'); process.exitCode = 1; });
}
