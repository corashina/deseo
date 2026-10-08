import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { fixtureRpc } from './support/entry-fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
import { ready } from './support/screenshot-render';

// Importance 92: long names, titles, and enlarged text must keep navigation and forms within the viewport.
test('shell and forms fit five widths with long text at 200 percent', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const ids = await createPortalPairFixture();
  try {
    const anna = await portalClient(ids.annaEmail); const marek = await portalClient(ids.marekEmail);
    for (const [client, userId, name] of [[anna, ids.annaId, 'Anna Aleksandra Katarzyna Nowak Kowalska'], [marek, ids.marekId, 'Marek Konstanty Alexander Nowak Kowalski']] as const) {
      const profile = await client.from('profiles').select('version').eq('user_id', userId).single();
      expect(profile.error).toBeNull();
      await fixtureRpc(client, 'save_profile', { p_display_name: name, p_timezone: 'Europe/Warsaw', p_locale: 'en', p_expected_version: profile.data!.version });
    }
    await fixtureRpc(anna, 'update_event', { p_event_id: ids.sharedEventId, p_expected_version: 1, p_command_id: randomUUID(),
      p_input: { id: ids.sharedEventId, pair_id: ids.pairId, title: 'An evening together with our friends and a long walk along the river before dinner at our favourite place in old town',
        owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', repeat: 'none', starts_at: '2026-10-05T17:00:00Z', ends_at: '2026-10-05T19:00:00Z' } });
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.clock.setFixedTime(new Date('2026-10-05T10:00:00+02:00'));
    const routes = ['/today', '/calendar?date=2026-10-05', '/calendar?date=2026-10-05&view=compare', '/events/' + ids.sharedEventId,
      '/events/new', '/events/' + ids.sharedEventId + '/edit', '/tasks', '/tasks/' + ids.taskId, '/tasks/new', '/ideas', '/ideas/new', '/notifications', '/messages', '/messages?view=notes', '/memories/new', '/settings/profile', '/settings/notifications'];
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await page.goto(route); await ready(page);
        for (const scale of [1, 2]) {
          if (scale === 2) await page.evaluate(() => {
            // Double computed text sizes, including pixel-sized controls. Keep viewport and geometry unchanged.
            const sizes = [...document.querySelectorAll<HTMLElement>('body *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)] as const);
            for (const [element, size] of sizes) element.style.fontSize = size * 2 + 'px';
          });
          const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            elements: [...document.querySelectorAll<HTMLElement>('body *')].filter(element => {
              const bounds = element.getBoundingClientRect(); return bounds.width > 0 && (bounds.right > innerWidth + 1 || bounds.left < -1);
            }).map(element => element.tagName + '.' + element.className).slice(0, 8) }));
          expect(overflow.scrollWidth, JSON.stringify({ route, scale, ...overflow })).toBeLessThanOrEqual(width);
          // Importance 92: page actions must remain distinct from long or enlarged headings.
          const headerAction = page.locator('.page-header > .button').first();
          if (await headerAction.isVisible()) {
            const actionBounds = await headerAction.boundingBox();
            const headingBounds = await page.locator('.page-header h1').first().boundingBox();
            expect(actionBounds!.width).toBeGreaterThan(0);
            expect(actionBounds!.height).toBeGreaterThanOrEqual(48);
            if (width < 768) expect(actionBounds!.y).toBeGreaterThanOrEqual(headingBounds!.y + headingBounds!.height);
          }
          if (width === 320 && route === '/today') {
            const header = page.locator('.page-header');
            const heading = header.getByRole('heading', { level: 1 });
            const action = header.getByRole('link', { name: 'Add event', exact: true });
            await expect(action).toBeVisible();
            await expect(action).toHaveText('Add event');
            const headingBounds = await heading.boundingBox();
            const actionBounds = await action.boundingBox();
            expect(headingBounds).not.toBeNull();
            expect(actionBounds).not.toBeNull();
            expect(actionBounds!.width).toBeGreaterThan(0);
            expect(actionBounds!.height).toBeGreaterThan(0);
            const separated = actionBounds!.x >= headingBounds!.x + headingBounds!.width
              || headingBounds!.x >= actionBounds!.x + actionBounds!.width
              || actionBounds!.y >= headingBounds!.y + headingBounds!.height
              || headingBounds!.y >= actionBounds!.y + actionBounds!.height;
            expect(separated, 'Heading and action at 320px, text scale ' + scale).toBe(true);
            await page.screenshot({ path: testInfo.outputPath(`today-320-text-${scale}.png`), fullPage: true });
          }
          if (route === '/today') {
            const sidebar = page.locator('.sidebar');
            if (await sidebar.isVisible()) {
              const size = await sidebar.evaluate(element => ({ content: element.scrollWidth, width: element.clientWidth }));
              expect(size.content, 'Sidebar at ' + width + 'px, text scale ' + scale).toBeLessThanOrEqual(size.width);
            } else {
              await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
              const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
              await expect(drawer).toBeVisible();
              const size = await drawer.evaluate(element => ({ content: element.scrollWidth, width: element.clientWidth }));
              expect(size.content, 'Drawer at ' + width + 'px, text scale ' + scale).toBeLessThanOrEqual(size.width);
              await page.keyboard.press('Escape');
            }
          }
        }
      }
    }
  } finally { await cleanupPortalPairFixture(ids); }
});
