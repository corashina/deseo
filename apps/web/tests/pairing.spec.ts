import { test, expect, admin, createEvent, createIdea, createList, createMemory, createTask, endPair, formPair, pinMessage, sendMessage } from './support/test';
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
    await expect(partner).toHaveURL(/\/today$/);
    await expect(partner.locator('.topbar-label')).toHaveText('Anna + Marek');
    await page.goto('/');
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.locator('.topbar-label')).toHaveText('Anna + Marek');

    const member = await admin.from('pair_members').select('pair_id').eq('user_id', a.id).is('left_at', null).single();
    if (member.error) throw member.error;
    const eventId = await createEvent(a, member.data.pair_id, { title: 'Picnic by the river' });
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

// Importance 100: after a pair ends, a person in a new pair sees none of the old pair's content.
test('a new pair after an ended pair shows none of the old content', async ({ page, pair, account, signIn }) => {
  const old = await pair();
  const start = new Date(Date.now() + 2 * 60_000).toISOString();
  const end = new Date(Date.now() + 62 * 60_000).toISOString();
  const before = {
    event: await createEvent(old.a, old.id, { title: 'Old pair dinner', starts_at: start, ends_at: end }),
    list: await createList(old.a, old.id, 'Old flat list'),
    message: await sendMessage(old.a, old.id, 'Old pair note about the flat keys'),
    idea: await createIdea(old.a, old.id, 'Old pair idea: a boat trip'),
    memory: await createMemory(old.a, old.id, 'Old pair memory at the seaside'),
  };
  const task = await createTask(old.a, old.id, 'Old pair task: return the keys', before.list);
  await pinMessage(old.a, before.message);
  await endPair(old.a, old.id);

  const next = await formPair(old.b, await account('Dora'));
  await createEvent(next.a, next.id, { title: 'New pair picnic', starts_at: start, ends_at: end });
  await createTask(next.a, next.id, 'New pair task: water the plants');
  await sendMessage(next.b, next.id, 'New pair message about the picnic');
  await createIdea(next.a, next.id, 'New pair idea: a museum visit');
  await createMemory(next.b, next.id, 'New pair memory in the garden');

  await signIn(page, next.a);
  const pages: [string, string][] = [['/today', 'New pair picnic'], ['/calendar', 'New pair picnic'], ['/tasks', 'New pair task: water the plants'],
    ['/messages', 'New pair message about the picnic'], ['/ideas', 'New pair idea: a museum visit'], ['/memories', 'New pair memory in the garden']];
  for (const [path, current] of pages) {
    await page.goto(path);
    await expect(page.getByText(current).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Old pair');
    await expect(page.locator('body')).not.toContainText('Old flat list');
  }
  const client = next.a.client;
  expect((await client.from('events').select('id').eq('id', before.event)).data).toEqual([]);
  expect((await client.from('tasks').select('id').eq('id', task)).data).toEqual([]);
  expect((await client.from('task_lists').select('id').eq('id', before.list)).data).toEqual([]);
  expect((await client.from('messages').select('id').eq('id', before.message)).data).toEqual([]);
  expect((await client.from('date_ideas').select('id').eq('id', before.idea)).data).toEqual([]);
  expect((await client.from('memories').select('id').eq('id', before.memory.id)).data).toEqual([]);
  expect((await client.storage.from('memory-photos').download(before.memory.path)).error).not.toBeNull();
});
