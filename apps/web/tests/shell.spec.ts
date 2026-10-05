import { test, expect } from '@playwright/test';
import { createEntryFixture, cleanupEntryFixture } from './support/entry-fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';

// Importance: 93. Keyboard focus and responsive navigation keep account controls reachable.
test('drawer and account controls preserve keyboard focus across portal widths', async ({ page }, testInfo) => {
  const fixture = await createEntryFixture('active');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      const trigger = page.getByRole('button', { name: 'Account menu' });
      await trigger.focus(); await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Your account' })).toBeVisible();
      await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
      if (width < 768) {
        const menu = page.getByRole('button', { name: 'Open navigation' });
        await menu.focus(); await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Your pair', exact: true })).toHaveAttribute('aria-current', 'page');
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Your pair', exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
        await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
      } else await expect(page.getByRole('link', { name: 'Your pair', exact: true })).toHaveAttribute('aria-current', 'page');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`shell-${width}.png`), fullPage: true });
    }
  } finally { await cleanupEntryFixture(fixture); }
});
