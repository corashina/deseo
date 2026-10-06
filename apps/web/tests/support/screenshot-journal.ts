import { readFile, writeFile } from 'node:fs/promises';
import { admin, cleanupEntryFixtureSessions, type EntryFixture } from './entry-fixtures';
import { cleanupPortalPairContent } from './fixtures';

type Ownership = { accountIds: string[]; pairId: string | null };
export type ScreenshotLedger = {
  portal: Ownership | null; portalContentStarted: boolean; portalContentRemoved: boolean;
  entries: Record<string, Ownership>; freshId: string | null; verificationIds: string[];
  namedPairId: string | null; removedPairIds: string[]; removedAccountIds: string[]; cleaned: boolean;
};
const owned = (fixture: EntryFixture): Ownership => ({ accountIds: [...fixture.accountIds], pairId: fixture.pairId });

async function dispose(ledger: ScreenshotLedger, save: () => Promise<void>) {
  ledger.cleaned = false;
  await save();
  const groups = [...(ledger.portal ? [ledger.portal] : []), ...Object.values(ledger.entries)];
  const accountIds = [...new Set([...groups.flatMap(group => group.accountIds), ...(ledger.freshId ? [ledger.freshId] : []), ...ledger.verificationIds])];
  // Check disposable identity before removing content or memberships.
  for (const id of accountIds) {
    const current = await admin.auth.admin.getUserById(id);
    if (current.error && current.error.code !== 'user_not_found') throw current.error;
    if (current.data.user && !/^entry-[0-9a-f-]+@example\.test$/.test(current.data.user.email ?? '')) throw new Error('Screenshot account ownership changed.');
  }
  if (ledger.portalContentStarted && !ledger.portalContentRemoved) {
    const portal = ledger.portal!;
    await cleanupPortalPairContent({ annaId: portal.accountIds[0], marekId: portal.accountIds[1], pairId: portal.pairId! });
    ledger.portalContentRemoved = true; await save();
  }
  for (const group of groups) {
    if (!group.pairId || ledger.removedPairIds.includes(group.pairId)) continue;
    const members = await admin.from('pair_members').select('user_id').eq('pair_id', group.pairId);
    const pair = await admin.from('pairs').select('id').eq('id', group.pairId).maybeSingle();
    if (members.error || pair.error) throw members.error ?? pair.error;
    if (pair.data && (!members.data.length || members.data.some(member => !group.accountIds.includes(member.user_id)))) {
      throw new Error('Screenshot pair ownership changed.');
    }
    const deletion = await admin.from('pairs').delete().eq('id', group.pairId);
    if (deletion.error) throw deletion.error;
    ledger.removedPairIds.push(group.pairId); await save();
  }
  await cleanupEntryFixtureSessions(accountIds);
  for (const id of accountIds) {
    if (ledger.removedAccountIds.includes(id)) continue;
    const current = await admin.auth.admin.getUserById(id);
    if (current.error && current.error.code !== 'user_not_found') throw current.error;
    if (current.data.user) {
      if (!/^entry-[0-9a-f-]+@example\.test$/.test(current.data.user.email ?? '')) throw new Error('Screenshot account ownership changed.');
      const deletion = await admin.auth.admin.deleteUser(id);
      if (deletion.error) throw deletion.error;
      const confirmed = await admin.auth.admin.getUserById(id);
      if (confirmed.error && confirmed.error.code !== 'user_not_found') throw confirmed.error;
      if (confirmed.data.user) throw new Error('Screenshot account remains after deletion.');
    }
    ledger.removedAccountIds.push(id); await save();
  }
  if (ledger.namedPairId) {
    const pair = await admin.from('pairs').select('state').eq('id', ledger.namedPairId).single();
    if (pair.error || pair.data.state !== 'active') throw new Error('Named pair changed during capture.');
  }
  ledger.cleaned = true; await save();
}

export async function createScreenshotJournal(file: string) {
  const ledger: ScreenshotLedger = { portal: null, portalContentStarted: false, portalContentRemoved: false, entries: {},
    freshId: null, verificationIds: [], namedPairId: null, removedPairIds: [], removedAccountIds: [], cleaned: false };
  const save = () => writeFile(file, JSON.stringify(ledger, null, 2) + '\n');
  await writeFile(file, JSON.stringify(ledger, null, 2) + '\n', { flag: 'wx' });
  return {
    verificationIds: ledger.verificationIds,
    async portal(fixture: EntryFixture, contentStarted = false) { ledger.portal = owned(fixture); ledger.portalContentStarted ||= contentStarted; await save(); },
    async entry(name: string, fixture: EntryFixture) { ledger.entries[name] = owned(fixture); await save(); },
    async fresh(id: string) { ledger.freshId = id; await save(); },
    async verification(id: string) { ledger.verificationIds.push(id); await save(); },
    async namedPair(id: string) { ledger.namedPairId = id; await save(); },
    cleanup: () => dispose(ledger, save),
  };
}

export async function cleanupScreenshotLedger(file: string) {
  const ledger: ScreenshotLedger = JSON.parse(await readFile(file, 'utf8'));
  await dispose(ledger, () => writeFile(file, JSON.stringify(ledger, null, 2) + '\n'));
}
