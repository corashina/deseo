import type { Locator } from '@playwright/test';

export async function messageAction(row: Locator, name: string) {
  if (await row.locator('.message-actions').getAttribute('open') === null) {
    await row.getByRole('button', { name: 'Message actions', exact: true }).click();
  }
  return row.getByRole('button', { name, exact: true });
}
