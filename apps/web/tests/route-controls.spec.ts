import { test, expect } from '@playwright/test';
import { createPortalPairFixture, cleanupPortalPairFixture } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
import { ready } from './support/screenshot-render';

// Importance 92: direct loads and reloads must retain selected tabs, reminder sections, and notification layout.
test('fresh routes and reloads own their controls at five widths', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    const storageState = await page.context().storageState();
    const routes = ['/tasks', '/ideas', '/tasks/' + ids.taskId, '/notifications'];
    for (const width of [320, 390, 768, 1024, 1440]) for (const route of routes) {
      const context = await browser.newContext({ storageState, viewport: { width, height: 1000 } });
      try {
        const fresh = await context.newPage();
        await fresh.goto('http://127.0.0.1:4174' + route);
        for (const reload of [false, true]) {
          if (reload) await fresh.reload();
          await ready(fresh);
          if (route === '/tasks' || route === '/ideas') {
            const selected = fresh.locator('.view-tabs button[aria-pressed=true]');
            await expect(selected).toHaveCount(1);
            const styles = await selected.evaluate(button => ({
              height: button.getBoundingClientRect().height,
              background: getComputedStyle(button).backgroundColor,
              selected: getComputedStyle(document.documentElement).getPropertyValue('--shared-soft').trim(),
              display: getComputedStyle(button.parentElement!).display,
            }));
            expect(styles.height).toBeGreaterThanOrEqual(48);
            expect(styles.display).toBe('flex');
            expect(styles.background).toBe('rgb(234, 228, 245)');
            expect(styles.selected).toBe('#EAE4F5');
          } else if (route.startsWith('/tasks/')) {
            await expect(fresh.getByRole('heading', { name: 'Your reminder', exact: true })).toBeVisible();
            expect(await fresh.locator('.event-reminder').evaluate(element => ({
              border: getComputedStyle(element).borderTopWidth, padding: getComputedStyle(element).paddingTop,
              margin: getComputedStyle(element).marginTop, width: getComputedStyle(element).maxWidth,
            }))).toEqual({ border: '1px', padding: '24px', margin: '24px', width: '480px' });
          } else {
            await expect(fresh.locator('.notification-list')).toBeVisible();
            expect(await fresh.locator('.notification-list').evaluate(element => ({
              display: getComputedStyle(element).display, gap: getComputedStyle(element).gap, width: getComputedStyle(element).maxWidth,
            }))).toEqual({ display: 'grid', gap: width < 768 ? '16px' : '24px', width: '960px' });
          }
        }
      } finally { await context.close(); }
    }
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 92: a shared plan must appear once per day and span both personal columns.
test('Compare places shared plans once across personal columns', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/calendar?view=compare&date=2026-10-05');
      await ready(page);
      const day = page.locator('.comparison-day').first();
      await expect(day.locator('a[href="/events/' + ids.sharedEventId + '"]')).toHaveCount(1);
      await expect(day.locator('.comparison-column .owner-together')).toHaveCount(0);
      await expect(day.locator('.comparison-shared .owner-together')).toHaveCount(2);
      for (const [id, column] of [[ids.annaEventId, 0], [ids.marekEventId, 1]] as const) {
        const personal = page.locator('.comparison-column a[href="/events/' + id + '"]');
        await expect(personal).toHaveCount(1);
        expect(await personal.evaluate(element => {
          const columns = [...element.closest('.comparison-day')!.querySelectorAll('.comparison-column')];
          return columns.indexOf(element.parentElement!);
        })).toBe(column);
      }
      const bounds = await day.evaluate(element => {
        const columns = [...element.querySelectorAll('.comparison-column')].map(column => column.getBoundingClientRect());
        const shared = element.querySelector('.comparison-shared')!.getBoundingClientRect();
        return { left: shared.left, right: shared.right, first: columns[0].left, last: columns[1].right };
      });
      expect(bounds.left).toBe(bounds.first);
      expect(bounds.right).toBe(bounds.last);
      for (const [column, owner] of [[0, 'a'], [1, 'b']] as const) {
        await expect(day.locator('.comparison-column').nth(column).locator('.event-row:not(.owner-' + owner + ')')).toHaveCount(0);
      }
    }
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 90: narrow Calendar defaults to Agenda while valid URL choices remain authoritative.
test('narrow Calendar defaults to Agenda and preserves explicit views', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithLocalEmailCode(page, ids.annaEmail);
    for (const query of ['', '?view=unknown', '?view=month', '?view=agenda', '?view=compare']) {
      await page.goto('/calendar' + query);
      await ready(page);
      const choice = query === '?view=month' ? 'Month' : query === '?view=compare' ? 'Compare' : 'Agenda';
      await expect(page.getByRole('button', { name: choice, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.reload(); await ready(page);
      await expect(page.getByRole('button', { name: choice, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 92: shell owner colors must use current verified membership on desktop and narrow views.
test('Marek shell controls use the verified teal slot', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.marekEmail);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/today'); await ready(page);
      const avatars = width === 1440 ? page.locator('.sidebar .avatar') : page.locator('.mobile-account .avatar');
      await expect(avatars).toHaveCount(width === 1440 ? 2 : 1);
      for (const avatar of await avatars.all()) {
        await expect(avatar).toHaveClass('avatar slot-b');
        expect(await avatar.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(222, 240, 233)');
      }
    }
  } finally { await cleanupPortalPairFixture(ids); }
});
