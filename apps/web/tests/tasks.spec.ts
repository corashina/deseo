import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
// Importance 98: real completion, Undo, assignment, dates, and conflicts protect shared tasks.
test('tasks complete, undo, edit, and reject a stale title', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/tasks');
    const row = page.getByRole('article').filter({ has: page.getByRole('link', { name: 'Book the pottery workshop', exact: true }) });
    await row.getByRole('checkbox').check();
    await expect(row.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
    const marek = await portalClient(ids.marekEmail);
    expect((await marek.from('tasks').select('completed_at').eq('id', ids.taskId).single()).data!.completed_at).not.toBeNull();
    await row.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(row.getByRole('checkbox')).toBeEnabled();
    await expect(row.getByRole('checkbox')).not.toBeChecked();
    expect((await marek.from('tasks').select('completed_at').eq('id', ids.taskId).single()).data!.completed_at).toBeNull();
    await page.goto('/tasks/' + ids.taskId + '/edit');
    await page.getByLabel('Title', { exact: true }).fill('Anna draft');
    await page.getByLabel('Assigned to').selectOption(ids.marekId);
    await page.getByLabel('Due date').fill('2026-10-07');
    const current = await marek.from('tasks').select('*').eq('id', ids.taskId).single();
    const t = current.data!;
    expect((await marek.rpc('update_task', {
      p_task_id: t.id,
      p_expected_version: t.version,
      p_command_id: randomUUID(),
      p_input: { id: t.id, pair_id: ids.pairId, list_id: t.list_id, title: 'Marek title', assignee_id: t.assignee_id, due_date: t.due_date }
    })).data.ok).toBe(true);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('This task changed. Your draft is kept.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Anna draft');
    await page.getByRole('button', { name: 'Reload task and discard draft', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Buy fresh vegetables');
    await page.getByLabel('Assigned to').selectOption(ids.marekId);
    await page.getByLabel('Due date').fill('2026-10-07');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Buy fresh vegetables', exact: true })).toBeVisible();
    const updated = await marek.from('tasks').select('assignee_id,due_date').eq('id', ids.taskId).single();
    expect(updated.data).toEqual({ assignee_id: ids.marekId, due_date: '2026-10-07' });
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
// Importance 98: failed completion must roll back and preserve the retry command.
test('failed completion rolls back and retries the original attempt after focus', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/tasks');
    const bodies: unknown[] = [];
    await page.route('**/rest/v1/rpc/set_task_completed', async (route) => {

      bodies.push(route.request().postDataJSON());

      if (bodies.length === 1)
        await route.abort();
      else
        await route.continue();

    });
    const row = page.getByRole('article').filter({ has: page.getByRole('link', { name: 'Book the pottery workshop', exact: true }) });
    await row.getByRole('checkbox').check();
    await expect(row.getByRole('button', { name: 'Retry completion', exact: true })).toBeEnabled();
    await expect(row.getByRole('checkbox')).not.toBeChecked();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await row.getByRole('button', { name: 'Retry completion', exact: true }).click();
    await expect(row.getByRole('checkbox')).toBeChecked();
    expect(bodies[1]).toEqual(bodies[0]);
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
// Importance 98: General and ordered move/delete preserve list integrity.
test('General stays fixed and nonempty list removal requires a move', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/tasks/lists/' + ids.generalListId);
    await expect(page.getByRole('button', { name: 'Rename list', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove list', exact: true })).toHaveCount(0);
    await page.goto('/tasks/lists/' + ids.groceriesListId);
    await expect(page.getByRole('button', { name: 'Remove list', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Move tasks to General', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm move', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove list', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Remove list', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
    await expect(page).toHaveURL(/\/tasks\/lists$/);
    const client = await portalClient(ids.marekEmail);
    expect((await client.from('tasks').select('list_id').eq('id', ids.dueTaskId).single()).data!.list_id).toBe(ids.generalListId);
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
// Importance 98: both browser sessions must receive confirmed task changes.
test('partner browser receives completion and Undo without reload', async ({ page, browser }) => {

  const ids = await createPortalPairFixture();

  const partnerContext = await browser.newContext();

  const partner = await partnerContext.newPage();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/tasks');
    await loginWithLocalEmailCode(partner, ids.marekEmail);
    await partner.goto('/tasks');
    const row = page.getByRole('article').filter({ has: page.getByRole('link', { name: 'Book the pottery workshop', exact: true }) });
    const partnerRow = partner.getByRole('article').filter({ has: partner.getByRole('link', { name: 'Book the pottery workshop', exact: true }) });
    await expect(partnerRow.getByRole('checkbox')).not.toBeChecked();
    await row.getByRole('checkbox').check();
    await expect(partnerRow.getByRole('checkbox')).toBeChecked();
    await partnerRow.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(row.getByRole('checkbox')).not.toBeChecked();
  }
  finally {
    await partnerContext.close();
    await cleanupPortalPairFixture(ids);
  }

});
// Importance 98: an accepted task save must survive a focus remount without a duplicate.
test('task lost save acknowledgement keeps the original payload and command', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/tasks/new');
    await page.getByLabel('Title', { exact: true }).fill('One shared task');
    const bodies: Array<{
      p_command_id: string;
      p_input: {
        id: string;
      };
    }> = [];
    await page.route('**/rest/v1/rpc/create_task', async (route) => {

      bodies.push(route.request().postDataJSON());

      if (bodies.length === 1) {
        await route.fetch();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await route.abort();
      }
      else
        await route.continue();

    });
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'One shared task', exact: true })).toBeVisible();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    const client = await portalClient(ids.marekEmail);
    expect((await client.from('tasks').select('id').eq('id', bodies[0].p_input.id)).data).toHaveLength(1);
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
// Importance 98: list creation and rename must persist across partner reads.
test('create and rename a named task list', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/tasks/lists');
    await page.getByLabel('List name', { exact: true }).fill('Weekend');
    await page.getByRole('button', { name: 'Create list', exact: true }).click();
    await page.getByRole('link', { name: 'Weekend', exact: true }).click();
    await page.getByLabel('New list name', { exact: true }).fill('Travel plans');
    await page.getByRole('button', { name: 'Rename list', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Travel plans', exact: true })).toBeVisible();
    const client = await portalClient(ids.marekEmail);
    expect((await client.from('task_lists').select('name').eq('pair_id', ids.pairId).eq('name', 'Travel plans')).data).toHaveLength(1);
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
