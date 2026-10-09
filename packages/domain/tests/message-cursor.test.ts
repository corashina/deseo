// Importance: 100. Cursor order must match durable message order.
import { compareMessageCursors, decodeMessageCursor, encodeMessageCursor, type MessageCursor } from '@deseo/domain/messages';

const message: MessageCursor = {
  id: '74ff3de3-609c-43c3-bbd3-01e064593ba9', createdAt: '2026-10-04T10:00:00.123456+00:00',
};

it('compares equivalent offsets and preserves microsecond order before UUID ties', () => {
  const later = { ...message, createdAt: '2026-10-04T12:00:00.123457+02:00', id: '00000000-0000-4000-8000-000000000000' };
  expect(compareMessageCursors(later, message)).toBeGreaterThan(0);
  expect(compareMessageCursors({ ...message, createdAt: '2026-10-04T12:00:00.123456+02:00' }, message)).toBe(0);
  expect(decodeMessageCursor(encodeMessageCursor({ createdAt: message.createdAt, id: message.id }))).toEqual({ createdAt: message.createdAt, id: message.id });
});

it('orders milliseconds before microseconds and normalizes UUID ties', () => {
  expect(compareMessageCursors({ ...message, createdAt: '2026-10-04T10:00:00.124000Z',
    id: '00000000-0000-4000-8000-000000000000' }, message)).toBeGreaterThan(0);
  expect(compareMessageCursors({ ...message, id: message.id.toUpperCase() }, message)).toBe(0);
  expect(compareMessageCursors({ ...message, id: '84ff3de3-609c-43c3-bbd3-01e064593ba9' }, message)).toBeGreaterThan(0);
  expect(compareMessageCursors(message, { ...message, id: '84ff3de3-609c-43c3-bbd3-01e064593ba9' })).toBeLessThan(0);
  expect(compareMessageCursors({ ...message, createdAt: '2026-10-04T10:00:00Z' },
    { ...message, createdAt: '2026-10-04T10:00:00.000000Z' })).toBe(0);
});
