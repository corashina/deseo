import { routeManifest } from '../../src/app/route-manifest';

export type ScreenshotScenario = { routeId: string; view: string; fixture: string; state: string; url: string };
export type ScreenshotRecord = ScreenshotScenario & {
  viewport: { width: number; height: number }; file: string; fullPageFile?: string;
  renderedUrl: string; heading: string; redirectTo?: string;
};

// Independent declarations make a new manifest view fail until its capture exists.
const declarations: [string, string[]][] = [
  ['entry-root', ['resolved-entry']],
  ['entry-welcome', ['default', 'invited', 'global-signout-failure']],
  ['entry-email', ['default', 'error']], ['entry-verify', ['default', 'invalid-code']],
  ['entry-profile', ['new-account']], ['pair-start', ['default']],
  ['pair-invite', ['default', 'generated-code', 'delivery-unconfirmed', 'already-delivered']],
  ['pair-join', ['default', 'review', 'unavailable']], ['pair-waiting', ['default', 'cancel-dialog']],
  ['pair-welcome', ['default']], ['pair-ended', ['default']], ['invite-entry', ['valid', 'invalid']],
  ['calendar', ['month', 'agenda', 'compare', 'empty', 'error']],
  ['event-new', ['default', 'validation', 'plan-date']],
  ['event-detail', ['shared', 'private', 'delete-dialog', 'unavailable', 'request-error', 'pending-deletion']],
  ['event-edit', ['default', 'conflict', 'share-dialog']], ['today', ['planning', 'empty', 'error']],
  ['memories', ['month-feed', 'empty', 'error']], ['memory-new', ['default', 'selected', 'upload-error']],
  ['memory-detail', ['author', 'partner', 'delete-dialog', 'unavailable', 'media-error', 'request-error', 'pending-deletion']],
  ['memory-edit', ['default', 'conflict']],
  ['messages', ['conversation', 'notes', 'empty', 'error', 'pending-send', 'delete-dialog', 'pending-action']],
  ['tasks', ['general', 'groceries', 'completed', 'completion-error']], ['task-new', ['default', 'validation']],
  ['task-detail', ['default', 'delete-dialog', 'unavailable', 'request-error', 'pending-deletion']],
  ['task-edit', ['default', 'conflict']], ['task-lists', ['default', 'create']],
  ['task-list-detail', ['general', 'nonempty', 'empty', 'move-dialog', 'remove-dialog']],
  ['ideas', ['saved', 'planned', 'archived', 'empty']], ['idea-new', ['default', 'validation']],
  ['idea-detail', ['saved', 'planned', 'archived', 'archive-dialog', 'unavailable', 'request-error']],
  ['idea-edit', ['default', 'conflict']], ['notifications', ['list', 'empty', 'unavailable', 'error']],
  ['settings', ['default', 'unpaired', 'ended']], ['settings-profile', ['default', 'conflict']],
  ['settings-pair', ['default', 'verification', 'end-dialog', 'ended']],
  ['settings-notifications', ['default', 'quiet-hours', 'conflict']],
  ['settings-account', ['default', 'unpaired', 'ended']], ['unknown-route', ['not-found']],
];

export const screenshotScenarios: ScreenshotScenario[] = declarations.flatMap(([routeId, views]) => {
  const route = routeManifest.find(item => item.id === routeId);
  if (!route) throw new Error('Unknown screenshot route: ' + routeId);
  return views.map(view => ({ routeId, view, fixture: route.fixture, state: view, url: route.path }));
});

export function assertScenarioCoverage() {
  const declared = new Set(screenshotScenarios.map(scene => scene.routeId + '/' + scene.view));
  const required = new Set(routeManifest.flatMap(route => route.views.map(view => route.id + '/' + view)));
  const missing = [...required].filter(key => !declared.has(key));
  const obsolete = [...declared].filter(key => !required.has(key));
  if (missing.length || obsolete.length) throw new Error('Screenshot coverage: missing ' + missing.join(', ') + '; obsolete ' + obsolete.join(', '));
}
