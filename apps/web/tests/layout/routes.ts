import type { Page } from '@playwright/test';
import { expect, type FilledPair } from '../support/test';

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
  { path: () => '/pair/invite', as: 'pending', title: 'Invite your partner', shell: true },
  { path: () => '/pair/waiting', as: 'pending', title: 'Waiting for your partner', shell: true },
  { path: () => '/pair/ended', as: 'ended', title: 'Your pair has ended', shell: true },
  open('/settings', 'Settings'),
  open('/settings/profile', 'Profile'),
  open('/settings/pair', 'Your pair'),
  open('/settings/account', 'Account'),
  open('/today', 'Today'),
  open('/calendar', 'Calendar'),
  open('/events/new', 'Add event'),
  record(ids => `/events/${ids.event}`, 'Event'),
  record(ids => `/events/${ids.event}/edit`, 'Edit event'),
  open('/ideas', 'Date ideas'),
  open('/ideas/new', 'Add idea'),
  record(ids => `/ideas/${ids.idea}`, 'Date idea'),
  record(ids => `/ideas/${ids.idea}/edit`, 'Edit idea'),
  open('/memories', 'Memories'),
  open('/memories/new', 'Add memory'),
  record(ids => `/memories/${ids.memory}`, 'Memory'),
  record(ids => `/memories/${ids.memory}/edit`, 'Edit memory'),
  open('/messages', 'Messages'),
  open('/tasks', 'Tasks'),
  open('/tasks/new', 'Add task'),
  open('/tasks/lists', 'Task lists'),
  record(ids => `/tasks/lists/${ids.list}`, 'Task list'),
  record(ids => `/tasks/${ids.task}`, 'Task'),
  record(ids => `/tasks/${ids.task}/edit`, 'Edit task'),
];

// Wait until the screen shows its data: title set, loaders gone, images decoded.
export async function ready(page: Page, title: string) {
  await expect(page).toHaveTitle(`${title} · Deseo`);
  await expect(page.getByRole('status').filter({ hasText: /^(Loading|Checking)/ })).toHaveCount(0);
  await page.waitForFunction(() => [...document.images].every(image => image.complete));
}
