import type { Page } from '@playwright/test';
import { endPair, expect, type FilledPair, type Fixtures } from '../support/test';

// none: signed out. pair: Anna in the filled pair. The others get a new account in that state.
export type As = 'none' | 'pair' | 'unpaired' | 'noProfile' | 'pending' | 'ended';
export type Screen = { path: (ids: FilledPair['ids']) => string; as: As; title: string; shell: boolean };

export const widths = [320, 390, 768, 1024, 1200, 1440];

const open = (path: string, title: string): Screen => ({ path: () => path, as: 'pair', title, shell: true });
const record = (path: Screen['path'], title: string): Screen => ({ path, as: 'pair', title, shell: true });

// One entry per screen in router.tsx. "/" and "/invite" only redirect, so they are not here.
// title is the text before " · Deseo" in the page title.
export const screens: Screen[] = [
  { path: () => '/welcome', as: 'none', title: 'Welcome', shell: false },
  { path: () => '/sign-in', as: 'none', title: 'Sign in', shell: false },
  { path: () => '/verify', as: 'none', title: 'Check your email', shell: false },
  { path: () => '/no-such-page', as: 'none', title: 'Page not found', shell: false },
  { path: () => '/profile/setup', as: 'noProfile', title: 'Set up your profile', shell: false },
  { path: () => '/pair/start', as: 'unpaired', title: 'Set up your pair', shell: true },
  { path: () => '/pair/join', as: 'unpaired', title: 'Join your partner', shell: true },
  { path: () => '/pair/waiting', as: 'pending', title: 'Waiting for your partner', shell: true },
  { path: () => '/pair/ended', as: 'ended', title: 'Your pair has ended', shell: true },
  open('/settings', 'Settings'),
  open('/today', 'Today'),
  open('/calendar', 'Calendar'),
  open('/events/new', 'Add event'),
  record(ids => `/events/${ids.event}`, 'Event'),
  record(ids => `/events/${ids.event}/edit`, 'Edit event'),
  record(ids => `/ideas/${ids.idea}`, 'Date idea'),
  open('/memories', 'Memories'),
  open('/memories/new', 'Add memory'),
  record(ids => `/memories/${ids.memory}`, 'Memory'),
  record(ids => `/memories/${ids.memory}/edit`, 'Edit memory'),
  open('/tasks', 'Tasks'),
  record(ids => `/tasks/${ids.task}`, 'Task'),
];

// Wait until the screen shows its data: title set, loaders gone, images decoded.
export async function ready(page: Page, title: string) {
  await expect(page).toHaveTitle(`${title} · Deseo`);
  await expect(page.getByRole('status').filter({ hasText: /^(Loading|Checking)/ })).toHaveCount(0);
  await page.waitForFunction(() => [...document.images].every(image => image.complete));
}

type Context = Fixtures & { filledPair: FilledPair };

// Sign in as the screen needs, open it, and wait until it is ready.
export async function openScreen(page: Page, screen: Screen, { filledPair, account, pendingPair, pair, signIn }: Context) {
  // Create only the account this screen needs.
  const person = await {
    none: async () => null,
    pair: async () => filledPair.a,
    unpaired: () => account(),
    noProfile: () => account(null),
    pending: async () => (await pendingPair()).a,
    ended: async () => { const ended = await pair(); await endPair(ended.a, ended.id); return ended.a; },
  }[screen.as]();
  if (person) await signIn(page, person);
  if (screen.path(filledPair.ids) === '/verify') {
    // The code screen needs an email request first. Answer it here, so no email is sent.
    await page.route('**/auth/v1/otp', route => route.fulfill({ status: 200, json: {} }));
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill('layout@example.test');
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
  } else {
    await page.goto(screen.path(filledPair.ids));
  }
  await ready(page, screen.title);
}
