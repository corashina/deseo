import type { Page } from '@playwright/test';
export async function confirmNavigation(page: Page, action: () => Promise<unknown>, accept: boolean) {
  const shown = page.waitForEvent('dialog');
  const started = action();
  const dialog = await shown;
  if (accept) await dialog.accept(); else await dialog.dismiss();
  await started;
}
export async function clickSidebar(page: Page, label: string) {
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('link', { name: label, exact: true }).filter({ visible: true }).first().click();
}
