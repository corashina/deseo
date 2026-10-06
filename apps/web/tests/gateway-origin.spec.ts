import { test, expect } from '@playwright/test';
import { createEntryFixture, cleanupEntryFixture, entryFixtureClient } from './support/entry-fixtures';

// Importance 100: real gateway requests must reject foreign origins before authenticated action work.
test('gateway rejects foreign origins for a valid actor and permits native requests', async () => {
  const fixture = await createEntryFixture('unpaired');
  try {
    const client = await entryFixtureClient(fixture.email);
    const session = await client.auth.getSession();
    expect(session.error).toBeNull();
    const token = session.data.session!.access_token;
    const mailbox = async () => {
      const response = await fetch('http://127.0.0.1:55724/api/v1/search?query=' + encodeURIComponent('to:' + fixture.email));
      expect(response.ok).toBe(true);
      return (await response.json()).messages?.length ?? 0;
    };
    const before = await mailbox();
    for (const origin of ['https://unknown.example.test', 'null']) {
      const response = await fetch('http://127.0.0.1:55721/functions/v1/verify-sensitive-action', {
        method: 'POST', headers: { Origin: origin, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end_pair' }),
      });
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ ok: false, error: { code: 'FORBIDDEN' } });
      expect(await mailbox()).toBe(before);
    }
    const native = await fetch('http://127.0.0.1:55721/functions/v1/verify-sensitive-action', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end_pair' }),
    });
    expect(native.status).toBe(200);
    expect(native.headers.get('cache-control')).toBe('no-store');
    expect((await native.json()).ok).toBe(true);
    await expect.poll(mailbox).toBe(before + 1);
  } finally {
    await cleanupEntryFixture(fixture);
  }
});
