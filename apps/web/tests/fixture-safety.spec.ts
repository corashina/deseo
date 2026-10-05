import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { assertLoopback, seedWebPair } from '../../../supabase/dev/seed-web-pair';
import { createEntryFixture, cleanupEntryFixture, admin, entryFixtureClient, fixtureRpc } from './support/entry-fixtures';
// Importance: fixture safety 100.
test('fixtures reject hosted backends and preserve unrelated data on repeat runs', async () => {
  expect(() => assertLoopback('https://project.supabase.co')).toThrow();
  expect(() => assertLoopback('http://127.0.0.1.evil.test:55721')).toThrow();
  const unrelated = await createEntryFixture('active');
  const client = entryFixtureClient(unrelated.email);
  const sentinelId = randomUUID();
  await fixtureRpc(client, 'create_event', { p_input: { id: sentinelId, pair_id: unrelated.pairId, title: 'Unrelated event', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', start_date: '2026-10-05', end_date_exclusive: '2026-10-06', repeat: 'none' }, p_command_id: randomUUID() });
  try {
    const contentBefore = await client.from('events').select('*').eq('id', sentinelId).single();
    const before = await admin.from('pairs').select('*').eq('id', unrelated.pairId!).single();
    const first = await seedWebPair(); const second = await seedWebPair();
    expect(second).toEqual(first);
    const after = await admin.from('pairs').select('*').eq('id', unrelated.pairId!).single();
    expect(after.data).toEqual(before.data);
    const contentAfter = await client.from('events').select('*').eq('id', sentinelId).single();
    expect(contentAfter.data).toEqual(contentBefore.data);
  } finally { await fixtureRpc(client, 'delete_event', { p_event_id: sentinelId, p_expected_version: 1, p_command_id: randomUUID() }); await cleanupEntryFixture(unrelated); }
});
