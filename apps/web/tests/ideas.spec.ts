import { test, expect } from '@playwright/test';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
// Importance 98: planning and deleting one future event preserve the idea link.
test('Plan date links one shared event and deletion returns the idea to Saved', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/ideas/' + ids.ideaId);
    await page.getByRole('link', { name: 'Plan date', exact: true }).click();
    await page.getByLabel('Start date', { exact: true }).fill('2027-02-05');
    await page.getByLabel('End date', { exact: true }).fill('2027-02-05');
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
    const eventId = page.url().split('/').at(-1)!;
    const client = await portalClient(ids.marekEmail);
    const idea = await client.from('date_ideas').select('state,linked_event_id').eq('id', ids.ideaId).single();
    expect(idea.data).toEqual({ state: 'planned', linked_event_id: eventId });
    expect((await client.from('events').select('visibility').eq('id', eventId).single()).data!.visibility).toBe('shared');
    await page.getByRole('button', { name: 'Delete event', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await expect(page).toHaveURL(/\/calendar/);
    expect((await client.from('date_ideas').select('state,linked_event_id').eq('id', ids.ideaId).single()).data).toEqual({ state: 'saved', linked_event_id: null });
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
// Importance 98: HTTPS validation and persistent edits protect shared ideas.
test('ideas validate HTTPS links, save edits, and archive', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/ideas/new');
    await page.getByLabel('Title', { exact: true }).fill('Museum afternoon');
    await page.getByLabel('Link', { exact: true }).fill('http://example.test');
    await page.getByRole('button', { name: 'Save idea', exact: true }).click();
    await expect(page.getByText('Use an HTTPS link.', { exact: true })).toBeVisible();
    await page.getByLabel('Link', { exact: true }).fill('https://example.test');
    await page.getByRole('button', { name: 'Save idea', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Museum afternoon', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Edit idea', exact: true }).click();
    await page.getByLabel('Note').fill('Book two tickets');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Book two tickets', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Archive idea', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm archive', exact: true }).click();
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
// Importance 98: an accepted plan retry must create only one event after remount.
test('lost Plan date acknowledgement retains the idea version and event identity', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/new?idea=' + ids.ideaId);
    const bodies: Array<{
      p_command_id: string;
      p_event_input: {
        id: string;
      };
      p_expected_version: number;
    }> = [];
    await page.route('**/rest/v1/rpc/plan_date_idea', async (route) => {

      bodies.push(route.request().postDataJSON());

      if (bodies.length === 1) {
        await route.fetch();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await route.abort();
      }
      else
        await route.continue();

    });
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    const client = await portalClient(ids.marekEmail);
    expect((await client.from('events').select('id').eq('id', bodies[0].p_event_input.id)).data).toHaveLength(1);
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
