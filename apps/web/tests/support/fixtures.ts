import { randomUUID } from 'node:crypto';
import { createEntryFixture, cleanupEntryFixture, entryFixtureClient } from './entry-fixtures';
import { populatePortalPair, localFixtureBackend } from '../../../../supabase/dev/seed-web-pair';
import { FIXED_IDS, type FixtureIds } from '../../../../supabase/dev/web-fixtures';
export type PortalFixture = FixtureIds & { annaEmail: string; marekEmail: string };
export const portalClient = async (email: string) => entryFixtureClient(email);
export async function createPortalPairFixture(): Promise<PortalFixture> {
  const entry = await createEntryFixture('active');
  try {
    const { admin } = localFixtureBackend();
    const partner = await admin.auth.admin.getUserById(entry.accountIds[1]);
    if (partner.error || !partner.data.user?.email) throw new Error('Partner missing');
    const fixed = Object.fromEntries(Object.keys(FIXED_IDS).map(key => [key, randomUUID()])) as typeof FIXED_IDS;
    const ids = await populatePortalPair(await portalClient(entry.email), await portalClient(partner.data.user.email), entry.pairId!, entry.accountIds[0], entry.accountIds[1], fixed, () => randomUUID());
    return { ...ids, annaEmail: entry.email, marekEmail: partner.data.user.email };
  } catch (error) { await cleanupPortalPairFixture({ annaId: entry.accountIds[0], marekId: entry.accountIds[1], pairId: entry.pairId! }); throw error; }
}
export async function cleanupPortalPairFixture(ids: Pick<FixtureIds, 'annaId'|'marekId'|'pairId'>) {
  const { admin } = localFixtureBackend();
  for (const id of [ids.annaId, ids.marekId]) {
    const user = await admin.auth.admin.getUserById(id);
    if (user.error || !user.data.user?.email?.match(/^entry-[0-9a-f-]+@example\.test$/)) throw new Error('Cleanup requires disposable fixture accounts.');
  }
  const members = await admin.from('pair_members').select('user_id').eq('pair_id', ids.pairId);
  if (members.error || members.data.length !== 2 || members.data.some(member => ![ids.annaId, ids.marekId].includes(member.user_id))) throw new Error('Cleanup pair identity changed.');
  const photos = await admin.from('memory_photos').select('full_path,thumb_path').eq('pair_id', ids.pairId);
  if (photos.error) throw photos.error;
  if (photos.data.length) {
    const deletion = await admin.storage.from('memory-photos').remove(photos.data.flatMap(photo => [photo.full_path, photo.thumb_path]));
    if (deletion.error) throw deletion.error;
  }
  for (const table of ['memory_photos', 'memories', 'messages', 'reminders', 'tasks', 'date_ideas', 'events']) {
    const result = await admin.from(table).delete().eq('pair_id', ids.pairId);
    if (result.error) throw result.error;
  }
  const lists = await admin.from('task_lists').delete().eq('pair_id', ids.pairId).eq('is_general', false);
  if (lists.error) throw lists.error;
  await cleanupEntryFixture({ accountIds: [ids.annaId, ids.marekId], pairId: ids.pairId, email: '', inviteToken: null });
}
