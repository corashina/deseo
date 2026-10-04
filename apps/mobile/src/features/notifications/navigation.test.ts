// Importance: 100. A push must not choose a URL or open another pair's content.
import { notificationIdFromPayload, notificationRoute } from './navigation';
const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
test('accepts only an opaque id in a push', () => {
  expect(notificationIdFromPayload({ notificationId: id })).toBe(id);
  expect(notificationIdFromPayload({ notificationId: id, url: '/settings/account' })).toBeNull();
  expect(notificationIdFromPayload({ notificationId: 'https://evil.test' })).toBeNull();
});
test('rejects a resolved destination outside the active pair', () => {
  expect(() => notificationRoute({ kind: 'event', id, pairId }, id)).toThrow();
  expect(notificationRoute({ kind: 'task', id, pairId }, pairId)).toEqual({ pathname: '/tasks/[taskId]', params: { taskId: id } });
});
