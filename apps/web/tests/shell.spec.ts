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

// Importance: 93. Escape during a pending command must not hide a subsequent failure.
test('pending cancellation keeps its dialog open and exposes failure after Escape', async ({ page }) => {
  const fixture = await createEntryFixture('pending');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    let arrived!: () => void; let release!: () => void;
    const requested = new Promise<void>(resolve => { arrived = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/rest/v1/rpc/cancel_pending_pair', async route => {
      arrived(); await gate;
      await route.fulfill({ json: { ok: false, error: { code: 'RETRYABLE', message: 'Try again.' } } });
    });
    await page.getByRole('button', { name: 'Cancel pending pair' }).click();
    await page.getByRole('button', { name: 'Cancel pair', exact: true }).click();
    await requested;
    await page.keyboard.press('Escape');
    release();
    const dialog = page.getByRole('dialog', { name: 'Cancel this pair?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toHaveText('Try again.');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: 'Cancel pending pair' }).click();
    await expect(dialog).toBeVisible();
    await page.unroute('**/rest/v1/rpc/cancel_pending_pair');
    await page.getByRole('button', { name: 'Cancel pair', exact: true }).click();
    await expect(page).toHaveURL(/\/pair\/ended/);
  } finally { await cleanupEntryFixture(fixture); }
});
