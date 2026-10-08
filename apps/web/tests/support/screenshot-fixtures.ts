import { randomUUID } from 'node:crypto';
import { admin, createEntryFixture, fixtureRpc, entryFixtureClient } from './entry-fixtures';
import { createPortalPairFixture } from './fixtures';
import { FIXED_IDS, ANNA_EMAIL, MAREK_EMAIL } from '../../../../supabase/dev/web-fixtures';
import { readLocalCode } from './local-auth';
import { createScreenshotJournal } from './screenshot-journal';

export async function createScreenshotFixtures(ledgerFile: string) {
  const journal = await createScreenshotJournal(ledgerFile);
  try {
    const exceptional = await createPortalPairFixture(journal.portal);
    const empty = await createEntryFixture('active', fixture => journal.entry('empty', fixture));
    const unpaired = await createEntryFixture('unpaired', fixture => journal.entry('unpaired', fixture));
    const pending = await createEntryFixture('pending', fixture => journal.entry('pending', fixture));
    const inviter = await createEntryFixture('pending', fixture => journal.entry('inviter', fixture));
    const ended = await createEntryFixture('active', fixture => journal.entry('ended', fixture));
    const logout = await createEntryFixture('unpaired', fixture => journal.entry('logout', fixture));
    const freshEmail = `entry-${randomUUID()}@example.test`;
    const fresh = await admin.auth.admin.createUser({ email: freshEmail, email_confirm: true });
    if (fresh.error || !fresh.data.user) throw new Error('New profile fixture failed');
    await journal.fresh(fresh.data.user.id);
    const owner = entryFixtureClient(exceptional.annaEmail);
    const preferences = await fixtureRpc(owner, 'get_notification_preferences');
    const { version: preferenceVersion, ...preferenceInput } = preferences;
    await fixtureRpc(owner, 'save_notification_preferences', { p_input: { ...preferenceInput, messageAlerts: true }, p_expected_version: preferenceVersion });
    await fixtureRpc(entryFixtureClient(exceptional.marekEmail), 'send_message', { p_pair_id: exceptional.pairId, p_client_id: randomUUID(), p_body: 'Your plan is ready for tonight.' });
    const emptyList = await fixtureRpc(owner, 'create_list', { p_pair_id: exceptional.pairId, p_name: 'Weekend plans', p_command_id: randomUUID() });
    const plannedId = randomUUID(); const archivedId = randomUUID();
    for (const [id, title] of [[plannedId, 'Gallery visit'], [archivedId, 'Summer picnic']]) {
      await fixtureRpc(owner, 'create_date_idea', { p_input: { id, pair_id: exceptional.pairId, title, note: 'Time for us.', link: null }, p_command_id: randomUUID() });
    }
    await fixtureRpc(owner, 'plan_date_idea', { p_idea_id: plannedId, p_expected_version: 1, p_command_id: randomUUID(),
      p_event_input: { id: randomUUID(), pair_id: exceptional.pairId, title: 'Gallery visit', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', repeat: 'none', start_date: '2026-10-11', end_date_exclusive: '2026-10-12' } });
    await fixtureRpc(owner, 'archive_date_idea', { p_idea_id: archivedId, p_expected_version: 1, p_command_id: randomUUID() });
    const endingPartner = await admin.auth.admin.getUserById(ended.accountIds[1]);
    if (!endingPartner.data.user?.email) throw new Error('Ended fixture partner missing');
    const endOwner = entryFixtureClient(endingPartner.data.user.email);
    const sent = await endOwner.functions.invoke('verify-sensitive-action', { body: { action: 'end_pair' } });
    if (sent.error || !sent.data.ok) throw new Error('End fixture verification request failed');
    const verified = await endOwner.functions.invoke('verify-sensitive-action', { body: { action: 'end_pair', code: await readLocalCode(endingPartner.data.user.email) } });
    if (verified.error || !verified.data.ok) throw new Error('End fixture verification failed');
    await fixtureRpc(endOwner, 'end_pair', { p_pair_id: ended.pairId, p_verification_proof: verified.data.data.proof, p_command_id: randomUUID() });
    await fixtureRpc(entryFixtureClient(logout.email), 'register_device', { p_input: { installationId: randomUUID(), platform: 'ios', permission: 'denied', token: null } });
    const membership = await admin.from('pair_members').select('pair_id').eq('user_id', FIXED_IDS.annaId).is('left_at', null).single();
    if (membership.error) throw new Error('Named Anna pair missing');
    const namedPair = await admin.from('pairs').select('state').eq('id', membership.data.pair_id).single();
    if (namedPair.data?.state !== 'active') throw new Error('Named pair must remain active');
    await journal.namedPair(membership.data.pair_id);
    const lists = await admin.from('task_lists').select('id,is_general,name').eq('pair_id', membership.data.pair_id);
    if (lists.error) throw new Error('Named lists missing');
    const named = { ...FIXED_IDS, pairId: membership.data.pair_id, annaEmail: ANNA_EMAIL, marekEmail: MAREK_EMAIL,
      generalListId: lists.data.find(row => row.is_general)!.id, groceriesListId: lists.data.find(row => row.name === 'Groceries')!.id };
    const message = await admin.from('messages').select('id').eq('pair_id', named.pairId).eq('author_id', named.annaId).limit(1).single();
    if (message.error) throw new Error('Named message missing');
    return { named: { ...named, annaMessageId: message.data.id }, exceptional, empty, unpaired, pending, inviter, ended, logout, freshEmail,
      freshId: fresh.data.user.id, plannedId, archivedId, emptyListId: emptyList.id, verificationIds: journal.verificationIds,
      recordVerificationAccount: journal.verification, cleanup: journal.cleanup,
    };
  } catch (error) {
    try { await journal.cleanup(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Screenshot setup and cleanup failed. Ownership remains in the journal.'); }
    throw error;
  }
}

export async function createScreenshotCaptureFixtures(ledgerFile: string, normalLedgerFile: string) {
  const fixtures = await createScreenshotFixtures(ledgerFile);
  try {
    const normalJournal = await createScreenshotJournal(normalLedgerFile);
    return { fixtures, normalJournal };
  } catch (error) {
    try { await fixtures.cleanup(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Secondary journal setup and screenshot cleanup failed. Ownership remains in the main journal.'); }
    throw error;
  }
}
