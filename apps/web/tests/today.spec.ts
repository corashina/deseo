import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
// Importance 92: Today composes pair-local plans and unfinished tasks with strict limits.
test('Today limits plans and tasks and shows the important date', async ({ page }) => {

  const ids = await createPortalPairFixture();

  try {
    await page.clock.install({ time: new Date('2026-10-04T22:30:00Z') });
    const client = await portalClient(ids.annaEmail);
    for (let index = 0; index < 4; index++) {
      expect((await client.rpc('create_task', {
        p_input: { id: randomUUID(), pair_id: ids.pairId, list_id: ids.generalListId, title: 'Due task ' + index, assignee_id: null, due_date: '2026-10-05' },
        p_command_id: randomUUID()
      })).data.ok).toBe(true);
    }
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(page.getByTestId('today-events').getByRole('link').filter({ has: page.locator('.event-row-content') })).toHaveCount(3);
    await expect(page.getByTestId('today-events').getByText('5 Oct · Together', { exact: true })).toBeVisible();
    await expect(page.getByTestId('today-events').getByText('6 Oct · Anna', { exact: true })).toBeVisible();
    await expect(page.getByTestId('today-tasks').getByRole('article')).toHaveCount(3);
    await expect(page.getByTestId('today-tasks').getByRole('checkbox', { checked: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Our anniversary', exact: true })).toBeVisible();
    const days = DateTime.fromISO('2026-10-18').diff(DateTime.fromISO('2026-10-05'), 'days').days;
    await expect(page.getByText('In ' + days + ' days', { exact: true })).toBeVisible();
    await expect(page.getByText('Recent memory', { exact: true })).toHaveCount(0);
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
// Importance 90: product routes must render without overflow at the approved browser widths.
test('planning pages render at each portal width and provide product captures', async ({ page }, testInfo) => {

  const ids = await createPortalPairFixture();

  try {
    await page.clock.install({ time: new Date('2026-10-05T08:00:00Z') });
    await loginWithLocalEmailCode(page, ids.annaEmail);
    const routes = [
      ['today', '/today', 'Today'], ['tasks', '/tasks', 'Tasks'], ['task-new', '/tasks/new', 'Add task'],
      ['task-detail', '/tasks/' + ids.taskId, 'Book the pottery workshop'], ['task-edit', '/tasks/' + ids.taskId + '/edit', 'Edit task'],
      ['task-lists', '/tasks/lists', 'Task lists'], ['task-list-detail', '/tasks/lists/' + ids.groceriesListId, 'Groceries'],
      ['ideas', '/ideas', 'Date ideas'], ['idea-new', '/ideas/new', 'Add idea'],
      ['idea-detail', '/ideas/' + ids.ideaId, 'Pottery evening'], ['idea-edit', '/ideas/' + ids.ideaId + '/edit', 'Edit idea'],
      ['plan-date', '/events/new?idea=' + ids.ideaId, 'Plan date'],
    ];
    for (const [name, route, title] of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: /^Loading/ })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(name + '-' + testInfo.project.name + '.png'), fullPage: true });
      for (const width of [320, 768, 1024]) {
        await page.setViewportSize({ width, height: width === 320 ? 844 : 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' at ' + width).toBe(true);
      }
      await page.setViewportSize(testInfo.project.use.viewport!);
    }
  }
  finally {
    await cleanupPortalPairFixture(ids);
  }

});
