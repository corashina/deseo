import { expect, type Page } from '@playwright/test';

export async function readLocalCode(email: string): Promise<string> {
  let code = '';
  await expect.poll(async () => {
    const response = await fetch(`http://127.0.0.1:55724/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const data = await response.json();
    const message = data.messages?.[0];
    if (!message) return false;
    const body = await (await fetch(`http://127.0.0.1:55724/api/v1/message/${message.ID}`)).json();
    code = (body.Text || body.HTML).match(/\b\d{6}\b/)?.[0] ?? '';
    return Boolean(code);
  }, { timeout: 15000 }).toBe(true);
  return code;
}
export async function loginWithLocalEmailCode(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await expect(page.getByLabel('Sign-in code')).toBeVisible();
  await page.getByLabel('Sign-in code').fill(await readLocalCode(email));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/verify/);
}
