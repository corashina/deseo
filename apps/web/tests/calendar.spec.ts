import { test, expect, admin, createEvent } from './support/test';

// Importance 100: a shared event reaches the partner, and a private event never does.
test('B sees the shared event and cannot open the private event', async ({ page, browser, pair, signIn }) => {
  const { a, b } = await pair();
  await signIn(page, a);
  const ids: string[] = [];
  for (const [title, visibility] of [['Concert night', 'shared'], ['Dentist visit', 'private']] as const) {
    await page.goto('/events/new');
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Visibility').selectOption(visibility);
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    ids.push(page.url().split('/events/')[1]);
  }
  const context = await browser.newContext();
  try {
    const partner = await context.newPage();
    await signIn(partner, b);
    await partner.goto('/calendar');
    await expect(partner.getByText('Concert night')).toBeVisible();
    await expect(partner.locator('body')).not.toContainText('Dentist visit');
    await partner.goto('/events/' + ids[0]);
    await expect(partner.getByRole('heading', { name: 'Concert night', exact: true })).toBeVisible();
    await partner.goto('/events/' + ids[1]);
    await expect(partner.getByRole('link', { name: 'Return to calendar' })).toBeVisible();
    await expect(partner.locator('body')).not.toContainText('Dentist visit');
    expect((await b.client.from('events').select('id').eq('id', ids[1])).data).toEqual([]);
  } finally { await context.close(); }
});

// Importance 98: a second save on a changed event keeps the draft and shows the conflict.
test('the second save of one event keeps its draft and reports a conflict', async ({ page, browser, pair, signIn }) => {
  const { id, a, b } = await pair();
  const eventId = await createEvent(a, id, { title: 'Weekend trip' });
  const context = await browser.newContext();
  try {
    const partner = await context.newPage();
    await signIn(page, a);
    await signIn(partner, b);
    await page.goto(`/events/${eventId}/edit`);
    await partner.goto(`/events/${eventId}/edit`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Weekend trip');
    await expect(partner.getByLabel('Title', { exact: true })).toHaveValue('Weekend trip');
    await partner.getByLabel('Title', { exact: true }).fill('Weekend trip to the lake');
    await partner.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(partner.getByRole('heading', { name: 'Weekend trip to the lake', exact: true })).toBeVisible();
    await page.getByLabel('Location').fill('Train station');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('This event changed. Your draft is kept.')).toBeVisible();
    await expect(page.getByLabel('Location')).toHaveValue('Train station');
    const stored = await admin.from('events').select('title, location').eq('id', eventId).single();
    expect(stored.data?.title).toBe('Weekend trip to the lake');
    expect(stored.data?.location).not.toBe('Train station');
  } finally { await context.close(); }
});
