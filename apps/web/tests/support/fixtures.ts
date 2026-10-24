import { randomUUID } from 'node:crypto';
import { admin, createEntryFixture, cleanupEntryFixture, entryFixtureClient, fixtureRpc } from './entry-fixtures';

type PairOwner = { annaId: string; marekId: string; pairId: string };
type PortalFixture = PairOwner & { sharedEventId: string; annaEmail: string; marekEmail: string };

export const portalClient = async (email: string) => entryFixtureClient(email);

export async function createPortalPairFixture(): Promise<PortalFixture> {
  const entry = await createEntryFixture('active');
  try {
    const partner = await admin.auth.admin.getUserById(entry.accountIds[1]);
    if (partner.error || !partner.data.user?.email) throw new Error('Partner missing');
    const sharedEventId = randomUUID();
    await fixtureRpc(entryFixtureClient(entry.email), 'create_event', {
      p_input: { id: sharedEventId, pair_id: entry.pairId, title: 'Dinner together', owner: 'together',
        visibility: 'shared', timezone: 'Europe/Warsaw', repeat: 'none',
        starts_at: '2026-10-05T17:00:00Z', ends_at: '2026-10-05T19:00:00Z' },
      p_command_id: randomUUID(),
    });
    return { annaId: entry.accountIds[0], marekId: entry.accountIds[1], pairId: entry.pairId!,
      sharedEventId, annaEmail: entry.email, marekEmail: partner.data.user.email };
  } catch (error) { await cleanupEntryFixture(entry); throw error; }
}

export async function cleanupPortalPairFixture(ids: PairOwner) {
  for (const id of [ids.annaId, ids.marekId]) {
    const user = await admin.auth.admin.getUserById(id);
    if (user.error || !user.data.user?.email?.match(/^entry-[0-9a-f-]+@example\.test$/)) throw new Error('Cleanup requires disposable fixture accounts.');
  }
  const members = await admin.from('pair_members').select('user_id').eq('pair_id', ids.pairId);
  if (members.error || members.data.length !== 2 || members.data.some(member => ![ids.annaId, ids.marekId].includes(member.user_id))) throw new Error('Cleanup pair identity changed.');
  await cleanupEntryFixture({ accountIds: [ids.annaId, ids.marekId], pairId: ids.pairId, email: '', inviteToken: null });
}
