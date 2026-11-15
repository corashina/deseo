import { randomUUID } from 'node:crypto';
import { test, expect, admin, rpc } from './support/test';
import { loginWithLocalEmailCode } from './support/local-auth';

// Importance 100: two people can pair through the screens, and a third account cannot read their data.
test('A invites, B joins, and C cannot read the pair', async ({ page, browser, account, pair, signIn }) => {
  const a = await account(null);
  const b = await account('Marek');
  const contexts = [await browser.newContext(), await browser.newContext()];
  try {
    await loginWithLocalEmailCode(page, a.email);
    await expect(page).toHaveURL(/\/profile\/setup$/);
    await page.getByLabel('Your name').fill('Anna');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByRole('button', { name: 'Create pair', exact: true }).click();
    await page.getByRole('link', { name: 'Get invitation code' }).click();
    await page.getByRole('button', { name: 'Create invitation code', exact: true }).click();
    const token = await page.locator('.invite-code').innerText();

    const partner = await contexts[0].newPage();
    await signIn(partner, b);
    await partner.goto('/invite?token=' + encodeURIComponent(token));
    await partner.getByRole('button', { name: 'Join pair', exact: true }).click();
    await expect(partner.getByRole('heading', { name: 'Anna + Marek' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Anna + Marek' })).toBeVisible();

    const member = await admin.from('pair_members').select('pair_id').eq('user_id', a.id).is('left_at', null).single();
    if (member.error) throw member.error;
    const eventId = randomUUID();
    await rpc(a.client, 'create_event', {
      p_input: { id: eventId, pair_id: member.data.pair_id, title: 'Picnic by the river', owner: 'together',
        visibility: 'shared', timezone: 'Europe/Warsaw', repeat: 'none', starts_at: '2026-12-05T11:00:00Z', ends_at: '2026-12-05T13:00:00Z' },
      p_command_id: randomUUID(),
    });
    await partner.goto('/events/' + eventId);
    await expect(partner.getByRole('heading', { name: 'Picnic by the river', exact: true })).toBeVisible();

    const other = await pair(['Cara', 'Dan']);
    const outsider = await contexts[1].newPage();
    await signIn(outsider, other.a);
    await outsider.goto('/events/' + eventId);
    await expect(outsider.getByRole('link', { name: 'Return to calendar' })).toBeVisible();
    await expect(outsider.locator('body')).not.toContainText('Picnic by the river');
    expect((await other.a.client.from('events').select('id').eq('id', eventId)).data).toEqual([]);
  } finally { for (const context of contexts) await context.close(); }
});
