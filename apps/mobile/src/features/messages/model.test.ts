// Importance: 95. Reordered pages and replies must not lose messages or repeat confirmed sends.
import { flattenMessagePages, reconcilePendingMessages } from './model';
import { messageBodySchema } from '@deseo/domain/messages';
import type { Message } from '@deseo/domain/messages';
import type { PendingMessage } from './types';

const message: Message = {
  id: '74ff3de3-609c-43c3-bbd3-01e064593ba9', pairId: '610bc9c7-8c81-47d1-894e-314c92071cf1',
  authorId: '741dd351-3376-4622-a9bd-ab9ced5fac8d', clientId: 'c8cf3be1-51dc-492e-85c6-4cfb634b4590',
  body: 'Hello', createdAt: '2026-10-04T10:00:00.123456+00:00', pinnedAt: null, version: 1,
};

// Importance: 95. Valid server messages must remain readable for all Unicode text.
it('matches the server body limit in Unicode code points', () => {
  expect(messageBodySchema.parse('🌷'.repeat(4000))).toBe('🌷'.repeat(4000));
  expect(messageBodySchema.safeParse('🌷'.repeat(4001)).success).toBe(false);
});

it('keeps the highest version once when pages overlap and updates arrive out of order', () => {
  const updated = { ...message, version: 3, pinnedAt: '2026-10-04T11:00:00Z' };
  const newer = { ...message, id: '84ff3de3-609c-43c3-bbd3-01e064593ba9', clientId: 'd8cf3be1-51dc-492e-85c6-4cfb634b4590' };
  const items = flattenMessagePages([
    { items: [newer, updated], nextCursor: 'older' },
    { items: [message, { ...message, version: 2 }], nextCursor: null },
  ]);
  expect(items).toEqual([newer, updated]);
});

// Importance: 100. A confirmed or deleted send must never be retried as new content.
it('removes acknowledged and deleted IDs while retaining the exact failed retry', () => {
  const pending: PendingMessage[] = [
    { clientId: message.clientId, body: message.body, state: 'failed' },
    { clientId: 'd8cf3be1-51dc-492e-85c6-4cfb634b4590', body: 'deleted', state: 'failed' },
    { clientId: 'e8cf3be1-51dc-492e-85c6-4cfb634b4590', body: ' retry me ', state: 'failed' },
  ];
  const result = reconcilePendingMessages(pending, [message], [pending[1]!.clientId]);
  expect(result).toEqual([pending[2]]);
  expect(result[0]).toBe(pending[2]);
  expect(pending).toHaveLength(3);
});
