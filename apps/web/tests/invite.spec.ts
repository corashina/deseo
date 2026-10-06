import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createEntryFixture, cleanupEntryFixture, entryFixtureClient, fixtureRpc } from './support/entry-fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';

// Importance 95: initial and replacement delivery must retain one command and never expose a revoked code.
for (const replacing of [false, true]) {
  test((replacing ? 'replacement' : 'initial') + ' invitation recovers an uncertain committed request after remount', async ({ page }) => {
    const fixture = await createEntryFixture('unpaired');
    const recipient = await createEntryFixture('unpaired');
    let release = () => {};
    try {
      const actor = entryFixtureClient(fixture.email);
      fixture.pairId = (await fixtureRpc(actor, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: randomUUID() })).pairId;
      await loginWithLocalEmailCode(page, fixture.email);
      await page.goto('/pair/invite');
      let oldToken = '';
      if (replacing) {
        await page.getByRole('button', { name: 'Create invitation code', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Copy invitation link', exact: true })).toBeVisible();
        oldToken = await page.locator('.invite-code').innerText();
        expect((await actor.rpc('preview_invite', { p_token: oldToken })).data?.ok === true).toBe(true);
      }
      const bodies: Array<{ p_pair_id: string; p_command_id: string }> = [];
      let committed = () => {}; let returned = () => {};
      const saved = new Promise<void>(resolve => { committed = resolve; });
      const done = new Promise<void>(resolve => { returned = resolve; });
      const acknowledgement = new Promise<void>(resolve => { release = resolve; });
      let replayWithoutToken = false;
      await page.route('**/rest/v1/rpc/create_invite', async route => {
        bodies.push(route.request().postDataJSON());
        const response = await route.fetch();
        const result = await response.json();
        expect(result.ok === true).toBe(true);
        if (bodies.length === 1) {
          committed(); await acknowledgement;
          await route.abort(); returned();
        } else {
          if (bodies.length === 2) replayWithoutToken = result.data.token === null && result.data.alreadyDelivered === true;
          await route.fulfill({ response });
        }
      });
      await page.getByRole('button', { name: replacing ? 'Replace invitation code' : 'Create invitation code', exact: true }).click();
      await saved;
      await expect(page.locator('.invite-code')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Copy invitation link', exact: true })).toHaveCount(0);
      if (replacing) expect((await actor.rpc('preview_invite', { p_token: oldToken })).data?.ok === false).toBe(true);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(page.getByRole('button', { name: 'Retry invitation code', exact: true })).toBeEnabled();
      await expect(page.getByText('Invitation delivery is unconfirmed. Retry the same request.', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Waiting for your partner', exact: true }).click();
      await page.getByRole('link', { name: 'Get invitation code', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Retry invitation code', exact: true })).toBeEnabled();
      await expect(page.locator('.invite-code')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Copy invitation link', exact: true })).toHaveCount(0);
      const captures = '../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures';
      await mkdir(captures, { recursive: true });
      await page.screenshot({ path: captures + '/invite-' + (replacing ? 'replacement' : 'initial') + '-uncertain-' + page.viewportSize()!.width + '.png', mask: [page.locator('.invite-code')] });
      release(); await done;
      await page.getByRole('button', { name: 'Retry invitation code', exact: true }).click();
      await expect(page.getByText('The code was already delivered. Create a new invitation code to replace it.', { exact: true })).toBeVisible();
      expect(replayWithoutToken).toBe(true);
      expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
      await expect(page.locator('.invite-code')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Copy invitation link', exact: true })).toHaveCount(0);
      await page.screenshot({ path: captures + '/invite-' + (replacing ? 'replacement' : 'initial') + '-receipt-' + page.viewportSize()!.width + '.png', mask: [page.locator('.invite-code')] });
      await page.getByRole('button', { name: 'Create invitation code', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Copy invitation link', exact: true })).toBeVisible();
      const nextToken = await page.locator('.invite-code').innerText();
      expect(bodies).toHaveLength(3);
      expect(bodies[2].p_command_id !== bodies[0].p_command_id).toBe(true);
      expect(bodies[2].p_pair_id).toBe(fixture.pairId);
      const accepted = await entryFixtureClient(recipient.email).rpc('accept_invite', { p_token: nextToken, p_command_id: randomUUID() });
      expect(accepted.data?.ok === true).toBe(true);
    } finally { release(); await cleanupEntryFixture(fixture); await cleanupEntryFixture(recipient); }
  });
}
