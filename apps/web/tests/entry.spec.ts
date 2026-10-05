import { test, expect } from '@playwright/test';
import { admin, createEntryFixture, cleanupEntryFixture, expireEntryCode } from './support/entry-fixtures';
import { loginWithLocalEmailCode, readLocalCode } from './support/local-auth';

// Importance: 100. Real entry and pairing gates protect account access.
for (const state of ['unpaired', 'pending', 'active'] as const) test(`email code opens the ${state} pair state`, async ({ page }) => {
  const fixture = await createEntryFixture(state);
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await expect(page).toHaveURL(new RegExp(`/pair/${state === 'unpaired' ? 'start' : state === 'pending' ? 'waiting' : 'welcome'}`));
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  } finally { await cleanupEntryFixture(fixture); }
});

// Importance: 100. The server must reject a real expired email code.
test('expired email code does not restore a session', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  try {
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill(fixture.email);
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
    const code = await readLocalCode(fixture.email);
    expireEntryCode(fixture.accountIds[0]);
    await page.getByLabel('Sign-in code').fill(code);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
    await expect(page).toHaveURL(/\/verify/);
  } finally { await cleanupEntryFixture(fixture); }
});

// Importance: 100. Profile, pair, invitation, and cancellation writes must survive server reads.
test('profile and pair setup create and cancel a real invitation', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  try {
    const { error } = await admin.from('profiles').delete().eq('user_id', fixture.accountIds[0]);
    expect(error).toBeNull();
    await loginWithLocalEmailCode(page, fixture.email);
    await expect(page).toHaveURL(/\/profile\/setup/);
    await page.getByLabel('Your name').fill('Anna');
    await page.getByLabel('Timezone').fill('Europe/Warsaw');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.getByRole('button', { name: 'Create pair' }).click();
    await expect(page).toHaveURL(/\/pair\/waiting/);
    const { data: memberships } = await admin.from('pair_members').select('pair_id').eq('user_id', fixture.accountIds[0]).is('left_at', null);
    fixture.pairId = memberships![0].pair_id;
    await page.getByRole('link', { name: 'Get invitation code' }).click();
    await page.getByRole('button', { name: 'Create invitation code' }).click();
    await expect(page.locator('.invite-code')).toHaveText(/^[0-9A-Z]{12}$/);
    const first = await page.locator('.invite-code').innerText();
    await page.getByRole('button', { name: 'Replace invitation code' }).click();
    await expect(page.locator('.invite-code')).not.toHaveText(first);
    await page.getByRole('link', { name: 'Waiting for your partner' }).click();
    await page.getByRole('button', { name: 'Cancel pending pair' }).click();
    await page.getByRole('button', { name: 'Cancel pair', exact: true }).click();
    await expect(page).toHaveURL(/\/pair\/ended/);
    await expect(page.getByRole('heading', { name: 'Your pair has ended' })).toBeVisible();
    await page.getByRole('link', { name: 'Set up a pair' }).click();
    await expect(page.getByRole('button', { name: 'Create pair' })).toBeVisible();
  } finally { await cleanupEntryFixture(fixture); }
});
test('invitation survives email sign-in and joins the real pair', async ({ page }) => {
  const owner = await createEntryFixture('pending');
  const joiner = await createEntryFixture('unpaired');
  try {
    await page.goto(`/invite?token=${owner.inviteToken}`);
    await expect(page).not.toHaveURL(/token=/);
    await page.getByRole('link', { name: 'Continue with email' }).click();
    await page.getByLabel('Email address').fill(joiner.email);
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
    await page.getByLabel('Sign-in code').fill(await readLocalCode(joiner.email));
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Join Anna' })).toBeVisible();
    await page.getByRole('button', { name: 'Join pair', exact: true }).click();
    await expect(page).toHaveURL(/\/pair\/welcome/);
  } finally { await cleanupEntryFixture(owner); await cleanupEntryFixture(joiner); }
});
test('malformed and invalid or expired codes retain the entry form', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  try {
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill(fixture.email);
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
    await page.getByLabel('Sign-in code').fill('abc');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('six digits');
    await page.getByLabel('Sign-in code').fill('000000');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
    await expect(page).toHaveURL(/\/verify/);
  } finally { await cleanupEntryFixture(fixture); }
});

// Importance: 95. A failed session read must preserve an unsaved profile draft.
test('profile draft survives a failed session read and retry', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  try {
    const { error } = await admin.from('profiles').delete().eq('user_id', fixture.accountIds[0]);
    expect(error).toBeNull();
    await loginWithLocalEmailCode(page, fixture.email);
    await page.getByLabel('Your name').fill('Unsaved Anna');
    await page.route('**/rest/v1/rpc/get_session_context', route => route.abort('failed'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: 'We could not open your account' })).toBeVisible();
    await page.unroute('**/rest/v1/rpc/get_session_context');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByLabel('Your name')).toHaveValue('Unsaved Anna');
  } finally { await cleanupEntryFixture(fixture); }
});

// Importance: 100. Acceptance must use the exact invitation the user reviewed.
for (const initial of [false, true]) test(`edited code rejects delayed ${initial ? 'initial' : 'manual'} preview`, async ({ page }) => {
  const ownerA = await createEntryFixture('pending');
  const ownerB = await createEntryFixture('pending');
  const joiner = await createEntryFixture('unpaired');
  try {
    await admin.from('profiles').update({ display_name: 'Beata' }).eq('user_id', ownerB.accountIds[0]);
    await loginWithLocalEmailCode(page, joiner.email);
    let arrived!: () => void; let release!: () => void;
    const requested = new Promise<void>(resolve => { arrived = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/rest/v1/rpc/preview_invite', async route => {
      if (route.request().postDataJSON().p_token !== ownerA.inviteToken) { await route.continue(); return; }
      const response = await route.fetch(); arrived(); await gate; await route.fulfill({ response });
    });
    await page.goto(initial ? `/invite?token=${ownerA.inviteToken}` : '/pair/join');
    if (!initial) {
      await page.getByLabel('Invitation code').fill(ownerA.inviteToken!);
      await page.getByRole('button', { name: 'Review invitation' }).click();
    }
    await requested;
    await page.getByLabel('Invitation code').fill(ownerB.inviteToken!);
    release();
    await expect(page.getByRole('button', { name: 'Review invitation' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Join pair', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Review invitation' }).click();
    await expect(page.getByRole('heading', { name: 'Join Beata' })).toBeVisible();
    await page.getByRole('button', { name: 'Join pair', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Beata + Anna' })).toBeVisible();
  } finally {
    await cleanupEntryFixture(ownerA); await cleanupEntryFixture(ownerB); await cleanupEntryFixture(joiner);
  }
});

// Importance: 95. Offline entry must retain editable input and prevent even direct form submission.
test('offline email form retains its draft and blocks submissions', async ({ page, context }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('entry-offline@example.test');
  let requests = 0;
  await page.route('**/auth/v1/otp', async route => { requests++; await route.abort(); });
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Send code', exact: true })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('offline');
  await page.getByLabel('Email address').fill('entry-edited-offline@example.test');
  await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
  expect(requests).toBe(0);
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Send code', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Email address')).toHaveValue('entry-edited-offline@example.test');
});
